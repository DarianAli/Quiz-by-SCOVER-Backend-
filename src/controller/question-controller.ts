import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { BASE_URL } from "../global.js";
import fs from "fs";
import prisma from "../config/prisma.js";
import { ok, created, badRequest, notFound, serverError, unauthorized, forbidden } from "../utils/response.util.js";
import { getPagination, buildMeta } from "../utils/pagination.util.js";

/** Bangun URL publik untuk gambar soal dari nama file relatif. */
function buildImageUrl(filename: string | null | undefined): string | null {
    if (!filename) return null;
    return `${process.env.NEXT_PUBLIC_BASE_API_URL ?? "http://localhost:9000"}/public/question_image/${filename}`;
}

/** Include untuk question_images di semua query Prisma — satu sumber kebenaran. */
const includeQuestionImages = {
    options: { orderBy: { order_index: "asc" as const } },
    question_images: { orderBy: { order_index: "asc" as const } },
} as const;

/** Include that also fetches child questions for STORY_GROUP parents. */
const includeWithChildren = {
    options: { orderBy: { order_index: "asc" as const } },
    question_images: { orderBy: { order_index: "asc" as const } },
    children: {
        where: { deleted_at: null },
        orderBy: { order_index: "asc" as const },
        include: {
            options: { orderBy: { order_index: "asc" as const } },
            question_images: { orderBy: { order_index: "asc" as const } },
        },
    },
} as const;

