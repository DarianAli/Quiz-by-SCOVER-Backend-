import { Prisma } from "@prisma/client";
import prisma from "../config/prisma.js";

// ─── Class Leaderboard ────────────────────────────────────────────────────────
// Ranking berdasarkan total score per class (per quiz atau per subject)
//
// Semantics preserved from original:
//  - Only users whose classId matches are considered (soft-deleted users excluded
//    via Prisma soft-delete middleware on user.findMany).
//  - Repeated attempts: only the best (MAX) score per user per quiz counts.
//  - Total = sum of best-per-quiz scores across all applicable quizzes.
//  - Ties: stable descending sort (ties share the same position/rank implicitly
//    via idx+1; no gap/dense-rank change — identical to original JS sort).
//  - `limit` applies only to the returned leaderboard array.
//  - `currentUserRank` and `total` reflect the full class, not just top-N.
//  - Deleted quizzes (quiz.deleted_at IS NOT NULL) are excluded.
//  - Draft quizzes (quiz.status = 'DRAFT') are included (matches original — the
//    original Prisma filter did not check status, so we preserve that behavior).

// ─── Types ────────────────────────────────────────────────────────────────────

/** Row returned by the raw SQL aggregation queries. */
interface AggRow {
    userId: number | bigint;
    total:  number | bigint;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise BigInt → number so callers always get plain numbers. */
function toNum(v: number | bigint): number {
    return typeof v === "bigint" ? Number(v) : v;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getClassLeaderboard(
    classId:       number,
    currentUserId: number,
    quizId?:       number,    // optional: per-quiz leaderboard
    limit = 20,
) {
    // ── Step 1: get all (non-deleted) users in this class ─────────────────────
    // prisma.user.findMany is intercepted by the soft-delete middleware, which
    // automatically appends `deleted_at: null`. No manual filter needed.
    const usersInClass = await prisma.user.findMany({
        where:  { classId },
        select: { id: true },
    });

    if (usersInClass.length === 0) {
        return { leaderboard: [], currentUserRank: null, total: 0 };
    }

    const userIds = usersInClass.map(u => u.id);

    // ── Step 2: aggregate best-per-quiz then sum — pushed to MySQL ────────────
    //
    // Prisma's groupBy() can only do a single GROUP BY level. To replicate
    //   SUM( MAX(score) per (userId, quizId) ) per userId
    // we need a subquery, which requires raw SQL.
    //
    // All parameters are integers derived from auth-validated values or the DB
    // itself (userIds). They are passed via Prisma.sql placeholders — never
    // string-concatenated.

    let rows: AggRow[];

    if (quizId !== undefined) {
        // ── Per-quiz mode ─────────────────────────────────────────────────────
        // Only one quiz: best score per user = MAX(score) for that quiz.
        // Deleted-quiz guard: we filter quiz.deleted_at IS NULL via JOIN so that
        // if the quiz was soft-deleted, no rows are returned (all totals = 0).
        rows = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
            SELECT s.userId,
                   MAX(s.score) AS total
            FROM   scores   AS s
            JOIN   quizzes  AS q ON q.id = s.quizId
            WHERE  s.userId IN (${Prisma.join(userIds)})
              AND  s.quizId  = ${quizId}
              AND  q.deleted_at IS NULL
            GROUP  BY s.userId
        `);
    } else {
        // ── Class-wide mode ───────────────────────────────────────────────────
        // Best score per (userId, quizId), then sum per userId.
        // Quiz must belong to a subject that is linked to this class AND must
        // not be soft-deleted (q.deleted_at IS NULL).
        // The original Prisma filter was:
        //   quiz.module.subject.subjectClass.some({ classId })
        // which maps to the JOIN chain below.
        rows = await prisma.$queryRaw<AggRow[]>(Prisma.sql`
            SELECT inner_agg.userId,
                   SUM(inner_agg.best) AS total
            FROM (
                SELECT s.userId,
                       s.quizId,
                       MAX(s.score) AS best
                FROM   scores        AS s
                JOIN   quizzes       AS q  ON q.id  = s.quizId
                JOIN   modules       AS m  ON m.id  = q.moduleId
                JOIN   subjects      AS su ON su.id = m.subjectId
                JOIN   subject_classes AS sc ON sc.subjectId = su.id
                                            AND sc.classId   = ${classId}
                WHERE  s.userId    IN (${Prisma.join(userIds)})
                  AND  q.deleted_at  IS NULL
                  AND  m.deleted_at  IS NULL
                  AND  su.deleted_at IS NULL
                GROUP  BY s.userId, s.quizId
            ) AS inner_agg
            GROUP  BY inner_agg.userId
        `);
    }

    // ── Step 3: build sorted array (descending total) ─────────────────────────
    // Ties: preserve stable descending sort — identical to the original JS sort.
    const allSorted: Array<[number, number]> = rows
        .map(r => [toNum(r.userId), toNum(r.total)] as [number, number])
        .sort((a, b) => b[1] - a[1]);

    // ── Step 4: current-user rank (full list, before limit) ──────────────────
    const currentUserRank =
        allSorted.findIndex(([uid]) => uid === currentUserId) + 1 || null;

    // ── Step 5: slice to limit for the leaderboard ───────────────────────────
    const topSlice  = allSorted.slice(0, limit);
    const topUids   = topSlice.map(([uid]) => uid);

    // ── Step 6: fetch display info for top-N users ────────────────────────────
    const users = topUids.length > 0
        ? await prisma.user.findMany({
              where:  { id: { in: topUids } },
              select: {
                  id:           true,
                  uuid:         true,
                  full_name:    true,
                  userName:     true,
                  photoProfile: true,
              },
          })
        : [];

    const userMap = new Map(users.map(u => [u.id, u]));

    const leaderboard = topSlice.map(([uid, totalScore], idx) => {
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

    return {
        leaderboard,
        currentUserRank,
        total: allSorted.length,
    };
}
