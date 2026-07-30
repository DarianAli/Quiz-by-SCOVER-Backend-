import { Request, Response, NextFunction } from "express";
import Jwt from "jsonwebtoken";
import { JwtPayload } from "../types/express";

// ─── Verify JWT Token ─────────────────────────────────────────────────────────
export const verifyToken = (request: Request, response: Response, next: NextFunction): void => {
    const authHeader = request.headers.authorization as string | undefined;
    const token = request.cookies?.token || authHeader?.split(" ")[1];

    if (!token) {
        response.status(401).json({ success: false, message: "Token not found." });
        return;
    }

    const SECRET = process.env.SECRET;
    if (!SECRET) {
        console.error("[auth] JWT SECRET is not configured");
        response.status(500).json({ success: false, message: "Server configuration error." });
        return;
    }

    try {
        const decoded = Jwt.verify(token, SECRET) as JwtPayload;

        request.user = decoded;

        if (decoded.role === "ADMIN") {
            request.admin = decoded;
        }

        next();
    } catch (error) {
        response.status(401).json({ success: false, message: "Invalid or expired token." });
    }
};

// ─── Verify Role ──────────────────────────────────────────────────────────────
export const verifyRole = (allowedRoles: string[]) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        const user = request.user;

        if (!user) {
            response.status(401).json({ success: false, message: "Authentication required." });
            return;
        }

        if (!user.role || !allowedRoles.includes(user.role)) {
            response.status(403).json({
                success: false,
                message: `Access denied. Allowed roles: ${allowedRoles.join(", ")}.`,
            });
            return;
        }

        next();
    };
};