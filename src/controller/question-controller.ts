import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../config/prisma";


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

export const getAllQuestion = async (request: Request, response: Response) => {
    try {
        const { search } = request.query;

        const getAllQuestion = await prisma.questions.findMany ({
            where: { question_text: { contains: search?.toString() || "" } },
            include: {
                options: true,
                answers: true
            }
        })

            response.status(200).json({
            success: true,
            data : getAllQuestion,
            message : "All question found successfully"
        })
        return
    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to fetch all question."
        })
        return
    }
}

export const getQuestionById = async (request: Request, response: Response) => {
    try {
        const idQuestion = request.params.idQuestion;
        const id = Number(idQuestion)

        if (!idQuestion) {
                response.status(400).json({
                success: false,
                message: "id Question is required"
            })
            return
        }

        if (Number.isNaN(id)) {
            response.status(400).json({
                success: false,
                message: "id Question must be a number"
            })
            return
        }

        const findQuestion = await prisma.questions.findFirst ({
            where: { idQuestion: id },
            include: {
                options: true,
                answers: true
            }
        })

        if (!findQuestion) {
            response.status(404).json ({
                success: false,
                message: "question not found"
            })
            return
        }

        const AllQuesion = await prisma.questions.findMany ({
            include: {
                options: true,
                answers: true
            }
        })

        response.status(200).json({
            success: true,
            data: findQuestion,
            message: "question found successfully"
        })
        return

    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to fetch question."
        })
        return
    }
}

export const deleteQuestion = async (request: Request, response: Response) => {
    try{ 
        const { idQuestion } = request.params;
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

        const deletedQuestion = await prisma.questions.delete({
            where: { idQuestion: Number(idQuestion) }
        })

        response.status(200).json({
            success: true,
            data: deletedQuestion,
            message: "question deleted successfully"
        })
        return

    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to delete question."
        })
        return
    }
}