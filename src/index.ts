import express from "express"
import cors from "cors"
import userRoute from "./Router/userRoute"

const PORT: number = 9000
const app = express()
app.use(cors())
app.use(express.urlencoded({ extended: true }))

app.use("/user", userRoute)

app.listen(PORT, () => {
    console.log(`Server running at port ${PORT}`)
})