import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { overview } from "./dashboard.controller.js";

const r = Router();
r.use(authRequired);

r.get("/overview", requirePerm(PERMISSIONS.REPORT_READ), overview);

export default r;
