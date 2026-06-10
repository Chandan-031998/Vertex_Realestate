import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import {
  salesFunnel,
  rentDues,
  agentPerformance,
  sourcePerformance,
  campaignPerformance,
  upsertCampaignSpend,
  analyticsSummary,
  exportAnalytics,
} from "./reports.controller.js";

const r = Router();
r.use(authRequired);

r.get("/sales-funnel", requirePerm(PERMISSIONS.REPORT_READ), salesFunnel);
r.get("/rent-dues", requirePerm(PERMISSIONS.REPORT_READ), rentDues);
r.get("/agent-performance", requirePerm(PERMISSIONS.REPORT_READ), agentPerformance);
r.get("/source-performance", requirePerm(PERMISSIONS.REPORT_READ), sourcePerformance);
r.get("/campaign-performance", requirePerm(PERMISSIONS.REPORT_READ), campaignPerformance);
r.post("/campaign-spend", requirePerm(PERMISSIONS.REPORT_EXPORT), upsertCampaignSpend);
r.get("/analytics/summary", requirePerm(PERMISSIONS.REPORT_READ), analyticsSummary);
r.get("/analytics/export", requirePerm(PERMISSIONS.REPORT_EXPORT), exportAnalytics);

export default r;
