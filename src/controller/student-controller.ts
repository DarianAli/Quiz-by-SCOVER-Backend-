import { Request, Response } from "express";
import {
    getStudentDashboard,
    getStudentSubjects,
    getStudentSubjectDetail,
    getStudentQuizDetail,
    getStudentQuizResult,
    getStudentQuizReview,
    getStudentProgress,
} from "../services/student.service.js";
import {
    ok, notFound, unauthorized, serverError,
} from "../utils/response.util.js";

// Semua endpoint ini membutuhkan req.user.idUser (STUDENT role)

const getUid = (req: Request): number | null => {
    const u = req.user;
    if (!u || !u.idUser) return null;
    return u.idUser;
};

// GET /student/dashboard
export const studentDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) { unauthorized(res); return; }

        const data = await getStudentDashboard(uid);
        if (!data) { notFound(res, "Student not found."); return; }

        ok(res, "Dashboard data retrieved successfully.", data);
    } catch (err) {
        console.error("[studentDashboard]", err);
        serverError(res);
    }
};

// GET /student/subjects
export const studentSubjects = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) { unauthorized(res); return; }

        const data = await getStudentSubjects(uid);
        if (!data) { notFound(res, "Student not found."); return; }

        ok(res, "Subjects retrieved successfully.", data);
    } catch (err) {
        console.error("[studentSubjects]", err);
        serverError(res);
    }
};

// GET /student/subjects/:uuid
export const studentSubjectDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid  = getUid(req);
        const { uuid } = req.params;
        if (!uid) { unauthorized(res); return; }

        const data = await getStudentSubjectDetail(uid, String(uuid));
        if (!data) { notFound(res, "Subject not found."); return; }

        ok(res, "Subject detail retrieved successfully.", data);
    } catch (err) {
        console.error("[studentSubjectDetail]", err);
        serverError(res);
    }
};

// GET /student/quiz/:uuid
export const studentQuizDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        const { uuid } = req.params;
        if (!uid) { unauthorized(res); return; }

        const data = await getStudentQuizDetail(uid, String(uuid));
        if (!data) { notFound(res, "Quiz not found."); return; }

        ok(res, "Quiz detail retrieved successfully.", data);
    } catch (err) {
        console.error("[studentQuizDetail]", err);
        serverError(res);
    }
};

// GET /student/result/:uuid
export const studentQuizResult = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        const { uuid } = req.params;
        if (!uid) { unauthorized(res); return; }

        const data = await getStudentQuizResult(uid, String(uuid));
        if (!data) { notFound(res, "Result not found."); return; }

        ok(res, "Quiz result retrieved successfully.", data);
    } catch (err) {
        console.error("[studentQuizResult]", err);
        serverError(res);
    }
};

// GET /student/review/:uuid
export const studentQuizReview = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        const { uuid } = req.params;
        if (!uid) { unauthorized(res); return; }

        const data = await getStudentQuizReview(uid, String(uuid));
        if (!data) { notFound(res, "Review not found."); return; }

        ok(res, "Quiz review retrieved successfully.", data);
    } catch (err) {
        console.error("[studentQuizReview]", err);
        serverError(res);
    }
};

// GET /student/progress
export const studentProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) { unauthorized(res); return; }

        const data = await getStudentProgress(uid);
        if (!data) { notFound(res, "Student not found."); return; }

        ok(res, "Progress data retrieved successfully.", data);
    } catch (err) {
        console.error("[studentProgress]", err);
        serverError(res);
    }
};



