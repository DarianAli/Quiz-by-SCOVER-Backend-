import express from "express";
import { verifyToken, verifyRole } from "../middleware/auth";
import { getMyClassLeaderboard, getLeaderboardByClass } from "../controller/leaderboard-controller";

const router = express.Router();

// GET /leaderboard — untuk student: leaderboard kelas sendiri
router.get(
    "/",
    [verifyToken, verifyRole(["STUDENT", "TENTOR", "ADMIN"])],
    getMyClassLeaderboard,
);

// GET /leaderboard/class/:classId — untuk tentor/admin: leaderboard kelas tertentu
router.get(
    "/class/:classId",
    [verifyToken, verifyRole(["TENTOR", "ADMIN"])],
    getLeaderboardByClass,
);

export default router;
