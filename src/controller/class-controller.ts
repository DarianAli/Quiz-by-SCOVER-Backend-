import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../config/prisma";
import { ok, created, badRequest, notFound, serverError } from "../utils/response.util";
import { getPagination, buildMeta } from "../utils/pagination.util";

// ─── POST /class/add ─────────────────────────────────────────────────────────
export const createClass = async (request: Request, response: Response): Promise<void> => {
    try {
        const { class_name, class_program } = request.body;
        if (!class_name) { badRequest(response, "class_name is required."); return; }

        const newClass = await prisma.classes.create({
            data: {
                uuid: uuidv4(),
                class_name,
                class_program,
            },
        });

        created(response, "Successfully created a class.", newClass);
    } catch (error) {
        console.error("[createClass]", error);
        serverError(response);
    }
};

// ─── PUT /class/update/:uuid ─────────────────────────────────────────────────
export const classUpdate = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idClass } = request.params;
        const { class_name, class_program } = request.body;

        let findClass;
        if (!isNaN(Number(idClass))) {
            findClass = await prisma.classes.findFirst({ where: { id: Number(idClass) } });
        } else {
            findClass = await prisma.classes.findFirst({ where: { uuid: String(idClass) } });
        }

        if (!findClass) {
            notFound(response, "Class not found.");
            return;
        }

        const updateData = await prisma.classes.update({
            where: { id: findClass.id },
            data: {
                class_name: class_name ?? findClass.class_name,
                class_program: class_program ?? findClass.class_program,
            },
        });

        ok(response, "Successfully updated class data.", updateData);
    } catch (error) {
        console.error("[classUpdate]", error);
        serverError(response);
    }
};

// ─── GET /class/all ──────────────────────────────────────────────────────────
export const getAllData = async (request: Request, response: Response): Promise<void> => {
    try {
        const { search = "" } = request.query;
        const { skip, take, page, limit } = getPagination(request.query);

        const where = {
            class_name: { contains: String(search) },
        };

        const [total, classes] = await Promise.all([
            prisma.classes.count({ where }),
            prisma.classes.findMany({
                where,
                skip,
                take,
                orderBy: { id: "asc" },
            }),
        ]);

        ok(response, "Showing all class data.", classes, buildMeta(total, page, limit));
    } catch (error) {
        console.error("[getAllData]", error);
        serverError(response);
    }
};

// ─── GET /class/:uuid ────────────────────────────────────────────────────────
export const getById = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idClass } = request.params;

        let findClass;
        if (!isNaN(Number(idClass))) {
            findClass = await prisma.classes.findFirst({ where: { id: Number(idClass) } });
        } else {
            findClass = await prisma.classes.findFirst({ where: { uuid: String(idClass) } });
        }

        if (!findClass) {
            notFound(response, "Class not found.");
            return;
        }

        ok(response, "Show data by id.", findClass);
    } catch (error) {
        console.error("[getById]", error);
        serverError(response);
    }
};

// ─── DELETE /class/delete/:uuid ──────────────────────────────────────────────
export const deleteClass = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idClass } = request.params;

        let findClass;
        if (!isNaN(Number(idClass))) {
            findClass = await prisma.classes.findFirst({ where: { id: Number(idClass) } });
        } else {
            findClass = await prisma.classes.findFirst({ where: { uuid: String(idClass) } });
        }

        if (!findClass) {
            notFound(response, "Class not found.");
            return;
        }

        const deleteData = await prisma.classes.delete({
            where: { id: findClass.id },
        });

        ok(response, "Class deleted.", deleteData);
    } catch (error) {
        console.error("[deleteClass]", error);
        serverError(response);
    }
};
