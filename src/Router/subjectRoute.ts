import express from "express"
import { verifyRole, verifyToken } from "../middleware/auth"
import { createDataValidation, updateDataValidation } from "../middleware/subjectValidation"
import { createSubject, deleteSubject, getAllSubject, getByID, updateSubject } from "../controller/subject-controller"
import { deleteLimiter, postLimiter, updateLimiter } from "../middleware/rateLimiter"

const app = express()
app.use(express.json())

app.post("/create", postLimiter, [verifyToken, verifyRole(["ADMIN"]), createDataValidation], createSubject)
app.get("/all-data", [verifyToken, verifyRole(["ADMIN"])], getAllSubject)
app.get("/get/:idSubject", [verifyToken, verifyRole(["ADMIN"])], getByID)
app.put("/update-data/:idSubject", updateLimiter, [verifyToken, verifyRole(["ADMIN"]), updateDataValidation], updateSubject)
app.delete("/delete-subject/:idSubject", deleteLimiter, [verifyToken, verifyRole(["ADMIN"]), deleteSubject])


export default app