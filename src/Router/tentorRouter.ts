import express from "express";
import { verifyToken, verifyRole } from "../middleware/auth.js";
import { 
    tentorDashboard, 
    tentorStudents, 
    tentorStudentDetail, 
    tentorSubject,
    tentorSubmissionsList,
    tentorSubmissionDetail,
    tentorReviewSubmission
} from "../controller/tentor-controller.js";

const router = express.Router();

const auth = [verifyToken, verifyRole(["TENTOR", "ADMIN"])];

router.get("/dashboard",          auth, tentorDashboard);       // GET /tentor/dashboard
router.get("/students",           auth, tentorStudents);         // GET /tentor/students
router.get("/students/:uuid",     auth, tentorStudentDetail);    // GET /tentor/students/:uuid
router.get("/subjects",           auth, tentorSubject);          // GET /tentor/subjects

// Submissions
router.get("/submissions",        auth, tentorSubmissionsList);
router.get("/submissions/:id",    auth, tentorSubmissionDetail);
router.patch("/submissions/:id/review", auth, tentorReviewSubmission);

export default router;
