import express from "express";
import { addData } from "../middleware/userValidation";
import { phoneValidation } from "../validator/phoneValidator";
import { createUser } from "../controller/user-controller";

const app = express()
app.use(express.json())

app.post("/register", [addData, phoneValidation(["phone_number", "parent_phone_number"])], createUser)

export default app