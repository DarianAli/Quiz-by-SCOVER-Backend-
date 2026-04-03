import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { BASE_URL } from "../../global";
import fs from "fs";
import prisma from "../config/prisma";


export const createOption = async (request: Request, response: Response) => {
    try {
        const { option_text, option_image, questionId } = request.body;
        const uuid = uuidv4();

        let filename = "";
        if (request.file) filename = request.file.filename;

        const parsedQuestionId = Number(questionId);

        if (Number.isNaN(parsedQuestionId)) {
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
                option_image: filename,
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

export const updateOption = async (request: Request, response: Response) => {
    try {
        const { idOption } = request.params;
        const { option_text, option_image,  } = request.body;
        const id = Number(idOption)

        if (Number.isNaN(id)) {
            response.status(400).json({
                success: false,
                message: "id must be a number"
            })
            return
        }

        const findOption = await prisma.options.findFirst({
            where: { idOption: id }
        })

        if (!findOption) {
            response.status(404).json({
                success: false,
                message: "option not found"
            })
            return
        }

        let filename = findOption.option_image
        if (request.file) {
            filename = request.file.filename

            let path  = `${BASE_URL}/public/option_image/${findOption.option_image}`
            let exists = fs.existsSync(path)
            if(exists && findOption.option_image !== ``) fs.unlinkSync(path)
        }

        const updatedOption = await prisma.options.update({
            where: { idOption: id },
            data: {
                option_text: option_text ?? findOption.option_text,
                option_image: filename
            },
            include: {
                answers: true,
                questions: true
            }
        })
        response.status(200).json({
            success: true,
            data: updatedOption,
            message: "option updated successfully"
        })
        return
    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to update option"
        })
        return
    }
}

export const getAllOption = async (request: Request, response: Response) => {
    try {
        const { search } = request.query;

        const getAllOption = await prisma.options.findMany({
            where: { option_text: { contains: search?.toString() || "" } },
            include: {
                answers: true,
                questions: true
            }
        })

        response.status(200).json({
            success: true,
            data: getAllOption,
            message: "All option found successfully"
        })
        return
    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to fetch all option"
        })
        return
    }
}

export const getOptionById = async (request: Request, response: Response) => {
    try {
        const idOption = request.params.idOption;
        const id = Number(idOption)

        if (!idOption) {
                response.status(400).json({
                success: false,
                message: "id Option is required"
            })
            return
        }

        if (Number.isNaN(id)) {
            response.status(400).json({
                success: false,
                message: "id must be a number"
            })
            return
        }

        const findOption = await prisma.options.findFirst({
            where: { idOption: id },
            include: {
                answers: true,
                questions: true
            }
        })

        if (!findOption) {
            response.status(404).json({
                success: false,
                message: "option not found"
            })
            return
        }

        response.status(200).json({
            success: true,
            data: findOption,
            message: "option found successfully"
        })
        return
    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to fetch option"
        })
        return
    }
}

export const deleteOption = async (request: Request, response: Response) => {
    try {
        const { idOption } = request.params;
        const id = Number(idOption)

        if (Number.isNaN(id)) {
            response.status(400).json({
                success: false,
                message: "id must be a number"
            })
            return
        }

        const findOption = await prisma.options.findFirst({
            where: { idOption: id }
        })

        if (!findOption) {
            response.status(404).json({
                success: false,
                message: "option not found"
            })
            return
        }

        let path = `${BASE_URL}/public/option_image/${findOption.option_image}`
        let exists = fs.existsSync(path)
        if(exists && findOption.option_image !== ``) fs.unlinkSync(path)


        const deletedOption = await prisma.options.delete({
            where: { idOption: id }
        })

        response.status(200).json({
            success: true,
            data: deletedOption,
            message: "option deleted successfully"
        })
        return

    } catch (error) {
        console.error(error)
        response.status(500).json({
            success: false,
            message: "failed to delete option"
        })
        return
    }
}