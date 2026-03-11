import ExcelJS from "exceljs";
import { UserRow } from "../utils/userRow.validator";

const COLUMN_MAP: Record<string, keyof UserRow> = {
    username:             "userName",
    userName:             "userName",
    email:                "email",
    full_name:            "full_name",
    fullname:             "full_name",
    role:                 "role",
    phone_number:         "phone_number",
    phonenumber:          "phone_number",
    classid:              "classId",
    classId:              "classId",
    parent_full_name:     "parent_full_name",
    parentfullname:       "parent_full_name",
    parent_phone_number:  "parent_phone_number",
    parentphonenumber:    "parent_phone_number",
};

// Safely convert any ExcelJS cell value to a plain string
const cellToString = (value: ExcelJS.CellValue): string => {
    if (value === null || value === undefined) return "";
    if (typeof value === "object" && "richText" in value) {
        return (value as ExcelJS.CellRichTextValue).richText
            .map(r => r.text)
            .join("")
            .trim();
    }
    if (typeof value === "object" && "result" in value) {
        return (value as ExcelJS.CellFormulaValue).result?.toString().trim() ?? "";
    }
    if (typeof value === "object" && "text" in value) {
        return (value as ExcelJS.CellHyperlinkValue).text?.toString().trim() ?? "";
    }
    if (value instanceof Date) {
        return value.toISOString();
    }
    return value.toString().trim();
};

export const parseExcelBuffer = async (buffer: Express.Multer.File["buffer"]): Promise<UserRow[]> => {
    const workbook = new ExcelJS.Workbook();
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );
    await workbook.xlsx.load(uint8 as unknown as ArrayBuffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
        throw new Error("The uploaded file contains no sheets.");
    }

    const rows: UserRow[] = [];
    let headers: string[] = [];

    worksheet.eachRow((row, rowNumber) => {
        // row.values is 1-indexed in ExcelJS — index 0 is always null
        const values = (row.values as ExcelJS.CellValue[]).slice(1);

        if (rowNumber === 1) {
            headers = values.map(v => cellToString(v));
            return;
        }

        // Skip fully empty rows
        if (values.every(v => v === null || v === undefined || v === "")) return;

        const mapped: Partial<UserRow> = {};

        headers.forEach((header, idx) => {
            const normalizedKey = header.trim().replace(/\s+/g, "_").toLowerCase();
            const field = COLUMN_MAP[normalizedKey] ?? COLUMN_MAP[header.trim()];

            if (field) {
                const raw = cellToString(values[idx]);
                if (field === "classId") {
                    (mapped as Record<string, unknown>)[field] = Number(raw);
                } else {
                    (mapped as Record<string, unknown>)[field] = raw;
                }
            }
        });

        rows.push(mapped as UserRow);
    });

    return rows;
};