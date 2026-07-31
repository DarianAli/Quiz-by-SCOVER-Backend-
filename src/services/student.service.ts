import prisma from "../config/prisma.js";
import { calculateAverageScore } from "./student-statistics.service.js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeeklyScore {
    day: string;
    average_score: number;
    quizzes_done: number;
}

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// ─── Student Dashboard Service ────────────────────────────────────────────────

export async function getStudentDashboard(userId: number) {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        include: {
            class: { select: { class_name: true, class_program: true } },
            streak: true,
        },
    });
    if (!user || !user.classId || !user.class) return null;

    // ── All quiz attempts ──────────────────────────────────────────────────────
    const allScores = await prisma.scores.findMany({
        where: { userId },
        include: {
            quiz: {
                include: { module: { include: { subject: { select: { subject_name: true } } } } },
            },
            attempt: { select: { start_time: true, finished_time: true } },
        },
        orderBy: { created_at: "desc" },
    });

    // ── In-progress attempts ───────────────────────────────────────────────────
    const inProgressAttempts = await prisma.attempt.findMany({
        where: { userId, isFinished: false },
        include: {
            quiz: {
                include: {
                    module: { include: { subject: { select: { subject_name: true } } } },
                    questions: { where: { deleted_at: null }, select: { id: true } },
                },
            },
        },
        orderBy: { created_at: "desc" },
        take: 5,
    });

    // ── Subject stats for user's class ────────────────────────────────────────
    const subjectClasses = await prisma.subjectClass.findMany({
        where: { classId: user.classId },
        include: {
            subject: {
                include: {
                    modules: {
                        include: {
                            quizzes: {
                                where: { deleted_at: null },
                                select: { id: true },
                            },
                        }
                    }
                },
            },
        },
    });

    // ── Score aggregations ─────────────────────────────────────────────────────
    const totalScoreSum = allScores.reduce((acc, s) => acc + s.score, 0);
    const avgScore      = await calculateAverageScore(userId, user.classId);

    const totalCorrect  = allScores.reduce((acc, s) => acc + s.correct, 0);
    const totalAnswered = allScores.reduce(
        (acc, s) => acc + s.correct + s.wrong,
        0,
    );
    const avgAccuracy   = totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;

    const timeSpent = allScores.reduce((acc, s) => acc + s.duration_used, 0);

    // Completed quiz IDs (unique)
    const completedQuizIds  = new Set(allScores.map(s => s.quizId));
    const totalQuizForClass = subjectClasses.reduce(
        (acc, sc) => acc + sc.subject.modules.flatMap(m => m.quizzes).length,
        0,
    );

    const remaining = Math.max(0, totalQuizForClass - completedQuizIds.size);

    // ── Weekly progress ────────────────────────────────────────────────────────
    const now        = new Date();
    const thisWeek   = new Date(now);
    thisWeek.setDate(now.getDate() - now.getDay()); // start of week (Sunday)
    thisWeek.setHours(0, 0, 0, 0);
    const lastWeek   = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const thisWeekScores = allScores.filter(
        s => new Date(s.created_at) >= thisWeek,
    );
    const lastWeekScores = allScores.filter(
        s =>
            new Date(s.created_at) >= lastWeek &&
            new Date(s.created_at) < thisWeek,
    );

    const thisWeekAvg = thisWeekScores.length > 0
        ? Math.round(thisWeekScores.reduce((a, s) => a + s.score, 0) / thisWeekScores.length)
        : 0;
    const lastWeekAvg = lastWeekScores.length > 0
        ? Math.round(lastWeekScores.reduce((a, s) => a + s.score, 0) / lastWeekScores.length)
        : 0;

    const weeklyProgress = lastWeekAvg > 0
        ? Math.round(((thisWeekAvg - lastWeekAvg) / lastWeekAvg) * 100)
        : thisWeekAvg > 0 ? 100 : 0;

    // ── Weekly scores for chart (last 7 days) ─────────────────────────────────
    const weeklyScores: WeeklyScore[] = [];
    for (let i = 6; i >= 0; i--) {
        const day     = new Date(now);
        day.setDate(now.getDate() - i);
        day.setHours(0, 0, 0, 0);
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);

        const dayScores = allScores.filter(s => {
            const d = new Date(s.created_at);
            return d >= day && d < nextDay;
        });

        weeklyScores.push({
            day:           DAY_LABELS[day.getDay()],
            average_score: dayScores.length > 0
                ? Math.round(dayScores.reduce((a, s) => a + s.score, 0) / dayScores.length)
                : 0,
            quizzes_done: dayScores.length,
        });
    }

    // ── Subject mastery ────────────────────────────────────────────────────────
    const subjectMastery = await Promise.all(subjectClasses.map(async sc => {
        const allQuizzes = sc.subject.modules.flatMap(m => m.quizzes);
        const subjectQuizIds = allQuizzes.map(q => q.id);
        const subjectScores  = allScores.filter(s => subjectQuizIds.includes(s.quizId));
        const completedCount = new Set(subjectScores.map(s => s.quizId)).size;
        const avgSc          = await calculateAverageScore(userId, user.classId, sc.subject.uuid);

        return {
            subject_name:       sc.subject.subject_name,
            mastery_percentage: allQuizzes.length > 0
                ? Math.round((completedCount / allQuizzes.length) * 100)
                : 0,
            completed: completedCount,
            total:     allQuizzes.length,
            average_score: avgSc,
        };
    }));

    const moduleProgress = subjectClasses.flatMap(sc => {
        return sc.subject.modules.map(m => {
            const moduleQuizIds = m.quizzes.map(q => q.id);
            const moduleScores = allScores.filter(s => moduleQuizIds.includes(s.quizId));
            const completedCount = new Set(moduleScores.map(s => s.quizId)).size;
            return {
                module_uuid: m.uuid,
                module_name: m.module_name,
                subject_name: sc.subject.subject_name,
                completed: completedCount,
                total: moduleQuizIds.length,
                progress_percentage: moduleQuizIds.length > 0 ? Math.round((completedCount / moduleQuizIds.length) * 100) : 0,
            };
        });
    });
    // ── Strongest/weakest subject ──────────────────────────────────────────────
    const sorted    = [...subjectMastery].sort((a, b) => b.average_score - a.average_score);
    const strongest = sorted[0] ?? null;
    const weakest   = sorted[sorted.length - 1] ?? null;

    // ── Leaderboard rank (per class) ───────────────────────────────────────────
    const classScores = await prisma.scores.groupBy({
        by: ["userId"],
        where: {
            quiz: { module: { subject: { subjectClass: { some: { classId: user.classId } } } } },
        },
        _sum: { score: true },
        orderBy: { _sum: { score: "desc" } },
    });

    const rankIndex    = classScores.findIndex(r => r.userId === userId);
    const currentRank  = rankIndex >= 0 ? rankIndex + 1 : 0;

    // ── Recent quizzes (completed) ─────────────────────────────────────────────
    const recentQuizzes = allScores.slice(0, 5).map(s => ({
        score_uuid:      s.uuid,
        quiz_uuid:       s.quiz.uuid,
        quiz_title:      s.quiz.quiz_title,
        subject_name:    s.quiz.module?.subject?.subject_name ?? "—",
        score:           s.score,
        correct:         s.correct,
        wrong:           s.wrong,
        total_questions: s.total_questions,
        difficulty:      s.quiz.difficulty,
        finished_time:   s.finished_time.toISOString(),
        duration_used:   s.duration_used,
    }));

    // ── Activity log ──────────────────────────────────────────────────────────
    const activities = await prisma.activity_log.findMany({
        where:   { userId },
        include: { quiz: { select: { uuid: true, quiz_title: true, module: { select: { subject: { select: { subject_name: true } } } } } } },
        orderBy: { created_at: "desc" },
        take: 10,
    });

    const recentActivities = activities.map(a => ({
        id:           String(a.id),
        action:       a.action,
        quiz_title:   a.quiz.quiz_title,
        subject_name: a.quiz.module?.subject?.subject_name ?? "—",
        score:        a.score ?? undefined,
        created_at:   a.created_at.toISOString(),
    }));

    return {
        student: {
            uuid:         user.uuid,
            full_name:    user.full_name,
            userName:     user.userName,
            photoProfile: user.photoProfile
                ? `/public/user_image/${user.photoProfile}`
                : "",
            class_name:    user.class.class_name,
            class_program: user.class.class_program,
        },
        stats: {
            average_score:    avgScore,
            weekly_progress:  weeklyProgress,
            current_rank:     currentRank,
            current_streak:   user.streak?.current_streak ?? 0,
            completed_quiz:   completedQuizIds.size,
            remaining_quiz:   remaining,
            average_accuracy: avgAccuracy,
            time_spent:       timeSpent,
        },
        strongest_subject: strongest
            ? { subject_name: strongest.subject_name, average_score: strongest.average_score }
            : null,
        weakest_subject: weakest && weakest !== strongest
            ? { subject_name: weakest.subject_name, average_score: weakest.average_score }
            : null,
        recent_quizzes:     recentQuizzes,
        in_progress_quizzes: inProgressAttempts.map(a => ({
            quiz_uuid:       a.quiz.uuid,
            quiz_title:      a.quiz.quiz_title,
            subject_name:    a.quiz.module?.subject?.subject_name ?? "—",
            difficulty:      a.quiz.difficulty,
            duration:        a.quiz.duration,
            total_questions: a.quiz.questions.length,
            start_time:      a.start_time.toISOString(),
            attempt_id:      a.id,
        })),
        subject_mastery:   subjectMastery,
        weekly_scores:     weeklyScores,
        recent_activities: recentActivities,
        module_progress:   moduleProgress,
    };
}

