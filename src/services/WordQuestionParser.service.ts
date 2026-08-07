import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs"
import path from "node:path";
import os from "node:os"

const execFileAsync = promisify(execFile)

// Types

export interface ParsedOption {
    letter: string;
    text: string;
}

export interface ParsedQuestion {
    number: number;
    question_text: string;
    options: ParsedOption[];
    correct_letter: string | null;
    images: string[];
    warnings: string[];
}

export interface ParseResult {
    source_filename: string;
    total_questions: number;
    questions: ParsedQuestion[];
    media_dir: string;
}

// Core parser
/** Strategi: convert docs -> markdown via pandoc (equation Word/OMML otomatis 
 * jadi LaTex inline $...$, TIDAK di-render sebagai gambar), lalu parse teks
 * markdown itu dengan regex sebagai pola soal Indonesia yang umum dipakai
 * (nomor list, opsi A-E, "#Kunci:X"). Regex ini sudah divalidasi terhadap
 * sample dokumen asli (20 soal, 0 warning, gambar grup soal 8-10 terdeteksi)
 */

const QUESTION_START_RE = /^(\d+)\.\s/gm;
const OPTION_RE = /^([A-Z])\.\s+([\s\S]*?)(?=\n[A-Z]\.\s|$)/gm;
const KUNCI_RE = /#Kunci:\s*([A-Z])/i;
const KUNCI_STRIP_RE = /[>\s]*#Kunci:\s*[A-Z]\s*/i;
const IMAGE_RE = /!\[\]\([^)]*media\/[^)]+\)/g;
const IMAGE_PATH_RE = /!\[\]\(([^)]*media\/[^)]+)\)/;

function splitIntoBlocks(text: string): { num: string; block: string }[] {
    const starts: { index: number; num: string }[] = []
    let m: RegExpExecArray | null;
    const re = new RegExp(QUESTION_START_RE);
    while ((m = re.exec(text)) !== null) {
        starts.push({ index: m.index, num: m[1] });
    }
    return starts.map((s, i) => {
        const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
        return { num: s.num, block: text.slice(s.index, end) };
    });
}

function parseBlock(num: string, block: string): ParsedQuestion {
    const kunciMatch = block.match(KUNCI_RE)
    const correctLetter = kunciMatch ? kunciMatch[1].toUpperCase() : null;

    const body = block.replace(KUNCI_STRIP_RE, "")

    const options: ParsedOption[] = []
    let firstOptPos: number | null = null;
    const optRe = new RegExp(OPTION_RE);
    let om: RegExpExecArray | null;
    while ((om = optRe.exec(body)) !== null) {
        if (firstOptPos === null) firstOptPos = om.index;
        const optText = om[2].trim().replace(/\n{2,}/g, " ").trim();
        options.push({ letter: om[1], text: optText })
    }

    let stem = (firstOptPos !== null ? body.slice(0, firstOptPos) : body)
        .replace(/^\d+\.\s*/, "")
        .trim();
    stem = stem.replace(/\<br\/\\>/g,"\n");
    stem = stem.replace(/```\{=html\}[\s\S]*?```/g, "");
    stem = stem.replace(/\n{3,}/g, "\n\n").trim();

    const images = [...block.matchAll(IMAGE_RE)]
        .map(x => x[0].match(IMAGE_PATH_RE)?.[1])
        .filter((p): p is string => Boolean(p))
        .map(p => p.replace(/^\.\//, "")); // normalisasi "./media/x.png" -> "media/x.png"

    const warnings: string[] = [];
    if (!correctLetter) warnings.push("Kunci jawaban tidak terdeteksi - perlu diisi manual.");
    if (options.length < 2) warnings.push(`Opsi jawaban tidak lengkap (ditemukan ${options.length}).`)
    if (correctLetter && !options.some(o => o.letter === correctLetter)) {
        warnings.push("Kunci jawaban tidak cocok dengan salah satu opsi yang terdeteksi.");
    }
    if (!stem) warnings.push("Teks soal kosong atau gagal terbaca.");

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

    const { stdout } = await execFileAsync("pandoc", [
        "-t", "markdown",
        `--extract-media=${mediaDir}`,
        docxPath,
    ], { maxBuffer: 1024 * 1024 * 20 });

    const cleanedText = stdout.replace(/```\{=html\}\n<!-- -->\n```\n?/g, "");
    const blocks = splitIntoBlocks(cleanedText);
    const questions = blocks.map(b => parseBlock(b.num, b.block));

    return {
        source_filename: originalName,
        total_questions: questions.length,
        questions,
        media_dir: mediaDir
    };
}