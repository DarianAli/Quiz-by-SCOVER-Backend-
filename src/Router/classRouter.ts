import express from "express"
import { addData, updateData } from "../middleware/classValidation"
import { classUpdate, createClass, deleteClass, getAllData, getById } from "../controller/class-controller"
import { deleteLimiter, postLimiter, updateLimiter } from "../middleware/rateLimiter"

const app = express()
app.use(express.json())

app.post("/create", postLimiter, [addData], createClass)
app.put("/update/:idClass", updateLimiter, [updateData], classUpdate)
app.get("/allData", getAllData)
app.get("/get/:idClass", getById)
app.delete("/delete/:idClass", deleteLimiter, deleteClass)

export default app