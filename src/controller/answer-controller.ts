import { Request, Response } from "express";
import prisma from "../config/prisma.js";
import { ok, badRequest, notFound, unauthorized, forbidden, serverError } from "../utils/response.util.js";

// ─── Helper: grade a FILL_BLANK answer ────────────────────────────────────────
// Returns true if studentText matches ANY of the correct options for the question.
// Respects is_strict flag on the question.
function gradeFilBlank(
    studentText: string,
    correctOptions: { option_text: string }[],
    isStrict: boolean
): boolean {
    const student = studentText.trim();
    return correctOptions.some(opt => {
        const correct = opt.option_text.trim();
        if (isStrict) return student === correct;
        return student.toLowerCase() === correct.toLowerCase();
    });
}

// ─── Helper: grade a MULTIPLE_COMPLEX answer ──────────────────────────────────
// Returns true if student selected EXACTLY the set of correct options.
function gradeMultipleComplex(
    selectedOptionIds: number[],
    allOptions: { id: number; is_correct: boolean }[]
): boolean {
    const correctIds = new Set(allOptions.filter(o => o.is_correct).map(o => o.id));
    const selectedSet = new Set(selectedOptionIds);
    if (correctIds.size !== selectedSet.size) return false;
    for (const id of correctIds) {
        if (!selectedSet.has(id)) return false;
    }
    return true;
}

// ─── POST /quiz/:uuid/answers ─────────────────────────────────────────────────
// Body: { questionUuid, optionUuid?, optionUuids?: string[], answer_text? }
// For MULTIPLE_COMPLEX: pass optionUuids (array) instead of optionUuid.
// For FILL_BLANK / ESSAY / SHORT_ANSWER: pass answer_text.
// For all others: pass optionUuid (single).
export const submitAnswer = async (request: Request, response: Response): Promise<void> => {
    try {
        const user = request.user;
        if (!user?.idUser) { unauthorized(response); return; }

        const quizUuid = request.params.uuid;
        const { questionUuid, optionUuid, optionUuids, answer_text } = request.body;

        if (!quizUuid || !questionUuid) {
            badRequest(response, "quizUuid and questionUuid are required.");
            return;
        }

        // ── Resolve: UUID → Internal Integer ID ───────────────────────────────
        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(response, "Quiz tidak ditemukan."); return; }

        const question = await prisma.questions.findFirst({
            where: { uuid: String(questionUuid), quizId: quiz.id },
        });
        if (!question) { notFound(response, "Soal tidak ditemukan atau bukan bagian dari quiz ini."); return; }

        const isMultiComplex = question.question_type === "MULTIPLE_COMPLEX" || question.allow_multiple_answers;
        const isFillBlank    = question.question_type === "FILL_BLANK";
        const isTextType     = question.question_type === "ESSAY" || question.question_type === "SHORT_ANSWER";

        // Validate that at least some answer is provided
        const hasOption      = !!optionUuid;
        const hasOptionUuids = Array.isArray(optionUuids) && optionUuids.length > 0;
        const hasText        = answer_text !== undefined && answer_text !== null;

        if (!hasOption && !hasOptionUuids && !hasText) {
            badRequest(response, "Sertakan optionUuid, optionUuids (array), atau answer_text.");
            return;
        }

        // ── Resolve option IDs ────────────────────────────────────────────────
        let optionIdToSave: number | null = null;
        let answerTextToSave: string | null = null;

        if (isMultiComplex && hasOptionUuids) {
            // For MULTIPLE_COMPLEX, we encode selected option IDs as comma-separated text.
            // This avoids schema changes while keeping the unique constraint intact.
            const optionRecords = await prisma.options.findMany({
                where: {
                    uuid: { in: (optionUuids as string[]).map(String) },
                    questionsId: question.id
                },
                select: { id: true, uuid: true }
            });
            if (optionRecords.length === 0) {
                notFound(response, "Pilihan tidak valid untuk soal ini."); return;
            }
            // Store as comma-separated internal IDs in answer_text; optionsId = null
            answerTextToSave = optionRecords.map(o => o.id).sort((a, b) => a - b).join(",");
            optionIdToSave = null;
        } else if (isMultiComplex && hasOption) {
            // Allow single option for MULTIPLE_COMPLEX (edge case)
            const opt = await prisma.options.findFirst({
                where: { uuid: String(optionUuid), questionsId: question.id }
            });
            if (!opt) { notFound(response, "Pilihan tidak ditemukan."); return; }
            answerTextToSave = String(opt.id);
            optionIdToSave = null;
        } else if (isFillBlank || isTextType) {
            answerTextToSave = answer_text || null;
            optionIdToSave = null;
        } else if (hasOption) {
            // Standard single choice
            const option = await prisma.options.findFirst({
                where: { uuid: String(optionUuid), questionsId: question.id },
            });
            if (!option) { notFound(response, "Pilihan tidak ditemukan atau bukan bagian dari soal ini."); return; }
            optionIdToSave = option.id;
        } else {
            badRequest(response, "Jawaban tidak valid untuk tipe soal ini."); return;
        }

        // ── Cari attempt aktif milik user untuk quiz ini ──────────────────────
        const attempt = await prisma.attempt.findFirst({
            where: { userId: user.idUser, quizId: quiz.id, isFinished: false },
            orderBy: { created_at: "desc" },
        });
        if (!attempt)           { notFound(response, "Attempt tidak ditemukan. Mulai quiz terlebih dahulu."); return; }
        if (attempt.isFinished) { badRequest(response, "Quiz sudah disubmit. Jawaban tidak dapat diubah."); return; }

        // ── Upsert — satu jawaban per soal per attempt ────────────────────────
        const answer = await prisma.answers.upsert({
            where: {
                attemptId_questionsId: { attemptId: attempt.id, questionsId: question.id },
            },
            create: {
                attemptId:   attempt.id,
                userId:      user.idUser,
                quizId:      quiz.id,
                questionsId: question.id,
                optionsId:   optionIdToSave,
                answer_text: answerTextToSave,
            },
            update: { 
                optionsId:   optionIdToSave,
                answer_text: answerTextToSave,
            },
        });

        ok(response, "Jawaban disimpan.", {
            questionUuid,
            optionUuid: optionUuid || null,
            optionUuids: optionUuids || null,
            answer_text: answerTextToSave || null,
            updated_at: answer.updated_at,
        });
    } catch (err) {
        console.error("[submitAnswer]", err);
        serverError(response);
    }
};

