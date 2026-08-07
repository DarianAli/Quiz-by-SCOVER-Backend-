import type { ParsedQuestion } from "./WordQuestionParser.service.js";

// AI assist (option)
/**
 * Fungsi ini menambahkan estimasi difficulty/topic dan flag 
 * "equation mencurigakan" ke tiap soal hasil parse, memakai Claude API.
 * 
 * SENGAJA best-effort & non-blocking:
 * -kalau ANTHROPIC_API_KEY tidak di-set -> langsung return data asli tanpa
 * error, supaya fitur import tetap jalan AI (parser deterministik di WordQuestionParser.service.ts sudah
 * cukup untuk struktur soal).
 * - Kalau API call gagal/timeout -> soal tetap dikembalikan apa adanya,
 * cuma tanpa enrichment, JANGAN sampai gagal parse gara-gara AI down.
 */

export interface EnrichmentQuestion extends ParsedQuestion {
    ai_suggested_difficulty?: "EASY" | "MEDIUM" | "HARD";
    ai_suggested_topic?: string;
    ai_equation_flag?: boolean;
}

const CLASSIFY_SYSTEM_PROMT = `Kuma membantu tentor mengklasifikasikan soal ujian.
Untuk tiap soal yang diberikan, kembalikan HANYA JSON array (tanpa teks lain,
tanpa markdown code fence) dengan struktur:
[{"number": <nomor soal>, "difficulty": "EASY|MEDIUM|HARD", "topic": <topic singkat>", "equation_flag": <true jika 
ada indikasi typo OCR pada notasi matematka, mis. huruf O dipakai sebagai angka 0, huruf I dipakai sebagai angka 1, atau
tanda kurung/operator yang tidak seimbang}]
Urutan output harus mengikuti urutan input. Jangan tambahkan penjelasan apapun di luar JSON.`;

async function callClaudeClassifier(questions: ParsedQuestion[]): Promise<Map<number, { difficulty: string; topic: string; equation_flag: boolean }>> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const resultMap = new Map<number, { difficulty: string; topic: string; equation_flag: boolean }>();
    if (!apiKey) return resultMap; //AI assist di-skip, bukan error

    // Batasi ke 20 soal per call biar tidak melebihi output token / supaya lebih
    // reliable; kalau butuh lebih banyak, panggil fungsi ini per-chunk dari caller.
    const batch = questions.slice(0, 20).map(q => ({
        number: q.number,
        question_text: q.question_text,
        options: q.options.map(o => `${o.letter}. ${o.text}`),
    }));
    
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application.json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 2000,
                system: CLASSIFY_SYSTEM_PROMT,
                message: [{ role: "user", content: JSON.stringify(batch) }],
            }),
        });

        if (!response.ok) {
            console.error("[AiQuestionAssist] Claude API error", response.status, await response.text());
            return resultMap;
        }

        const data = await response.json();
        const textBlock = data.content?.find((c: any) => c.type === "text");
        if (!textBlock?.text) return resultMap;

        const cleaned = textBlock.text.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned) as {
            number: number; diffculty: string; topic: string; equation_flag: boolean;
        }[];

        for (const item of parsed) {
            resultMap.set(item.number, {
                difficulty: item.diffculty,
                topic: item.topic,
                equation_flag: item.equation_flag,
            });
        }
    } catch (err) {
        console.error("[AiQuestionAssist] classification failed, continuing without AI enrichment", err);
    }

    return resultMap;
}

export async function classifyQuestionsWithAI(questions: ParsedQuestion[]): Promise<EnrichmentQuestion[]> {
    if (questions.length === 0) return [];

    const classifications = await callClaudeClassifier(questions);

    return questions.map(q => {
        const c = classifications.get(q.number);
        if (!c) return { ...q };
        return {
            ...q,
            ai_suggested_difficulty: (["EASY", "MEDIUM", "HARD"].includes(c.difficulty) ? c.difficulty : undefined) as any,
            ai_suggested_topic: c.topic,
            ai_suggested_flag: Boolean(c.equation_flag),
        };
    });
}
