import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient

// ─── Tentor Dashboard ─────────────────────────────────────────────────────────

export async function getTentorDashboard(tentorId: number) {
    const tentor = await prisma.user.findFirst({
        where: { id: tentorId, role: "TENTOR" },
        include: { class: { select: { id: true, class_name: true, class_program: true } } },
    });
    if (!tentor || !tentor.classId || !tentor.class) return null;

    const classId = tentor.classId;

    // Students in same class
    const students = await prisma.user.findMany({
        where:  { classId, role: "STUDENT" },
        select: { id: true },
    });
    const studentIds   = students.map(s => s.id);
    const totalStudent = studentIds.length;

    // All quizzes for this class
    const subjectClasses = await prisma.subjectClass.findMany({
        where: { classId },
        include: { subject: { include: { modules: { include: { quizzes: { where: { deleted_at: null }, select: { id: true } } } } } } },
    });
    const classQuizIds = subjectClasses.flatMap(sc => sc.subject?.modules.flatMap(m => m.quizzes.map(q => q.id)) || []);

    // Scores in this class
    const allScores = await prisma.scores.findMany({
        where: { userId: { in: studentIds }, quizId: { in: classQuizIds } },
        select: { userId: true, quizId: true, score: true, correct: true, wrong: true, created_at: true },
    });

    // Class average
    const classAvg = allScores.length > 0
        ? Math.round(allScores.reduce((a, s) => a + s.score, 0) / allScores.length)
        : 0;

    // Active students this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activeStudents = new Set(
        allScores.filter(s => s.created_at >= weekAgo).map(s => s.userId),
    ).size;

    // Students who have NOT submitted anything
    const submittedIds = new Set(allScores.map(s => s.userId));
    const inactiveCount = studentIds.filter(id => !submittedIds.has(id)).length;

    // Recent submissions
    const recentScores = await prisma.scores.findMany({
        where:   { userId: { in: studentIds }, quizId: { in: classQuizIds } },
        include: {
            user: { select: { uuid: true, full_name: true, userName: true, photoProfile: true } },
            quiz: { select: { uuid: true, quiz_title: true, difficulty: true, module: { select: { subject: { select: { subject_name: true } } } } } },
        },
        orderBy: { created_at: "desc" },
        take:    10,
    });

    return {
        tentor: {
            uuid:         tentor.uuid,
            full_name:    tentor.full_name,
            userName:     tentor.userName,
            class_name:   tentor.class.class_name,
            class_program: tentor.class.class_program,
        },
        stats: {
            total_student:    totalStudent,
            active_this_week: activeStudents,
            inactive_count:   inactiveCount,
            class_average:    classAvg,
            total_quiz:       classQuizIds.length,
        },
        recent_submissions: recentScores.map(s => ({
            student_uuid:    s.user?.uuid ?? "",
            student_name:    s.user?.full_name || s.user?.userName || "Deleted User",
            student_avatar:  s.user?.photoProfile ? `/public/user_image/${s.user.photoProfile}` : null,
            quiz_uuid:       s.quiz?.uuid ?? "",
            quiz_title:      s.quiz.quiz_title,
            difficulty:      s.quiz.difficulty,
            score:           s.score,
            correct:         s.correct,
            wrong:           s.wrong,
            submitted_at:    s.created_at.toISOString(),
        })),
    };
}

// ─── Tentor: Student List ─────────────────────────────────────────────────────

