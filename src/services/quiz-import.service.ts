import ExcelJS from "exceljs";
import { toLatex } from "../utils/latex.util";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedQuestion {
    question_text:  string;
    option_a:       string;
    option_b:       string;
    option_c:       string;
    option_d:       string;
    option_e?:      string;
    correct_answer: "A" | "B" | "C" | "D" | "E";
    discussion:     string;
    difficulty:     "EASY" | "MEDIUM" | "HARD";
    poin:           number;
}

export interface ParseResult {
    questions: ParsedQuestion[];
    errors:    { row: number; message: string }[];
}

const VALID_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const VALID_ANSWERS      = ["A", "B", "C", "D", "E"] as const;

// ─── Excel Parser ─────────────────────────────────────────────────────────────

const cellToStr = (val: ExcelJS.CellValue): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "object" && "richText" in val)
        return (val as ExcelJS.CellRichTextValue).richText.map(r => r.text).join("").trim();
    if (typeof val === "object" && "result" in val)
        return String((val as ExcelJS.CellFormulaValue).result ?? "").trim();
    if (val instanceof Date) return val.toISOString();
    return String(val).trim();
};

export async function parseExcelQuestions(buffer: any): Promise<ParseResult> {
    const workbook  = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("File tidak memiliki sheet.");

    const questions: ParsedQuestion[] = [];
    const errors: { row: number; message: string }[] = [];

    let headers: string[] = [];

    sheet.eachRow((row, rowNum) => {
        const values = (row.values as ExcelJS.CellValue[]).slice(1);

        if (rowNum === 1) {
            headers = values.map(v => cellToStr(v).toLowerCase().replace(/\s+/g, "_"));
            return;
        }

        if (values.every(v => !v)) return; // skip empty rows

        const get = (key: string): string =>
            cellToStr(values[headers.indexOf(key)] ?? null);

        const question_text  = toLatex(get("question_text")  || get("soal")            || get("pertanyaan"));
        const option_a       = toLatex(get("option_a")       || get("pilihan_a")       || get("a"));
        const option_b       = toLatex(get("option_b")       || get("pilihan_b")       || get("b"));
        const option_c       = toLatex(get("option_c")       || get("pilihan_c")       || get("c"));
        const option_d       = toLatex(get("option_d")       || get("pilihan_d")       || get("d"));
        const option_e       = toLatex(get("option_e")       || get("pilihan_e")       || get("e"));
        const correct_raw    = (get("correct_answer") || get("jawaban") || get("kunci")).toUpperCase().trim();
        const discussion     = toLatex(get("discussion") || get("pembahasan") || get("penjelasan"));
        const difficulty_raw = (get("difficulty") || get("tingkat_kesulitan") || "EASY").toUpperCase().trim();
        const poin_raw       = get("poin") || get("point") || get("nilai") || "10";

        const rowErrors: string[] = [];

        if (!question_text)  rowErrors.push("question_text kosong");
        if (!option_a)       rowErrors.push("option_a kosong");
        if (!option_b)       rowErrors.push("option_b kosong");
        if (!option_c)       rowErrors.push("option_c kosong");
        if (!option_d)       rowErrors.push("option_d kosong");
        if (!VALID_ANSWERS.includes(correct_raw as "A"))
            rowErrors.push(`correct_answer "${correct_raw}" tidak valid (A/B/C/D/E)`);
        if (!VALID_DIFFICULTIES.includes(difficulty_raw as "EASY"))
            rowErrors.push(`difficulty "${difficulty_raw}" tidak valid (EASY/MEDIUM/HARD)`);

        if (rowErrors.length > 0) {
            errors.push({ row: rowNum, message: rowErrors.join("; ") });
            return;
        }

        questions.push({
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            option_e:       option_e || undefined,
            correct_answer: correct_raw as "A" | "B" | "C" | "D" | "E",
            discussion,
            difficulty:     difficulty_raw as "EASY" | "MEDIUM" | "HARD",
            poin:           Number(poin_raw) || 10,
        });
    });

    return { questions, errors };
}

// ─── Word (.docx) Parser ──────────────────────────────────────────────────────
// Format yang didukung:
//
//   1. Teks soal
//   A. Pilihan A
//   B. Pilihan B
//   C. Pilihan C
//   D. Pilihan D
//   E. Pilihan E (opsional)
//   Jawaban: B
//   Pembahasan: ...
//   Tingkat: EASY/MEDIUM/HARD   (opsional, default EASY)
//   Poin: 10                    (opsional, default 10)
//
// Soal dipisahkan oleh baris kosong atau nomor soal berikutnya.

