import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import * as c from "./accounts.controller.js";

const r = Router();
r.use(authRequired);

r.get("/coa", requirePerm(PERMISSIONS.ACCOUNTS_READ), c.listCoa);
r.post("/coa", requirePerm(PERMISSIONS.ACCOUNTS_WRITE), c.upsertCoa);

r.get("/journals", requirePerm(PERMISSIONS.ACCOUNTS_READ), c.listJournals);
r.get("/journals/:id/lines", requirePerm(PERMISSIONS.ACCOUNTS_READ), c.journalLines);

r.get("/reports/pl", requirePerm(PERMISSIONS.ACCOUNTS_READ), c.reportPL);
r.get("/reports/cashflow", requirePerm(PERMISSIONS.ACCOUNTS_READ), c.reportCashflow);
r.get("/reports/ar-ap", requirePerm(PERMISSIONS.ACCOUNTS_READ), c.reportArAp);

export default r;
