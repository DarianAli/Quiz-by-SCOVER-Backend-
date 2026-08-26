import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

// ─── Types ────────────────────────────────────────────────────────────────

export interface ParsedOption {
    letter: string;       // "A" | "B" | "C" | "D" | "E" | ...
    text: string;          // boleh mengandung LaTeX inline: $...$
}

export interface ParsedQuestion {
    number: number;
    question_text: string; // boleh mengandung LaTeX ($...$) dan newline
    options: ParsedOption[];
    correct_letter: string | null;
    images: string[];      // path relatif ke folder media hasil ekstraksi, mis. "media/image1.png"
    warnings: string[];    // isu yang perlu direview manual sebelum commit
}

export interface ParseResult {
    source_filename: string;
    total_questions: number;
    questions: ParsedQuestion[];
    media_dir: string; // folder absolut tempat gambar hasil ekstraksi disimpan (perlu di-serve/upload terpisah)
}

// ─── Core parser ──────────────────────────────────────────────────────────
// Strategi: convert docx -> markdown via pandoc (equation Word/OMML otomatis
// jadi LaTeX inline $...$, TIDAK di-render sebagai gambar), lalu parse teks
// markdown itu dengan regex berbasis pola soal Indonesia yang umum dipakai
// (nomor list, opsi A-E, "#Kunci:X").

const QUESTION_START_RE = /^(\d+)\.\s/gm;
const OPTION_RE = /^([A-Z])\.\s+([\s\S]*?)(?=\n[A-Z]\.\s|$)/gm;
const KUNCI_RE = /#Kunci:\s*([A-Z])/i;
const KUNCI_STRIP_RE = /[>\s]*#Kunci:\s*[A-Z]\s*/i;
const IMAGE_RE = /!\[\]\([^)]*media\/[^)]+\)/g;
const IMAGE_PATH_RE = /!\[\]\(([^)]*media\/[^)]+)\)/;

/**
 * Membersihkan artefak markdown hasil pandoc yang TIDAK boleh ikut masuk ke
 * konten (stem maupun opsi). Dijalankan sekali di seluruh `stdout`, SEBELUM
 * di-split per soal/opsi — bukan cuma di `stem` seperti sebelumnya — supaya
 * opsi jawaban dapat pembersihan yang sama persis dengan teks soal.
 *
 * Kenapa ini penting: artefak seperti "\<br/>\" atau backslash tunggal di
 * akhir baris (hard line-break Word) sering jatuh TEPAT di tepi delimiter
 * `$...$`. Kalau tidak dibersihkan dulu, backslash itu ikut kebawa ke dalam
 * span LaTeX dan bikin KaTeX gagal parse (contoh nyata: opsi berakhir
 * "...0.1255\" — backslash tanpa perintah setelahnya = invalid LaTeX).
 */
