import prisma from "../config/prisma.js";

// ─── Class Leaderboard ────────────────────────────────────────────────────────
// Ranking berdasarkan total score per class (per quiz atau per subject)

export async function getClassLeaderboard(
    classId: number,
    currentUserId: number,
    quizId?: number,    // optional: per-quiz leaderboard
    limit = 20,
) {
    // Build quiz filter
    const quizFilter = quizId
        ? { quizId }
        : {
              quiz: {
                  module: {
                      subject: {
                          subjectClass: { some: { classId } },
                      },
                  },
              },
          };

    // Get all students in this class
    const usersInClass = await prisma.user.findMany({
        where: { classId },
        select: { id: true },
    });
    const userIds = usersInClass.map(u => u.id);

    // Aggregate best score per user per quiz, then sum
    const rawScores = await prisma.scores.findMany({
        where: {
            userId: { in: userIds },
            ...quizFilter,
        },
        select: {
            userId: true,
            quizId: true,
            score:  true,
        },
        orderBy: { score: "desc" },
    });

    // Best score per user per quiz
    const bestMap = new Map<string, number>();
    for (const s of rawScores) {
        const key   = `${s.userId}:${s.quizId}`;
        const prev  = bestMap.get(key) ?? 0;
        if (s.score > prev) bestMap.set(key, s.score);
    }

    // Sum best scores per user
    const userTotals = new Map<number, number>();
    for (const [key, score] of bestMap) {
        const uid = Number(key.split(":")[0]);
        userTotals.set(uid, (userTotals.get(uid) ?? 0) + score);
    }

    // Sort descending
    const sorted = Array.from(userTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

    // Fetch user info
    const topUserIds = sorted.map(([uid]) => uid);
    const users = await prisma.user.findMany({
        where: { id: { in: topUserIds } },
        select: { id: true, uuid: true, full_name: true, userName: true, photoProfile: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const leaderboard = sorted.map(([uid, totalScore], idx) => {
        const u = userMap.get(uid);
        return {
            rank:          idx + 1,
            id:            u?.uuid ?? String(uid),
            name:          u?.full_name || u?.userName || "—",
            avatar:        u?.photoProfile
                ? `/public/user_image/${u.photoProfile}`
                : null,
            point:         totalScore,
            isCurrentUser: uid === currentUserId,
        };
    });

    // Current user rank (even if not in top N)
    const allSorted = Array.from(userTotals.entries()).sort((a, b) => b[1] - a[1]);
    const currentUserRank = allSorted.findIndex(([uid]) => uid === currentUserId) + 1;

    return {
        leaderboard,
        currentUserRank: currentUserRank > 0 ? currentUserRank : null,
        total: allSorted.length,
    };
}

