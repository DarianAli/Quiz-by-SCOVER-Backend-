import express from "express"
import { verifyRole, verifyToken } from "../middleware/auth"
import { createDataValidation } from "../middleware/subjectValidation"
import { createSubject, getAllSubject } from "../controller/subject-controller"
import { postLimiter } from "../middleware/rateLimiter"

const app = express()
app.use(express.json())

app.post("/create", postLimiter, [verifyToken, verifyRole(["ADMIN"]), createDataValidation], createSubject)
app.get("/all-data", [verifyToken, verifyRole(["ADMIN"])], getAllSubject)


export default app