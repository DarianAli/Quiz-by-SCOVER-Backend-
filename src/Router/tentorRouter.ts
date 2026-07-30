import express from "express";
import { verifyToken, verifyRole } from "../middleware/auth";
import { tentorDashboard, tentorStudents, tentorStudentDetail } from "../controller/tentor-controller";

const router = express.Router();

const auth = [verifyToken, verifyRole(["TENTOR", "ADMIN"])];

router.get("/dashboard",          auth, tentorDashboard);       // GET /tentor/dashboard
router.get("/students",           auth, tentorStudents);         // GET /tentor/students
router.get("/students/:uuid",     auth, tentorStudentDetail);    // GET /tentor/students/:uuid

export default router;
