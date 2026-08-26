import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import fs from "fs";
import prisma from "../config/prisma.js";
import { BASE_URL } from "../global.js";
import { ok, created, badRequest, notFound, conflict, forbidden, serverError } from "../utils/response.util.js";
import { getPagination, buildMeta } from "../utils/pagination.util.js";
import {
    parseAndValidateFile,
    validateRows,
    checkClassExistence,
    checkDatabaseConflicts,
    prepareUsersForInsert,
    insertUsers,
    sendBulkUploadResponse,
    handleBulkUploadError,
} from "../services/bulkUserUpload.service.js";

// ─── POST /user/bulk-upload ──────────────────────────────────────────────────
export const bulkCreateUsers = async (request: Request, response: Response): Promise<void> => {
    try {
        const rows                        = await parseAndValidateFile(request.file);
        const { validRows, uploadErrors } = validateRows(rows);
        const classRows                   = await checkClassExistence(validRows, uploadErrors);
        const cleanRows                   = await checkDatabaseConflicts(classRows, uploadErrors);
        const toInsert                    = await prepareUsersForInsert(cleanRows, uploadErrors);
        const createdCount                = await insertUsers(toInsert);
        sendBulkUploadResponse(response, rows.length, createdCount, uploadErrors);
    } catch (error) {
        handleBulkUploadError(response, error);
    }
};

// ─── POST /user/add ──────────────────────────────────────────────────────────
export const createUser = async (request: Request, response: Response): Promise<void> => {
    try {
        const { userName, email, password, full_name, role, phone_number, parent_full_name, parent_phone_number, classId } = request.body;

        if (!userName || !email || !password || !role) {
            badRequest(response, "Username, email, password, and role are required.");
            return;
        }

        if (classId) {
            const findClass = await prisma.classes.findFirst({ where: { id: Number(classId) } });
            if (!findClass) { notFound(response, "Class not found."); return; }
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { email },
                    { userName },
                    { phone_number: phone_number || "---" }
                ]
            }
        });
        const existingAdmin = await prisma.admin.findFirst({
            where: {
                OR: [
                    { email },
                    { phone_number: phone_number || "---" }
                ]
            }
        });

        if (existingUser || existingAdmin) {
            conflict(response, "User with this email, username, or phone number already exists.");
            return;
        }

        const hashed = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                uuid: uuidv4(),
                userName,
                email,
                password: hashed,
                full_name,
                role,
                phone_number: phone_number || "",
                parent_full_name,
                parent_phone_number,
                classId: classId ? Number(classId) : null,
            },
            select: {
                uuid: true,
                userName: true,
                email: true,
                full_name: true,
                role: true,
                phone_number: true,
                class: true
            }
        });

        created(response, "Successfully created a user.", newUser);
    } catch (error) {
        console.error("[createUser]", error);
        serverError(response);
    }
};

// ─── GET /user/all ───────────────────────────────────────────────────────────
export const getAllUser = async (request: Request, response: Response): Promise<void> => {
    try {
        const { search = "", role } = request.query;
        const { skip, take, page, limit } = getPagination(request.query);

        const where: any = {
            OR: [
                { userName: { contains: String(search) } },
                { full_name: { contains: String(search) } }
            ]
        };
        if (role) where.role = String(role).toUpperCase();

        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                skip,
                take,
                orderBy: { id: "asc" },
                select: {
                    id: true,
                    uuid: true,
                    userName: true,
                    email: true,
                    full_name: true,
                    role: true,
                    phone_number: true,
                    photoProfile: true,
                    parent_full_name: true,
                    parent_phone_number: true,
                    class: true,
                    created_at: true
                }
            })
        ]);

        ok(response, "Showing all user data.", users, buildMeta(total, page, limit));
    } catch (error) {
        console.error("[getAllUser]", error);
        serverError(response);
    }
};

// ─── GET /user/:uuid ─────────────────────────────────────────────────────────
export const getById = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idUser } = request.params;

        let findUser;
        if (!isNaN(Number(idUser))) {
            findUser = await prisma.user.findFirst({ where: { id: Number(idUser) }, include: { class: true } });
        } else {
            findUser = await prisma.user.findFirst({ where: { uuid: String(idUser) }, include: { class: true } });
        }

        if (!findUser) { notFound(response, "User not found."); return; }

        ok(response, "Show user by ID.", {
            id: findUser.id,
            uuid: findUser.uuid,
            userName: findUser.userName,
            email: findUser.email,
            full_name: findUser.full_name,
            role: findUser.role,
            phone_number: findUser.phone_number,
            photoProfile: findUser.photoProfile,
            parent_full_name: findUser.parent_full_name,
            parent_phone_number: findUser.parent_phone_number,
            class: findUser.class,
            created_at: findUser.created_at
        });
    } catch (error) {
        console.error("[getById]", error);
        serverError(response);
    }
};

