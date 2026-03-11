import { Response, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createQuestion = async (request: Request, response: Response) => {
    try {
        const { question_text, question_image, difficulty, poin, quizId } = request.body;
        const uuid = uuidv4()

        if (!question_text || quizId === undefined || poin === undefined) {
            response.status(400).json({
                success: false,
                message: "Missing required fields: question_text, quizId, and poin are required"
            });
            return;
        }

        const parsedQuizId = Number(quizId);
        const parsedPoin = Number(poin);

        if (Number.isNaN(parsedQuizId) || Number.isNaN(parsedPoin)) {
            response.status(400).json({
                success: false,
                message: "quizId and poin must be valid numbers"
            });
            return;
        }


        const newQuestion = await prisma.questions.create({
            data: {
                uuid,
                question_text,
                question_image,
                difficulty,
                poin: parsedPoin,
                quizId: parsedQuizId
            },
            include: {
                options: true,
                answers: true
            }
        })
        response.status(201).json({
            success: true,
            data: newQuestion
        })       
        return

    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: `failed to create question.`
        })
        return
    }
}
