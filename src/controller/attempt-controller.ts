import { Response, Request } from "express"
import prisma from "../config/prisma";


export const startAttempt = async (request: Request, response: Response) => {
    try {
        const user = request.user
        const { idQuiz } = request.params;
        const id = Number(idQuiz)

        if (Number.isNaN(id)) {
            response.status(400).json({
            success: false,
            message: "id must be a number"
            })
            return
        }

        if (!user) {
                response.status(401).json({
                success: false,
                message: "unauthorized"
            })
            return
        }

        console.log(user)

    
        const quiz = await prisma.quiz.findUnique ({
            where: { idQuiz: Number(idQuiz) }
        })
    
        if (!quiz) {
                response.status(404).json({
                success: false,
                message: "quiz not found"
            })
            return
        }
    
        const existing = await prisma.attempt.findUnique ({
            where: {
                userId_quizId: {
                    userId: user.idUser,
                    quizId: Number(idQuiz)       
                }
            }
        })
    
        if (existing) {
                response.status(400).json({
                    success: false,
                    message: "quiz already started"
            })
            return
        }
    
        const attempt = await prisma.attempt.create ({
            data: {
                userId: user.idUser,
                quizId: Number(idQuiz)
            }
        })

    
        response.json({
            attemptId: attempt.idAttempt,
            start_time: attempt.start_time,
            duration: quiz.duration
        })
    } catch (error) {
            console.log(error)
            response.status(500).json({
            success: false,
            message: "failed to start attempt"
        })
        return
    }
}

export const submitAttempt = async (request: Request, response: Response) => {
    try {

        const user = request.user
        const { idAttempt } = request.params;
        const id = Number(idAttempt)

        if (Number.isNaN(id)) {
            response.status(400).json({
            success: false,
            message: "id must be a number"
            })
            return
        }

        if (!user) {
                response.status(401).json({
                success: false,
                message: "unauthorized"
            })
            return
        }

        const attempt = await prisma.attempt.findUnique ({
            where: { idAttempt: Number(idAttempt) },
            include: {
                quiz: true
            }
        })

        if (!attempt) {
            response.status(404).json({
            success: false,
            message: "attempt not found"
            })
            return
        }

        if (attempt.userId !== user.idUser) {
            response.status(403).json ({
            message: "unauthorized"
            })
            return
        }

        if (attempt.finished_time) {
            response.status(400).json({
                success: false,
                message: "attempt already submitted"
            })
            return
        }

        const now = new Date()
        const started = attempt.start_time
        const durationMs = attempt.quiz.duration * 60 * 1000
        const elapsed = now.getTime() - started.getTime()
        const late = elapsed > durationMs

        const attemptUpdated = await prisma.attempt.update ({
            where: { idAttempt: Number(idAttempt) },
            data: {
                finished_time: now,
                isFinished: true
            }
        })

            response.status(200).json({
            success: true,
            message: late ? "Quiz Submitted late" : "Quiz submitted on time",
            late,
            durationAllowed: attempt.quiz.duration,
            timeUsedMinutes: Math.floor(elapsed / 60000),
            data: attemptUpdated
        })
        return


    } catch (error) {
        console.log(error)
        response.status(500).json({
            success: false,
            message: "failed to Submit attempt"
        })
        return
    }
}