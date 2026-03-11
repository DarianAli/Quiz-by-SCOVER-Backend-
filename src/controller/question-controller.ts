import { Response, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient({ errorFormat: "pretty" })

export const createQuestion = async (request: Request, response: Response) => {
    try {
        const { question_text, question_image, difficulty, poin, quizId } = request.body;
        const uuid = uuidv4()

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


export const updateQuestion = async (request: Request, response: Response) => {
    try {
        const { idQuestion } = request.params;
        const { question_text, question_image, difficulty, poin, quizId } = request.body;
        const id = Number(idQuestion)

        if (Number.isNaN(id)) {
            response.status(400).json({
                success: false,
                message: "id must be a number"
            })
            return
        }

        const findQuestion = await prisma.questions.findFirst ({
            where: { idQuestion: id }
        })

        if (!findQuestion) {
            response.status(404).json ({
                success: false,
                message: "question not found"
            })
            return
        }

        const parsedPoin = Number(poin);

        if (Number.isNaN(parsedPoin)) {
            response.status(400).json({
                success: false,
                message: "poin must be valid numbers"
            });
            return;
        }

        const updatedQuestion = await prisma.questions.update({
            where: { idQuestion: Number(idQuestion) },
            data: {
                question_text: question_text ?? findQuestion.question_text,
                question_image: question_image ?? findQuestion.question_image,
                difficulty: difficulty ?? findQuestion.difficulty,
                poin: parsedPoin ?? findQuestion.poin,
            }
        })

        response.status(200).json({
            status: true,
            data: updatedQuestion,
            message: "question updated successfully"
        })
        return

    }   catch (error) {
        console.error(error)
        response.status(500).json({
            status: false,
            message: `failed to update question.`
        })
        return
        }
}