import { Request, Response } from "express";
import bcrypt from "bcrypt";
import Jwt from "jsonwebtoken";
import prisma from "../config/prisma";
import { ok, unauthorized, notFound, serverError } from "../utils/response.util";

// ─── POST /auth/login ─────────────────────────────────────────────────────────
export const login = async (request: Request, response: Response): Promise<void> => {
    try {
        const { email, password } = request.body;

        const SECRET = process.env.SECRET;
        if (!SECRET) {
            serverError(response, "Server configuration error.");
            return;
        }

        // ── Try admin first ────────────────────────────────────────────────────
        const admin = await prisma.admin.findFirst({ where: { email } });
        if (admin) {
            const match = await bcrypt.compare(password, admin.password);
            if (!match) {
                unauthorized(response, "Invalid credentials.");
                return;
            }

            // Unified payload: idUser maps to admin.id so middleware works universally
            const payload = { idUser: admin.id, email: admin.email, userName: admin.username, role: "ADMIN" };
            const token   = Jwt.sign(payload, SECRET, { expiresIn: "1d" });

            const cookieOptions = {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax" as const,
                maxAge: 24 * 60 * 60 * 1000, // 1 day
                path: "/",
            };

            response.cookie("token", token, cookieOptions);
            response.cookie("role", "ADMIN", cookieOptions);

            ok(response, "Successfully logged in.", {
                token,
                role:     "ADMIN",
                email:    admin.email,
                userName: admin.username,
                idUser:   admin.id,
                uuid:     admin.uuid,
            });
            return;
        }

        // ── Try regular user ───────────────────────────────────────────────────
        const user = await prisma.user.findFirst({
            where: { email },
            include: { class: { select: { class_name: true, class_program: true } } },
        });

        if (!user) {
            notFound(response, "User not found.");
            return;
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            unauthorized(response, "Invalid credentials.");
            return;
        }

        const payload = { idUser: user.id, email: user.email, userName: user.userName, role: user.role };
        const token   = Jwt.sign(payload, SECRET, { expiresIn: "1d" });

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            maxAge: 24 * 60 * 60 * 1000, // 1 day
            path: "/",
        };

        response.cookie("token", token, cookieOptions);
        response.cookie("role", user.role, cookieOptions);

        ok(response, "Successfully logged in.", {
            token,
            role:        user.role,
            email:       user.email,
            userName:    user.userName,
            full_name:   user.full_name,
            idUser:      user.id,
            uuid:        user.uuid,
            photoProfile: user.photoProfile
                ? `${process.env.CORS_ORIGIN ?? "http://localhost:3000"}/public/user_image/${user.photoProfile}`
                : null,
            class_name:    user.class?.class_name ?? null,
            class_program: user.class?.class_program ?? null,
        });
    } catch (error) {
        console.error("[login]", error);
        serverError(response);
    }
};

// ─── POST /auth/logout ────────────────────────────────────────────────────────
export const logout = async (request: Request, response: Response): Promise<void> => {
    try {
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            path: "/",
        };

        response.clearCookie("token", cookieOptions);
        response.clearCookie("role", cookieOptions);

        ok(response, "Successfully logged out.", null);
    } catch (error) {
        console.error("[logout]", error);
        serverError(response);
    }
};
