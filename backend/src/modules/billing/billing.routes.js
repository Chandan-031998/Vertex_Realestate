import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import {
  listInvoices,
  createInvoice,
  addPayment,
  listPayments,
  createBillingNote,
  listBillingNotes,
  exportInvoicePdf,
  sendInvoice,
} from "./billing.controller.js";

const r = Router();
r.use(authRequired);

r.get("/invoices", requirePerm(PERMISSIONS.BILLING_READ), listInvoices);
r.post("/invoices", requirePerm(PERMISSIONS.BILLING_WRITE), createInvoice);
r.post("/invoices/:id/payments", requirePerm(PERMISSIONS.BILLING_WRITE), addPayment);
r.get("/invoices/:id/payments", requirePerm(PERMISSIONS.BILLING_READ), listPayments);
r.post("/invoices/:id/export-pdf", requirePerm(PERMISSIONS.BILLING_READ), exportInvoicePdf);
r.post("/invoices/:id/send", requirePerm(PERMISSIONS.BILLING_WRITE), sendInvoice);

r.get("/notes", requirePerm(PERMISSIONS.BILLING_READ), listBillingNotes);
r.post("/notes", requirePerm(PERMISSIONS.BILLING_WRITE), createBillingNote);

export default r;