// ─── Student Subjects Service ─────────────────────────────────────────────────

export async function getStudentSubjects(userId: number) {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        select: { classId: true },
    });
    if (!user || !user.classId) return null;

    const subjectClasses = await prisma.subjectClass.findMany({
        where: { classId: user.classId },
        include: {
            subject: {
                include: {
                    modules: {
                        include: {
                            quizzes: {
                                where: { deleted_at: null },
                                select: {
                                    id: true,
                                    duration: true,
                                    scores: { where: { userId }, select: { score: true, quizId: true } },
                                },
                            },
                        }
                    }
                },
            },
        },
    });

    return Promise.all(subjectClasses.map(async sc => {
        const subject = sc.subject;
        const allQuizzes = subject.modules.flatMap(m => m.quizzes);
        const totalQuiz = allQuizzes.length;

        const completedQuizIds = new Set(
            allQuizzes
                .filter(q => q.scores.some(s => s.quizId === q.id))
                .map(q => q.id),
        );
        const completedQuiz = completedQuizIds.size;

        const avgScore = await calculateAverageScore(userId, user.classId, subject.uuid);

        const estimatedTime = allQuizzes.reduce((acc, q) => acc + q.duration, 0);

        return {
            uuid:                  subject.uuid,
            subject_name:          subject.subject_name,
            total_quiz:            totalQuiz,
            completed_quiz:        completedQuiz,
            average_score:         avgScore,
            completion_percentage: totalQuiz > 0
                ? Math.round((completedQuiz / totalQuiz) * 100)
                : 0,
            estimated_time: estimatedTime,
        };
    }));
}

