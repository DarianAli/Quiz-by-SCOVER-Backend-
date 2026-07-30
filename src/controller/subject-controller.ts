import { Response, Request } from "express";
import { v4 as uuidv4 } from "uuid";
import prisma from "../config/prisma";
import { ok, created, badRequest, notFound, conflict, serverError } from "../utils/response.util";
import { getPagination, buildMeta } from "../utils/pagination.util";
import { string } from "joi";

// ─── POST /subject/add ───────────────────────────────────────────────────────
// classId (body) sekarang berupa array of class UUIDs, bukan numeric id
export const createSubject = async (request: Request, response: Response): Promise<void> => {
    try {
        const { subject_name, classId } = request.body;
        if (!subject_name) { badRequest(response, "subject_name is required."); return; }

        let classRecords: { id: number }[] = [];
        if (classId !== undefined) {
            if (!Array.isArray(classId) || classId.length === 0) {
                badRequest(response, "classId must be a non-empty array."); return;
            }

            const uniqueUuids = [...new Set(classId.map(String))];
            classRecords = await prisma.classes.findMany({ where: { uuid: { in: uniqueUuids } } });

            if (classRecords.length !== uniqueUuids.length) {
                notFound(response, "One or more classId not found."); return;
            }
        }

        const existing = await prisma.subject.findFirst({ where: { subject_name } });
        if (existing) {
            conflict(response, "Subject with this name already exists."); return;
        }

        const newSubject = await prisma.subject.create({
            data: {
                uuid: uuidv4(),
                subject_name,
                ...(classId && {
                    subjectClass: {
                        create: classRecords.map(c => ({ classId: c.id })),
                    },
                }),
            },
            include: {
                subjectClass: { include: { class: true } },
            },
        });

        const result = {
            uuid:         newSubject.uuid,
            subject_name: newSubject.subject_name,
            classes:      newSubject.subjectClass.map(sc => ({
                uuid: sc.class.uuid,
                class_name: sc.class.class_name,
                class_program: sc.class.class_program,
            })),
            created_at:   newSubject.created_at,
            updated_at:   newSubject.updated_at,
        };

        created(response, "Successfully created subject.", result);
    } catch (error) {
        console.error("[createSubject]", error);
        serverError(response);
    }
};

// ─── POST /subject/assign/:idSubject ─────────────────────────────────────────
// idSubject (route param) & classId (body) sekarang uuid-only
export const assignSubject = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idSubject } = request.params;
        const { classId } = request.body;

        if (!Array.isArray(classId) || classId.length === 0) {
            badRequest(response, "classId must be a non-empty array."); return;
        }

        const subject = await prisma.subject.findFirst({ where: { uuid: String(idSubject) } });
        if (!subject) { notFound(response, "Subject not found."); return; }

        const uniqueUuids = [...new Set(classId.map(String))];
        const foundClasses = await prisma.classes.findMany({ where: { uuid: { in: uniqueUuids } } });

        if (foundClasses.length !== uniqueUuids.length) {
            notFound(response, "One or more classId not found."); return;
        }

        const existingLinks = await prisma.subjectClass.findMany({
            where: { subjectId: subject.id, classId: { in: foundClasses.map(c => c.id) } },
        });

        const existingClassIds = existingLinks.map(link => link.classId);
        const newClasses = foundClasses.filter(c => !existingClassIds.includes(c.id));

        if (newClasses.length === 0) {
            conflict(response, "Subject is already assigned to all provided classes."); return;
        }

        await prisma.subjectClass.createMany({
            data: newClasses.map(c => ({ subjectId: subject.id, classId: c.id })),
        });

        const updatedSubject = await prisma.subject.findUnique({
            where: { id: subject.id },
            include: { subjectClass: { include: { class: true } } },
        });

        const result = {
            uuid:         updatedSubject!.uuid,
            subject_name: updatedSubject!.subject_name,
            classes:      updatedSubject!.subjectClass.map(sc => ({
                uuid: sc.class.uuid,
                class_name: sc.class.class_name,
                class_program: sc.class.class_program,
            })),
        };

        ok(response, "Successfully assigned subject to class(es).", result);
    } catch (error) {
        console.error("[assignSubject]", error);
        serverError(response);
    }
};

