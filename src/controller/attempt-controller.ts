import { Request, Response } from "express";
import prisma from "../config/prisma.js";
import {
    ok, badRequest, notFound, unauthorized, forbidden, serverError,
} from "../utils/response.util.js";

// ─── XP Formula ───────────────────────────────────────────────────────────────
const DIFFICULTY_MULTIPLIER: Record<string, number> = {
    EASY:   1.0,
    MEDIUM: 1.5,
    HARD:   2.0,
};

function calculateXP(score: number, difficulty: string): number {
    const mult = DIFFICULTY_MULTIPLIER[difficulty] ?? 1.0;
    return Math.round((score / 100) * 100 * mult); // max 200 XP untuk HARD 100%
}

// ─── Update Streak ────────────────────────────────────────────────────────────
async function updateStreak(userId: number): Promise<void> {
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const existing = await prisma.user_streak.findFirst({ where: { userId } });

    if (!existing) {
        await prisma.user_streak.create({
            data: {
                userId,
                current_streak: 1,
                longest_streak: 1,
                last_activity:  new Date(),
            },
        });
        return;
    }

    const lastDate = new Date(existing.last_activity);
    lastDate.setHours(0, 0, 0, 0);

    let newStreak = existing.current_streak;

    if (lastDate.getTime() === today.getTime()) {
        // Sudah aktif hari ini — tidak perlu update streak
        return;
    } else if (lastDate.getTime() === yesterday.getTime()) {
        // Hari berturut-turut
        newStreak += 1;
    } else {
        // Streak terputus
        newStreak = 1;
    }

    await prisma.user_streak.update({
        where: { userId },
        data: {
            current_streak: newStreak,
            longest_streak: Math.max(newStreak, existing.longest_streak),
            last_activity:  new Date(),
        },
    });
}

// ─── POST /quiz/:uuid/attempt/start ──────────────────────────────────────────
// NOTE: Menggunakan :uuid (bukan :id integer). idAttempt tetap dikembalikan ke
// frontend untuk keperluan autosave, tetapi submit tidak butuh id ini karena
// backend menemukannya sendiri via userId + quizId.
export const startAttempt = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.idUser) { unauthorized(res); return; }

        // ✅ Ambil dari :uuid (bukan :id / :quizUuid) — sesuai route yang baru
        const quizUuid = req.params.uuid;
        if (!quizUuid) { badRequest(res, "Quiz UUID wajib disertakan."); return; }

        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(res, "Quiz tidak ditemukan."); return; }

        // ── Cek retake policy ──────────────────────────────────────────────────
        const existingAttempts = await prisma.attempt.findMany({
            where: { userId: user.idUser, quizId: quiz.id },
            orderBy: { created_at: "desc" },
        });

        // Jika ada attempt yang belum selesai → return untuk resume
        const activeAttempt = existingAttempts.find(a => !a.isFinished);
        if (activeAttempt) {
            // Kembalikan saved_answers menggunakan questionsId (integer, internal mapping)
            // Frontend menggunakan ini untuk restore state lokal — TIDAK untuk ekspos ke URL
            const savedAnswers = await prisma.answers.findMany({
                where:  { attemptId: activeAttempt.id },
                select: { questionsId: true, optionsId: true, answer_text: true },
            });

            // Map questionId -> optionId OR answer_text
            const saved_answers: Record<number, string | number> = {};
            for (const a of savedAnswers) {
                if (a.answer_text !== null) saved_answers[a.questionsId] = a.answer_text;
                else if (a.optionsId !== null) saved_answers[a.questionsId] = a.optionsId;
            }

            ok(res, "Quiz sedang berlangsung, melanjutkan attempt sebelumnya.", {
                idAttempt:      activeAttempt.id,
                start_time:     activeAttempt.start_time,
                duration:       quiz.duration,
                attempt_number: activeAttempt.attempt_number,
                saved_answers,
                is_resume: true,
            });
            return;
        }

        // Cek apakah masih boleh mencoba berdasarkan retake_policy
        const finishedCount = existingAttempts.filter(a => a.isFinished).length;

        if (quiz.retake_policy === "ONCE" && finishedCount >= 1) {
            forbidden(res, "Quiz ini hanya boleh dikerjakan sekali.");
            return;
        }

        if (quiz.retake_policy === "LIMITED" && quiz.max_attempts !== null) {
            if (finishedCount >= quiz.max_attempts) {
                forbidden(res, `Batas maksimum ${quiz.max_attempts} percobaan sudah tercapai.`);
                return;
            }
        }
        // UNLIMITED → selalu boleh

        // ── Buat attempt baru ──────────────────────────────────────────────────
        const attempt = await prisma.attempt.create({
            data: {
                userId:         user.idUser,
                quizId:         quiz.id,
                attempt_number: finishedCount + 1,
            },
        });

        // Log aktivitas
        await prisma.activity_log.create({
            data: {
                userId: user.idUser,
                quizId: quiz.id,
                action: "STARTED_QUIZ",
            },
        });

        ok(res, "Attempt dimulai.", {
            idAttempt:      attempt.id,
            start_time:     attempt.start_time,
            duration:       quiz.duration,
            attempt_number: attempt.attempt_number,
            is_resume:      false,
        });
    } catch (err) {
        console.error("[startAttempt]", err);
        serverError(res);
    }
};

