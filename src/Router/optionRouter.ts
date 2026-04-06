import express from "express"
import { createOption, updateOption, getAllOption, getOptionById, deleteOption } from "../controller/option-controller"
import { verifyRole, verifyToken } from "../middleware/auth"
import { postLimiter, updateLimiter, deleteLimiter } from "../middleware/rateLimiter"
import { verifyAddOption, verifyEditOption } from "../middleware/optionValidation"
import uploadOptionFile from "../middleware/optionUpload"

const app = express()
app.use(express.json())

app.post('/add', postLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), uploadOptionFile.single("option_image"), verifyAddOption], createOption)
app.put('/update/:idOption', updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"]), uploadOptionFile.single("option_image"), verifyEditOption], updateOption)
app.get('/allData', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getAllOption)
app.get('/byID/:idOption', [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getOptionById)
app.delete('/delete/:idOption', deleteLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR"])], deleteOption)

export default app