import express from "express";
import {
    getAllQuiz, getQuizByUuid, createQuiz, updateQuiz, deleteQuiz, 
} from "../controller/quiz-controller";
import { startAttempt, submitAttempt } from "../controller/attempt-controller";
import {
    deleteLimiter, postLimiter, updateLimiter, attemptLimiter,
} from "../middleware/rateLimiter";
import { verifyRole, verifyToken } from "../middleware/auth";
import answerRouter from "./answerRouter";

const router = express.Router();

// ─── Quiz CRUD ─────────────────────────────────────────────────────────────────
router.get("/all",               [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"])], getAllQuiz);
router.get("/:uuid",             [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"])], getQuizByUuid);
router.post("/add",               [verifyToken, verifyRole(["ADMIN", "TENTOR"])], createQuiz);
router.put("/update/:uuid",      updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"])], updateQuiz);
router.delete("/delete/:uuid",   deleteLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"])], deleteQuiz);


// ─── Attempt ───────────────────────────────────────────────────────────────────
// NOTE: Semua endpoint menggunakan :uuid (string), BUKAN :id (integer)
router.post("/:uuid/attempt/start",   attemptLimiter, [verifyToken, verifyRole(["STUDENT", "ADMIN", "TENTOR"])], startAttempt);
router.post("/:uuid/attempt/submit",  postLimiter,    [verifyToken, verifyRole(["STUDENT", "ADMIN", "TENTOR"])], submitAttempt);

// ─── Answers (nested) — menggunakan :uuid sebagai parent param ────────────────
router.use("/:uuid/answers", answerRouter);

export default router;