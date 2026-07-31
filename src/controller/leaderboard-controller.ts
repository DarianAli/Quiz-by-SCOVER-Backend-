import { Request, Response } from "express";
import { getClassLeaderboard } from "../services/leaderboard.service.js";
import { ok, unauthorized, serverError, badRequest } from "../utils/response.util.js";
import prisma from "../config/prisma.js";

// GET /leaderboard — leaderboard kelas student yang sedang login
export const getMyClassLeaderboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user?.idUser) { unauthorized(res); return; }

        const quizId  = req.query.quizId ? Number(req.query.quizId) : undefined;
        const limit   = Number(req.query.limit) || 20;

        // Get student's class
        const student = await prisma.user.findFirst({
            where:  { id: user.idUser },
            select: { classId: true },
        });

        if (!student || !student.classId) { unauthorized(res, "Student not found or has no class."); return; }

        const data = await getClassLeaderboard(student.classId, user.idUser, quizId, limit);

        ok(res, "Leaderboard retrieved successfully.", data.leaderboard, {
            total:           data.total,
            currentUserRank: data.currentUserRank,
        });
    } catch (err) {
        console.error("[getMyClassLeaderboard]", err);
        serverError(res);
    }
};

// GET /leaderboard/class/:classId — admin/tentor: leaderboard kelas tertentu
export const getLeaderboardByClass = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) { unauthorized(res); return; }

        const classId = Number(req.params.classId);
        if (isNaN(classId)) { badRequest(res, "classId must be a number."); return; }

        const quizId  = req.query.quizId ? Number(req.query.quizId) : undefined;
        const limit   = Number(req.query.limit) || 50;
        const viewerId = user.idUser ?? 0;

        const data = await getClassLeaderboard(classId, viewerId, quizId, limit);

        ok(res, "Leaderboard retrieved successfully.", data.leaderboard, {
            total:           data.total,
            currentUserRank: data.currentUserRank,
        });
    } catch (err) {
        console.error("[getLeaderboardByClass]", err);
        serverError(res);
    }
};

