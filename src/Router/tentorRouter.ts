import express from "express";
import { verifyToken, verifyRole } from "../middleware/auth.js";
import { tentorDashboard, tentorStudents, tentorStudentDetail, tentorSubject } from "../controller/tentor-controller.js";

const router = express.Router();

const auth = [verifyToken, verifyRole(["TENTOR", "ADMIN"])];

router.get("/dashboard",          auth, tentorDashboard);       // GET /tentor/dashboard
router.get("/students",           auth, tentorStudents);         // GET /tentor/students
router.get("/students/:uuid",     auth, tentorStudentDetail);    // GET /tentor/students/:uuid
router.get("/subjects",           auth, tentorSubject);          // GET /tentor/subjects

export default router;
