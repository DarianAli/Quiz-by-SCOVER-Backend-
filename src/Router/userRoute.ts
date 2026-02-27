import express from "express";
import { addData, updateData, updatePasswordData, updatePasswordDataUser } from "../middleware/userValidation";
import { phoneValidation } from "../validator/phoneValidator";
import { createUser, deleteUser, getAllUser, getById, updatePasswordAdmin, updatePasswordUser, updateUser } from "../controller/user-controller";
import { deleteLimiter, passwordLimiter, registerLimiter, updateLimiter } from "../middleware/rateLimiter";

const app = express()
app.use(express.json())

app.post("/register", registerLimiter, [addData, phoneValidation(["phone_number", "parent_phone_number"])], createUser)
app.get("/getAll", getAllUser)
app.get("/get/:idUser", getById)
app.put("/update/:idUser", updateLimiter, [updateData, phoneValidation(["phone_number", "parent_phone_number"])], updateUser)
app.put("/:idUser/admin/password", passwordLimiter, [updatePasswordData], updatePasswordAdmin)
app.put("/password/:idUser", passwordLimiter, [updatePasswordDataUser], updatePasswordUser)
app.delete("/delete/:idUser",deleteLimiter, deleteUser)

export default app