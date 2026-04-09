import express from "express"
import { submitAnswer, getMyProgress, getQuizReview, getQuizDifficulty } from "../controller/answer-controller"
import { verifyToken, verifyRole } from "../middleware/auth"
import { answerLimiter } from "../middleware/rateLimiter"

const router = express.Router({ mergeParams: true }) // mergeParams supaya :idQuiz dari parent terbaca
router.use(express.json())

// POST /quiz/:idQuiz/answers          — Siswa submit/update jawaban satu soal
router.post(
    "/",
    answerLimiter,
    [verifyToken, verifyRole(["STUDENT", "ADMIN", "TENTOR"])],
    submitAnswer
)

// GET /quiz/:idQuiz/answers/progress  — Cek progress & resume quiz
router.get(
    "/progress",
    [verifyToken, verifyRole(["STUDENT", "ADMIN", "TENTOR"])],
    getMyProgress
)

// GET /quiz/:idQuiz/answers/review    — Review jawaban setelah quiz selesai
router.get(
    "/review",
    [verifyToken, verifyRole(["STUDENT", "ADMIN", "TENTOR"])],
    getQuizReview
)

// GET /quiz/:idQuiz/answers/difficulty — Analitik kesulitan soal (admin/tentor)
router.get(
    "/difficulty",
    [verifyToken, verifyRole(["ADMIN", "TENTOR"])],
    getQuizDifficulty
)

export default router
