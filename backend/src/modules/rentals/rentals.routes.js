import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import multer from "multer";
import fs from "fs";
import { joinUpload } from "../../utils/filePaths.js";
import * as c from "./rentals.controller.js";

const r = Router();
r.use(authRequired);

const inspDir = joinUpload("rentals", "inspections");
fs.mkdirSync(inspDir, { recursive: true });
const inspectionUpload = multer({ dest: inspDir });

r.get("/contracts", requirePerm(PERMISSIONS.RENT_READ), c.listContracts);
r.post("/contracts", requirePerm(PERMISSIONS.RENT_WRITE), c.createContract);

r.get("/schedules", requirePerm(PERMISSIONS.RENT_READ), c.listSchedules);
r.post("/schedules/:id/collect", requirePerm(PERMISSIONS.RENT_WRITE), c.collectRent);
r.get("/schedules/:id/receipt", requirePerm(PERMISSIONS.RENT_READ), c.getReceipt);
r.post("/schedules/run-overdue-check", requirePerm(PERMISSIONS.RENT_WRITE), c.runLateFeeReminder);

r.get("/maintenance/tickets", requirePerm(PERMISSIONS.MAINTENANCE_MANAGE), c.listMaintenanceTickets);
r.post("/maintenance/tickets", requirePerm(PERMISSIONS.MAINTENANCE_MANAGE), c.raiseMaintenanceTicket);
r.post("/maintenance/tickets/:id/assign-vendor", requirePerm(PERMISSIONS.MAINTENANCE_MANAGE), c.assignVendor);
r.patch("/maintenance/tickets/:id/status", requirePerm(PERMISSIONS.MAINTENANCE_MANAGE), c.updateTicketStatus);
r.post("/maintenance/tickets/:id/payment-request", requirePerm(PERMISSIONS.MAINTENANCE_MANAGE), c.requestVendorPayment);
r.get("/maintenance/sla-report", requirePerm(PERMISSIONS.MAINTENANCE_MANAGE), c.slaReport);

r.get("/tenant-ops/move-checklists", requirePerm(PERMISSIONS.CUSTOMER_READ), c.listMoveChecklists);
r.post("/tenant-ops/move-checklists", requirePerm(PERMISSIONS.CUSTOMER_WRITE), c.createMoveChecklist);
r.patch("/tenant-ops/move-checklists/:id", requirePerm(PERMISSIONS.CUSTOMER_WRITE), c.updateMoveChecklist);
r.get("/tenant-ops/complaints", requirePerm(PERMISSIONS.CUSTOMER_READ), c.listTenantComplaints);
r.post("/tenant-ops/complaints", requirePerm(PERMISSIONS.CUSTOMER_WRITE), c.createTenantComplaint);
r.patch("/tenant-ops/complaints/:id", requirePerm(PERMISSIONS.CUSTOMER_WRITE), c.updateTenantComplaint);

r.get("/inspections", requirePerm(PERMISSIONS.INSPECTION_MANAGE), c.listInspections);
r.post("/inspections", requirePerm(PERMISSIONS.INSPECTION_MANAGE), inspectionUpload.single("report"), c.createInspection);

r.get("/owners/:ownerId/monthly-statement", requirePerm(PERMISSIONS.OWNER_STATEMENT_READ), c.ownerMonthlyStatement);
r.get("/properties/profitability", requirePerm(PERMISSIONS.RENT_READ), c.rentalProfitability);

export default r;
