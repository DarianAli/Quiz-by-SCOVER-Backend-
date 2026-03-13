import dotenv from "dotenv"
dotenv.config()

import express from "express"
import cors from "cors"
import userRoute from "./Router/userRoute"
import classRoute from "./Router/classRouter"
import adminRoute from "./Router/adminRouter"
import quizRoute from "./Router/quizRouter"
import subjectRoute from "./Router/subjectRoute"
import questionRouter from "./Router/questionRouter"
import { globalLimiter } from "./middleware/rateLimiter"


const PORT: number = 9000
const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(globalLimiter)

app.use("/user", userRoute)
app.use("/class", classRoute)
app.use("/admin", adminRoute)
app.use("/quiz", quizRoute)
app.use("/subject", subjectRoute)
app.use("/question", questionRouter)

app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`)
})