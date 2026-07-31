import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../config/prisma.js";
import { ok, created, badRequest, notFound, unauthorized, serverError } from "../utils/response.util.js";

// ─── GET /module/subject/:subjectUuid ─────────────────────────────────────────
export const getModulesBySubject = async (req: Request, res: Response): Promise<void> => {
    try {
        const { subjectUuid } = req.params;

        const subject = await prisma.subject.findFirst({
            where: { uuid: String(subjectUuid), deleted_at: null },
            select: { id: true, subject_name: true }
        });

        if (!subject) { notFound(res, "Subject tidak ditemukan."); return; }

        const modules = await prisma.module.findMany({
            where: { subjectId: subject.id, deleted_at: null },
            orderBy: { order_index: "asc" },
            include: {
                quizzes: {
                    where: { deleted_at: null },
                    select: { id: true }
                }
            }
        });

        const data = modules.map(m => ({
            uuid: m.uuid,
            module_name: m.module_name,
            description: m.description,
            order_index: m.order_index,
            total_quiz: m.quizzes.length,
            created_at: m.created_at,
        }));

        ok(res, "Modules retrieved successfully.", { subject_name: subject.subject_name, modules: data });
    } catch (err) {
        console.error("[getModulesBySubject]", err);
        serverError(res);
    }
};

// ─── POST /module/add ─────────────────────────────────────────────────────────
export const createModule = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user || user.role !== "TENTOR") { unauthorized(res); return; }

        const { subjectUuid, module_name, description, order_index } = req.body;

        if (!subjectUuid || !module_name) {
            badRequest(res, "subjectUuid dan module_name wajib diisi."); return;
        }

        const subject = await prisma.subject.findFirst({
            where: { uuid: subjectUuid, deleted_at: null },
            include: { subjectClass: true }
        });

        if (!subject) { notFound(res, "Subject tidak ditemukan."); return; }

        const dbUser = await prisma.user.findUnique({ where: { id: user.idUser } });
        if (!dbUser?.classId || !subject.subjectClass.some(sc => sc.classId === dbUser.classId)) {
            unauthorized(res, "Anda tidak memiliki akses ke subject ini."); return;
        }

        const newModule = await prisma.module.create({
            data: {
                uuid: uuidv4(),
                module_name,
                description: description ?? null,
                order_index: order_index ? Number(order_index) : 0,
                subjectId: subject.id,
            }
        });

        created(res, "Module berhasil dibuat.", {
            uuid: newModule.uuid,
            module_name: newModule.module_name,
            description: newModule.description,
            order_index: newModule.order_index,
        });
    } catch (err) {
        console.error("[createModule]", err);
        serverError(res);
    }
};

// ─── PUT /module/update/:uuid ──────────────────────────────────────────────────
export const updateModule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uuid } = req.params;
        const user = req.user;
        if (!user || user.role !== "TENTOR") { unauthorized(res); return; }

        const { module_name, description, order_index } = req.body;

        const mod = await prisma.module.findFirst({
            where: { uuid: String(uuid), deleted_at: null },
            include: { subject: { include: { subjectClass: true } } }
        });

        if (!mod) { notFound(res, "Module tidak ditemukan."); return; }

        const dbUser = await prisma.user.findUnique({ where: { id: user.idUser } });
        if (!dbUser?.classId || !mod.subject.subjectClass.some(sc => sc.classId === dbUser.classId)) {
            unauthorized(res, "Anda tidak memiliki akses ke module ini."); return;
        }

        const updated = await prisma.module.update({
            where: { id: mod.id },
            data: {
                module_name: module_name ?? mod.module_name,
                description: description !== undefined ? description : mod.description,
                order_index: order_index !== undefined ? Number(order_index) : mod.order_index,
            }
        });

        ok(res, "Module berhasil diperbarui.", {
            uuid: updated.uuid,
            module_name: updated.module_name,
            description: updated.description,
            order_index: updated.order_index,
        });
    } catch (err) {
        console.error("[updateModule]", err);
        serverError(res);
    }
};

// ─── DELETE /module/delete/:uuid ──────────────────────────────────────────────
export const deleteModule = async (req: Request, res: Response): Promise<void> => {
    try {
        const { uuid } = req.params;
        const user = req.user;
        if (!user || user.role !== "TENTOR") { unauthorized(res); return; }

        const mod = await prisma.module.findFirst({
            where: { uuid: String(uuid), deleted_at: null },
            include: { subject: { include: { subjectClass: true } } }
        });

        if (!mod) { notFound(res, "Module tidak ditemukan."); return; }

        const dbUser = await prisma.user.findUnique({ where: { id: user.idUser } });
        if (!dbUser?.classId || !mod.subject.subjectClass.some(sc => sc.classId === dbUser.classId)) {
            unauthorized(res, "Anda tidak memiliki akses ke module ini."); return;
        }

        await prisma.module.delete({ where: { id: mod.id } });

        ok(res, "Module berhasil dihapus.");
    } catch (err) {
        console.error("[deleteModule]", err);
        serverError(res);
    }
};
