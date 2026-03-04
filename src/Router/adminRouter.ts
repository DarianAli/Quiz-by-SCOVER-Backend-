import express from "express";
import { passwordLimiter, registerLimiter, updateLimiter } from "../middleware/rateLimiter";
import { createAdmin, getAdminProfile, updateAdmin, updatePassword } from "../controller/admin-controller";
import { addData, updateData, updatePass } from "../middleware/adminValidation";
import { internalAuth } from "../middleware/internal";
import { verifyRole, verifyToken } from "../middleware/auth";
import { phoneValidation } from "../validator/phoneValidator";

const app = express()
app.use(express.json())

app.post("/internal/register-admin", registerLimiter, [internalAuth ,addData, phoneValidation(["phone_number"])], createAdmin)
app.get("/internal/get-admin/:idAdmin", [internalAuth, verifyToken, verifyRole(["ADMIN"])], getAdminProfile)
app.put("/internal/update-admin/:idAdmin", updateLimiter, [internalAuth, verifyToken, verifyRole(["ADMIN"]), phoneValidation(["phone_number"]), updateData], updateAdmin)
app.put("/internal/password-admin/:idAdmin", passwordLimiter, [internalAuth, verifyToken, verifyRole(["ADMIN"]), updatePass], updatePassword)



export default app