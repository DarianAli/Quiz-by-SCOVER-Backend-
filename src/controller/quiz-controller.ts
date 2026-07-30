import { Request, Response } from "express";
import { v4 as uuidv4 }      from "uuid";
import prisma                 from "../config/prisma";
import {
    ok, created, badRequest, notFound, unauthorized, serverError, forbidden
} from "../utils/response.util";
import { getPagination, buildMeta } from "../utils/pagination.util";

// ─── GET /quiz/all ────────────────────────────────────────────────────────────
export const getAllQuiz = async (req: Request, res: Response): Promise<void> => {
    try {
        const { search = "", subjectId, difficulty, status } = req.query;
        const { skip, take, page, limit } = getPagination(req.query);

        const where: Record<string, unknown> = {
            quiz_title: { contains: String(search) },
        };

        if (subjectId) where.subjectId = Number(subjectId);
        if (difficulty) where.difficulty = String(difficulty).toUpperCase();
        if (status)     where.status     = String(status).toUpperCase();

        const [total, quizzes] = await Promise.all([
            prisma.quiz.count({ where }),
            prisma.quiz.findMany({
                where,
                skip,
                take,
                orderBy: { created_at: "desc" },
                include: {
                    subject:   { select: { uuid: true, subject_name: true } },
                    questions: { where: { deleted_at: null }, select: { id: true } },
                    _count:    { select: { attempts: true, scores: true } },
                },
            }),
        ]);

        const data = quizzes.map(q => ({
            uuid:            q.uuid,
            quiz_title:      q.quiz_title,
            quiz_date:       q.quiz_date,
            duration:        q.duration,
            status:          q.status,
            difficulty:      q.difficulty,
            retake_policy:   q.retake_policy,
            max_attempts:    q.max_attempts,
            subject:         q.subject,
            total_questions: q.questions.length,
            total_attempts:  q._count.attempts,
            created_at:      q.created_at,
        }));

        ok(res, "Quizzes retrieved successfully.", data, buildMeta(total, page, limit));
    } catch (err) {
        console.error("[getAllQuiz]", err);
        serverError(res);
    }
};

// ─── GET /quiz/:uuid ──────────────────────────────────────────────────────────
export const getQuizByUuid = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uuid } = req.params;

        const quiz = await prisma.quiz.findFirst({
            where: { uuid: String(uuid) },
            include: {
                subject:   { select: { uuid: true, subject_name: true } },
                questions: {
                    where:   { deleted_at: null },
                    orderBy: { order_index: "asc" },
                    include: {
                        options: {
                            orderBy: { order_index: "asc" },
                        },
                    },
                },
            },
        });

        if (!quiz) { notFound(res, "Quiz tidak ditemukan."); return; }

        ok(res, "Quiz retrieved successfully.", quiz);
    } catch (err) {
        console.error("[getQuizById]", err);
        serverError(res);
    }
};

// ─── POST /quiz/add ───────────────────────────────────────────────────────────
export const createQuiz = async (req: Request, res: Response): Promise<void> => {
    try {
        const user  = req.user;
        if (!user) { unauthorized(res); return; }

        const {
            quiz_title, quiz_date, duration, status, difficulty,
            subjectId, retake_policy, max_attempts,
        } = req.body;

        if (!duration || Number(duration) <= 0) {
            badRequest(res, "Duration harus lebih dari 0."); return;
        }

        if (!quiz_title) { badRequest(res, "quiz_title wajib diisi."); return; }

        // Validate subject if provided
        let resolvedSubjectId: number | null = null;
        if (subjectId) {
            const subject = await prisma.subject.findFirst({
                where: { uuid: String(subjectId) }
            })
            if (!subject) { notFound(res, "Subject tidak ditemukan."); return; }
            resolvedSubjectId = subject.id
        }

        const VALID_STATUSES = ["DRAFT", "PUBLISHED"];
        const quizStatus = String(status || "DRAFT").toUpperCase();
        if (!VALID_STATUSES.includes(quizStatus)) {
            badRequest(res, "status harus DRAFT atau PUBLISHED"); return;
        }

        // Validate retake_policy
        const VALID_POLICIES = ["ONCE", "LIMITED", "UNLIMITED"];
        const policy = String(retake_policy ?? "ONCE").toUpperCase();
        if (!VALID_POLICIES.includes(policy)) {
            badRequest(res, "retake_policy harus ONCE, LIMITED, atau UNLIMITED."); return;
        }

        if (policy === "LIMITED" && (!max_attempts || Number(max_attempts) < 1)) {
            badRequest(res, "max_attempts wajib diisi dan >= 1 jika retake_policy = LIMITED."); return;
        }

        const newQuiz = await prisma.quiz.create({
            data: {
                uuid:          uuidv4(),
                quiz_title,
                quiz_date:     quiz_date ? new Date(quiz_date) : new Date(),
                duration:      Number(duration),
                status:        quizStatus as "DRAFT" | "PUBLISHED",
                difficulty:    difficulty  ?? "EASY",
                subjectId:     resolvedSubjectId,
                retake_policy: policy as "ONCE" | "LIMITED" | "UNLIMITED",
                max_attempts:  policy === "LIMITED" ? Number(max_attempts) : null,
                created_by:    user.idUser ?? null,
                creator_role:  user.role   as "ADMIN" | "TENTOR" | "STUDENT",
            },
            include: {
                subject: { select: { uuid: true, subject_name: true } },
            },
        });

        created(res, "Quiz berhasil dibuat.", newQuiz);
    } catch (err) {
        console.error("[createQuiz]", err);
        serverError(res);
    }
};

