import express, { Request, Response, NextFunction } from "express";
import { addData, updateData, updatePasswordData, updatePasswordDataUser, verifyLogin } from "../middleware/userValidation";
import { phoneValidation } from "../validator/phoneValidator";
import { auth, createUser, deleteUser, getAllUser, getById, updatePasswordAdmin, updatePasswordUser, updateUser } from "../controller/user-controller";
import { deleteLimiter, passwordLimiter, postLimiter, registerLimiter, updateLimiter } from "../middleware/rateLimiter";
import { verifyRole, verifyToken } from "../middleware/auth";
import { onlyAdminCanChangeRole } from "../middleware/onlyAdminUpdate";
import { verifyOwnershipOrAdmin } from "../middleware/validation";
import { bulkCreateUsers } from "../controller/user-controller";
import { uploadExcel } from "../middleware/uploadMidleware";

const app = express()
app.use(express.json())

const handleUpload = (req: Request, res: Response, next: NextFunction) => {
    uploadExcel(req, res, (err) => {
        if (err) {
            res.status(400).json({
                status:  false,
                message: err.message ?? "File upload error.",
            });
            return;
        }
        next();
    });
};

app.post("/register", registerLimiter, [ addData, phoneValidation(["phone_number", "parent_phone_number"])], createUser)
app.post("/login", registerLimiter, [verifyLogin], auth)
app.post("/bulk-upload", postLimiter, [verifyToken, verifyRole(["ADMIN"]), handleUpload], bulkCreateUsers)
app.get("/getAll", [verifyToken, verifyRole(["ADMIN"])], getAllUser)
app.get("/get/:idUser", [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]), verifyOwnershipOrAdmin], getById)
app.put("/update/:idUser", updateLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]), verifyOwnershipOrAdmin, onlyAdminCanChangeRole, updateData, phoneValidation(["phone_number", "parent_phone_number"])], updateUser)
app.put("/:idUser/admin/password", passwordLimiter, [verifyToken, verifyRole(["ADMIN"]), updatePasswordData], updatePasswordAdmin)
app.put("/password/:idUser", passwordLimiter, [verifyToken, verifyRole(["ADMIN", "TENTOR", "STUDENT"]), verifyOwnershipOrAdmin, updatePasswordDataUser], updatePasswordUser)
app.delete("/delete/:idUser", deleteLimiter, [verifyToken, verifyRole(["ADMIN"])], deleteUser)

export default app