import express from "express";
import multer  from "multer";
import { verifyToken, verifyRole } from "../middleware/auth";
import { previewImport, confirmImport } from "../controller/import-controller";

const router  = express.Router();

// Multer — memory storage, hanya .xlsx/.docx, max 10MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword",
        ];
        const ext = file.originalname.split(".").pop()?.toLowerCase();
        if (allowed.includes(file.mimetype) || ["xlsx", "xls", "docx", "doc"].includes(ext ?? "")) {
            cb(null, true);
        } else {
            cb(new Error("Hanya file .xlsx atau .docx yang diizinkan."));
        }
    },
});

const auth = [verifyToken, verifyRole(["TENTOR", "ADMIN"])];

// POST /import/questions/preview — upload file & preview parsed questions
router.post("/questions/preview", auth, upload.single("file"), previewImport);

// POST /import/questions/confirm — simpan hasil preview ke DB
router.post("/questions/confirm", auth, confirmImport);

export default router;