// ─── POST /question/add ──────────────────────────────────────────────────────
export const createQuestion = async (request: Request, response: Response): Promise<void> => {
    try {
        const {
            question_text, difficulty, poin, quizId, discussion, order_index,
            question_type, parentId, allow_multiple_answers, is_strict
        } = request.body;
        
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

        // Normalize question_type: frontend sends lowercase (e.g. "essay"), Prisma enum is UPPERCASE
        const normalizedType = question_type
            ? String(question_type).toUpperCase()
            : "MULTIPLE_CHOICE";

        // Resolve parentId: if given, verify it belongs to same quiz
        let resolvedParentId: number | null = null;
        if (parentId !== undefined && parentId !== null) {
            const parentQ = await prisma.questions.findFirst({
                where: { id: Number(parentId), quizId: quiz.id }
            });
            if (!parentQ) {
                badRequest(response, "parentId does not match a valid question in this quiz.");
                return;
            }
            resolvedParentId = parentQ.id;
        }

        const newQuestion = await prisma.questions.create({
            data: {
                uuid: uuidv4(),
                question_text,
                question_image: filename,
                difficulty: difficulty ?? "EASY",
                question_type: normalizedType as any,
                poin: parsedPoin,
                discussion: discussion ?? null,
                order_index: order_index ? Number(order_index) : 0,
                quizId: quiz.id,
                parentId: resolvedParentId,
                allow_multiple_answers: allow_multiple_answers === true || allow_multiple_answers === "true",
                is_strict: is_strict === true || is_strict === "true",
            },
            include: includeWithChildren,
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
        const {
            question_text, difficulty, poin, discussion, order_index,
            question_type, parentId, allow_multiple_answers, is_strict
        } = request.body;

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

        // Normalize question_type: frontend sends lowercase, Prisma enum is UPPERCASE
        const normalizedType = question_type
            ? String(question_type).toUpperCase()
            : undefined;

        // Resolve parentId change
        let resolvedParentId: number | null | undefined = undefined; // undefined = don't change
        if (parentId !== undefined) {
            if (parentId === null) {
                resolvedParentId = null;
            } else {
                const parentQ = await prisma.questions.findFirst({ where: { id: Number(parentId) } });
                resolvedParentId = parentQ ? parentQ.id : null;
            }
        }

        const updatedQuestion = await prisma.questions.update({
            where: { id: findQuestion.id },
            data: {
                question_text: question_text ?? findQuestion.question_text,
                question_image: filename,
                difficulty: difficulty ?? findQuestion.difficulty,
                question_type: normalizedType ? (normalizedType as any) : findQuestion.question_type,
                poin: poin !== undefined ? Number(poin) : findQuestion.poin,
                discussion: discussion !== undefined ? discussion : findQuestion.discussion,
                order_index: order_index !== undefined ? Number(order_index) : findQuestion.order_index,
                ...(resolvedParentId !== undefined ? { parentId: resolvedParentId } : {}),
                ...(allow_multiple_answers !== undefined ? {
                    allow_multiple_answers: allow_multiple_answers === true || allow_multiple_answers === "true"
                } : {}),
                ...(is_strict !== undefined ? {
                    is_strict: is_strict === true || is_strict === "true"
                } : {}),
            },
            include: includeWithChildren,
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
            parentId: null, // only return top-level questions in the list
        };
        if (quizId) where.quizId = Number(quizId);

        const [total, questions] = await Promise.all([
            prisma.questions.count({ where }),
            prisma.questions.findMany({
                where,
                skip,
                take,
                orderBy: { order_index: "asc" },
                include: includeWithChildren,
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
                include: includeWithChildren,
            });
        } else {
            findQuestion = await prisma.questions.findFirst({
                where: { uuid: String(idQuestion) },
                include: includeWithChildren,
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


// ─── DELETE /question/delete-many ───────────────────────────────────────────
export const deleteManyQuestion = async (request: Request, response: Response): Promise<void> => {
    try {
        const user = request.user;
        if (!user) {
            unauthorized(response);
            return;
        }

        const { quizId, questionIds } = request.body;

        if (!quizId) {
            badRequest(response, "quizId is required.");
            return;
        }

        if (!Array.isArray(questionIds) || questionIds.length === 0) {
            badRequest(response, "questionIds must be a non-empty array.");
            return;
        }

        // Fetch the quiz to verify ownership
        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(quizId) } });
        if (!quiz) {
            notFound(response, "Quiz not found.");
            return;
        }

        // Validate Tentor ownership
        if (user.role === "TENTOR" && quiz.created_by !== user.idUser) {
            forbidden(response, "Anda tidak memiliki akses untuk menghapus soal di quiz ini.");
            return;
        }

        // Fetch questions to ensure they belong to the quiz and to unlink images
        const questionsToDelete = await prisma.questions.findMany({
            where: {
                uuid: { in: questionIds.map(String) },
                quizId: quiz.id
            },
            include: {
                question_images: true,
                // also include children so we can collect their images too
                children: {
                    include: { question_images: true }
                }
            }
        });

        if (questionsToDelete.length === 0) {
            badRequest(response, "No valid questions found to delete in this quiz.");
            return;
        }

        // Unlink images from disk to clean up storage
        for (const q of questionsToDelete) {
            // Legacy single image
            if (q.question_image) {
                const pathStr = `${BASE_URL}/public/question_image/${q.question_image}`;
                if (fs.existsSync(pathStr)) {
                    fs.unlinkSync(pathStr);
                }
            }
            // Multi-images
            for (const img of q.question_images) {
                const multiImgPath = `${BASE_URL}/public/question_image/${img.filename}`;
                if (fs.existsSync(multiImgPath)) {
                    fs.unlinkSync(multiImgPath);
                }
            }
            // Children images (for STORY_GROUP — onDelete:Cascade handles DB, we clean disk)
            for (const child of (q as any).children ?? []) {
                if (child.question_image) {
                    const cp = `${BASE_URL}/public/question_image/${child.question_image}`;
                    if (fs.existsSync(cp)) fs.unlinkSync(cp);
                }
                for (const cimg of child.question_images ?? []) {
                    const cimgPath = `${BASE_URL}/public/question_image/${cimg.filename}`;
                    if (fs.existsSync(cimgPath)) fs.unlinkSync(cimgPath);
                }
            }
        }

        // Perform safe batch deletion via Prisma (triggers soft delete extension if configured)
        const deletedIds = questionsToDelete.map(q => q.id);
        const deletedResult = await prisma.questions.deleteMany({
            where: {
                id: { in: deletedIds }
            }
        });

        ok(response, "Questions deleted successfully.", {
            deletedCount: deletedResult.count,
            deletedQuestionIds: questionsToDelete.map(q => q.uuid)
        });
    } catch (error) {
        console.error("[deleteManyQuestion]", error);
        serverError(response);
    }
};
