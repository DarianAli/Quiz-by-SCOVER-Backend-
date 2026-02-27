import express from "express"
import { getAllQuiz, getQuizById, createQuiz, updateQuiz, deleteQuiz } from "../controller/quiz-controller"
import { deleteLimiter, postLimiter, updateLimiter } from "../middleware/rateLimiter"
import { startAttempt, submitAttempt } from "../controller/attempt-controller"
import { verifyAddQuiz, verifyEditQuiz } from "../middleware/quizValidation"

const app = express();
app.use(express.json())

app.get('/allData', getAllQuiz)
app.get('/byID/:idQuiz', getQuizById)
app.post('/add', postLimiter,[verifyAddQuiz], createQuiz)
app.put('/update/:idQuiz', updateLimiter, [verifyEditQuiz], updateQuiz)
app.delete('/delete/:idQuiz', deleteLimiter, deleteQuiz)

app.post('/:idQuiz/attempt/start', startAttempt)
app.post('/:idQuiz/attempt/:idAttempt/submit', submitAttempt)

export default app