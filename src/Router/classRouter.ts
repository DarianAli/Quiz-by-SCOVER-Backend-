import express from "express"
import { addData, updateData } from "../middleware/classValidation"
import { classUpdate, createClass, deleteClass, getAllData, getById } from "../controller/class-controller"
import { deleteLimiter, postLimiter, updateLimiter } from "../middleware/rateLimiter"
import { verifyRole, verifyToken } from "../middleware/auth"

const app = express()
app.use(express.json())

app.post("/create", postLimiter, [verifyToken, verifyRole(["ADMIN"]), addData], createClass)
app.put("/update/:idClass", updateLimiter, [verifyToken, verifyRole(["ADMIN"]),updateData], classUpdate)
app.get("/allData", [verifyToken, verifyRole(["ADMIN", "TENTOR"])], getAllData)
app.get("/get/:idClass", [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"])], getById)
app.delete("/delete/:idClass", deleteLimiter, [verifyToken, verifyRole(["ADMIN"])], deleteClass)

export default app