export async function getTentorStudentList(tentorId: number) {
    const tentor = await prisma.user.findFirst({
        where:  { id: tentorId, role: "TENTOR" },
        select: { classId: true },
    });
    if (!tentor || !tentor.classId) return null;

    const students = await prisma.user.findMany({
        where:   { classId: tentor.classId, role: "STUDENT" },
        include: {
            class: {
                select: { uuid: true, class_name: true }
            },
            scores: {
                select: { score: true, correct: true, wrong: true, accuracy: true, created_at: true },
                orderBy: { created_at: "desc" },
            },
            streak: { select: { current_streak: true } },
        },
        orderBy: { full_name: "asc" },
    });

    // Class quiz count
    const subjectClasses = await prisma.subjectClass.findMany({
        where: { classId: tentor.classId },
        include: { subject: { include: { modules: { include: { quizzes: { where: { deleted_at: null }, select: { id: true } } } } } } },
    });
    const totalClassQuiz = subjectClasses.reduce((a, sc) => a + (sc.subject?.modules.reduce((ma, m) => ma + m.quizzes.length, 0) || 0), 0);

    const studentList = students.map(s => {
        const completedCount = new Set(s.scores.map((sc) => sc)).size; // approximate
        const avgScore       = s.scores.length > 0
            ? Math.round(s.scores.reduce((a, sc) => a + sc.score, 0) / s.scores.length)
            : 0;
        const lastActive     = s.scores[0]?.created_at ?? null;
        const displayName    = s.full_name || s.userName;

        // Urutan kronologis (lama -> baru) untuk hitung trend & sparkline
        const chronological = [...s.scores].reverse();

        // Trend: bandingkan rata-rata separuh awal vs separuh terbaru
        const mid        = Math.ceil(chronological.length / 2);
        const olderHalf   = chronological.slice(0, mid);
        const recentHalf  = chronological.slice(mid);
        const olderAvg    = olderHalf.length > 0
            ? olderHalf.reduce((a, sc) => a + sc.score, 0) / olderHalf.length
            : 0;
        const recentAvg   = recentHalf.length > 0
            ? recentHalf.reduce((a, sc) => a + sc.score, 0) / recentHalf.length
            : olderAvg;
        const trendPct    = olderAvg > 0
            ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
            : 0;
        const trendDirection: "up" | "down" | "flat" =
            trendPct > 2 ? "up" : trendPct < -2 ? "down" : "flat";

        // Sparkline: maksimal 8 titik terakhir, urut kronologis
        const sparkline = chronological.slice(-8).map((sc, idx) => ({
            label: String(idx + 1),
            value: sc.score,
        }));

        // Inisial untuk avatar fallback
        const avatarInitials = displayName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(w => w[0]?.toUpperCase())
            .join("");

        const completionRate = totalClassQuiz > 0
            ? Math.round((completedCount / totalClassQuiz) * 100)
            : 0;

        return {
            id:              s.uuid,
            name:            displayName,
            avatarInitials,
            avatar:          s.photoProfile ? `/public/user_image/${s.photoProfile}` : null,
            classId:         s.class?.uuid ?? "",
            className:       s.class?.class_name ?? "",
            email:           s.email,
            averageScore:    avgScore,
            completionRate,
            completed_quiz:  completedCount,     // dipertahankan untuk kompatibilitas dgn kode lama yg mungkin masih pakai ini
            total_quiz:      totalClassQuiz,      // idem
            streakDays:      s.streak?.current_streak ?? 0,
            lastActiveAt:    lastActive?.toISOString() ?? new Date(0).toISOString(),
            atRisk:          avgScore > 0 && avgScore < 60,
            trend: {
                value:     Math.abs(trendPct),
                direction: trendDirection,
            },
            sparkline,
        };
    });

    // Class overview
    const allAvg   = studentList.map(s => s.averageScore).filter(v => v > 0);
    const classAvg = allAvg.length > 0 ? Math.round(allAvg.reduce((a, b) => a + b, 0) / allAvg.length) : 0;

    return {
        class_overview: {
            total_student:   students.length,
            class_average:   classAvg,
            top_score:       Math.max(0, ...allAvg),
            completion_rate: totalClassQuiz > 0
                ? Math.round(
                      (studentList.reduce((a, s) => a + s.completed_quiz, 0) /
                          (students.length * totalClassQuiz)) *
                          100,
                  )
                : 0,
        },
        students: studentList,
    };
}

// ─── Tentor: Student Detail ───────────────────────────────────────────────────

