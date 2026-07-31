import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { parseExcelQuestions, parseWordQuestions, ParsedQuestion } from "../services/quiz-import.service.js";
import { ok, badRequest, notFound, serverError } from "../utils/response.util.js";
import prisma from "../config/prisma.js";

// ─── Helper: convert ParsedQuestion → DB rows ────────────────────────────────

function buildOptions(q: ParsedQuestion, questionId: number) {
    const optionMap: Record<string, string | undefined> = {
        A: q.option_a,
        B: q.option_b,
        C: q.option_c,
        D: q.option_d,
        E: q.option_e,
    };

    return Object.entries(optionMap)
        .filter(([, text]) => text)
        .map(([letter, text], idx) => ({
            uuid:         uuidv4(),
            option_text:  text!,
            option_image: "",
            is_correct:   letter === q.correct_answer,
            order_index:  idx,
            questionsId:  questionId,
        }));
}

// ─── POST /import/questions/preview ──────────────────────────────────────────
// Parse file → return preview (tidak simpan ke DB)

export const previewImport = async (req: Request, res: Response): Promise<void> => {
    try {
        const file = req.file;
        if (!file) { badRequest(res, "File tidak ditemukan. Upload file .xlsx atau .docx."); return; }

        const mime = file.mimetype;
        const ext  = file.originalname.split(".").pop()?.toLowerCase();

        let parseResult;

        if (mime.includes("spreadsheet") || mime.includes("excel") || ext === "xlsx" || ext === "xls") {
            parseResult = await parseExcelQuestions(file.buffer);
        } else if (
            mime.includes("wordprocessingml") ||
            mime.includes("msword")           ||
            ext === "docx"                    ||
            ext === "doc"
        ) {
            parseResult = await parseWordQuestions(file.buffer);
        } else {
            badRequest(res, "Format file tidak didukung. Gunakan .xlsx atau .docx.");
            return;
        }

        ok(res, "Preview berhasil diparse.", {
            total_parsed:  parseResult.questions.length,
            total_errors:  parseResult.errors.length,
            questions:     parseResult.questions,
            errors:        parseResult.errors,
        });
    } catch (err) {
        console.error("[previewImport]", err);
        serverError(res);
    }
};

// ─── POST /import/questions/confirm ──────────────────────────────────────────
// Simpan data preview ke database (body berisi parsed questions + quizId)

export const confirmImport = async (req: Request, res: Response): Promise<void> => {
    try {
        const { quizId, questions } = req.body as {
            quizId:    number;
            questions: ParsedQuestion[];
        };

        if (!quizId || isNaN(Number(quizId))) {
            badRequest(res, "quizId tidak valid.");
            return;
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            badRequest(res, "Tidak ada soal untuk disimpan.");
            return;
        }

        const quiz = await prisma.quiz.findFirst({ where: { id: Number(quizId) } });
        if (!quiz) { notFound(res, "Quiz tidak ditemukan."); return; }

        // Get current max order_index
        const lastQ = await prisma.questions.findFirst({
            where:   { quizId: quiz.id },
            orderBy: { order_index: "desc" },
            select:  { order_index: true },
        });
        let orderStart = (lastQ?.order_index ?? -1) + 1;

        // Bulk insert menggunakan transaction
        const created: number[] = [];

        await prisma.$transaction(async (tx) => {
            for (const q of questions) {
                const newQuestion = await tx.questions.create({
                    data: {
                        uuid:          uuidv4(),
                        question_text: q.question_text,
                        question_image: "",
                        discussion:    q.discussion,
                        difficulty:    q.difficulty,
                        poin:          q.poin,
                        order_index:   orderStart++,
                        quizId:        quiz.id,
                    },
                });

                // Insert options
                const optionData = buildOptions(q, newQuestion.id);
                await tx.options.createMany({ data: optionData });

                created.push(newQuestion.id);
            }
        });

        ok(res, `Berhasil menyimpan ${created.length} soal ke quiz "${quiz.quiz_title}".`, {
            quiz_uuid:     quiz.uuid,
            quiz_title:    quiz.quiz_title,
            created_count: created.length,
        });
    } catch (err) {
        console.error("[confirmImport]", err);
        serverError(res);
    }
};

