import prisma from "../config/prisma.js";

/**
 * Calculates the average score for a student, based on the same logic used in Student Subject Detail:
 * 1. Only considers published quizzes (deleted_at: null, status: "PUBLISHED")
 * 2. Takes the latest score (most recent attempt) for each quiz
 * 3. Averages these latest scores
 * 4. Ignores quizzes that have not been completed (no score record)
 */
export async function calculateAverageScore(userId: number, classId: number | null, subjectUuid?: string): Promise<number> {
    if (!classId) return 0;

    const subjectsWhere = {
        subjectClass: { some: { classId } },
        ...(subjectUuid ? { uuid: subjectUuid } : {})
    };

    const subjects = await prisma.subject.findMany({
        where: subjectsWhere,
        include: {
            modules: {
                include: {
                    quizzes: {
                        where: { deleted_at: null, status: "PUBLISHED" },
                        include: {
                            scores: {
                                where: { userId },
                                orderBy: { created_at: "desc" },
                                take: 1,
                            }
                        }
                    }
                }
            }
        }
    });

    const latestScores = subjects
        .flatMap(subject => subject.modules.flatMap(m => m.quizzes))
        .flatMap(quiz => quiz.scores)
        .map(score => score.score);

    if (latestScores.length === 0) return 0;
    
    const total = latestScores.reduce((acc, score) => acc + score, 0);
    return Math.round(total / latestScores.length);
}

// ─── Prefetch helper (single query) ──────────────────────────────────────────

/**
 * Shape of each subject row returned by prefetchSubjectsWithScores.
 * Mirrors the Prisma include used inside calculateAverageScore so that
 * computeAverageScoreFromSubjects can apply identical filtering logic.
 */
export type SubjectWithPublishedScores = {
    uuid: string;
    modules: Array<{
        quizzes: Array<{
            scores: Array<{ score: number }>;
        }>;
    }>;
};

/**
 * Loads every subject in a class together with its PUBLISHED (non-deleted) quizzes
 * and the single latest score per quiz for the given user — in ONE database query.
 *
 * The returned array can be passed directly to computeAverageScoreFromSubjects.
 * This is intentionally separate from calculateAverageScore so callers that need
 * per-subject averages inside a loop can prefetch once and compute in-memory.
 *
 * Semantics are identical to calculateAverageScore:
 *   - deleted_at: null + status: "PUBLISHED" quiz filter
 *   - userId filter on scores
 *   - orderBy created_at desc, take: 1 (latest score per quiz)
 *   - soft-deleted quizzes excluded (deleted_at: null)
 */
export async function prefetchSubjectsWithScores(
    userId: number,
    classId: number,
): Promise<SubjectWithPublishedScores[]> {
    return prisma.subject.findMany({
        where: { subjectClass: { some: { classId } } },
        select: {
            uuid: true,
            modules: {
                select: {
                    quizzes: {
                        where: { deleted_at: null, status: "PUBLISHED" },
                        select: {
                            scores: {
                                where: { userId },
                                orderBy: { created_at: "desc" },
                                take: 1,
                                select: { score: true },
                            },
                        },
                    },
                },
            },
        },
    });
}

/**
 * Pure in-memory computation — no database calls.
 *
 * Given the array returned by prefetchSubjectsWithScores, compute the average
 * score for:
 *   - a specific subject (when subjectUuid is provided), or
 *   - all subjects across the class (when subjectUuid is omitted).
 *
 * The calculation is identical to calculateAverageScore:
 *   latest score per quiz → average → Math.round.
 */
export function computeAverageScoreFromSubjects(
    prefetched: SubjectWithPublishedScores[],
    subjectUuid?: string,
): number {
    const filtered = subjectUuid
        ? prefetched.filter(s => s.uuid === subjectUuid)
        : prefetched;

    const latestScores = filtered
        .flatMap(s => s.modules.flatMap(m => m.quizzes))
        .flatMap(q => q.scores)
        .map(s => s.score);

    if (latestScores.length === 0) return 0;
    const total = latestScores.reduce((acc, s) => acc + s, 0);
    return Math.round(total / latestScores.length);
}
