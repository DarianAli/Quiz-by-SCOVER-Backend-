import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import { ok, created, badRequest, notFound, conflict, serverError } from "../utils/response.util.js";

// ─── POST /internal/register-admin ────────────────────────────────────────────
export const createAdmin = async (request: Request, response: Response): Promise<void> => {
    try {
        const { username, password, email, phone_number } = request.body;

        if (!username || !password || !email) {
            badRequest(response, "Username, password, and email are required.");
            return;
        }

        const existingAdmin = await prisma.admin.findFirst({
            where: {
                OR: [
                    { email },
                    { username },
                    { phone_number: phone_number || "---" },
                ],
            },
        });

        if (existingAdmin) {
            conflict(response, "Admin with this email, username, or phone number already exists.");
            return;
        }

        const hashed = await bcrypt.hash(password, 10);
        const newAdmin = await prisma.admin.create({
            data: {
                uuid: uuidv4(),
                username,
                password: hashed,
                email,
                phone_number: phone_number || "",
            },
            select: {
                uuid: true,
                username: true,
                email: true,
                phone_number: true,
            },
        });

        created(response, "Admin created successfully.", newAdmin);
    } catch (error) {
        console.error("[createAdmin]", error);
        serverError(response);
    }
};

// ─── GET /internal/get-admin/:uuid ───────────────────────────────────────────
export const getAdminProfile = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idAdmin } = request.params; // we'll treat it as UUID for backwards compat if needed, but better id

        let admin;
        if (!isNaN(Number(idAdmin))) {
            admin = await prisma.admin.findFirst({ where: { id: Number(idAdmin) } });
        } else {
            admin = await prisma.admin.findFirst({ where: { uuid: String(idAdmin) } });
        }

        if (!admin) {
            notFound(response, "Admin not found.");
            return;
        }

        ok(response, "Admin profile retrieved successfully.", {
            id: admin.id,
            uuid: admin.uuid,
            username: admin.username,
            email: admin.email,
            phone_number: admin.phone_number,
        });
    } catch (error) {
        console.error("[getAdminProfile]", error);
        serverError(response);
    }
};

// ─── PUT /internal/update-admin/:uuid ────────────────────────────────────────
export const updateAdmin = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idAdmin } = request.params;
        const { username, email, phone_number } = request.body;

        let admin;
        if (!isNaN(Number(idAdmin))) {
            admin = await prisma.admin.findFirst({ where: { id: Number(idAdmin) } });
        } else {
            admin = await prisma.admin.findFirst({ where: { uuid: String(idAdmin) } });
        }

        if (!admin) {
            notFound(response, "Admin not found.");
            return;
        }

        const duplicates = await prisma.admin.findFirst({
            where: {
                OR: [
                    { username: username || "---" },
                    { email: email || "---" },
                    { phone_number: phone_number || "---" },
                ],
                NOT: { id: admin.id },
            },
        });

        if (duplicates) {
            conflict(response, "Email, username, or phone number already used by another admin.");
            return;
        }

        const updated = await prisma.admin.update({
            where: { id: admin.id },
            data: {
                username: username ?? admin.username,
                email: email ?? admin.email,
                phone_number: phone_number ?? admin.phone_number,
            },
            select: {
                uuid: true,
                username: true,
                email: true,
                phone_number: true,
            },
        });

        ok(response, "Successfully updated admin data.", updated);
    } catch (error) {
        console.error("[updateAdmin]", error);
        serverError(response);
    }
};

// ─── PUT /internal/password-admin/:uuid ──────────────────────────────────────
export const updatePassword = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idAdmin } = request.params;
        const { password } = request.body;

        if (!password) { badRequest(response, "Password is required."); return; }

        let admin;
        if (!isNaN(Number(idAdmin))) {
            admin = await prisma.admin.findFirst({ where: { id: Number(idAdmin) } });
        } else {
            admin = await prisma.admin.findFirst({ where: { uuid: String(idAdmin) } });
        }

        if (!admin) {
            notFound(response, "Account not found.");
            return;
        }

        const isSame = await bcrypt.compare(password, admin.password);
        if (isSame) {
            badRequest(response, "Password cannot be the same as old password.");
            return;
        }

        const hashed = await bcrypt.hash(password, 10);
        await prisma.admin.update({
            where: { id: admin.id },
            data: { password: hashed },
        });

        ok(response, "Successfully updated the password.");
    } catch (error) {
        console.error("[updatePassword]", error);
        serverError(response);
    }
};

// ─── DELETE /internal/delete-admin/:uuid ─────────────────────────────────────
export const deleteAdmin = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idAdmin } = request.params;

        let admin;
        if (!isNaN(Number(idAdmin))) {
            admin = await prisma.admin.findFirst({ where: { id: Number(idAdmin) } });
        } else {
            admin = await prisma.admin.findFirst({ where: { uuid: String(idAdmin) } });
        }

        if (!admin) {
            notFound(response, "Admin not found.");
            return;
        }

        const deleted = await prisma.admin.delete({
            where: { id: admin.id },
            select: {
                id: true,
                username: true,
                email: true,
            },
        });

        ok(response, "Successfully deleted admin.", deleted);
    } catch (error) {
        console.error("[deleteAdmin]", error);
        serverError(response);
    }
};
