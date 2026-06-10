import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import multer from "multer";
import fs from "fs";
import * as c from "./agreements.controller.js";
import { joinUpload } from "../../utils/filePaths.js";

const r = Router();
r.use(authRequired);
const legalDir = joinUpload("legal", "reviews");
fs.mkdirSync(legalDir, { recursive: true });
const legalUpload = multer({ dest: legalDir });

r.get("/templates", requirePerm(PERMISSIONS.AGREEMENT_READ), c.listTemplates);
r.post("/templates", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.createTemplate);

r.get("/transactions", requirePerm(PERMISSIONS.AGREEMENT_READ), c.listTransactions);
r.post("/transactions", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.createTransaction);
r.get("/transactions/:id/autofill", requirePerm(PERMISSIONS.AGREEMENT_READ), c.autofillTransaction);

r.get("/checklist", requirePerm(PERMISSIONS.AGREEMENT_READ), c.checklistByType);
r.get("/transactions/:id/checklist", requirePerm(PERMISSIONS.AGREEMENT_READ), c.listChecklist);
r.patch("/transactions/:id/checklist/:itemId", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.updateChecklistItem);

r.patch("/transactions/:id/title-status", requirePerm(PERMISSIONS.TITLE_VERIFY), c.updateTitleStatus);
r.patch("/transactions/:id/legal-approval", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.updateLegalApproval);
r.patch("/transactions/:id/review", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.updateLegalReview);
r.post("/transactions/:id/review-report", requirePerm(PERMISSIONS.AGREEMENT_WRITE), legalUpload.single("report"), c.uploadLegalReviewReport);
r.patch("/transactions/:id/ready-for-registration", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.approveReadyForRegistration);
r.patch("/transactions/:id/final-completeness", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.approveFinalCompleteness);

r.get("/transactions/:id/registration", requirePerm(PERMISSIONS.AGREEMENT_READ), c.getRegistration);
r.post("/transactions/:id/registration", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.upsertRegistration);

r.post("/transactions/:id/esign-placeholder", requirePerm(PERMISSIONS.AGREEMENT_WRITE), c.updateEsignPlaceholder);

export default r;
