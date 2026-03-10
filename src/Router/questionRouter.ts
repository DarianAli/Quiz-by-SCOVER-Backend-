import express from "express"
import { createQuestion } from "../controller/question-controller"
import { verifyRole, verifyToken } from "../middleware/auth"
import { postLimiter, updateLimiter, deleteLimiter } from "../middleware/rateLimiter"
import { verifyAddQuestion, verifyEditQuestion } from "../middleware/questionValidation"

const app = express()
app.use(express.json())

app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyAddQuestion], createQuestion)

export default app