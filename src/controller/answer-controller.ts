import { Request, Response } from "express";
import prisma from "../config/prisma";
import { ok, badRequest, notFound, unauthorized, forbidden, serverError } from "../utils/response.util";

// ─── POST /quiz/:uuid/answers ─────────────────────────────────────────────────
// Body: { questionUuid, optionUuid }
// ✅ Tidak ada integer ID yang dikirim dari frontend.
// Backend resolve UUID → ID internal secara sendiri.
export const submitAnswer = async (request: Request, response: Response): Promise<void> => {
    try {
        const user = request.user;
        if (!user?.idUser) { unauthorized(response); return; }

        // ✅ Ambil quiz UUID dari parent param (bukan integer idQuiz)
        const quizUuid = request.params.uuid;
        const { questionUuid, optionUuid } = request.body;

        if (!quizUuid || !questionUuid || !optionUuid) {
            badRequest(response, "quizUuid, questionUuid, dan optionUuid wajib disertakan.");
            return;
        }

        // ── Resolve: UUID → Internal Integer ID ───────────────────────────────
        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(response, "Quiz tidak ditemukan."); return; }

        const question = await prisma.questions.findFirst({
            where: { uuid: String(questionUuid), quizId: quiz.id },
        });
        if (!question) { notFound(response, "Soal tidak ditemukan atau bukan bagian dari quiz ini."); return; }

        const option = await prisma.options.findFirst({
            where: { uuid: String(optionUuid), questionsId: question.id },
        });
        if (!option) { notFound(response, "Pilihan tidak ditemukan atau bukan bagian dari soal ini."); return; }

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
                optionsId:   option.id,
            },
            update: { optionsId: option.id },
        });

        // ✅ Response tidak mengekspos integer ID
        ok(response, "Jawaban disimpan.", {
            questionUuid,
            optionUuid,
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

        // ✅ Resolve UUID → internal ID
        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(response, "Quiz tidak ditemukan."); return; }

        const allQuestions = await prisma.questions.findMany({
            where:   { quizId: quiz.id, deleted_at: null },
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

        // ✅ Resolve UUID → internal ID
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

        const userAnswerMap = new Map(userAnswers.map(a => [a.questionsId, a.optionsId]));

        const reviewData = questions.map((q, idx) => {
            const selectedOptId  = userAnswerMap.get(q.id) ?? null;
            const correctOption  = q.options.find(o => o.is_correct);
            // Cari uuid dari option yang dipilih dari database lokal (tidak ekspos integer ke frontend)
            const selectedOption = q.options.find(o =>
                // lookup by internal id match (only server-side join)
                userAnswers.find(a => a.questionsId === q.id && a.optionsId === selectedOptId)
            );
            const isCorrect      = selectedOption?.is_correct ?? false;

            return {
                question_uuid:      q.uuid,
                question_index:     idx + 1,
                question_text:      q.question_text,
                question_image:     q.question_image,
                discussion:         q.discussion,
                poin:               q.poin,
                options:            q.options.map(o => ({
                    option_uuid:  o.uuid,
                    option_text:  o.option_text,
                    option_image: o.option_image,
                    is_correct:   o.is_correct,
                })),
                selected_option_uuid: selectedOption?.uuid ?? null,
                correct_option_uuid:  correctOption?.uuid   ?? null,
                isCorrect,
                isSkipped: selectedOptId === null,
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
        const quizId = quiz.id; // ✅ integer ID hanya digunakan secara internal

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
            if (a.options.is_correct) s.correct++;
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