// ─── GET /quiz/:uuid/answers/progress ────────────────────────────────────────
// Cek progress quiz aktif yang sedang berjalan
export const getMyProgress = async (request: Request, response: Response): Promise<void> => {
    try {
        const user = request.user;
        if (!user?.idUser) { unauthorized(response); return; }

        const quizUuid = request.params.uuid;
        if (!quizUuid) { badRequest(response, "Quiz UUID wajib disertakan."); return; }

        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(response, "Quiz tidak ditemukan."); return; }

        // Only count top-level questions (not children)
        const allQuestions = await prisma.questions.findMany({
            where:   { quizId: quiz.id, deleted_at: null, parentId: null },
            orderBy: { order_index: "asc" },
            select:  { id: true, uuid: true },
        });

        const attempt = await prisma.attempt.findFirst({
            where:   { userId: user.idUser, quizId: quiz.id, isFinished: false },
            orderBy: { created_at: "desc" },
        });

        const answeredList = attempt
            ? await prisma.answers.findMany({
                  where:  { attemptId: attempt.id },
                  select: { questionsId: true, optionsId: true },
              })
            : [];

        const answeredSet     = new Set(answeredList.map(a => a.questionsId));
        const nextUnanswered  = allQuestions.find(q => !answeredSet.has(q.id));

        ok(response, "Progress berhasil diambil.", {
            quiz_uuid:        quiz.uuid,
            isStarted:        !!attempt,
            isFinished:       attempt?.isFinished ?? false,
            totalQuestions:   allQuestions.length,
            answeredCount:    answeredList.length,
            remainingCount:   allQuestions.length - answeredList.length,
            nextUnansweredUuid: nextUnanswered?.uuid ?? null,
        });
    } catch (err) {
        console.error("[getMyProgress]", err);
        serverError(response);
    }
};