// ─── GET /subject/all ────────────────────────────────────────────────────────
// Sudah uuid-only sejak awal — tidak ada perubahan.
export const getAllSubject = async (request: Request, response: Response): Promise<void> => {
    try {
        const { search = "" } = request.query;
        const { skip, take, page, limit } = getPagination(request.query);
        const currentUser = request.user;

        const where = {
            subject_name: { contains: String(search) },
            deleted_at: null,
        };

        const [total, subjects] = await Promise.all([
            prisma.subject.count({ where }),
            prisma.subject.findMany({
                where,
                skip,
                take,
                orderBy: { id: "asc" },
                include: {
                    subjectClass: { include: { class: true } },
                    quizzes: {
                        where: { deleted_at: null },
                        select: {
                            uuid: true,
                            quiz_title: true,
                            quiz_date: true,
                            duration: true,
                            status: true,
                            difficulty: true,
                            retake_policy: true,
                            max_attempts: true,
                            created_at: true,
                        },
                        orderBy: { created_at: "desc" },
                    },
                },
            }),
        ]);

        const allClassId = [...new Set(subjects.flatMap(s => s.subjectClass.map(sc => sc.classId)))]

        const classMembers = allClassId.length > 0
            ? await prisma.user.findMany({
                where: { classId: { in: allClassId }, role: { in: ["TENTOR", "STUDENT"] } },
                select: { uuid: true, full_name: true, userName: true, photoProfile: true, role: true, classId: true },
            })
            : [];

        const tentorsByClass = new Map<number, typeof classMembers>()
        const studentByClass = new Map<number, typeof classMembers>()
        for (const m of classMembers) {
            if (!m.classId) continue;
            const bucket = m.role === "TENTOR" ? tentorsByClass : studentByClass;
            if (!bucket.has(m.classId)) bucket.set(m.classId, []);
            bucket.get(m.classId)!.push(m)
        }

        const data = subjects.map(s => {
            const classIds = s.subjectClass.map(sc => sc.classId);

            const isMyClass = currentUser?.role === "TENTOR"
                && currentUser?.classId != null
                && classIds.includes(currentUser.classId)

                // Dedupe tentor/murid lintas kelas yang sama sama memakai subject ini
                const tentorMap = new Map<string, { uuid: string; name: string; photo: string | null }>()
                const studentUuids = new Set<string>()
                for (const cid of classIds) {
                    for (const t of tentorsByClass.get(cid) ?? []) {
                        tentorMap.set(t.uuid, {
                            uuid: t.uuid,
                            name: t.full_name || t.userName,
                            photo: t.photoProfile ? `/public/user_image/${t.photoProfile}` : null,
                        })
                    }
                    for (const st of studentByClass.get(cid) ?? []) {
                        studentUuids.add(st.uuid)
                    }
                }
                const totalQuiz = s.quizzes.length;
                const annualGoal = s.annual_quiz_target ?? null
                const curriculumProgress = annualGoal && annualGoal > 0
                    ? Math.min(100, Math.round((totalQuiz / annualGoal) * 100))
                    : null

                return {
                    uuid:           s.uuid,
                    subject_name:   s.subject_name,
                    classes:        s.subjectClass.map(sc => ({
                        uuid:           sc.class.uuid,
                        class_name:     sc.class.class_name,
                        class_program:  sc.class.class_program,
                    })),
                    quizzes:        s.quizzes,
                    total_quiz:     totalQuiz,
                    total_student:  studentUuids.size,
                    tentors:        Array.from(tentorMap.values()),
                    is_my_class:    isMyClass,
                    annual_quiz_target: annualGoal,
                    curriculum_progress: curriculumProgress,
                    created_at:     s.created_at,
                    updated_at:     s.updated_at,
                }
        });

        ok(response, "Showing all subjects.", data, buildMeta(total, page, limit));
    } catch (error) {
        console.error("[getAllSubject]", error);
        serverError(response);
    }
};

