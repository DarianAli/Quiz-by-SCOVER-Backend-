import { Request, Response } from "express";
import {
    getTentorDashboard,
    getTentorStudentList,
    getTentorStudentDetail,
    getTentorSubjects,
    getTentorSubmissions,
    getTentorSubmissionDetail,
    reviewTentorSubmission,
} from "../services/tentor.service.js";
import { ok, unauthorized, notFound, serverError } from "../utils/response.util.js";

const getUid = (req: Request): number | null => req.user?.idUser ?? null;

// GET /tentor/dashboard
export const tentorDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) { unauthorized(res); return; }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;

        const data = await getTentorDashboard(uid);
        if (!data) { notFound(res, "Tentor not found."); return; }

        ok(res, "Dashboard retrieved successfully.", data);
    } catch (err) {
        console.error("[tentorDashboard]", err);
        serverError(res, "Failed to load dashboard.", err);
    }
};

// GET /tentor/students
export const tentorStudents = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) { unauthorized(res); return; }

        const data = await getTentorStudentList(uid);
        if (!data) { notFound(res, "Tentor not found."); return; }

        ok(res, "Student list retrieved successfully.", data);
    } catch (err) {
        console.error("[tentorStudents]", err);
        serverError(res, "Failed to load student list.", err);
    }
};

// GET /tentor/students/:uuid
export const tentorStudentDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid          = getUid(req);
        const { uuid }     = req.params;
        if (!uid) { unauthorized(res); return; }

        const data = await getTentorStudentDetail(uid, String(uuid));
        if (!data) { notFound(res, "Student not found or not in your class."); return; }

        ok(res, "Student detail retrieved successfully.", data);
    } catch (err) {
        console.error("[tentorStudentDetail]", err);
        serverError(res, "Failed to load student detail.", err);
    }
};

// GET Tentor subjects
export const tentorSubject = async(req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) {
            unauthorized(res)
            return
        }

        const data = await getTentorSubjects(uid)
        if (!data) {
            notFound(res, "Tentor or assigned class not found.")
            return
        }

        ok(res, "Tentor subjects retrieved successfully.", data)
    } catch (error) {
        console.error("[tentorSubject]", error)
        serverError(res, "Failed to load subjects.", error)
    }
}

// GET /tentor/submissions
export const tentorSubmissionsList = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) { unauthorized(res); return; }

        const data = await getTentorSubmissions(uid, req.query);
        if (!data) { notFound(res, "Tentor not found."); return; }

        ok(res, "Submissions retrieved successfully.", data);
    } catch (err) {
        console.error("[tentorSubmissionsList]", err);
        serverError(res, "Failed to load submissions.", err);
    }
};

// GET /tentor/submissions/:id
export const tentorSubmissionDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        const attemptId = parseInt(String(req.params.id));
        if (!uid) { unauthorized(res); return; }
        if (isNaN(attemptId)) { notFound(res, "Invalid submission ID"); return; }

        const data = await getTentorSubmissionDetail(uid, attemptId);
        if (!data) { notFound(res, "Submission not found or unauthorized."); return; }

        ok(res, "Submission detail retrieved successfully.", data);
    } catch (err) {
        console.error("[tentorSubmissionDetail]", err);
        serverError(res, "Failed to load submission detail.", err);
    }
};

// PATCH /tentor/submissions/:id/review
export const tentorReviewSubmission = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        const attemptId = parseInt(String(req.params.id));
        const { reviews } = req.body; // Array of { answerId, score, feedback }

        if (!uid) { unauthorized(res); return; }
        if (isNaN(attemptId)) { notFound(res, "Invalid submission ID"); return; }
        if (!Array.isArray(reviews)) { serverError(res, "Invalid reviews format"); return; }

        const data = await reviewTentorSubmission(uid, attemptId, reviews);
        if (!data) { notFound(res, "Submission not found or unauthorized."); return; }

        ok(res, "Submission reviewed successfully.", data);
    } catch (err) {
        console.error("[tentorReviewSubmission]", err);
        serverError(res, "Failed to review submission.", err);
    }
};
