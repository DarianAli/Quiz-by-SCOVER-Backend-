import express from "express"
import { createOption, updateOption, getAllOption, getOptionById } from "../controller/option-controller"
import { verifyRole, verifyToken } from "../middleware/auth"
import { postLimiter, updateLimiter, deleteLimiter } from "../middleware/rateLimiter"
import { verifyAddOption, verifyEditOption } from "../middleware/optionValidation"
import { get } from "http"

const app = express()
app.use(express.json())

app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyAddOption], createOption)
app.put('/update/:idOption', updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), verifyEditOption], updateOption)
app.get('/allData', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getAllOption)
app.get('/byID/:idOption', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getOptionById)

export default app