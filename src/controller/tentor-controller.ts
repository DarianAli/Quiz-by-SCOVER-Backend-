import { Request, Response } from "express";
import {
    getTentorDashboard,
    getTentorStudentList,
    getTentorStudentDetail,
    getTentorSubjects,
} from "../services/tentor.service.js";
import { ok, unauthorized, notFound, serverError } from "../utils/response.util.js";

const getUid = (req: Request): number | null => req.user?.idUser ?? null;

// GET /tentor/dashboard
export const tentorDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
        const uid = getUid(req);
        if (!uid) { unauthorized(res); return; }

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



