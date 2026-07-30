import "express";

// Unified JWT payload — both admin and user logins use this shape.
// For admins: idUser = admin.id, userName = admin.username
export interface JwtPayload {
    idUser:   number;
    email:    string;
    userName: string;
    role:     string;
    classId:  number
}

declare global {
    namespace Express {
        interface Request {
            user?:  JwtPayload;
            admin?: JwtPayload; // same shape as user; set only when role === "ADMIN"
            file?:  Express.Multer.File;
            files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
        }
    }
}