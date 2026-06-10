import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import multer from "multer";
import fs from "fs";
import { joinUpload } from "../../utils/filePaths.js";
import { listTenants, createTenant, addVerificationNote, listVerificationNotes } from "./tenants.controller.js";

const r = Router();
r.use(authRequired);

const storageDir = joinUpload("tenants", "verification");
fs.mkdirSync(storageDir, { recursive: true });
const upload = multer({ dest: storageDir });

r.get("/", requirePerm(PERMISSIONS.CUSTOMER_READ), listTenants);
r.post("/", requirePerm(PERMISSIONS.CUSTOMER_WRITE), upload.single("verification_doc"), createTenant);

r.get("/:id/verification-notes", requirePerm(PERMISSIONS.CUSTOMER_READ), listVerificationNotes);
r.post("/:id/verification-notes", requirePerm(PERMISSIONS.CUSTOMER_WRITE), addVerificationNote);

export default r;
