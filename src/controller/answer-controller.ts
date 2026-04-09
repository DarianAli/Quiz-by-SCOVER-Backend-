import { Response, Request } from "express";
import prisma from "../config/prisma";


// ════════════════════════════════════════════════════════════════════
// Flow 1 — Submit / Update Jawaban Satu Soal
// POST /quiz/:idQuiz/answers
// Body: { questionsId, optionsId }
// ════════════════════════════════════════════════════════════════════
export const submitAnswer = async (request: Request, response: Response) => {
    try {
        const user = request.user;
        const { idQuiz } = request.params;
        const { questionsId, optionsId } = request.body;

        if (!user) {
            response.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const quizId = Number(idQuiz);
        const qId    = Number(questionsId);
        const oId    = Number(optionsId);

        if (Number.isNaN(quizId) || Number.isNaN(qId) || Number.isNaN(oId)) {
            response.status(400).json({ success: false, message: "idQuiz, questionsId, and optionsId must be numbers" });
            return;
        }

        // Pastikan attempt ada dan belum selesai
        const attempt = await prisma.attempt.findUnique({
            where: {
                userId_quizId: { userId: user.idUser, quizId }
            }
        });

        if (!attempt) {
            response.status(404).json({ success: false, message: "Attempt not found. Start the quiz first." });
            return;
        }

        if (attempt.isFinished) {
            response.status(400).json({ success: false, message: "Quiz already submitted. Cannot change answers." });
            return;
        }

        // Validasi soal dan opsi termasuk dalam quiz ini
        const question = await prisma.questions.findFirst({
            where: { idQuestion: qId, quizId }
        });

        if (!question) {
            response.status(404).json({ success: false, message: "Question not found or does not belong to this quiz" });
            return;
        }

        const option = await prisma.options.findFirst({
            where: { idOption: oId, questionsId: qId }
        });

        if (!option) {
            response.status(404).json({ success: false, message: "Option not found or does not belong to this question" });
            return;
        }

        // Upsert berdasarkan unique key (userId, quizId, questionsId)
        const answer = await prisma.answers.upsert({
            where: {
                userId_quizId_questionsId: {
                    userId: user.idUser,
                    quizId,
                    questionsId: qId
                }
            },
            create: {
                userId:      user.idUser,
                quizId,
                questionsId: qId,
                optionsId:   oId
            },
            update: {
                optionsId: oId
            }
        });

        response.status(200).json({
            success: true,
            message: "Answer saved",
            data: answer
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({ success: false, message: "Failed to save answer" });
    }
};


// ════════════════════════════════════════════════════════════════════
// Flow 2 — Progress & Resume Quiz
// GET /quiz/:idQuiz/answers/progress
// ════════════════════════════════════════════════════════════════════
export const getMyProgress = async (request: Request, response: Response) => {
    try {
        const user = request.user;
        const { idQuiz } = request.params;

        if (!user) {
            response.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const quizId = Number(idQuiz);
        if (Number.isNaN(quizId)) {
            response.status(400).json({ success: false, message: "idQuiz must be a number" });
            return;
        }

        // Ambil semua soal quiz
        const allQuestions = await prisma.questions.findMany({
            where:   { quizId, deleted_at: null },
            orderBy: { idQuestion: "asc" }
        });

        // Ambil semua jawaban user untuk quiz ini
        const answeredList = await prisma.answers.findMany({
            where: { userId: user.idUser, quizId },
            include: {
                options:   { select: { idOption: true, option_text: true, is_correct: true } },
                questions: { select: { idQuestion: true, question_text: true } }
            }
        });

        const answeredQuestionIds = new Set(answeredList.map(a => a.questionsId));

        // Cari soal pertama yang belum dijawab
        const nextUnanswered = allQuestions.find(q => !answeredQuestionIds.has(q.idQuestion));

        // Ambil info attempt
        const attempt = await prisma.attempt.findUnique({
            where: { userId_quizId: { userId: user.idUser, quizId } }
        });

        response.status(200).json({
            success: true,
            data: {
                quizId,
                isStarted:                !!attempt,
                isFinished:               attempt?.isFinished ?? false,
                totalQuestions:           allQuestions.length,
                answeredCount:            answeredList.length,
                remainingCount:           allQuestions.length - answeredList.length,
                nextUnansweredQuestionId: nextUnanswered?.idQuestion ?? null,
                answers:                  answeredList
            }
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({ success: false, message: "Failed to get progress" });
    }
};


// ════════════════════════════════════════════════════════════════════
// Flow 3 — Review Jawaban (setelah submit)
// GET /quiz/:idQuiz/answers/review
// ════════════════════════════════════════════════════════════════════
export const getQuizReview = async (request: Request, response: Response) => {
    try {
        const user = request.user;
        const { idQuiz } = request.params;

        if (!user) {
            response.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const quizId = Number(idQuiz);
        if (Number.isNaN(quizId)) {
            response.status(400).json({ success: false, message: "idQuiz must be a number" });
            return;
        }

        // Hanya boleh review setelah quiz selesai
        const attempt = await prisma.attempt.findUnique({
            where: { userId_quizId: { userId: user.idUser, quizId } }
        });

        if (!attempt) {
            response.status(404).json({ success: false, message: "Attempt not found" });
            return;
        }

        if (!attempt.isFinished) {
            response.status(403).json({ success: false, message: "Review is only available after quiz submission" });
            return;
        }

        // Ambil semua soal beserta opsinya
        const questions = await prisma.questions.findMany({
            where:   { quizId, deleted_at: null },
            orderBy: { idQuestion: "asc" },
            include: {
                options: {
                    select: {
                        idOption:     true,
                        option_text:  true,
                        option_image: true,
                        is_correct:   true
                    }
                }
            }
        });

        // Ambil jawaban user untuk quiz ini
        const userAnswers = await prisma.answers.findMany({
            where: { userId: user.idUser, quizId }
        });

        // Map jawaban user: questionsId → optionsId
        const userAnswerMap = new Map(userAnswers.map(a => [a.questionsId, a.optionsId]));

        // Build review data
        const reviewData = questions.map(q => {
            const selectedOptionId = userAnswerMap.get(q.idQuestion) ?? null;
            const correctOption    = q.options.find(o => o.is_correct) ?? null;
            const selectedOption   = q.options.find(o => o.idOption === selectedOptionId) ?? null;
            const isCorrect        = selectedOption?.is_correct ?? false;
            const isAnswered       = selectedOptionId !== null;

            return {
                idQuestion:     q.idQuestion,
                question_text:  q.question_text,
                question_image: q.question_image,
                poin:           q.poin,
                options:        q.options,
                selectedOption,
                correctOption,
                isAnswered,
                isCorrect
            };
        });

        const totalCorrect   = reviewData.filter(r => r.isCorrect).length;
        const totalWrong     = reviewData.filter(r => r.isAnswered && !r.isCorrect).length;
        const totalUnanswered = reviewData.filter(r => !r.isAnswered).length;

        response.status(200).json({
            success: true,
            data: {
                quizId,
                summary: {
                    totalQuestions: questions.length,
                    correct:        totalCorrect,
                    wrong:          totalWrong,
                    unanswered:     totalUnanswered
                },
                review: reviewData
            }
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({ success: false, message: "Failed to get quiz review" });
    }
};


// ════════════════════════════════════════════════════════════════════
// Flow 4 — Analitik Kesulitan Soal (Admin / Tentor)
// GET /quiz/:idQuiz/answers/difficulty
// ════════════════════════════════════════════════════════════════════
export const getQuizDifficulty = async (request: Request, response: Response) => {
    try {
        const { idQuiz } = request.params;

        const quizId = Number(idQuiz);
        if (Number.isNaN(quizId)) {
            response.status(400).json({ success: false, message: "idQuiz must be a number" });
            return;
        }

        // Cek quiz ada
        const quiz = await prisma.quiz.findUnique({ where: { idQuiz: quizId } });
        if (!quiz) {
            response.status(404).json({ success: false, message: "Quiz not found" });
            return;
        }

        // Ambil semua jawaban untuk quiz ini beserta info opsi (is_correct)
        const allAnswers = await prisma.answers.findMany({
            where:   { quizId },
            include: {
                options:   { select: { is_correct: true } },
                questions: {
                    select: {
                        idQuestion:    true,
                        question_text: true,
                        difficulty:    true,
                        poin:          true
                    }
                }
            }
        });

        // Ambil semua soal quiz (termasuk yang belum pernah dijawab siapapun)
        const allQuestions = await prisma.questions.findMany({
            where:   { quizId, deleted_at: null },
            orderBy: { idQuestion: "asc" }
        });

        // Total peserta unik (based on attempt)
        const totalParticipants = await prisma.attempt.count({
            where: { quizId }
        });

        // Group jawaban per soal
        interface QuestionStat {
            idQuestion:    number;
            question_text: string;
            difficulty:    string;
            poin:          number;
            totalAnswers:  number;
            correctCount:  number;
            wrongCount:    number;
            successRate:   number;  // persen
            skippedCount:  number;  // peserta yang tidak menjawab soal ini
        }

        const statsMap = new Map<number, QuestionStat>();

        // Inisialisasi semua soal dengan 0
        for (const q of allQuestions) {
            statsMap.set(q.idQuestion, {
                idQuestion:    q.idQuestion,
                question_text: q.question_text,
                difficulty:    q.difficulty,
                poin:          q.poin,
                totalAnswers:  0,
                correctCount:  0,
                wrongCount:    0,
                successRate:   0,
                skippedCount:  totalParticipants
            });
        }

        // Hitung per jawaban
        for (const answer of allAnswers) {
            const stat = statsMap.get(answer.questionsId);
            if (!stat) continue;

            stat.totalAnswers++;
            stat.skippedCount = totalParticipants - stat.totalAnswers;

            if (answer.options.is_correct) {
                stat.correctCount++;
            } else {
                stat.wrongCount++;
            }

            // successRate: dari seluruh peserta (bukan hanya yang menjawab)
            stat.successRate = totalParticipants > 0
                ? Math.round((stat.correctCount / totalParticipants) * 100)
                : 0;
        }

        // Sort by successRate ascending (soal paling sulit di atas)
        const analytics = Array.from(statsMap.values()).sort(
            (a, b) => a.successRate - b.successRate
        );

        response.status(200).json({
            success: true,
            data: {
                quizId,
                quizTitle:         quiz.quiz_title,
                totalParticipants,
                analytics
            }
        });
    } catch (error) {
        console.error(error);
        response.status(500).json({ success: false, message: "Failed to get difficulty analytics" });
    }
};
