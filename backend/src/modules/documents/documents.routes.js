import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { uploadDocs } from "../properties/uploads.middleware.js";
import { addDoc, listDocs } from "./documents.controller.js";

const r = Router();
r.use(authRequired);

r.get("/", requirePerm(PERMISSIONS.PROPERTY_READ), listDocs);
r.post("/", requirePerm(PERMISSIONS.PROPERTY_WRITE), uploadDocs.single("file"), addDoc);

export default r;