function cleanPandocArtifacts(raw: string): string {
    let text = raw;

    // Blok raw-html kosong: ```{=html}\n<!-- -->\n```
    text = text.replace(/```\{=html\}[\s\S]*?```/g, "");
    // Raw-html inline (varian pandoc yang lebih baru): `<!-- -->`{=html}
    text = text.replace(/`[^`\n]*`\{=html\}/g, "");
    // Komentar HTML polos yang lolos tanpa fence sama sekali
    text = text.replace(/<!--[\s\S]*?-->/g, "");

    // Hard line-break Word: pandoc bisa menulisnya sebagai literal "\<br/>\"
    // atau sebagai backslash tunggal di akhir baris. Ubah keduanya jadi newline
    // biasa dulu (bukan langsung dibuang) supaya paragraf tetap terpisah —
    // baru nanti tahap collapse-whitespace di bawah yang merapikannya.
    text = text.replace(/\\<br\/?>\\?/g, "\n");
    text = text.replace(/\\[ \t]*\n/g, "\n");

    // Backslash "menggantung" (tidak diikuti huruf/angka, artinya bukan
    // perintah LaTeX yang valid) yang bersebelahan langsung dengan tanda $ —
    // ini yang paling sering merusak span math karena nyangkut di tepi delimiter.
    text = text.replace(/\\(\$)/g, "$1");       // "\$" tepat sebelum penutup -> buang backslash-nya
    text = text.replace(/\\(\s*$)/gm, "$1");    // backslash tunggal di akhir baris yang tersisa

    return text;
}

/** Hitung jumlah "$" tunggal (bukan "$$") di suatu teks — dipakai untuk deteksi span math yang tidak seimbang. */
function hasUnbalancedInlineMath(text: string): boolean {
    const withoutBlock = text.replace(/\$\$[\s\S]*?\$\$/g, "");
    const count = (withoutBlock.match(/\$/g) || []).length;
    return count % 2 !== 0;
}

function splitIntoBlocks(text: string): { num: string; block: string }[] {
    // Collect ALL raw candidates for `N. ` patterns at line-start.
    // A naive approach causes false-positives when a question body contains
    // numbered sub-lists (e.g. "1. Ion positif bergerak...") — the regex
    // would mistake those as new questions, doubling the result set.
    const allMatches: { index: number; num: number }[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(QUESTION_START_RE);
    while ((m = re.exec(text)) !== null) {
        allMatches.push({ index: m.index, num: Number(m[1]) });
    }
    if (allMatches.length === 0) return [];

    // Group by question number.
    const byNum = new Map<number, { index: number; num: number }[]>();
    for (const match of allMatches) {
        if (!byNum.has(match.num)) byNum.set(match.num, []);
        byNum.get(match.num)!.push(match);
    }

    // For each sequential question number (1, 2, 3, …), pick the candidate
    // that:
    //   1. Appears at or after the end of the previously chosen question.
    //   2. Has a #Kunci: marker before the first candidate of the next number
    //      — this reliably distinguishes the real question from a numbered
    //      list embedded inside its body.
    //   3. Falls back to the first available candidate if no #Kunci is found
    //      (e.g. essay question or missing answer key).
    const starts: { index: number; num: string }[] = [];
    let expectedNum = 1;
    let searchFromIdx = 0;

    while (byNum.has(expectedNum)) {
        const candidates = byNum.get(expectedNum)!.filter(c => c.index >= searchFromIdx);
        if (candidates.length === 0) break;

        let chosen: { index: number; num: number } | null = null;

        for (const cand of candidates) {
            // Determine the end of this candidate's potential block: it ends
            // where the first candidate for (expectedNum+1) begins.
            const nextCands = (byNum.get(expectedNum + 1) ?? []).filter(c => c.index > cand.index);
            const blockEnd = nextCands.length > 0 ? nextCands[0].index : text.length;
            const block = text.slice(cand.index, blockEnd);
            if (KUNCI_RE.test(block)) {
                chosen = cand;
                break;
            }
        }

        // Fallback: no #Kunci found (essay / missing key) — take the first candidate.
        if (!chosen) chosen = candidates[0];

        starts.push({ index: chosen.index, num: String(chosen.num) });
        searchFromIdx = chosen.index + 1;
        expectedNum++;
    }

    return starts.map((s, i) => {
        const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
        return { num: s.num, block: text.slice(s.index, end) };
    });
}

function parseBlock(num: string, block: string): ParsedQuestion {
    const kunciMatch = block.match(KUNCI_RE);
    const correctLetter = kunciMatch ? kunciMatch[1].toUpperCase() : null;

    const body = block.replace(KUNCI_STRIP_RE, "");

    const options: ParsedOption[] = [];
    let firstOptPos: number | null = null;
    const optRe = new RegExp(OPTION_RE);
    let om: RegExpExecArray | null;
    while ((om = optRe.exec(body)) !== null) {
        if (firstOptPos === null) firstOptPos = om.index;
        let optText = om[2].trim().replace(/\n{2,}/g, " ").trim();
        options.push({ letter: om[1], text: optText });
    }

    let stem = (firstOptPos !== null ? body.slice(0, firstOptPos) : body)
        .replace(/^\d+\.\s*/, "")
        .trim();
    stem = stem.replace(/\n{3,}/g, "\n\n").trim();

    const images = [...block.matchAll(IMAGE_RE)]
        .map(x => x[0].match(IMAGE_PATH_RE)?.[1])
        .filter((p): p is string => Boolean(p))
        .map(p => path.basename(p.replace(/\\/g, "/"))); // normalisasi path absolut/relatif -> "image1.png"

    const warnings: string[] = [];
    if (!correctLetter) warnings.push("Kunci jawaban tidak terdeteksi — perlu diisi manual.");
    if (options.length < 2) warnings.push(`Opsi jawaban tidak lengkap (ditemukan ${options.length}).`);
    if (correctLetter && !options.some(o => o.letter === correctLetter)) {
        warnings.push("Kunci jawaban tidak cocok dengan salah satu opsi yang terdeteksi.");
    }
    if (!stem) warnings.push("Teks soal kosong atau gagal terbaca.");

    // Tandai soal/opsi dengan notasi matematika yang tidak seimbang sebagai
    // "perlu direview" alih-alih membiarkannya gagal senyap di KaTeX saat
    // tentor sampai ke halaman preview siswa.
    if (hasUnbalancedInlineMath(stem)) {
        warnings.push("Notasi matematika pada teks soal kemungkinan tidak seimbang ($) — cek equation editor.");
    }
    options.forEach((o) => {
        if (hasUnbalancedInlineMath(o.text)) {
            warnings.push(`Notasi matematika pada opsi ${o.letter} kemungkinan tidak seimbang ($) — cek equation editor.`);
        }
    });

    return {
        number: Number(num),
        question_text: stem,
        options,
        correct_letter: correctLetter,
        images,
        warnings,
    };
}

/**
 * Parse satu file .docx menjadi array soal terstruktur.
 * @param filePath path absolut ke file .docx (hasil upload multer)
 * @param originalName nama file asli (untuk pelaporan)
 */
export async function parseWordQuestionFile(filePath: string, originalName: string): Promise<ParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    let docxPath = filePath;

    // .doc lama perlu dikonversi dulu ke .docx via LibreOffice sebelum pandoc bisa baca
    if (ext === ".doc") {
        const outDir = path.dirname(filePath);
        await execFileAsync("soffice", ["--headless", "--convert-to", "docx", "--outdir", outDir, filePath]);
        docxPath = filePath.replace(/\.doc$/i, ".docx");
    }

    const mediaDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-import-media-"));

    // Use markdown with pipe_tables forced ON by disabling the three competing
    // table formats (multiline, simple, grid). This guarantees that every Word
    // table becomes a clean, parseable | pipe | table | line, instead of the
    // spaced-column "simple" or grid formats that our frontend cannot handle.
    const { stdout } = await execFileAsync("pandoc", [
        "-f", "docx",
        "-t", "markdown-multiline_tables-simple_tables-grid_tables",
        `--extract-media=${mediaDir}`,
        docxPath,
    ], { maxBuffer: 1024 * 1024 * 20 });

    // Bersihkan SEKALI di seluruh output, sebelum di-split per soal/opsi —
    // supaya stem dan setiap opsi mendapat perlakuan yang sama persis.
    const cleanedText = cleanPandocArtifacts(stdout);
    const blocks = splitIntoBlocks(cleanedText);
    const questions = blocks.map(b => parseBlock(b.num, b.block));

    if (process.env.NODE_ENV !== "production") {
        // Log the first question for quick pipeline verification
        const debugTarget = questions[0];
        if (debugTarget) {
            console.log(`=== DEBUG soal #${debugTarget.number} (of ${questions.length}) ===`);
            console.log(JSON.stringify(debugTarget, null, 2));
        }
    }

    return {
        source_filename: originalName,
        total_questions: questions.length,
        questions,
        media_dir: mediaDir,
    };
}