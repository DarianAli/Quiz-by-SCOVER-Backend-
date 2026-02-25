import express from "express";
import { addData, updateData } from "../middleware/userValidation";
import { phoneValidation } from "../validator/phoneValidator";
import { createUser, getAllUser, getById, updateUser } from "../controller/user-controller";
import { registerLimiter, updateLimiter } from "../middleware/rateLimiter";

const app = express()
app.use(express.json())

app.post("/register", registerLimiter, [addData, phoneValidation(["phone_number", "parent_phone_number"])], createUser)
app.get("/getAll", getAllUser)
app.get("/get/:idUser", getById)
app.put("/update/:idUser", updateLimiter, [updateData, phoneValidation(["phone_number", "parent_phone_number"])], updateUser)

export default app