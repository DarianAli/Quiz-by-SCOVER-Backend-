import { Request } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "public", "option_image")
fs.mkdirSync(uploadDir, { recursive: true })

const storage = multer.diskStorage({
    destination: (request: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, uploadDir)        
    },
    filename: (request: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
        cb(null, `${new Date().getTime().toString()}-${file.originalname}`)
    }
})

const ALLOWED_MINE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

const uploadOptionFile = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 },

    fileFilter: ( req, dile, cb) => {
        if (ALLOWED_MINE_TYPES.includes(dile.mimetype)) {
            cb(null, true)
        } else {
            cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed."))
        }
    }
})

export default uploadOptionFile