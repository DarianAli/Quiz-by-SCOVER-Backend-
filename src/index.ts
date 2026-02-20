import express from "express"
import cors from "cors"
import userRoute from "./Router/userRoute"
import classRoute from "./Router/classRouter"
import { globalLimiter } from "./middleware/rateLimiter"

const PORT: number = 9000
const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))
app.use(globalLimiter)

app.use("/user", userRoute)
app.use("/class", classRoute)

app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`)
})