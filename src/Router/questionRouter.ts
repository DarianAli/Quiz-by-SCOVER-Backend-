import express from "express"
import { createQuestion, updateQuestion, getAllQuestion, getQuestionById, deleteQuestion } from "../controller/question-controller"
import { verifyRole, verifyToken } from "../middleware/auth"
import { postLimiter, updateLimiter, deleteLimiter } from "../middleware/rateLimiter"
import { verifyAddQuestion, verifyEditQuestion } from "../middleware/questionValidation"
import uploadQuestionFile from "../middleware/questionUpload"

const app = express()
app.use(express.json({ strict: false }))

app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), uploadQuestionFile.single("question_image"), verifyAddQuestion], createQuestion)
app.put('/update/:idQuestion', updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), uploadQuestionFile.single("question_image"), verifyEditQuestion], updateQuestion)
app.get('/allData', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getAllQuestion)
app.get('/byID/:idQuestion', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getQuestionById)
app.delete('/delete/:idQuestion', deleteLimiter, [verifyToken, verifyRole(["ADMIN"])], deleteQuestion)

export default app