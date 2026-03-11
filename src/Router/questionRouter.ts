import express from "express"
import { createQuestion, updateQuestion } from "../controller/question-controller"
import { verifyRole, verifyToken } from "../middleware/auth"
import { postLimiter, updateLimiter, deleteLimiter } from "../middleware/rateLimiter"
import { verifyAddQuestion, verifyEditQuestion } from "../middleware/questionValidation"

const app = express()
app.use(express.json({ strict: false }))

app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyAddQuestion], createQuestion)
app.put('/update/:idQuestion', updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyEditQuestion], updateQuestion)

export default app