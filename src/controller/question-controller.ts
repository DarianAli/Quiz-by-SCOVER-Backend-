import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { BASE_URL } from "../global.js";
import fs from "fs";
import prisma from "../config/prisma.js";
import { ok, created, badRequest, notFound, serverError } from "../utils/response.util.js";
import { getPagination, buildMeta } from "../utils/pagination.util.js";
import { string } from "joi";

// ─── POST /question/add ──────────────────────────────────────────────────────
export const createQuestion = async (request: Request, response: Response): Promise<void> => {
    try {
        const { question_text, difficulty, poin, quizId, discussion, order_index } = request.body;
        
        let filename = "";
        if (request.file) filename = request.file.filename;

        // Resolve quiz by uuid

        const quiz = await prisma.quiz.findFirst({where: { uuid: String(quizId) }})
        if (!quiz) {
            notFound(response, "Quiz not found");
            return;
        }

        const parsedPoin = Number(poin)
        if (isNaN(parsedPoin)) {
            badRequest(response, "poin must be a valid number.")
            return;
        }

        const newQuestion = await prisma.questions.create({
            data: {
                uuid: uuidv4(),
                question_text,
                question_image: filename,
                difficulty: difficulty ?? "EASY",
                poin: parsedPoin,
                discussion: discussion ?? null,
                order_index: order_index ? Number(order_index) : 0,
                quizId: quiz.id,
            },
            include: {
                options: true,
            }
        });

        created(response, "Question created successfully.", newQuestion);
    } catch (error) {
        console.error("[createQuestion]", error);
        serverError(response);
    }
};

// ─── PUT /question/update/:uuid ──────────────────────────────────────────────
export const updateQuestion = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idQuestion } = request.params;
        const { question_text, difficulty, poin, discussion, order_index } = request.body;

        let findQuestion;
        if (!isNaN(Number(idQuestion))) {
            findQuestion = await prisma.questions.findFirst({ where: { id: Number(idQuestion) } });
        } else {
            findQuestion = await prisma.questions.findFirst({ where: { uuid: String(idQuestion) } });
        }

        if (!findQuestion) {
            notFound(response, "Question not found.");
            return;
        }

        let filename = findQuestion.question_image;
        if (request.file) {
            filename = request.file.filename;

            const path = `${BASE_URL}/public/question_image/${findQuestion.question_image}`;
            if (fs.existsSync(path) && findQuestion.question_image !== "") {
                fs.unlinkSync(path);
            }
        }

        const updatedQuestion = await prisma.questions.update({
            where: { id: findQuestion.id },
            data: {
                question_text: question_text ?? findQuestion.question_text,
                question_image: filename,
                difficulty: difficulty ?? findQuestion.difficulty,
                poin: poin !== undefined ? Number(poin) : findQuestion.poin,
                discussion: discussion !== undefined ? discussion : findQuestion.discussion,
                order_index: order_index !== undefined ? Number(order_index) : findQuestion.order_index,
            },
            include: {
                options: true,
            }
        });

        ok(response, "Question updated successfully.", updatedQuestion);
    } catch (error) {
        console.error("[updateQuestion]", error);
        serverError(response);
    }
};

// ─── GET /question/all ───────────────────────────────────────────────────────
export const getAllQuestion = async (request: Request, response: Response): Promise<void> => {
    try {
        const { search = "", quizId } = request.query;
        const { skip, take, page, limit } = getPagination(request.query);

        const where: any = {
            question_text: { contains: String(search) },
        };
        if (quizId) where.quizId = Number(quizId);

        const [total, questions] = await Promise.all([
            prisma.questions.count({ where }),
            prisma.questions.findMany({
                where,
                skip,
                take,
                orderBy: { order_index: "asc" },
                include: {
                    options: { orderBy: { order_index: "asc" } },
                }
            })
        ]);

        ok(response, "All questions found successfully.", questions, buildMeta(total, page, limit));
    } catch (error) {
        console.error("[getAllQuestion]", error);
        serverError(response);
    }
};

// ─── GET /question/:uuid ─────────────────────────────────────────────────────
export const getQuestionById = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idQuestion } = request.params;

        let findQuestion;
        if (!isNaN(Number(idQuestion))) {
            findQuestion = await prisma.questions.findFirst({
                where: { id: Number(idQuestion) },
                include: { options: { orderBy: { order_index: "asc" } } }
            });
        } else {
            findQuestion = await prisma.questions.findFirst({
                where: { uuid: String(idQuestion) },
                include: { options: { orderBy: { order_index: "asc" } } }
            });
        }

        if (!findQuestion) {
            notFound(response, "Question not found.");
            return;
        }

        ok(response, "Question found successfully.", findQuestion);
    } catch (error) {
        console.error("[getQuestionById]", error);
        serverError(response);
    }
};

// ─── DELETE /question/delete/:uuid ───────────────────────────────────────────
export const deleteQuestion = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idQuestion } = request.params;

        let findQuestion;
        if (!isNaN(Number(idQuestion))) {
            findQuestion = await prisma.questions.findFirst({ where: { id: Number(idQuestion) } });
        } else {
            findQuestion = await prisma.questions.findFirst({ where: { uuid: String(idQuestion) } });
        }

        if (!findQuestion) {
            notFound(response, "Question not found.");
            return;
        }

        const path = `${BASE_URL}/public/question_image/${findQuestion.question_image}`;
        if (fs.existsSync(path) && findQuestion.question_image !== "") {
            fs.unlinkSync(path);
        }

        const deletedQuestion = await prisma.questions.delete({
            where: { id: findQuestion.id }
        });

        ok(response, "Question deleted successfully.", deletedQuestion);
    } catch (error) {
        console.error("[deleteQuestion]", error);
        serverError(response);
    }
};
