import express from "express"
import { createQuestion, updateQuestion, getAllQuestion, getQuestionById } from "../controller/question-controller"
import { verifyRole, verifyToken } from "../middleware/auth"
import { postLimiter, updateLimiter, deleteLimiter } from "../middleware/rateLimiter"
import { verifyAddQuestion, verifyEditQuestion } from "../middleware/questionValidation"

const app = express()
app.use(express.json({ strict: false }))

app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyAddQuestion], createQuestion)
app.put('/update/:idQuestion', updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyEditQuestion], updateQuestion)
app.get('/allData', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getAllQuestion)
app.get('/byID/:idQuestion', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getQuestionById)

export default app