import { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient, role } from "@prisma/client"
import { parseExcelBuffer } from "../service/excel.parser";
import { UserRow, validateUserRow } from "../utils/userRow.validator";
import { UploadError, UserInsertPayload, ValidatedRow } from "../types/user.types";
import { UserService } from "./user.service";

const prisma = new PrismaClient({ errorFormat: "pretty" });

const VALID_ROLES = Object.values(role);

// ── File Parsing ─────────────────────────────────────────────────────────────

/**
 * Parses and validates the uploaded file buffer.
 * Throws a typed error that `handleBulkUploadError` can catch and surface.
 */
export class FileParseError extends Error {
    constructor(
        public readonly statusCode: number,
        message: string,
    ) {
        super(message);
        this.name = "FileParseError";
    }
}

export async function parseAndValidateFile(
    file: Express.Multer.File | undefined,
): Promise<UserRow[]> {
    if (!file) {
        throw new FileParseError(400, "No file uploaded. Please upload an .xlsx or .csv file.");
    }

    let rows: UserRow[];
    try {
        rows = await parseExcelBuffer(file.buffer);
    } catch {
        throw new FileParseError(
            400,
            "Failed to parse the uploaded file. Ensure it matches the required template.",
        );
    }

    if (rows.length === 0) {
        throw new FileParseError(400, "The uploaded file contains no data rows.");
    }

    return rows;
}

// ── Row Validation ────────────────────────────────────────────────────────────

export interface ValidateRowsResult {
    validRows:    ValidatedRow[];
    uploadErrors: UploadError[];
}

/**
 * Runs the per-row validator and partitions rows into valid and error buckets.
 */
export function validateRows(rows: UserRow[]): ValidateRowsResult {
    const uploadErrors: UploadError[] = [];
    const validRows: ValidatedRow[]   = [];

    rows.forEach((row, idx) => {
        const rowNumber = idx + 2; // +2: row 1 is the header
        const result    = validateUserRow(row, rowNumber);

        if (!result.valid) {
            uploadErrors.push({ row: rowNumber, data: row, errors: result.errors });
        } else {
            validRows.push({ row: rowNumber, data: row });
        }
    });

    return { validRows, uploadErrors };
}

// ── Class Existence Check ─────────────────────────────────────────────────────

/**
 * Verifies that every referenced classId exists in the database.
 * Rows with non-existent classIds are moved into uploadErrors.
 * Returns only rows that passed the class check.
 */
export async function checkClassExistence(
    validRows:    ValidatedRow[],
    uploadErrors: UploadError[],
): Promise<ValidatedRow[]> {
    const uniqueClassIds = [...new Set(validRows.map(r => Number(r.data.classId)))];

    const existingClasses = await prisma.classes.findMany({
        where:  { idClass: { in: uniqueClassIds } },
        select: { idClass: true },
    });

    const validClassIds = new Set(existingClasses.map(c => c.idClass));
    const passedRows: ValidatedRow[] = [];

    for (const item of validRows) {
        if (!validClassIds.has(Number(item.data.classId))) {
            uploadErrors.push({
                row:    item.row,
                data:   item.data,
                errors: [`Row ${item.row}: classId ${item.data.classId} does not exist.`],
            });
        } else {
            passedRows.push(item);
        }
    }

    return passedRows;
}

// ── Database Conflict Check ───────────────────────────────────────────────────

/**
 * Detects duplicate userName, email, or phone_number — both within the
 * uploaded file and against existing `user` and `admin` records.
 * Rows with conflicts are moved into uploadErrors.
 * Returns only conflict-free rows.
 */
