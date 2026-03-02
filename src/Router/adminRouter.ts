import express from "express";
import { registerLimiter } from "../middleware/rateLimiter";
import { createAdmin } from "../controller/admin-controller";
import { addData } from "../middleware/adminValidation";
import { internalAuth } from "../middleware/internal";

const app = express()
app.use(express.json())

app.post("/internal/register-admin", registerLimiter, [internalAuth ,addData], createAdmin)


export default app