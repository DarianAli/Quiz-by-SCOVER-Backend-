import express from "express"
import { addData, updateData } from "../middleware/classValidation"
import { classUpdate, createClass } from "../controller/class-controller"

const app = express()
app.use(express.json())

app.post("/create", [addData], createClass)
app.put("/update/:idClass", [updateData], classUpdate)

export default app