// ─── Student Subject Detail (with Quiz List) ──────────────────────────────────

export async function getStudentSubjectDetail(userId: number, subjectUuid: string) {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        select: { classId: true },
    });
    if (!user || !user.classId) return null;

    const subject = await prisma.subject.findFirst({
        where: { uuid: subjectUuid, subjectClass: { some: { classId: user.classId } } },
        include: {
            modules: {
                include: {
                    quizzes: {
                        where: { deleted_at: null, status: "PUBLISHED" },
                        include: {
                            questions: { where: { deleted_at: null }, select: { id: true } },
                            attempts: {
                                where: { userId },
                                orderBy: { created_at: "desc" },
                                take: 1,
                            },
                            scores: {
                                where: { userId },
                                orderBy: { created_at: "desc" },
                                take: 1,
                            },
                        },
                    },
                }
            }
        },
    });

    if (!subject) return null;

    const allQuizzes = subject.modules.flatMap(m => m.quizzes);

    const quizzes = allQuizzes.map(q => {
        const lastAttempt = q.attempts[0] ?? null;
        const lastScore   = q.scores[0]   ?? null;

        let studentStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" = "NOT_STARTED";
        if (lastAttempt?.isFinished) studentStatus = "COMPLETED";
        else if (lastAttempt && !lastAttempt.isFinished) studentStatus = "IN_PROGRESS";

        return {
            uuid:            q.uuid,
            quiz_title:      q.quiz_title,
            difficulty:      q.difficulty,
            duration:        q.duration,
            total_questions: q.questions.length,
            quiz_date:       q.quiz_date.toISOString(),
            student_status:  studentStatus,
            last_score:      lastScore?.score       ?? null,
            last_correct:    lastScore?.correct     ?? null,
            last_wrong:      lastScore?.wrong       ?? null,
            attempt_id:      lastAttempt?.id        ?? null,
            is_finished:     lastAttempt?.isFinished ?? false,
        };
    });

    const modules = subject.modules.map(m => {
        const moduleQuizzes = m.quizzes.map(q => {
            const lastAttempt = q.attempts[0] ?? null;
            const lastScore   = q.scores[0]   ?? null;

            let studentStatus: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" = "NOT_STARTED";
            if (lastAttempt?.isFinished) studentStatus = "COMPLETED";
            else if (lastAttempt && !lastAttempt.isFinished) studentStatus = "IN_PROGRESS";

            return {
                uuid:            q.uuid,
                quiz_title:      q.quiz_title,
                difficulty:      q.difficulty,
                duration:        q.duration,
                total_questions: q.questions.length,
                quiz_date:       q.quiz_date.toISOString(),
                student_status:  studentStatus,
                last_score:      lastScore?.score       ?? null,
                last_correct:    lastScore?.correct     ?? null,
                last_wrong:      lastScore?.wrong       ?? null,
                attempt_id:      lastAttempt?.id        ?? null,
                is_finished:     lastAttempt?.isFinished ?? false,
            };
        });
        return {
            uuid: m.uuid,
            module_name: m.module_name,
            description: m.description,
            order_index: m.order_index,
            quizzes: moduleQuizzes,
        };
    });

    const completedCount = quizzes.filter(q => q.student_status === "COMPLETED").length;
    const avgScore       = await calculateAverageScore(userId, user.classId, subject.uuid);
    const estimatedTime  = allQuizzes.reduce((a, q) => a + q.duration, 0);

    return {
        uuid:                  subject.uuid,
        subject_name:          subject.subject_name,
        total_quiz:            allQuizzes.length,
        completed_quiz:        completedCount,
        average_score:         avgScore,
        completion_percentage: allQuizzes.length > 0
            ? Math.round((completedCount / allQuizzes.length) * 100)
            : 0,
        estimated_time: estimatedTime,
        quizzes,
        modules,
    };
}

