import express from "express";
import { addData, updateData, updatePasswordData, updatePasswordDataUser } from "../middleware/userValidation";
import { phoneValidation } from "../validator/phoneValidator";
import { createUser, getAllUser, getById, updatePasswordAdmin, updatePasswordUser, updateUser } from "../controller/user-controller";
import { passwordLimiter, registerLimiter, updateLimiter } from "../middleware/rateLimiter";

const app = express()
app.use(express.json())

app.post("/register", registerLimiter, [addData, phoneValidation(["phone_number", "parent_phone_number"])], createUser)
app.get("/getAll", getAllUser)
app.get("/get/:idUser", getById)
app.put("/update/:idUser", updateLimiter, [updateData, phoneValidation(["phone_number", "parent_phone_number"])], updateUser)
app.put("/admin/user/:idUser/password", passwordLimiter, [updatePasswordData], updatePasswordAdmin)
app.put("/password/:idUser", passwordLimiter, [updatePasswordDataUser], updatePasswordUser)

export default app