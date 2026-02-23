import express from "express";
import { addData } from "../middleware/userValidation";
import { phoneValidation } from "../validator/phoneValidator";
import { createUser, getAllUser, getById, registerLimiter } from "../controller/user-controller";

const app = express()
app.use(express.json())

app.post("/register", registerLimiter, [addData, phoneValidation(["phone_number", "parent_phone_number"])], createUser)
app.get("/getAll", getAllUser)
app.get("/get/:idUser", getById)

export default app