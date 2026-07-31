import express from "express";
import { deleteLimiter, passwordLimiter, registerLimiter, updateLimiter } from "../middleware/rateLimiter.js";
import { createAdmin, deleteAdmin, getAdminProfile, updateAdmin, updatePassword } from "../controller/admin-controller.js";
import { addData, updateData, updatePass } from "../middleware/adminValidation.js";
import { internalAuth } from "../middleware/internal.js";
import { verifyRole, verifyToken } from "../middleware/auth.js";
import { phoneValidation } from "../validator/phoneValidator.js";

const app = express()
app.use(express.json())

app.post("/internal/register-admin", registerLimiter, [internalAuth ,addData, phoneValidation(["phone_number"])], createAdmin)
app.get("/internal/get-admin/:idAdmin", [internalAuth, verifyToken, verifyRole(["ADMIN"])], getAdminProfile)
app.put("/internal/update-admin/:idAdmin", updateLimiter, [internalAuth, verifyToken, verifyRole(["ADMIN"]), phoneValidation(["phone_number"]), updateData], updateAdmin)
app.put("/internal/password-admin/:idAdmin", passwordLimiter, [internalAuth, verifyToken, verifyRole(["ADMIN"]), updatePass], updatePassword)
app.delete("/internal/delete-admin/:idAdmin", deleteLimiter, [internalAuth, verifyToken, verifyRole(["ADMIN"])], deleteAdmin)


export default app