export async function getTentorStudentDetail(tentorId: number, studentUuid: string) {
    const tentor = await prisma.user.findFirst({
        where: { id: tentorId, role: "TENTOR" },
        select: { classId: true },
    });
    if (!tentor || !tentor.classId) return null;

    const student = await prisma.user.findFirst({
        where:   { uuid: studentUuid, classId: tentor.classId, role: "STUDENT" },
        include: {
            class:  { select: { uuid: true, class_name: true, class_program: true } }, // + uuid
            streak: true,
            scores: {
                include: {
                    quiz: {
                        include: { module: { include: { subject: { select: { subject_name: true, uuid: true } } } } },
                    },
                },
                orderBy: { created_at: "desc" },
            },
        },
    });
    if (!student || !student.class) return null;

    // ── Subject mastery ─────────────────────────────────────────────────────
    const subjectClasses = await prisma.subjectClass.findMany({
        where: { classId: tentor.classId },
        include: {
            subject: {
                include: { modules: { include: { quizzes: { where: { deleted_at: null }, select: { id: true } } } } },
            },
        },
    });

    const allModules = subjectClasses.flatMap(sc => 
        sc.subject?.modules.map(m => ({ ...m, subject_name: sc.subject.subject_name })) || []
    );

    const moduleMasteryRaw = allModules.map(m => {
        const qIds      = m.quizzes.map(q => q.id);
        const subScores = student.scores.filter(s => qIds.includes(s.quizId));
        const avg       = subScores.length > 0
            ? Math.round(subScores.reduce((a, s) => a + s.score, 0) / subScores.length)
            : 0;
        return {
            module_name:   m.module_name,
            subject_name:  m.subject_name,
            average_score: avg,
            completed:     new Set(subScores.map(s => s.quizId)).size,
            total:         qIds.length,
            mastery:       qIds.length > 0
                ? Math.round((new Set(subScores.map(s => s.quizId)).size / qIds.length) * 100)
                : 0,
        };
    });

    const subjectMastery = moduleMasteryRaw.map(mm => ({
        subject: mm.module_name,
        label:   `${mm.subject_name} - ${mm.module_name}`,
        mastery: mm.mastery,
    }));

    const masterySorted = [...moduleMasteryRaw].sort((a, b) => b.average_score - a.average_score);
    const strongest = masterySorted[0] ?? null;
    const weakest   = masterySorted[masterySorted.length - 1] ?? null;

    // ── Performance history: weekly / monthly / semester (dipakai PerformanceChart) ──
    const chronological = [...student.scores].reverse(); // lama -> baru
    const now = new Date();

    // Weekly — 8 minggu terakhir
    const weekly = [];
    for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - i * 7);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        const weekScores = chronological.filter(s => s.created_at >= weekStart && s.created_at < weekEnd);
        weekly.push({
            label: `W${8 - i}`,
            score: weekScores.length > 0
                ? Math.round(weekScores.reduce((a, s) => a + s.score, 0) / weekScores.length)
                : 0,
        });
    }

    // Monthly — 6 bulan terakhir
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const monthlyMap = new Map<string, number[]>();
    for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthlyMap.set(MONTHS[d.getMonth()], []);
    }
    for (const s of chronological) {
        const key = MONTHS[s.created_at.getMonth()];
        if (monthlyMap.has(key)) monthlyMap.get(key)!.push(s.score);
    }
    const monthly = Array.from(monthlyMap.entries()).map(([label, scores]) => ({
        label,
        score: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    }));

    // Semester — 4 periode 6-bulanan terakhir
    const semester = [];
    for (let i = 3; i >= 0; i--) {
        const periodEnd = new Date(now);
        periodEnd.setMonth(now.getMonth() - i * 6);
        const periodStart = new Date(periodEnd);
        periodStart.setMonth(periodEnd.getMonth() - 6);

        const periodScores = chronological.filter(s => s.created_at >= periodStart && s.created_at < periodEnd);
        semester.push({
            label: `Sem ${4 - i}`,
            score: periodScores.length > 0
                ? Math.round(periodScores.reduce((a, s) => a + s.score, 0) / periodScores.length)
                : 0,
        });
    }

    const performance = { weekly, monthly, semester };

    // ── Focus areas (dipakai FocusAreaCard — butuh objek, bukan string) ────
    const focusAreas = [...subjectMastery]
        .sort((a, b) => a.mastery - b.mastery)
        .slice(0, 3)
        .map(sm => ({
            id:           sm.subject,
            topic:        sm.subject,
            subject:      sm.subject,
            subjectLabel: sm.label,
            mastery:      sm.mastery,
        }));

    // ── Overall stats ───────────────────────────────────────────────────────
    const overallAvg = student.scores.length > 0
        ? Math.round(student.scores.reduce((a, s) => a + s.score, 0) / student.scores.length)
        : 0;
    const completedQuizCount = new Set(student.scores.map(s => s.quizId)).size;
    const totalClassQuiz     = moduleMasteryRaw.reduce((a, sm) => a + sm.total, 0);
    const displayName        = student.full_name || student.userName;
    const avatarInitials     = displayName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0]?.toUpperCase())
        .join("");

    return {
        student: {
            uuid:                   student.uuid,
            id:                     student.uuid,
            name:                   displayName,
            avatarInitials,
            avatar:                 student.photoProfile ? `/public/user_image/${student.photoProfile}` : null,
            classId:                student.class.uuid,
            className:              student.class.class_name,
            class_program:          student.class.class_program,
            email:                  student.email,
            averageScore:           overallAvg,
            completionRate:         totalClassQuiz > 0
                ? Math.round((completedQuizCount / totalClassQuiz) * 100)
                : 0,
            streakDays:             student.streak?.current_streak ?? 0,
            lastActiveAt:           student.scores[0]?.created_at?.toISOString() ?? new Date(0).toISOString(),
            atRisk:                 overallAvg > 0 && overallAvg < 60,
            strongestSubject:       strongest?.module_name ?? "",
            strongestSubjectScore:  strongest?.average_score ?? 0,
            weakestSubject:         weakest?.module_name ?? "",
            weakestSubjectScore:    weakest?.average_score ?? 0,
        },
        stats: {
            average_score:   overallAvg,
            completed_quiz:  completedQuizCount,
            current_streak:  student.streak?.current_streak ?? 0,
            longest_streak:  student.streak?.longest_streak ?? 0,
        },
        subjectMastery,
        performance,
        focusAreas,
        recentQuizzes: student.scores.slice(0, 5).map(s => ({
            id:       s.uuid,
            quizName: s.quiz.quiz_title,
            subject:  s.quiz.module?.subject?.subject_name ?? "—",
            date:     s.created_at.toISOString(),
            score:    s.score,
            status:   "completed" as const,
        })),
        insights: [], // belum ada logic generate insight — array kosong aman, tidak crash
    };
}