// ─── PUT /quiz/update/:uuid ───────────────────────────────────────────────────
export const updateQuiz = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uuid } = req.params;
        const user = req.user;
        const { quiz_title, quiz_date, duration, status, difficulty, subjectId, retake_policy, max_attempts } = req.body;

        if (!user) {
            unauthorized(res, "Authentication required.");
            return
        }

        const quiz = await prisma.quiz.findFirst({ where: { uuid: String(uuid) } });
        if (!quiz) { notFound(res, "Quiz tidak ditemukan."); return; }

        if (user.role === "TENTOR" && quiz.created_by !== user?.idUser) {
            forbidden(res, "Anda tidak memiliki akses untuk mengubah quiz ini.")
            return
        }

        const VALID_STATUSES = ["DRAFT", "PUBLISHED"];
        const quizStatus = status ? String(status).toUpperCase() : quiz.status;
        if (!VALID_STATUSES.includes(quizStatus)) {
            badRequest(res, "status harus DRAFT atau PUBLISHED."); return;
        }

        const VALID_POLICIES = ["ONCE", "LIMITED", "UNLIMITED"];
        const policy = retake_policy
            ? String(retake_policy).toUpperCase()
            : quiz.retake_policy;

        if (!VALID_POLICIES.includes(policy)) {
            badRequest(res, "retake_policy harus ONCE, LIMITED, atau UNLIMITED."); return;
        }

        const updated = await prisma.quiz.update({
            where: { id: quiz.id },
            data: {
                quiz_title:    quiz_title  ?? quiz.quiz_title,
                quiz_date:     quiz_date   ? new Date(quiz_date) : quiz.quiz_date,
                duration:      duration    ? Number(duration)    : quiz.duration,
                status:        quizStatus as "DRAFT" | "PUBLISHED",
                difficulty:    difficulty  ?? quiz.difficulty,
                subjectId:     subjectId !== undefined ? Number(subjectId) : quiz.subjectId,
                retake_policy: policy as "ONCE" | "LIMITED" | "UNLIMITED",
                max_attempts:  policy === "LIMITED"
                    ? Number(max_attempts ?? quiz.max_attempts)
                    : null,
            },
            include: { subject: { select: { uuid: true, subject_name: true } } },
        });

        ok(res, "Quiz berhasil diperbarui.", updated);
    } catch (err) {
        console.error("[updateQuiz]", err);
        serverError(res);
    }
};

// ─── DELETE /quiz/delete/:id (soft delete via Prisma extension) ─────────────
export const deleteQuiz = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const where = !isNaN(Number(id))
            ? { id: Number(id) }
            : { uuid: String(id) };

        const quiz = await prisma.quiz.findFirst({ where });
        if (!quiz) { notFound(res, "Quiz tidak ditemukan."); return; }

        await prisma.quiz.delete({ where: { id: quiz.id } });

        ok(res, "Quiz berhasil dihapus.");
    } catch (err) {
        console.error("[deleteQuiz]", err);
        serverError(res);
    }
};

