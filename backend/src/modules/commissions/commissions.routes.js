import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import * as c from "./commissions.controller.js";

const r = Router();
r.use(authRequired);

r.get("/agents", requirePerm(PERMISSIONS.COMMISSION_READ), c.listAgents);
r.get("/rules", requirePerm(PERMISSIONS.COMMISSION_READ), c.listRules);
r.post("/rules", requirePerm(PERMISSIONS.COMMISSION_WRITE), c.upsertRule);

r.get("/splits", requirePerm(PERMISSIONS.COMMISSION_READ), c.listSplits);
r.post("/splits", requirePerm(PERMISSIONS.COMMISSION_WRITE), c.createOrReplaceSplits);
r.post("/splits/:id/approve", requirePerm(PERMISSIONS.COMMISSION_APPROVE), c.approveSplit);
r.post("/splits/:id/paid", requirePerm(PERMISSIONS.COMMISSION_APPROVE), c.markSplitPaid);

r.get("/payouts", requirePerm(PERMISSIONS.COMMISSION_READ), c.listPayouts);
r.post("/payouts", requirePerm(PERMISSIONS.COMMISSION_WRITE), c.createPayout);
r.post("/payouts/:id/approve", requirePerm(PERMISSIONS.COMMISSION_APPROVE), c.approvePayout);
r.post("/payouts/:id/paid", requirePerm(PERMISSIONS.COMMISSION_APPROVE), c.markPayoutPaid);

r.get("/dashboard", requirePerm(PERMISSIONS.COMMISSION_READ), c.dashboard);

export default r;
