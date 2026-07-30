import express from "express";
import { login, logout } from "../controller/auth-controller";
import { registerLimiter } from "../middleware/rateLimiter";

const router = express.Router();

// POST /auth/login
router.post("/login", login);

// POST /auth/logout
router.post("/logout", logout);

export default router;