export async function parseWordQuestions(buffer: any): Promise<ParseResult> {
    // Lazy import mammoth
    const mammoth = await import("mammoth");
    const result  = await mammoth.extractRawText({ buffer });
    const rawText = result.value;

    const lines   = rawText.split(/\r?\n/).map(l => l.trim());
    const questions: ParsedQuestion[] = [];
    const errors: { row: number; message: string }[] = [];

    // Split into question blocks by detecting numbered lines "1." "2." etc.
    const blocks: string[][] = [];
    let current: string[]    = [];

    for (const line of lines) {
        if (/^\d+\./.test(line) && current.length > 0) {
            blocks.push(current);
            current = [line];
        } else {
            current.push(line);
        }
    }
    if (current.length > 0) blocks.push(current);

    blocks.forEach((block, blockIdx) => {
        const blockNum = blockIdx + 1;
        const nonEmpty = block.filter(l => l.length > 0);

        // Remove leading number "1. " from first line
        const firstLine  = nonEmpty[0]?.replace(/^\d+\.\s*/, "") ?? "";
        const remaining  = nonEmpty.slice(1);

        let question_text  = "";
        let option_a = "", option_b = "", option_c = "", option_d = "", option_e = "";
        let correct_answer = "";
        let discussion     = "";
        let difficulty     = "EASY";
        let poin           = 10;

        // First line = question text (may span multiple lines before first A.)
        const firstOptionIdx = remaining.findIndex(l => /^[A-E][\.\)]\s/.test(l));
        const questionLines  = firstOptionIdx >= 0
            ? [firstLine, ...remaining.slice(0, firstOptionIdx)]
            : [firstLine];
        question_text = toLatex(questionLines.join(" ").trim());

        // Parse options and metadata
        for (const line of remaining) {
            const optMatch = line.match(/^([A-E])[\.\)]\s+(.+)/);
            if (optMatch) {
                const letter = optMatch[1].toUpperCase();
                const text   = toLatex(optMatch[2].trim());
                if      (letter === "A") option_a = text;
                else if (letter === "B") option_b = text;
                else if (letter === "C") option_c = text;
                else if (letter === "D") option_d = text;
                else if (letter === "E") option_e = text;
                continue;
            }

            const jawabanMatch = line.match(/^(?:jawaban|kunci|answer)\s*:\s*([A-E])/i);
            if (jawabanMatch) { correct_answer = jawabanMatch[1].toUpperCase(); continue; }

            const pembahasanMatch = line.match(/^(?:pembahasan|penjelasan|discussion)\s*:\s*(.+)/i);
            if (pembahasanMatch) { discussion = toLatex(pembahasanMatch[1].trim()); continue; }

            const tingkatMatch = line.match(/^(?:tingkat|difficulty|kesulitan)\s*:\s*(\w+)/i);
            if (tingkatMatch) {
                const d = tingkatMatch[1].toUpperCase();
                if (VALID_DIFFICULTIES.includes(d as "EASY")) difficulty = d;
                continue;
            }

            const poinMatch = line.match(/^(?:poin|point|nilai|skor)\s*:\s*(\d+)/i);
            if (poinMatch) { poin = Number(poinMatch[1]) || 10; continue; }
        }

        const rowErrors: string[] = [];
        if (!question_text)                                       rowErrors.push("soal kosong");
        if (!option_a)                                            rowErrors.push("pilihan A kosong");
        if (!option_b)                                            rowErrors.push("pilihan B kosong");
        if (!option_c)                                            rowErrors.push("pilihan C kosong");
        if (!option_d)                                            rowErrors.push("pilihan D kosong");
        if (!VALID_ANSWERS.includes(correct_answer as "A"))       rowErrors.push("jawaban tidak valid");

        if (rowErrors.length > 0) {
            errors.push({ row: blockNum, message: rowErrors.join("; ") });
            return;
        }

        questions.push({
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            option_e: option_e || undefined,
            correct_answer: correct_answer as "A" | "B" | "C" | "D" | "E",
            discussion,
            difficulty: difficulty as "EASY" | "MEDIUM" | "HARD",
            poin,
        });
    });

    return { questions, errors };
}

