import { Router } from "express";
import { getModulesBySubject, createModule, updateModule, deleteModule } from "../controller/module-controller.js";
import { verifyToken, verifyRole } from "../middleware/auth.js";

const moduleRoute = Router();

const auth = [verifyToken, verifyRole(["ADMIN", "TENTOR"])];

moduleRoute.get("/subject/:subjectUuid", verifyToken, getModulesBySubject);
moduleRoute.post("/add", auth, createModule);
moduleRoute.put("/update/:uuid", auth, updateModule);
moduleRoute.delete("/delete/:uuid", auth, deleteModule);

export default moduleRoute;