// ─── Quiz Detail For Student (no is_correct!) ─────────────────────────────────

export async function getStudentQuizDetail(userId: number, quizUuid: string) {
    const quiz = await prisma.quiz.findFirst({
        where: { uuid: quizUuid, deleted_at: null },
        include: {
            module: { include: { subject: { select: { subject_name: true } } } },
            questions: {
                where: { deleted_at: null },
                orderBy: { order_index: "asc" },
                include: {
                    options: {
                        orderBy: { order_index: "asc" },
                        select: {
                            id:           true,
                            uuid:         true,
                            option_text:  true,
                            option_image: true,
                            // is_correct NOT included for student
                        },
                    },
                },
            },
            attempts: {
                where: { userId, isFinished: false },
                orderBy: { created_at: "desc" },
                take: 1,
            },
        },
    });

    if (!quiz) return null;

    // Load saved answers if resume
    const existingAttempt = quiz.attempts[0] ?? null;
    let savedAnswers: Record<number, number> = {};

    if (existingAttempt) {
        const answers = await prisma.answers.findMany({
            where: { attemptId: existingAttempt.id },
            select: { questionsId: true, optionsId: true },
        });
        savedAnswers = Object.fromEntries(answers.map(a => [a.questionsId, a.optionsId]));
    }

    return {
        uuid:            quiz.uuid,
        quiz_title:      quiz.quiz_title,
        difficulty:      quiz.difficulty,
        duration:        quiz.duration,
        retake_policy:   quiz.retake_policy,
        total_questions: quiz.questions.length,
        subject_name:    quiz.module?.subject?.subject_name ?? "—",
        questions: quiz.questions.map(q => ({
            idQuestion:     q.id,
            uuid:           q.uuid,
            question_text:  q.question_text,
            question_image: q.question_image,
            difficulty:     q.difficulty,
            poin:           q.poin,
            options:        q.options.map(o => ({
                idOption:     o.id,
                uuid:         o.uuid,
                option_text:  o.option_text,
                option_image: o.option_image,
            })),
        })),
        attempt: existingAttempt
            ? {
                  idAttempt:    existingAttempt.id,
                  start_time:   existingAttempt.start_time.toISOString(),
                  saved_answers: savedAnswers,
              }
            : null,
    };
}