export async function checkDatabaseConflicts(
    rows:         ValidatedRow[],
    uploadErrors: UploadError[],
): Promise<ValidatedRow[]> {
    const fileUserNames    = rows.map(r => r.data.userName);
    const fileEmails       = rows.map(r => r.data.email);
    const filePhoneNumbers = rows.map(r => r.data.phone_number);

    const [dbUsers, dbAdmins] = await Promise.all([
        prisma.user.findMany({
            where: {
                OR: [
                    { userName:     { in: fileUserNames    } },
                    { email:        { in: fileEmails       } },
                    { phone_number: { in: filePhoneNumbers } },
                ],
            },
            select: { userName: true, email: true, phone_number: true },
        }),
        prisma.admin.findMany({
            where: {
                OR: [
                    { email:        { in: fileEmails       } },
                    { phone_number: { in: filePhoneNumbers } },
                ],
            },
            select: { email: true, phone_number: true },
        }),
    ]);

    const dbUserNames    = new Set(dbUsers.map(u => u.userName));
    const dbEmails       = new Set([...dbUsers.map(u => u.email), ...dbAdmins.map(a => a.email)]);
    const dbPhoneNumbers = new Set([...dbUsers.map(u => u.phone_number), ...dbAdmins.map(a => a.phone_number)]);

    const seenInFile = {
        userNames:    new Map<string, number>(),
        emails:       new Map<string, number>(),
        phoneNumbers: new Map<string, number>(),
    };

    const cleanRows: ValidatedRow[] = [];

    for (const item of rows) {
        const { data, row } = item;
        const rowErrors: string[] = [];

        if (seenInFile.userNames.has(data.userName)) {
            rowErrors.push(
                `Row ${row}: userName "${data.userName}" is duplicated within the file (first seen at row ${seenInFile.userNames.get(data.userName)}).`,
            );
        } else {
            seenInFile.userNames.set(data.userName, row);
        }

        if (seenInFile.emails.has(data.email)) {
            rowErrors.push(`Row ${row}: email "${data.email}" is duplicated within the file.`);
        } else {
            seenInFile.emails.set(data.email, row);
        }

        if (seenInFile.phoneNumbers.has(data.phone_number)) {
            rowErrors.push(`Row ${row}: phone_number "${data.phone_number}" is duplicated within the file.`);
        } else {
            seenInFile.phoneNumbers.set(data.phone_number, row);
        }

        if (dbUserNames.has(data.userName)) {
            rowErrors.push(`Row ${row}: userName "${data.userName}" already exists in the database.`);
        }
        if (dbEmails.has(data.email)) {
            rowErrors.push(`Row ${row}: email "${data.email}" already exists in the database.`);
        }
        if (dbPhoneNumbers.has(data.phone_number)) {
            rowErrors.push(`Row ${row}: phone_number "${data.phone_number}" already exists in the database.`);
        }

        if (rowErrors.length > 0) {
            uploadErrors.push({ row, data, errors: rowErrors });
            continue;
        }

        cleanRows.push(item);
    }

    return cleanRows;
}

// ── Insert Payload Preparation ────────────────────────────────────────────────

/**
 * Transforms ValidatedRows into fully-shaped UserInsertPayloads.
 * Passwords are generated via UserService.generateInitialPassword.
 * Rows with invalid roles are moved to uploadErrors.
 */
export async function prepareUsersForInsert(
    rows:         ValidatedRow[],
    uploadErrors: UploadError[],
): Promise<UserInsertPayload[]> {
    const payloads: UserInsertPayload[] = [];

    for (const { data, row } of rows) {
        const trimmedRole = data.role.trim();

        if (!VALID_ROLES.includes(trimmedRole as role)) {
            uploadErrors.push({
                row,
                data,
                errors: [`Row ${row}: Invalid role "${trimmedRole}".`],
            });
            continue;
        }

        const hashedPassword = await UserService.generateInitialPassword(data.userName);

        payloads.push({
            uuid:                uuidv4(),
            userName:            data.userName,
            email:               data.email,
            password:            hashedPassword,
            full_name:           data.full_name,
            role:                trimmedRole as role,
            phone_number:        data.phone_number,
            classId:             Number(data.classId),
            parent_full_name:    data.parent_full_name    ?? "",
            parent_phone_number: data.parent_phone_number ?? "",
        });
    }

    return payloads;
}

// ── Database Insertion ────────────────────────────────────────────────────────

/**
 * Inserts users atomically via prisma.$transaction + createMany.
 * skipDuplicates provides a safety net against race conditions.
 * Returns the number of rows actually created.
 */
export async function insertUsers(users: UserInsertPayload[]): Promise<number> {
    if (users.length === 0) return 0;

    const [result] = await prisma.$transaction([
        prisma.user.createMany({
            data:           users,
            skipDuplicates: true,
        }),
    ]);

    const createdCount = result.count;

    if (createdCount < users.length) {
        console.warn(
            `[insertUsers] ${users.length - createdCount} row(s) skipped due to race-condition duplicates.`,
        );
    }

    return createdCount;
}

// ── Response Helpers ──────────────────────────────────────────────────────────

/**
 * Builds and sends the bulk-upload JSON response with the appropriate HTTP
 * status code (201 / 207 partial / 422 all-failed).
 */
export function sendBulkUploadResponse(
    res:          Response,
    totalRows:    number,
    createdCount: number,
    uploadErrors: UploadError[],
): void {
    const statusCode =
        uploadErrors.length > 0 && createdCount === 0 ? 422
        : uploadErrors.length > 0                     ? 207
        :                                               201;

    res.status(statusCode).json({
        status:        createdCount > 0,
        message:
            createdCount === 0
                ? "No users were created. All rows failed."
                : `Successfully created ${createdCount} user(s).${
                      uploadErrors.length > 0 ? ` ${uploadErrors.length} row(s) failed.` : ""
                  }`,
        total_rows:    totalRows,
        total_created: createdCount,
        total_failed:  uploadErrors.length,
        errors:        uploadErrors.length > 0 ? uploadErrors : undefined,
    });
}

/**
 * Logs an unexpected error and sends a consistent 500 response.
 * Handles FileParseError as a client error with its own status code.
 */
export function handleBulkUploadError(res: Response, error: unknown): void {
    if (error instanceof FileParseError) {
        res.status(error.statusCode).json({
            status:  false,
            message: error.message,
        });
        return;
    }

    console.error("[bulkCreateUsers]", error);
    res.status(500).json({
        status:  false,
        message: "Internal server error.",
    });
}
