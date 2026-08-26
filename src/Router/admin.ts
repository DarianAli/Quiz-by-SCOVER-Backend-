import express from "express";
import { deleteLimiter, passwordLimiter, registerLimiter, updateLimiter } from "../middleware/rateLimiter.js";
import { createAdmin, deleteAdmin, getAdminProfile, updateAdmin, updatePassword } from "../controller/admin-controller.js";
import { addData, updateData, updatePass } from "../middleware/adminValidation.js";
import { verifyRole, verifyToken } from "../middleware/auth.js";
import { phoneValidation } from "../validator/phoneValidator.js";

const app = express()
app.use(express.json())

app.post("/", registerLimiter, [verifyToken, verifyRole(["ADMIN"]), addData, phoneValidation(["phone_number"])], createAdmin)
app.put("/:idAdmin", updateLimiter, [verifyToken, verifyRole(["ADMIN"]), updateData, phoneValidation(["phone_number"])], updateAdmin)
app.put("/:idAdmin/password", passwordLimiter, [verifyToken, verifyRole(["ADMIN"]), updatePass], updatePassword)
app.delete("/:idAdmin", deleteLimiter, [verifyToken, verifyRole(["ADMIN"])], deleteAdmin)

export default app