// ─── Quiz Result ──────────────────────────────────────────────────────────────

export async function getStudentQuizResult(userId: number, quizUuid: string) {
    const quiz = await prisma.quiz.findFirst({
        where: { uuid: quizUuid, deleted_at: null },
        include: { module: { include: { subject: { select: { subject_name: true } } } } },
    });
    if (!quiz) return null;

    // Get latest completed score
    const score = await prisma.scores.findFirst({
        where: { userId, quizId: quiz.id },
        orderBy: { created_at: "desc" },
        include: {
            attempt: {
                include: {
                    quiz: { select: { id: true } },
                },
            },
        },
    });
    if (!score) return null;

    // Leaderboard rank for this quiz
    const quizScores = await prisma.scores.groupBy({
        by: ["userId"],
        where: { quizId: quiz.id },
        _max: { score: true },
        orderBy: { _max: { score: "desc" } },
    });
    const rankIndex = quizScores.findIndex(r => r.userId === userId);
    const rank      = rankIndex >= 0 ? rankIndex + 1 : null;

    // Question breakdown (from answers of this attempt)
    const answers = await prisma.answers.findMany({
        where: { attemptId: score.attemptId },
        include: {
            questions: { select: { question_text: true, order_index: true } },
            options:   { select: { is_correct: true } },
        },
        orderBy: { questions: { order_index: "asc" } },
    });

    const allQuestions = await prisma.questions.findMany({
        where: { quizId: quiz.id, deleted_at: null },
        orderBy: { order_index: "asc" },
        select: { id: true, question_text: true, order_index: true },
    });

    const answeredMap = new Map(answers.map(a => [a.questionsId, a]));

    const questionBreakdown = allQuestions.map((q, idx) => {
        const ans = answeredMap.get(q.id);
        return {
            question_index:    idx + 1,
            question_text:     q.question_text,
            selected_option_id: ans?.optionsId ?? null,
            is_correct:        ans?.options.is_correct ?? false,
            is_skipped:        !ans,
        };
    });

    return {
        quiz_uuid:    quiz.uuid,
        quiz_title:   quiz.quiz_title,
        subject_name: quiz.module?.subject?.subject_name ?? "—",
        difficulty:   quiz.difficulty,
        score: {
            uuid:            score.uuid,
            total_questions: score.total_questions,
            correct:         score.correct,
            wrong:           score.wrong,
            skipped:         score.skipped,
            score:           score.score,
            accuracy:        score.accuracy,
            start_time:      score.start_time.toISOString(),
            finished_time:   score.finished_time.toISOString(),
            duration_used:   score.duration_used,
        },
        rank,
        xp_earned:         score.xp_earned,
        question_breakdown: questionBreakdown,
    };
}

// ─── Quiz Review ──────────────────────────────────────────────────────────────

