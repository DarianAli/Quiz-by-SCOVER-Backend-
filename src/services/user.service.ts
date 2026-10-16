import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { Role } from "@prisma/client";
import prisma from "../config/prisma.js";

const BCRYPT_SALT_ROUNDS = 10;

export interface CreateUserInput {
    name?: string;
    full_name?: string;
    userName?: string;
    email: string;
    password: string;
    role: "STUDENT" | "TENTOR" | "ADMIN";
    phone_number?: string;
    parent_full_name?: string;
    parent_phone_number?: string;
    classId?: number | null;
}

export interface SafeUserResult {
    id: number;
    idUser: number;
    uuid: string;
    name: string;
    full_name: string;
    userName: string;
    email: string;
    role: string;
    phone_number: string;
    classId: number | null;
    createdAt: Date;
    created_at: Date;
}

export class UserService {
    /**
     * Generates an initial hashed password for a bulk-uploaded user.
     * Default initial password format: `<userName>123`
     */
    static async generateInitialPassword(userName: string): Promise<string> {
        const raw = `${userName}123`;
        return bcrypt.hash(raw, BCRYPT_SALT_ROUNDS);
    }

    /**
     * Admin-only user creation service.
     * Supports creating STUDENT, TENTOR, and ADMIN accounts.
     */
    static async createUser(data: CreateUserInput): Promise<SafeUserResult> {
        const {
            email,
            password,
            role,
            phone_number,
            parent_full_name,
            parent_phone_number,
            classId,
        } = data;

        const displayName = (data.full_name || data.name || "").trim();

        // 1. Determine or derive username
        let userName = data.userName?.trim();
        if (!userName) {
            const emailPrefix = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
            userName = emailPrefix.length >= 3 ? emailPrefix : `user_${emailPrefix}`;
        }

        // 2. Validate class if provided
        if (classId) {
            const findClass = await prisma.classes.findFirst({ where: { id: Number(classId) } });
            if (!findClass) {
                const err = new Error("Class not found.");
                (err as any).statusCode = 404;
                (err as any).code = "NOT_FOUND";
                throw err;
            }
        }

        // 3. Check for duplicates in user and admin tables
        const duplicateConditions: Array<{ email?: string; userName?: string; phone_number?: string }> = [
            { email },
            { userName },
        ];
        if (phone_number && phone_number.trim() !== "") {
            duplicateConditions.push({ phone_number });
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: duplicateConditions,
            },
        });

        const adminConditions: Array<{ email?: string; username?: string; phone_number?: string }> = [
            { email },
            { username: userName },
        ];
        if (phone_number && phone_number.trim() !== "") {
            adminConditions.push({ phone_number });
        }

        const existingAdmin = await prisma.admin.findFirst({
            where: {
                OR: adminConditions,
            },
        });

        if (existingUser || existingAdmin) {
            const err = new Error("User with this email, username, or phone number already exists.");
            (err as any).statusCode = 409;
            (err as any).code = "CONFLICT";
            throw err;
        }

        // 4. Hash password with project standard bcrypt
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        // 5. Create user in database with the exact requested role
        const prismaRole = role as Role;
        const userUuid = uuidv4();

        const newUser = await prisma.user.create({
            data: {
                uuid: userUuid,
                userName,
                full_name: displayName,
                email,
                password: hashedPassword,
                role: prismaRole,
                phone_number: phone_number || "",
                parent_full_name: parent_full_name || "",
                parent_phone_number: parent_phone_number || "",
                classId: classId ? Number(classId) : null,
            },
        });

        // If the created user is an ADMIN, also register in the admins table to ensure compatibility
        if (prismaRole === Role.ADMIN) {
            try {
                const adminExists = await prisma.admin.findFirst({ where: { email } });
                if (!adminExists) {
                    await prisma.admin.create({
                        data: {
                            uuid: userUuid,
                            username: userName,
                            email,
                            password: hashedPassword,
                            phone_number: phone_number || "",
                        },
                    });
                }
            } catch (adminErr) {
                console.warn("[UserService] Notice: admin table sync skipped or already present", adminErr);
            }
        }

        // 6. Return safe user fields (never return password)
        return {
            id: newUser.id,
            idUser: newUser.id,
            uuid: newUser.uuid,
            name: newUser.full_name,
            full_name: newUser.full_name,
            userName: newUser.userName,
            email: newUser.email,
            role: newUser.role,
            phone_number: newUser.phone_number,
            classId: newUser.classId,
            createdAt: newUser.created_at,
            created_at: newUser.created_at,
        };
    }
}