// ─── POST /quiz/:uuid/attempt/submit ─────────────────────────────────────────
// ✅ Backend menemukan attempt aktif via userId + quizUuid — tidak ada idAttempt di URL.
export const submitAttempt = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.idUser) { unauthorized(res); return; }

        const quizUuid = req.params.uuid;
        if (!quizUuid) { badRequest(res, "Quiz UUID wajib disertakan."); return; }

        // ✅ Cari quiz dan attempt aktif secara internal — tidak ada integer ID dari frontend
        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizUuid) } });
        if (!quiz) { notFound(res, "Quiz tidak ditemukan."); return; }

        const attempt = await prisma.attempt.findFirst({
            where:   { userId: user.idUser, quizId: quiz.id, isFinished: false },
            include: { quiz: true },
            orderBy: { created_at: "desc" },
        });

        if (!attempt)           { notFound(res, "Attempt aktif tidak ditemukan. Mulai quiz terlebih dahulu."); return; }
        if (attempt.isFinished) { badRequest(res, "Attempt sudah disubmit."); return; }

        const now        = new Date();
        const started    = attempt.start_time;
        const durMs      = attempt.quiz.duration * 60 * 1000;
        const elapsed    = now.getTime() - started.getTime();
        const late       = elapsed > durMs;
        const durUsedMin = Math.floor(elapsed / 60000);

        // ── Hitung skor ────────────────────────────────────────────────────────
        const userAnswers = await prisma.answers.findMany({
            where:   { attemptId: attempt.id },
            include: {
                options:   { select: { is_correct: true } },
                questions: { 
                    select: { 
                        poin: true, 
                        question_type: true, 
                        allow_multiple_answers: true,
                        is_strict: true,
                        options: { select: { id: true, is_correct: true, option_text: true } },
                    } 
                },
            },
        });

        // Only count top-level questions (STORY_GROUP children answered separately are scored by parent context)
        const allQuestions = await prisma.questions.findMany({
            where: { quizId: attempt.quizId, deleted_at: null, parentId: null },
        });

        let correct = 0, wrong = 0, score = 0;
        for (const ans of userAnswers) {
            const qType      = ans.questions.question_type;
            const allowMulti = ans.questions.allow_multiple_answers;
            const isStrict   = ans.questions.is_strict;
            const poin       = ans.questions.poin;

            if (qType === 'MULTIPLE_COMPLEX' || allowMulti) {
                // ── Multiple Complex: exact set match ─────────────────────────
                if (ans.answer_text) {
                    const selectedIds = ans.answer_text.split(",").map(Number).filter(n => !isNaN(n));
                    const allOpts     = ans.questions.options;
                    const correctIds  = new Set(allOpts.filter(o => o.is_correct).map(o => o.id));
                    const selectedSet = new Set(selectedIds);
                    let isCorrectMC   = correctIds.size === selectedSet.size;
                    if (isCorrectMC) {
                        for (const id of correctIds) {
                            if (!selectedSet.has(id)) { isCorrectMC = false; break; }
                        }
                    }
                    if (isCorrectMC) { correct++; score += poin; }
                    else { wrong++; }
                } else {
                    wrong++;
                }
            } else if (qType === 'FILL_BLANK') {
                // ── Fill Blank: match any correct option ──────────────────────
                if (ans.answer_text) {
                    const student = ans.answer_text.trim();
                    const correctOptions = ans.questions.options.filter(o => o.is_correct);
                    const isCorrectFB = correctOptions.some(opt => {
                        const correctText = opt.option_text.trim();
                        if (isStrict) return student === correctText;
                        return student.toLowerCase() === correctText.toLowerCase();
                    });
                    if (isCorrectFB) { correct++; score += poin; }
                    else { wrong++; }
                } else {
                    wrong++;
                }
            } else if (ans.options) {
                // ── Standard single choice (MULTIPLE_CHOICE, TRUE_FALSE) ──────
                if (ans.options.is_correct) { 
                    correct++; 
                    score += poin; 
                } else {
                    wrong++;
                }
            } else if (ans.answer_text) {
                // Essay / Short Answer (Manual grading later)
                // We count it as answered (not skipped) but not correct/wrong for auto-grade
            }
        }

        const total_questions = allQuestions.length;
        const skipped         = total_questions - userAnswers.length;
        const maxScore        = allQuestions.reduce((a, q) => a + q.poin, 0);
        const normalizedScore = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        const accuracy        = (correct + wrong) > 0
            ? Math.round((correct / (correct + wrong)) * 100)
            : 0;
        const xp_earned       = calculateXP(normalizedScore, attempt.quiz.difficulty);

        // ── Update attempt ─────────────────────────────────────────────────────
        await prisma.attempt.update({
            where: { id: attempt.id },
            data:  { finished_time: now, isFinished: true },
        });

        const hasEssay = allQuestions.some(q => q.question_type === 'ESSAY' || q.question_type === 'SHORT_ANSWER');
        const reviewStatus = hasEssay ? 'WAITING_REVIEW' : 'AUTO_GRADED';

        // ── Simpan skor ────────────────────────────────────────────────────────
        await prisma.scores.create({
            data: {
                uuid:            crypto.randomUUID(),
                userId:          user.idUser,
                quizId:          attempt.quizId,
                attemptId:       attempt.id,
                total_questions,
                correct,
                wrong,
                skipped,
                score:           normalizedScore,
                accuracy,
                xp_earned,
                start_time:      started,
                finished_time:   now,
                duration_used:   durUsedMin,
                review_status:   reviewStatus,
            },
        });

        // ── Update streak ──────────────────────────────────────────────────────
        await updateStreak(user.idUser);

        // ── Log aktivitas ──────────────────────────────────────────────────────
        await prisma.activity_log.create({
            data: {
                userId: user.idUser,
                quizId: attempt.quizId,
                action: "COMPLETED_QUIZ",
                score:  normalizedScore,
            },
        });

        // ✅ Response tidak mengekspos idScore (integer) — frontend hanya butuh quiz_uuid untuk redirect
        ok(res, late ? "Quiz submitted (terlambat)." : "Quiz submitted tepat waktu.", {
            late,
            duration_allowed_min: attempt.quiz.duration,
            duration_used_min:    durUsedMin,
            score_result: {
                total_questions,
                correct,
                wrong,
                skipped,
                score:    normalizedScore,
                accuracy,
                xp_earned,
            },
            quiz_uuid: attempt.quiz.uuid,
        });
    } catch (err) {
        console.error("[submitAttempt]", err);
        serverError(res);
    }
};





