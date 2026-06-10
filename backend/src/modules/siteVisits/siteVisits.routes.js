import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { listVisits, createVisit, updateOutcome } from "./siteVisits.controller.js";

const r = Router();
r.use(authRequired);

r.get("/", requirePerm(PERMISSIONS.LEAD_READ), listVisits);
r.post("/", requirePerm(PERMISSIONS.LEAD_WRITE), createVisit);
r.patch("/:id/outcome", requirePerm(PERMISSIONS.LEAD_WRITE), updateOutcome);

export default r;
