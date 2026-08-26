
export interface UserRow {
    userName: string;
    email: string;
    full_name: string;
    role: string;
    phone_number: string;
    classId: number;
    parent_full_name?: string;
    parent_phone_number?: string;
}

export interface RowValidationResult {
    valid: boolean;
    errors: string[];
}

type UserRole = "STUDENT" | "TENTOR"

const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX    = /^[0-9]{9,15}$/;
const ALLOWED_ROLES: UserRole[] = ["STUDENT", "TENTOR"]

export const validateUserRow = (row: UserRow, rowNumber: number): RowValidationResult => {
    const errors: string[] = [];
    const prefix = `Row ${rowNumber}:`;

    if (!row.userName?.toString().trim()) {
        errors.push(`${prefix} userName is required.`);
    }

    if (!row.email?.toString().trim()) {
        errors.push(`${prefix} email is required.`);
    } else if (!EMAIL_REGEX.test(row.email.toString().trim())) {
        errors.push(`${prefix} email format is invalid.`);
    }

    if (!row.full_name?.toString().trim()) {
        errors.push(`${prefix} full_name is required.`);
    }

    if (!row.role?.toString().trim()) {
        errors.push(`${prefix} role is required.`);
    } else if (!ALLOWED_ROLES.includes(row.role.toString().trim() as UserRole)) {
        errors.push(`${prefix} role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
    }

    if (!row.phone_number?.toString().trim()) {
        errors.push(`${prefix} phone_number is required.`);
    } else if (!PHONE_REGEX.test(row.phone_number.toString().trim())) {
        errors.push(`${prefix} phone_number must be 9–15 digits only.`);
    }

    if (!row.classId === undefined || row.classId === null) {
        errors.push(`${prefix} classId is required.`);
    } else if (isNaN(Number(row.classId))) {
        errors.push(`${prefix} classId must be a number.`);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
};