// ─── GET /subject/get/:idSubject ─────────────────────────────────────────────
// Sudah uuid-only sejak awal — tidak ada perubahan pada logic pencarian.
export const getByID = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idSubject } = request.params;

        const subject = await prisma.subject.findFirst({
            where: { uuid: String(idSubject), deleted_at: null },
            include: {
                subjectClass: { include: { class: true } },
                quizzes: {
                    where: { deleted_at: null },
                    select: {
                        uuid: true,
                        quiz_title: true,
                        quiz_date: true,
                        duration: true,
                        status: true,
                        difficulty: true,
                        retake_policy: true,
                        max_attempts: true,
                        created_at: true,
                    },
                    orderBy: { created_at: "desc" },
                },
            },
        });

        if (!subject) { notFound(response, "Subject not found."); return; }

        const result = {
            uuid:         subject.uuid,
            subject_name: subject.subject_name,
            classes:      subject.subjectClass.map(sc => ({
                uuid: sc.class.uuid,
                class_name: sc.class.class_name,
                class_program: sc.class.class_program,
            })),
            quizzes:      subject.quizzes,
            created_at:   subject.created_at,
            updated_at:   subject.updated_at,
        };

        ok(response, "Show subject data.", result);
    } catch (error) {
        console.error("[getByID]", error);
        serverError(response);
    }
};

// ─── PUT /subject/update-data/:idSubject ─────────────────────────────────────
// idSubject sekarang uuid-only
export const updateSubject = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idSubject } = request.params;
        const { subject_name } = request.body;

        const subject = await prisma.subject.findFirst({ where: { uuid: String(idSubject) } });
        if (!subject) { notFound(response, "Subject not found."); return; }

        if (subject_name) {
            const existing = await prisma.subject.findFirst({
                where: { subject_name, NOT: { id: subject.id } },
            });
            if (existing) { conflict(response, "Subject name already exists."); return; }
        }

        const updated = await prisma.subject.update({
            where: { id: subject.id },
            data: { subject_name: subject_name ?? subject.subject_name },
        });

        const result = {
            uuid:         updated.uuid,
            subject_name: updated.subject_name,
            created_at:   updated.created_at,
            updated_at:   updated.updated_at,
        };

        ok(response, "Successfully updated subject data.", result);
    } catch (error) {
        console.error("[updateSubject]", error);
        serverError(response);
    }
};

// ─── DELETE /subject/delete-subject/:idSubject ───────────────────────────────
// idSubject sekarang uuid-only. Soft-delete extension tetap berjalan seperti biasa.
export const deleteSubject = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idSubject } = request.params;

        const subject = await prisma.subject.findFirst({ where: { uuid: String(idSubject) } });
        if (!subject) { notFound(response, "Subject not found."); return; }

        await prisma.subject.delete({ where: { id: subject.id } });

        ok(response, "Successfully deleted subject.", { uuid: subject.uuid, subject_name: subject.subject_name });
    } catch (error) {
        console.error("[deleteSubject]", error);
        serverError(response);
    }
};

// ─── GET /subject/:idUser/subjects ───────────────────────────────────────────
// idUser sekarang uuid-only; response tidak lagi membocorkan id numerik user/class
export const getSubjectByUser = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idUser } = request.params;

        const user = await prisma.user.findFirst({
            where: { uuid: String(idUser) },
            include: { class: true },
        });

        if (!user) { notFound(response, "User not found."); return; }

        if (!user.classId) {
            ok(response, "User has no class.", {
                user: { uuid: user.uuid, userName: user.userName },
                class: null,
                subject: [],
            });
            return;
        }

        const subjects = await prisma.subjectClass.findMany({
            where: { classId: user.classId },
            include: { subject: true },
        });

        ok(response, "Successfully get subjects by user class.", {
            user: { uuid: user.uuid, userName: user.userName },
            class: user.class
                ? {
                    uuid: user.class.uuid,
                    class_name: user.class.class_name,
                    class_program: user.class.class_program,
                }
                : null,
            subject: subjects.map(s => ({
                uuid: s.subject.uuid,
                subject_name: s.subject.subject_name,
            })),
        });
    } catch (error) {
        console.error("[getSubjectByUser]", error);
        serverError(response);
    }
};