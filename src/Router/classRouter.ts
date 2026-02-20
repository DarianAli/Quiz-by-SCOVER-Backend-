import express from "express"
import { addData } from "../middleware/classValidation"
import { createClass } from "../controller/class-controller"

const app = express()
app.use(express.json())

app.post("/create", [addData], createClass)

export default app