export async function getStudentQuizReview(userId: number, quizUuid: string) {
    const quiz = await prisma.quiz.findFirst({
        where: { uuid: quizUuid, deleted_at: null },
        include: { module: { include: { subject: { select: { subject_name: true } } } } },
    });
    if (!quiz) return null;

    // Latest finished attempt
    const attempt = await prisma.attempt.findFirst({
        where: { userId, quizId: quiz.id, isFinished: true },
        orderBy: { created_at: "desc" },
    });
    if (!attempt) return null;

    const questions = await prisma.questions.findMany({
        where:   { quizId: quiz.id, deleted_at: null },
        orderBy: { order_index: "asc" },
        include: {
            options: {
                orderBy: { order_index: "asc" },
                select: {
                    id:           true,
                    uuid:         true,
                    option_text:  true,
                    option_image: true,
                    is_correct:   true,
                },
            },
        },
    });

    const answers = await prisma.answers.findMany({
        where: { attemptId: attempt.id },
    });
    const answerMap = new Map(answers.map(a => [a.questionsId, a.optionsId]));

    const reviewQuestions = questions.map((q, idx) => {
        const selectedOptionId = answerMap.get(q.id) ?? null;
        const correctOption    = q.options.find(o => o.is_correct);
        const selectedOption   = q.options.find(o => o.id === selectedOptionId);
        const isCorrect        = selectedOption?.is_correct ?? false;

        return {
            idQuestion:        q.id,
            uuid:              q.uuid,
            question_index:    idx + 1,
            question_text:     q.question_text,
            question_image:    q.question_image,
            discussion:        q.discussion,
            difficulty:        q.difficulty,
            poin:              q.poin,
            options:           q.options.map(o => ({
                idOption:     o.id,
                uuid:         o.uuid,
                option_text:  o.option_text,
                option_image: o.option_image,
                is_correct:   o.is_correct,
            })),
            selected_option_id: selectedOptionId,
            correct_option_id:  correctOption?.id ?? 0,
            is_correct:         isCorrect,
            is_skipped:         selectedOptionId === null,
            is_marked_review:   false, // tidak disimpan di DB, client-side only
        };
    });

    const correctCount  = reviewQuestions.filter(q => q.is_correct).length;
    const wrongCount    = reviewQuestions.filter(q => !q.is_correct && !q.is_skipped).length;
    const skippedCount  = reviewQuestions.filter(q => q.is_skipped).length;

    const scoreRecord = await prisma.scores.findFirst({
        where: { attemptId: attempt.id },
    });

    return {
        quiz_uuid:      quiz.uuid,
        quiz_title:     quiz.quiz_title,
        subject_name:   quiz.module?.subject?.subject_name ?? "—",
        difficulty:     quiz.difficulty,
        total_questions: questions.length,
        correct_count:  correctCount,
        wrong_count:    wrongCount,
        skipped_count:  skippedCount,
        score:          scoreRecord?.score ?? 0,
        questions:      reviewQuestions,
    };
}

// ─── Student Progress ─────────────────────────────────────────────────────────

