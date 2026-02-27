import express from "express";
import { addData, updateData, updatePasswordData, updatePasswordDataUser, verifyLogin } from "../middleware/userValidation";
import { phoneValidation } from "../validator/phoneValidator";
import { auth, createUser, deleteUser, getAllUser, getById, updatePasswordAdmin, updatePasswordUser, updateUser } from "../controller/user-controller";
import { deleteLimiter, passwordLimiter, registerLimiter, updateLimiter } from "../middleware/rateLimiter";
import { verifyRole, verifyToken } from "../middleware/auth";
import { onlyAdminCanChangeRole } from "../middleware/onlyAdminUpdate";

const app = express()
app.use(express.json())

app.post("/register", registerLimiter, [verifyToken,  verifyRole(["ADMIN"]), addData, phoneValidation(["phone_number", "parent_phone_number"])], createUser)
app.post("/login", [verifyLogin], auth)
app.get("/getAll", [verifyToken, verifyRole(["ADMIN"])], getAllUser)
app.get("/get/:idUser", [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"])], getById)
app.put("/update/:idUser", updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]), onlyAdminCanChangeRole, updateData, phoneValidation(["phone_number", "parent_phone_number"])], updateUser)
app.put("/:idUser/admin/password", passwordLimiter, [verifyToken, verifyRole(["ADMIN"]), updatePasswordData], updatePasswordAdmin)
app.put("/password/:idUser", passwordLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]), updatePasswordDataUser], updatePasswordUser)
app.delete("/delete/:idUser",deleteLimiter, [verifyToken, verifyRole(["ADMIN"])], deleteUser)

export default app