// ─── PUT /user/update/:uuid ──────────────────────────────────────────────────
export const updateUser = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idUser } = request.params;
        const { userName, email, full_name, role, phone_number, parent_full_name, parent_phone_number, classId } = request.body;

        let findUser;
        if (!isNaN(Number(idUser))) {
            findUser = await prisma.user.findFirst({ where: { id: Number(idUser) } });
        } else {
            findUser = await prisma.user.findFirst({ where: { uuid: String(idUser) } });
        }

        if (!findUser) { notFound(response, "User not found."); return; }

        const requester = request.user;
        if (requester?.role !== "ADMIN" && requester?.idUser !== findUser.id) {
            forbidden(response, "You can only edit your own account."); return;
        }

        if (classId !== undefined && classId !== null) {
            const findClass = await prisma.classes.findFirst({ where: { id: Number(classId) } });
            if (!findClass) { notFound(response, "Class not found."); return; }
        }

        const findDuplicates = await prisma.user.findFirst({
            where: {
                OR: [
                    { userName: userName || "---" },
                    { email: email || "---" },
                    { phone_number: phone_number || "---" }
                ],
                NOT: { id: findUser.id }
            }
        });

        if (findDuplicates) {
            conflict(response, "Username, email, or phone number already used by another user."); return;
        }

        const updateData = await prisma.user.update({
            where: { id: findUser.id },
            data: {
                userName: userName ?? findUser.userName,
                email: email ?? findUser.email,
                full_name: full_name ?? findUser.full_name,
                role: role ?? findUser.role,
                phone_number: phone_number ?? findUser.phone_number,
                parent_full_name: parent_full_name ?? findUser.parent_full_name,
                parent_phone_number: parent_phone_number ?? findUser.parent_phone_number,
                classId: classId !== undefined ? Number(classId) : findUser.classId
            },
            select: {
                uuid: true,
                userName: true,
                email: true,
                full_name: true,
                role: true,
                phone_number: true,
                class: true
            }
        });

        ok(response, "Successfully updated user data.", updateData);
    } catch (error) {
        console.error("[updateUser]", error);
        serverError(response);
    }
};

// ─── PUT /user/update/picture/:uuid ──────────────────────────────────────────
export const updatePicture = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idUser } = request.params;

        let findUser;
        if (!isNaN(Number(idUser))) {
            findUser = await prisma.user.findFirst({ where: { id: Number(idUser) } });
        } else {
            findUser = await prisma.user.findFirst({ where: { uuid: String(idUser) } });
        }

        if (!findUser) { notFound(response, "User not found."); return; }

        let filename = findUser.photoProfile;
        if (request.file) {
            filename = request.file.filename;

            const path = `${BASE_URL}/public/user_image/${findUser.photoProfile}`;
            if (fs.existsSync(path) && findUser.photoProfile !== "") {
                fs.unlinkSync(path);
            }
        }

        const updateData = await prisma.user.update({
            where: { id: findUser.id },
            data: { photoProfile: filename },
            select: { uuid: true, userName: true, photoProfile: true }
        });

        ok(response, "Successfully updated profile picture.", updateData);
    } catch (error) {
        console.error("[updatePicture]", error);
        serverError(response);
    }
};

// ─── PUT /user/update-password/:uuid ─────────────────────────────────────────
export const updatePasswordUser = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idUser } = request.params;
        const { oldPassword, newPassword, confirmPassword } = request.body;

        if (newPassword !== confirmPassword) {
            badRequest(response, "Password confirmation does not match."); return;
        }

        let findUser;
        if (!isNaN(Number(idUser))) {
            findUser = await prisma.user.findFirst({ where: { id: Number(idUser) } });
        } else {
            findUser = await prisma.user.findFirst({ where: { uuid: String(idUser) } });
        }

        if (!findUser) { notFound(response, "User not found."); return; }

        const validOld = await bcrypt.compare(oldPassword, findUser.password);
        if (!validOld) {
            forbidden(response, "Old password is incorrect."); return;
        }

        const samePassword = await bcrypt.compare(newPassword, findUser.password);
        if (samePassword) {
            badRequest(response, "New password cannot be the same as old password."); return;
        }

        const hashed = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: findUser.id },
            data: { password: hashed }
        });

        ok(response, "Successfully updated password.");
    } catch (error) {
        console.error("[updatePasswordUser]", error);
        serverError(response);
    }
};

// ─── DELETE /user/delete/:uuid ───────────────────────────────────────────────
export const deleteUser = async (request: Request, response: Response): Promise<void> => {
    try {
        const { idUser } = request.params;

        let findUser;
        if (!isNaN(Number(idUser))) {
            findUser = await prisma.user.findFirst({ where: { id: Number(idUser) } });
        } else {
            findUser = await prisma.user.findFirst({ where: { uuid: String(idUser) } });
        }

        if (!findUser) { notFound(response, "User not found."); return; }

        const path = `${BASE_URL}/public/user_image/${findUser.photoProfile}`;
        if (fs.existsSync(path) && findUser.photoProfile !== "") {
            fs.unlinkSync(path);
        }

        const deletedData = await prisma.user.delete({
            where: { id: findUser.id },
            select: { uuid: true, userName: true, email: true, role: true }
        });

        ok(response, "Successfully deleted user.", deletedData);
    } catch (error) {
        console.error("[deleteUser]", error);
        serverError(response);
    }
};
