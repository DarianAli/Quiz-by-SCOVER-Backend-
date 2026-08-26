import express from "express"
import { submitAnswer, getMyProgress, getQuizReview, getQuizDifficulty } from "../controller/answer-controller.js"
import { verifyToken, verifyRole } from "../middleware/auth.js"
import { answerLimiter } from "../middleware/rateLimiter.js"

// mergeParams: true — supaya :uuid dari parent route terbaca di sini
const router = express.Router({ mergeParams: true })
router.use(express.json())

// POST /quiz/:uuid/answers          — Siswa submit/update jawaban satu soal
// Body: { questionUuid, optionUuid } — TIDAK menggunakan integer ID
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