export async function getStudentProgress(userId: number) {
    const user = await prisma.user.findFirst({
        where: { id: userId },
        include: { streak: true, class: { select: { class_name: true } } },
    });
    if (!user || !user.classId || !user.class) return null;

    const allScores = await prisma.scores.findMany({
        where: { userId },
        include: {
            quiz: {
                include: {
                    module: { include: { subject:   { select: { subject_name: true, uuid: true } } } },
                    questions: { where: { deleted_at: null }, select: { id: true } },
                },
            },
        },
        orderBy: { created_at: "asc" },
    });

    const avgScore = await calculateAverageScore(userId, user.classId);

    // ── Subject progress ───────────────────────────────────────────────────────
    const subjectClasses = await prisma.subjectClass.findMany({
        where: { classId: user.classId },
        include: {
            subject: {
                include: {
                    modules: {
                        include: {
                            quizzes: {
                                where: { deleted_at: null },
                                select: { id: true },
                            },
                        }
                    }
                },
            },
        },
    });

    const subjectProgress = await Promise.all(subjectClasses.map(async sc => {
        const s           = sc.subject;
        const allQuizzes  = s.modules.flatMap(m => m.quizzes);
        const quizIds     = allQuizzes.map(q => q.id);
        const subScores   = allScores.filter(sc2 => quizIds.includes(sc2.quizId));
        const completed   = new Set(subScores.map(s2 => s2.quizId)).size;
        const avgScore    = await calculateAverageScore(userId, user.classId, s.uuid);
        const mastery     = allQuizzes.length > 0
            ? Math.round((completed / allQuizzes.length) * 100)
            : 0;

        // Trend: compare last 3 vs previous 3
        const sorted    = [...subScores].sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
        const mid       = Math.ceil(sorted.length / 2);
        const firstHalf = sorted.slice(0, mid);
        const lastHalf  = sorted.slice(mid);
        const firstAvg  = firstHalf.length > 0
            ? firstHalf.reduce((a, b) => a + b.score, 0) / firstHalf.length
            : 0;
        const lastAvg   = lastHalf.length > 0
            ? lastHalf.reduce((a, b) => a + b.score, 0) / lastHalf.length
            : firstAvg;
        const trend: "UP" | "DOWN" | "STABLE" =
            lastAvg > firstAvg + 2 ? "UP" :
            lastAvg < firstAvg - 2 ? "DOWN" : "STABLE";

        return {
            subject_name:       s.subject_name,
            total_quiz:         allQuizzes.length,
            completed_quiz:     completed,
            average_score:      avgScore,
            mastery_percentage: mastery,
            trend,
        };
    }));

    // ── Monthly performance (last 6 months) ───────────────────────────────────
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const monthlyMap = new Map<string, number[]>();

    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = MONTHS[d.getMonth()];
        if (!monthlyMap.has(key)) monthlyMap.set(key, []);
    }

    for (const s of allScores) {
        const key = MONTHS[s.created_at.getMonth()];
        if (monthlyMap.has(key)) monthlyMap.get(key)!.push(s.score);
    }

    const monthlyPerformance = Array.from(monthlyMap.entries()).map(([month, scores]) => ({
        month,
        average_score:  scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0,
        quizzes_done: scores.length,
    }));

    // ── Accuracy trend (weekly, last 8 weeks) ─────────────────────────────────
    const accuracyTrend = [];
    const now2 = new Date();
    for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now2);
        weekStart.setDate(now2.getDate() - i * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekScores = allScores.filter(s => {
            const d = new Date(s.created_at);
            return d >= weekStart && d < weekEnd;
        });

        const totalC = weekScores.reduce((a, s) => a + s.correct, 0);
        const totalA = weekScores.reduce((a, s) => a + s.correct + s.wrong, 0);
        accuracyTrend.push({
            week:     `W${8 - i}`,
            accuracy: totalA > 0 ? Math.round((totalC / totalA) * 100) : 0,
        });
    }

    // ── Weak/strong topics (based on subject performance) ─────────────────────
    const subjectsSorted = [...subjectProgress].sort((a, b) => b.average_score - a.average_score);
    const strongTopics   = subjectsSorted.slice(0, 3).map(s => ({
        topic:    s.subject_name,
        subject:  s.subject_name,
        accuracy: s.average_score,
        attempts: s.completed_quiz,
    }));
    const weakTopics = [...subjectsSorted].reverse().slice(0, 3).map(s => ({
        topic:    s.subject_name,
        subject:  s.subject_name,
        accuracy: s.average_score,
        attempts: s.completed_quiz,
    }));

    // ── Overall ────────────────────────────────────────────────────────────────
    const totalQuizForClass = subjectClasses.reduce(
        (a, sc) => a + sc.subject.modules.flatMap(m => m.quizzes).length,
        0,
    );
    const completedQuizIds  = new Set(allScores.map(s => s.quizId)).size;
    const totalC2           = allScores.reduce((a, s) => a + s.correct, 0);
    const totalA2           = allScores.reduce((a, s) => a + s.correct + s.wrong, 0);

    return {
        overall: {
            average_score:    avgScore,
            learning_streak:  user.streak?.current_streak ?? 0,
            completed_quiz:   completedQuizIds,
            total_quiz:       totalQuizForClass,
            completion_rate:  totalQuizForClass > 0
                ? Math.round((completedQuizIds / totalQuizForClass) * 100)
                : 0,
            average_accuracy: totalA2 > 0 ? Math.round((totalC2 / totalA2) * 100) : 0,
            total_time_spent: allScores.reduce((a, s) => a + s.duration_used, 0),
        },
        subject_progress:    subjectProgress,
        monthly_performance: monthlyPerformance,
        accuracy_trend:      accuracyTrend,
        weak_topics:         weakTopics,
        strong_topics:       strongTopics,
        recent_activity: [],
    };
}