export async function getTentorSubjects(tentorId: number) {
    const tentor = await prisma.user.findFirst({
        where: {
            id: tentorId,
            role: Role.TENTOR,
            deleted_at: null
        },
        select: {
            classId: true
        }
    })

    if (!tentor || !tentor.classId) return null;

    const totalStudent = await prisma.user.count({
        where: {
            classId: tentor.classId,
            role: Role.STUDENT,
            deleted_at: null
        }
    })

    const subjects = await prisma.subjectClass.findMany({
        where: { classId: tentor.classId },
        include: {
            subject: {
                include: {
                    modules: {
                        include: {
                            quizzes: {
                                where: { deleted_at: null },
                                select: {
                                    id: true,
                                    status: true,
                                    _count: {
                                        select: {
                                            questions: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    })

    const students = await prisma.user.findMany({
        where: { classId: tentor.classId, role: Role.STUDENT, deleted_at: null },
        select: { id: true }
    })
    const studentIds = students.map(s => s.id)

    // Fetch all scores for these students
    const allScores = await prisma.scores.findMany({
        where: { userId: { in: studentIds } },
        orderBy: { created_at: "desc" }
    })

    // Helper to get latest score per (userId, quizId)
    // We already ordered by desc, so the first one we see is the latest
    const latestScores: typeof allScores = [];
    const seen = new Set<string>();
    for (const s of allScores) {
        const key = `${s.userId}-${s.quizId}`;
        if (!seen.has(key)) {
            seen.add(key);
            latestScores.push(s);
        }
    }
    
    return subjects.map(sc => {
        const subject = sc.subject;
        const allQuizzes = subject?.modules.flatMap(m => m.quizzes) || [];
        const totalQuizzes = allQuizzes.length;
        const publishedQuizzes = allQuizzes.filter(q => q.status === "PUBLISHED").length
        const draftQuizzes = allQuizzes.filter(q => q.status === "DRAFT").length

        // Menghitung akumulasi total soal pada seluruh quiz dalam project ini
        const total_questions = allQuizzes.reduce((acc, q) => acc + q._count.questions, 0)
        
        // Menghitung average score (hanya dari kuis PUBLISHED, skor terbaru tiap siswa)
        const publishedQuizIds = new Set(allQuizzes.filter(q => q.status === "PUBLISHED").map(q => q.id));
        const subjectScores = latestScores.filter(s => publishedQuizIds.has(s.quizId));
        const average_score = subjectScores.length > 0 
            ? Math.round(subjectScores.reduce((acc, s) => acc + s.score, 0) / subjectScores.length)
            : 0;

        // Completion rate: (Total unique kuis yang dikerjakan oleh siswa) / (Total kuis PUBLISHED * Total siswa)
        const expectedCompletions = publishedQuizzes * totalStudent;
        const actualCompletions = subjectScores.length; // Karena latestScores sudah unik per (userId, quizId)
        const completion_rate = expectedCompletions > 0
            ? Math.round((actualCompletions / expectedCompletions) * 100)
            : 0;

        return {
            id:     subject?.id ?? 0,
            uuid:   subject?.uuid ?? "",
            subject_name:   subject?.subject_name ?? "Deleted Subject",
            student_count:  totalStudent,
            total_quiz:     totalQuizzes,
            published_quiz: publishedQuizzes,
            draft_quiz:     draftQuizzes,
            total_question: total_questions,
            average_score:  average_score,
            completion_rate: completion_rate
        }
    })
}

// ─── Tentor Submissions (Essay Grading) ──────────────────────────────────────

export async function getTentorSubmissions(tentorId: number, query: any) {
    const tentor = await prisma.user.findFirst({
        where: { id: tentorId, role: "TENTOR" },
        select: { classId: true }
    });
    if (!tentor || !tentor.classId) return null;

    const classId = tentor.classId;

    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    const search = query.search || "";
    const statusFilter = query.status || "";
    const subjectFilter = query.subject || "";
    const quizFilter = query.quiz || "";
    const sort = query.sort || "newest";

    // Build the query where clause
    const whereClause: any = {
        quiz: {
            module: {
                subject: {
                    subjectClass: {
                        some: { classId: classId }
                    }
                }
            }
        },
        user: {
            classId: classId
        }
    };

    if (search) {
        whereClause.user.full_name = { contains: search };
    }
    if (statusFilter) {
        whereClause.review_status = statusFilter;
    }
    if (subjectFilter) {
        whereClause.quiz.module.subject.uuid = subjectFilter;
    }
    if (quizFilter) {
        whereClause.quiz.uuid = quizFilter;
    }

    let orderByClause: any = { created_at: "desc" };
    if (sort === "oldest") orderByClause = { created_at: "asc" };
    if (sort === "highest_score") orderByClause = { score: "desc" };
    if (sort === "lowest_score") orderByClause = { score: "asc" };

    const [submissions, totalItems] = await Promise.all([
        prisma.scores.findMany({
            where: whereClause,
            include: {
                user: { select: { uuid: true, full_name: true, userName: true, class: { select: { class_name: true } } } },
                quiz: { select: { uuid: true, quiz_title: true, module: { select: { subject: { select: { subject_name: true } } } } } },
                attempt: { select: { id: true, start_time: true, finished_time: true } }
            },
            orderBy: orderByClause,
            skip,
            take: limit,
        }),
        prisma.scores.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalItems / limit);

    return {
        data: submissions.map(s => ({
            id: s.attempt.id,
            student_name: s.user.full_name || s.user.userName,
            class_name: s.user.class?.class_name || "-",
            subject_name: s.quiz.module?.subject?.subject_name || "-",
            quiz_title: s.quiz.quiz_title,
            score: s.score,
            status: s.review_status,
            submitted_at: s.created_at,
            duration: s.duration_used
        })),
        pagination: {
            page,
            limit,
            totalItems,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
        }
    };
}

export async function getTentorSubmissionDetail(tentorId: number, attemptId: number) {
    const tentor = await prisma.user.findFirst({
        where: { id: tentorId, role: "TENTOR" },
        select: { classId: true }
    });
    if (!tentor || !tentor.classId) return null;

    const attempt = await prisma.attempt.findFirst({
        where: { id: attemptId },
        include: {
            user: { select: { classId: true, uuid: true, full_name: true, userName: true, class: { select: { class_name: true } } } },
            quiz: { select: { uuid: true, quiz_title: true, module: { select: { subject: { select: { subject_name: true } } } } } },
            score: true,
        }
    });

    if (!attempt || !attempt.score) return null;
    if (attempt.user.class?.class_name === undefined) return null; // Fallback check

    // Check if the student belongs to the tentor's class
    if (attempt.user.classId !== tentor.classId) {
        return null; // Unauthorized
    }

    const answers = await prisma.answers.findMany({
        where: { attemptId: attempt.id },
        include: {
            questions: {
                include: {
                    options: true
                }
            },
            options: true
        }
    });

    return {
        student: {
            name: attempt.user.full_name || attempt.user.userName,
            class: attempt.user.class?.class_name,
        },
        quiz: {
            subject: attempt.quiz.module?.subject?.subject_name,
            title: attempt.quiz.quiz_title,
        },
        score: {
            total: attempt.score.score,
            status: attempt.score.review_status,
            submitted_at: attempt.score.created_at,
            duration: attempt.score.duration_used,
        },
        answers: answers.map(ans => ({
            id: ans.id,
            question: {
                id: ans.questions.id,
                uuid: ans.questions.uuid,
                text: ans.questions.question_text,
                type: ans.questions.question_type,
                difficulty: ans.questions.difficulty,
                points: ans.questions.poin,
                options: ans.questions.options.map(opt => ({
                    id: opt.id,
                    uuid: opt.uuid,
                    text: opt.option_text,
                    is_correct: opt.is_correct
                }))
            },
            student_answer: {
                option_id: ans.optionsId,
                option_uuid: ans.options?.uuid,
                text: ans.answer_text,
                is_correct: ans.options?.is_correct ?? null,
                score: ans.score, // Essay score
                feedback: ans.feedback, // Essay feedback
            }
        }))
    };
}

export async function reviewTentorSubmission(tentorId: number, attemptId: number, reviews: { answerId: number, score: number, feedback: string }[]) {
    const tentor = await prisma.user.findFirst({
        where: { id: tentorId, role: "TENTOR" },
        select: { classId: true }
    });
    if (!tentor || !tentor.classId) return null;

    const attempt = await prisma.attempt.findFirst({
        where: { id: attemptId },
        include: { score: true, user: true, quiz: true }
    });

    if (!attempt || !attempt.score) return null;
    if (attempt.user.classId !== tentor.classId) return null;

    // Update each answer
    for (const review of reviews) {
        const answer = await prisma.answers.findFirst({
            where: { id: review.answerId, attemptId: attempt.id },
            include: { questions: true }
        });

        if (answer && (answer.questions.question_type === 'ESSAY' || answer.questions.question_type === 'SHORT_ANSWER')) {
            // Validate max score
            const finalScore = Math.min(Math.max(0, review.score), answer.questions.poin);
            await prisma.answers.update({
                where: { id: answer.id },
                data: {
                    score: finalScore,
                    feedback: review.feedback
                }
            });
        }
    }

    // Recalculate Total Score
    const allAnswers = await prisma.answers.findMany({
        where: { attemptId: attempt.id },
        include: { options: true, questions: true }
    });

    let correct = 0, wrong = 0, totalScoreRaw = 0;
    for (const ans of allAnswers) {
        if (ans.options) {
            // MC / TF
            if (ans.options.is_correct) {
                correct++;
                totalScoreRaw += ans.questions.poin;
            } else {
                wrong++;
            }
        } else if (ans.questions.question_type === 'ESSAY' || ans.questions.question_type === 'SHORT_ANSWER') {
            // Add manually graded score
            totalScoreRaw += ans.score || 0;
        }
    }

    const allQuestions = await prisma.questions.findMany({
        where: { quizId: attempt.quizId, deleted_at: null }
    });
    const maxScore = allQuestions.reduce((a, q) => a + q.poin, 0);
    const normalizedScore = maxScore > 0 ? Math.round((totalScoreRaw / maxScore) * 100) : 0;
    const accuracy = (correct + wrong) > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;

    // Update Scores Table
    await prisma.scores.update({
        where: { id: attempt.score.id },
        data: {
            score: normalizedScore,
            accuracy: accuracy,
            review_status: 'REVIEWED'
        }
    });

    return { success: true, new_score: normalizedScore };
}
