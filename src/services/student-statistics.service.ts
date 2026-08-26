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