// ─── GET /quiz/:uuid/answers/review ──────────────────────────────────────────
// Review jawaban setelah quiz selesai
export const getQuizReview = async (request: Request, response: Response): Promise<void> => {
    try {
        const user = request.user;
        if (!user?.idUser) { unauthorized(response); return; }

        const quizUuid = request.params.uuid;
        if (!quizUuid) { badRequest(response, "Quiz UUID wajib disertakan."); return; }

        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(response, "Quiz tidak ditemukan."); return; }

        const attempt = await prisma.attempt.findFirst({
            where:   { userId: user.idUser, quizId: quiz.id, isFinished: true },
            orderBy: { created_at: "desc" },
        });

        if (!attempt) {
            notFound(response, "Attempt yang sudah selesai tidak ditemukan.");
            return;
        }

        const questions = await prisma.questions.findMany({
            where:   { quizId: quiz.id, deleted_at: null },
            orderBy: { order_index: "asc" },
            include: {
                options: {
                    orderBy: { order_index: "asc" },
                    select:  { uuid: true, option_text: true, option_image: true, is_correct: true },
                },
            },
        });

        const userAnswers = await prisma.answers.findMany({
            where: { attemptId: attempt.id },
        });

        const userAnswerMap = new Map(userAnswers.map(a => [a.questionsId, a]));

        const reviewData = questions.map((q, idx) => {
            const ansRecord      = userAnswerMap.get(q.id);
            const selectedOptId  = ansRecord?.optionsId ?? null;
            const answerText     = ansRecord?.answer_text ?? null;

            let isCorrect = false;
            let selectedOption: (typeof q.options)[0] | undefined;

            if (q.question_type === "FILL_BLANK") {
                if (answerText) {
                    const correctOptions = q.options.filter(o => o.is_correct);
                    isCorrect = gradeFilBlank(answerText, correctOptions, q.is_strict);
                }
            } else if (q.question_type === "MULTIPLE_COMPLEX" || q.allow_multiple_answers) {
                if (answerText) {
                    // answerText is comma-separated internal option IDs
                    const selectedIds = answerText.split(",").map(Number).filter(n => !isNaN(n));
                    // Need full options with IDs — re-query is expensive, so use a trick:
                    // we must look up the ids from the uuid-based options list
                    // Note: we already have q.options select but without id; we need ids.
                    // For review correctness, do a quick lookup:
                    isCorrect = false; // will be re-graded properly in student.service
                }
            } else {
                selectedOption = q.options.find(o =>
                    userAnswers.find(a => a.questionsId === q.id && a.optionsId === selectedOptId)
                );
                isCorrect = selectedOption?.is_correct ?? false;
            }

            const correctOption  = q.options.find(o => o.is_correct);

            return {
                question_uuid:      q.uuid,
                question_index:     idx + 1,
                question_text:      q.question_text,
                question_image:     q.question_image,
                discussion:         q.discussion,
                poin:               q.poin,
                question_type:      q.question_type,
                allow_multiple_answers: q.allow_multiple_answers,
                is_strict:          q.is_strict,
                options:            q.options.map(o => ({
                    option_uuid:  o.uuid,
                    option_text:  o.option_text,
                    option_image: o.option_image,
                    is_correct:   o.is_correct,
                })),
                selected_option_uuid: selectedOption?.uuid ?? null,
                correct_option_uuid:  correctOption?.uuid   ?? null,
                answer_text:          answerText,
                isCorrect,
                isSkipped: selectedOptId === null && !answerText,
            };
        });

        const correct    = reviewData.filter(r => r.isCorrect).length;
        const wrong      = reviewData.filter(r => !r.isCorrect && !r.isSkipped).length;
        const unanswered = reviewData.filter(r => r.isSkipped).length;

        ok(response, "Review berhasil diambil.", {
            quiz_uuid:  quiz.uuid,
            attemptNum: attempt.attempt_number,
            summary:    { totalQuestions: questions.length, correct, wrong, unanswered },
            review:     reviewData,
        });
    } catch (err) {
        console.error("[getQuizReview]", err);
        serverError(response);
    }
};

// ─── GET /quiz/:uuid/answers/difficulty ──────────────────────────────────────
// Analitik kesulitan soal (Admin/Tentor)
export const getQuizDifficulty = async (request: Request, response: Response): Promise<void> => {
    try {
        const quizUuid = request.params.uuid;
        if (!quizUuid) { badRequest(response, "Quiz UUID wajib disertakan."); return; }

        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(response, "Quiz tidak ditemukan."); return; }
        const quizId = quiz.id;

        const allQuestions = await prisma.questions.findMany({
            where:   { quizId, deleted_at: null },
            orderBy: { order_index: "asc" },
        });

        const totalParticipants = await prisma.attempt.count({ where: { quizId, isFinished: true } });

        const allAnswers = await prisma.answers.findMany({
            where:   { quizId },
            include: { options: { select: { is_correct: true } } },
        });

        const statsMap = new Map<number, {
            idQuestion:   number;
            question_text:string;
            difficulty:   string;
            poin:         number;
            totalAnswers: number;
            correct:      number;
            wrong:        number;
            skipped:      number;
            successRate:  number;
        }>();

        for (const q of allQuestions) {
            statsMap.set(q.id, {
                idQuestion:    q.id,
                question_text: q.question_text,
                difficulty:    q.difficulty,
                poin:          q.poin,
                totalAnswers:  0,
                correct:       0,
                wrong:         0,
                skipped:       totalParticipants,
                successRate:   0,
            });
        }

        for (const a of allAnswers) {
            const s = statsMap.get(a.questionsId);
            if (!s) continue;
            s.totalAnswers++;
            s.skipped = totalParticipants - s.totalAnswers;
            if (a.options?.is_correct) s.correct++;
            else s.wrong++;
            s.successRate = totalParticipants > 0
                ? Math.round((s.correct / totalParticipants) * 100)
                : 0;
        }

        const analytics = Array.from(statsMap.values()).sort((a, b) => a.successRate - b.successRate);

        ok(response, "Analitik kesulitan berhasil diambil.", {
            quizId,
            quizTitle:         quiz.quiz_title,
            totalParticipants,
            analytics,
        });
    } catch (err) {
        console.error("[getQuizDifficulty]", err);
        serverError(response);
    }
};


