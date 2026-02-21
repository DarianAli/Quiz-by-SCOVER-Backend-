import express from "express"
import { addData, updateData } from "../middleware/classValidation"
import { classUpdate, createClass, getAllData, getById } from "../controller/class-controller"

const app = express()
app.use(express.json())

app.post("/create", [addData], createClass)
app.put("/update/:idClass", [updateData], classUpdate)
app.get("/allData", getAllData)
app.get("/get/:idClass", getById)

export default app