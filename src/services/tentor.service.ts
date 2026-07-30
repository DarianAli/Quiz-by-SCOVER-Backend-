import prisma from "../config/prisma";

// ─── Tentor Dashboard ─────────────────────────────────────────────────────────

export async function getTentorDashboard(tentorId: number) {
    const tentor = await prisma.user.findFirst({
        where: { id: tentorId, role: "TENTOR" },
        include: { class: { select: { id: true, class_name: true, class_program: true } } },
    });
    if (!tentor) return null;

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
        include: { subject: { include: { quizzes: { where: { deleted_at: null }, select: { id: true } } } } },
    });
    const classQuizIds = subjectClasses.flatMap(sc => sc.subject.quizzes.map(q => q.id));

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
            quiz: { select: { uuid: true, quiz_title: true, difficulty: true } },
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
            student_uuid:    s.user.uuid,
            student_name:    s.user.full_name || s.user.userName,
            student_avatar:  s.user.photoProfile ? `/public/user_image/${s.user.photoProfile}` : null,
            quiz_uuid:       s.quiz.uuid,
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
    if (!tentor) return null;

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
        include: { subject: { include: { quizzes: { where: { deleted_at: null }, select: { id: true } } } } },
    });
    const totalClassQuiz = subjectClasses.reduce((a, sc) => a + sc.subject.quizzes.length, 0);

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
    const allAvg   = studentList.map(s => s.average_score).filter(v => v > 0);
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
    if (!tentor) return null;

    const student = await prisma.user.findFirst({
        where:   { uuid: studentUuid, classId: tentor.classId, role: "STUDENT" },
        include: {
            class:  { select: { uuid: true, class_name: true, class_program: true } }, // + uuid
            streak: true,
            scores: {
                include: {
                    quiz: {
                        include: { subject: { select: { subject_name: true, uuid: true } } },
                    },
                },
                orderBy: { created_at: "desc" },
            },
        },
    });
    if (!student) return null;

    // ── Subject mastery ─────────────────────────────────────────────────────
    const subjectClasses = await prisma.subjectClass.findMany({
        where: { classId: tentor.classId },
        include: {
            subject: {
                include: { quizzes: { where: { deleted_at: null }, select: { id: true } } },
            },
        },
    });

    const subjectMasteryRaw = subjectClasses.map(sc => {
        const qIds      = sc.subject.quizzes.map(q => q.id);
        const subScores = student.scores.filter(s => qIds.includes(s.quizId));
        const avg       = subScores.length > 0
            ? Math.round(subScores.reduce((a, s) => a + s.score, 0) / subScores.length)
            : 0;
        return {
            subject_name:  sc.subject.subject_name,
            average_score: avg,
            completed:     new Set(subScores.map(s => s.quizId)).size,
            total:         qIds.length,
            mastery:       qIds.length > 0
                ? Math.round((new Set(subScores.map(s => s.quizId)).size / qIds.length) * 100)
                : 0,
        };
    });

    // Bentuk dipakai SubjectPerformance & StudentDetail (subject = nama asli, bukan enum tetap)
    const subjectMastery = subjectMasteryRaw.map(sm => ({
        subject: sm.subject_name,
        label:   sm.subject_name,
        mastery: sm.mastery,
    }));

    const masterySorted = [...subjectMasteryRaw].sort((a, b) => b.average_score - a.average_score);
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
    const totalClassQuiz     = subjectMasteryRaw.reduce((a, sm) => a + sm.total, 0);
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
            lastActiveAt:           student.scores[0]?.created_at.toISOString() ?? new Date(0).toISOString(),
            atRisk:                 overallAvg > 0 && overallAvg < 60,
            strongestSubject:       strongest?.subject_name ?? "",
            strongestSubjectScore:  strongest?.average_score ?? 0,
            weakestSubject:         weakest?.subject_name ?? "",
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
            subject:  s.quiz.subject?.subject_name ?? "—",
            date:     s.created_at.toISOString(),
            score:    s.score,
            status:   "completed" as const,
        })),
        insights: [], // belum ada logic generate insight — array kosong aman, tidak crash
    };
}

