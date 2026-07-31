import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { BASE_URL } from "../global.js";
import fs from "fs";
import prisma from "../config/prisma.js";
import { ok, created, badRequest, notFound, serverError } from "../utils/response.util.js";

// ─── POST /option/add ────────────────────────────────────────────────────────
export const createOption = async (request: Request, response: Response): Promise<void> => {
    try {
        const { option_text, questionId, is_correct, order_index } = request.body;

        let filename = "";
        if (request.file) filename = request.file.filename;

        const parsedQuestionId = Number(questionId);

        if (isNaN(parsedQuestionId)) {
            badRequest(response, "questionId must be a number.");
            return;
        }

        const newOption = await prisma.options.create({
            data: {
                uuid: uuidv4(),
                option_text,
                option_image: filename,
                is_correct: is_correct === "true" || is_correct === true,
                order_index: order_index ? Number(order_index) : 0,
                questionsId: parsedQuestionId,
            },
            include: {
                questions: { select: { uuid: true, question_text: true } }
            }
        });

        created(response, "Option created successfully.", newOption);
    } catch (error) {
        console.error("[createOption]", error);
        serverError(response);
    }
};

// ─── PUT /option/update/:uuid ────────────────────────────────────────────────
export const updateOption = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idOption } = request.params;
        const { option_text, is_correct, order_index } = request.body;

        let findOption;
        if (!isNaN(Number(idOption))) {
            findOption = await prisma.options.findFirst({ where: { id: Number(idOption) } });
        } else {
            findOption = await prisma.options.findFirst({ where: { uuid: String(idOption) } });
        }

        if (!findOption) {
            notFound(response, "Option not found.");
            return;
        }

        let filename = findOption.option_image;
        if (request.file) {
            filename = request.file.filename;

            const path = `${BASE_URL}/public/option_image/${findOption.option_image}`;
            if (fs.existsSync(path) && findOption.option_image !== "") {
                fs.unlinkSync(path);
            }
        }

        const updatedOption = await prisma.options.update({
            where: { id: findOption.id },
            data: {
                option_text: option_text ?? findOption.option_text,
                option_image: filename,
                is_correct: is_correct !== undefined ? (is_correct === "true" || is_correct === true) : findOption.is_correct,
                order_index: order_index !== undefined ? Number(order_index) : findOption.order_index,
            },
            include: {
                questions: { select: { uuid: true, question_text: true } }
            }
        });

        ok(response, "Option updated successfully.", updatedOption);
    } catch (error) {
        console.error("[updateOption]", error);
        serverError(response);
    }
};

// ─── GET /option/all ─────────────────────────────────────────────────────────
export const getAllOption = async (request: Request, response: Response): Promise<void> => {
    try {
        const { search = "" } = request.query;

        const optionsList = await prisma.options.findMany({
            where: { option_text: { contains: String(search) } },
            include: {
                questions: { select: { uuid: true, question_text: true } }
            }
        });

        ok(response, "All options found successfully.", optionsList);
    } catch (error) {
        console.error("[getAllOption]", error);
        serverError(response);
    }
};

// ─── GET /option/:uuid ───────────────────────────────────────────────────────
export const getOptionById = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idOption } = request.params;

        let findOption;
        if (!isNaN(Number(idOption))) {
            findOption = await prisma.options.findFirst({ where: { id: Number(idOption) } });
        } else {
            findOption = await prisma.options.findFirst({ where: { uuid: String(idOption) } });
        }

        if (!findOption) {
            notFound(response, "Option not found.");
            return;
        }

        ok(response, "Option found successfully.", findOption);
    } catch (error) {
        console.error("[getOptionById]", error);
        serverError(response);
    }
};

// ─── DELETE /option/delete/:uuid ─────────────────────────────────────────────
export const deleteOption = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idOption } = request.params;

        let findOption;
        if (!isNaN(Number(idOption))) {
            findOption = await prisma.options.findFirst({ where: { id: Number(idOption) } });
        } else {
            findOption = await prisma.options.findFirst({ where: { uuid: String(idOption) } });
        }

        if (!findOption) {
            notFound(response, "Option not found.");
            return;
        }

        const path = `${BASE_URL}/public/option_image/${findOption.option_image}`;
        if (fs.existsSync(path) && findOption.option_image !== "") {
            fs.unlinkSync(path);
        }

        const deletedOption = await prisma.options.delete({
            where: { id: findOption.id },
        });

        ok(response, "Option deleted successfully.", deletedOption);
    } catch (error) {
        console.error("[deleteOption]", error);
        serverError(response);
    }
};
