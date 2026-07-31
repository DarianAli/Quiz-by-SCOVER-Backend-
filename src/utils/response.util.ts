import { Response } from "express";

// ─── Standard API Response Helpers ───────────────────────────────────────────

export interface ApiMeta {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: unknown;
}

export const ok = (
    res: Response,
    message: string,
    data?: unknown,
    meta?: ApiMeta,
): Response =>
    res.status(200).json({
        success: true,
        message,
        ...(data !== undefined && { data }),
        ...(meta && { meta }),
    });

export const created = (
    res: Response,
    message: string,
    data?: unknown,
): Response =>
    res.status(201).json({
        success: true,
        message,
        ...(data !== undefined && { data }),
    });

export const badRequest = (res: Response, message: string): Response =>
    res.status(400).json({ success: false, message });

export const unauthorized = (
    res: Response,
    message = "Unauthorized.",
): Response => res.status(401).json({ success: false, message });

export const forbidden = (
    res: Response,
    message = "Access forbidden.",
): Response => res.status(403).json({ success: false, message });

export const notFound = (res: Response, message: string): Response =>
    res.status(404).json({ success: false, message });

export const conflict = (res: Response, message: string): Response =>
    res.status(409).json({ success: false, message });

export const serverError = (
    res: Response,
    message = "Internal server error.",
    error?: unknown
): Response => {
    return res.status(500).json({
        success: false,
        message,
        ...(error !== undefined && { 
            error: error instanceof Error ? error.message : String(error)
        }),
    });
};
