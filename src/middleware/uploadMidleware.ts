import multer, { FileFilterCallback } from "multer";
import { Request } from "express";
import path from "path";

const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const ALLOWED_MIMETYPES  = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel",                                           // .xls
    "text/csv",                                                           // .csv
    "application/csv",                                                    // .csv (alternate)
];

const storage = multer.memoryStorage();

const fileFilter = (
    _req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    const validExt  = ALLOWED_EXTENSIONS.includes(ext);
    const validMime = ALLOWED_MIMETYPES.includes(mimeType);

    if (validExt && validMime) {
        cb(null, true);
    } else {
        cb(new Error("Only .xlsx, .xls, and .csv files are allowed."));
    }
};

export const uploadExcel = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB — sufficient for any user list
    },
}).single("file");