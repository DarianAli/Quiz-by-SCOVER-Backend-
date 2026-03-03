import express from "express";
import { registerLimiter } from "../middleware/rateLimiter";
import { createAdmin, getAdminProfile } from "../controller/admin-controller";
import { addData } from "../middleware/adminValidation";
import { internalAuth } from "../middleware/internal";
import { verifyRole, verifyToken } from "../middleware/auth";

const app = express()
app.use(express.json())

app.post("/internal/register-admin", registerLimiter, [internalAuth ,addData], createAdmin)
app.get("/internal/get-admin/:idAdmin", [internalAuth, verifyToken, verifyRole(["ADMIN"])], getAdminProfile)



export default app