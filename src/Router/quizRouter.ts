import express from "express"
import { getAllQuiz, getQuizById, createQuiz, updateQuiz, deleteQuiz } from "../controller/quiz-controller"
import { deleteLimiter, postLimiter, updateLimiter, attemptLimiter } from "../middleware/rateLimiter"
import { startAttempt, submitAttempt, } from "../controller/attempt-controller"
import { verifyAddQuiz, verifyEditQuiz } from "../middleware/quizValidation"
import { verifyRole, verifyToken } from "../middleware/auth" 

const app = express();
app.use(express.json())

app.get('/allData', [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]),], getAllQuiz)
app.get('/byID/:idQuiz',[verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]),], getQuizById)
app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]), verifyAddQuiz], createQuiz)
app.put('/update/:idQuiz', updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]), verifyEditQuiz], updateQuiz)
app.delete('/delete/:idQuiz', deleteLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"])], deleteQuiz)

app.post('/:idQuiz/attempt/start', attemptLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]),], startAttempt)
app.post('/:idQuiz/attempt/:idAttempt/submit', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]),], submitAttempt)

export default app