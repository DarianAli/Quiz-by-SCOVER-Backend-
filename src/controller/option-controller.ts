import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient({ errorFormat: "pretty" });

export const createOption = async (request: Request, response: Response) => {
    try {
        const { option_text, option_image, questionId } = request.body;
        const uuid = uuidv4();

        const parsedQuestionId = Number(questionId);

        if (Number.isNaN(parsedQuestionId) || Number.isNaN(parsedQuestionId)) {
            response.status(400).json({
                success: false,
                message: "questionId must be a number"
            })
            return
        }

        const newOption = await prisma.options.create({
            data: {
                uuid,
                option_text,
                option_image,
                is_correct: false,
                questionsId: parsedQuestionId
            },
            include: {
                answers: true,
                questions: true
            }
        })
        response.status(201).json({
            success: true,
            data: newOption,
            message: "option created successfully"
        })
        return
    }
    catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to create option"
        })
        return
    }
}
