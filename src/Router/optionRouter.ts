import express from "express"
import { createOption } from "../controller/option-controller"
import { verifyRole, verifyToken } from "../middleware/auth"
import { postLimiter, updateLimiter, deleteLimiter } from "../middleware/rateLimiter"
import { verifyAddOption, verifyEditOption } from "../middleware/optionValidation"

const app = express()
app.use(express.json())

app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyAddOption], createOption)

export default app