import express from "express";
import { verifyToken, verifyRole } from "../middleware/auth";
import {
    studentDashboard,
    studentSubjects,
    studentSubjectDetail,
    studentQuizDetail,
    studentQuizResult,
    studentQuizReview,
    studentProgress,
} from "../controller/student-controller";

const router = express.Router();

// Semua route student membutuhkan autentikasi dan role STUDENT/ADMIN/TENTOR
const auth = [verifyToken, verifyRole(["STUDENT", "ADMIN", "TENTOR"])];

router.get("/dashboard",          auth, studentDashboard);      // GET /student/dashboard
router.get("/subjects",           auth, studentSubjects);        // GET /student/subjects
router.get("/subjects/:uuid",     auth, studentSubjectDetail);   // GET /student/subjects/:uuid
router.get("/quiz/:uuid",         auth, studentQuizDetail);      // GET /student/quiz/:uuid
router.get("/result/:uuid",       auth, studentQuizResult);      // GET /student/result/:uuid
router.get("/review/:uuid",       auth, studentQuizReview);      // GET /student/review/:uuid
router.get("/progress",           auth, studentProgress);        // GET /student/progress

export default router;
