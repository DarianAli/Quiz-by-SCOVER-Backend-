import { Response, Request } from "express"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient({ errorFormat: "pretty" })

export const startAttempt = async (request: Request, response: Response) => {
    const user = ( request as any ).user
    const { quizId } = request.body;

    const quiz = await prisma.quiz.findUnique ({
        where: { idQuiz: Number(quizId) }
    })

    if (!quiz) {
        return response.status(404).json({
            success: false,
            message: "quiz not found"
        })
    }

    const existing = await prisma.attempt.findUnique ({
        where: {
            userId_quizId: {
                userId: user.idUser,
                quizId: Number(quizId)       
            }
        }
    })

    if (existing) {
        return response.status(400).json({
            message: "quiz already started"
        })
    }

    const attempt = await prisma.attempt.create ({
        data: {
            userId: user.idUser,
            quizId: Number(quizId)
        }
    })

    response.json({
        attemptId: attempt.idAttempt,
        start_time: attempt.start_time,
        duration: quiz.duration
    })
}

export const submitAttempt = async (request: Request, response: Response) => {
    const user = ( request as any ).user
    const { attemptId } = request.body;

    const attempt = await prisma.attempt.findUnique ({
        where: { idAttempt: Number(attemptId) },
        include: {
            quiz: true
        }
    })

    if (!attempt) {
        return response.status(404).json({
            success: false,
            message: "attempt not found"
        })
    }

    if (attempt.userId !== user.idUser) {
        return response.status(403).json ({
            message: "unauthorized"
        })
    }

    if (attempt.finished_time) {
        return response.status(400).json({
            success: false,
            message: "attempt already submitted"
        })
    }

    const now = new Date()
    const started = attempt.start_time
    const durationMs = attempt.quiz.duration * 60 * 1000
    const elapsed = now.getTime() - started.getTime()
    const late = elapsed > durationMs

    const attemptUpdated = await prisma.attempt.update ({
        where: { idAttempt: Number(attemptId) },
        data: {
            finished_time: now,
            isFinished: true
        }
    })

    return response.status(200).json({
        success: true,
        message: late ? "Quiz Submitted late" : "Quiz submitted on time",
        late,
        durationAllowed: attempt.quiz.duration,
        timeUsedMinutes: Math.floor(elapsed / 60000),
        data: attemptUpdated
    })

}