import express from "express"
import multer from "multer"
import path from "node:path"
import os from "os"
import { verifyToken, verifyRole } from "../middleware/auth.js"
import { parseWordImport, getImportMedia, commitWordImport, discardWordImport } from "../controller/QuestionImport.js"

const router = express.Router()
const auth = [verifyToken, verifyRole(["TENTOR", "ADMIN"])]

const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (![".docx", ".doc"].includes(ext)) {
            cb(new Error("Hanya dile .docx atau .doc yang didukung."));
            return;
        }
        cb(null, true)
    }
})

router.post("/parse", auth, upload.single("file"), parseWordImport)
router.get("/:sessionId/media/:filename", auth, getImportMedia)
router.post("/:sessionId/commit", auth, commitWordImport)
router.delete("/:sessionId", auth, discardWordImport);

export default router;