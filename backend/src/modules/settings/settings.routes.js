import { Router } from "express";
import multer from "multer";
import fs from "fs";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { joinUpload } from "../../utils/filePaths.js";
import { getSettings, saveSettings } from "./settings.controller.js";

const r = Router();
r.use(authRequired);

const uploadDir = joinUpload("branding");
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

r.get("/app", requirePerm(PERMISSIONS.MASTER_SETTINGS_MANAGE), getSettings);
r.put("/app", requirePerm(PERMISSIONS.MASTER_SETTINGS_MANAGE), upload.single("logo"), saveSettings);

export default r;
