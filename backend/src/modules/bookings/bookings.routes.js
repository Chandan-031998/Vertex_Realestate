import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requireAnyPerm, requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import {
  listBookings,
  createBooking,
  cancelBooking,
  confirmBooking,
  getConfirmationPdf,
  requestCancellation,
  approveCancellation,
  requestRefund,
  approveRefund,
  processRefund,
  generateTokenReceipt,
} from "./bookings.controller.js";

const r = Router();
r.use(authRequired);

r.get("/", requirePerm(PERMISSIONS.BOOKING_READ), listBookings);
r.post("/", requirePerm(PERMISSIONS.BOOKING_WRITE), createBooking);
r.post("/:id/confirm", requirePerm(PERMISSIONS.BOOKING_APPROVE), confirmBooking);
r.get("/:id/confirmation-pdf", requirePerm(PERMISSIONS.BOOKING_READ), getConfirmationPdf);

r.post("/:id/cancel", requirePerm(PERMISSIONS.BOOKING_WRITE), cancelBooking);
r.post("/:id/cancel/request", requirePerm(PERMISSIONS.BOOKING_WRITE), requestCancellation);
r.post("/:id/cancel/approve", requirePerm(PERMISSIONS.CANCELLATION_APPROVE), approveCancellation);
r.post("/:id/refund/request", requirePerm(PERMISSIONS.BOOKING_WRITE), requestRefund);
r.post("/:id/refund/approve", requirePerm(PERMISSIONS.REFUND_APPROVE), approveRefund);
r.post("/:id/refund/process", requirePerm(PERMISSIONS.BILLING_WRITE), processRefund);
r.post("/:id/token-receipt", requireAnyPerm(PERMISSIONS.BOOKING_WRITE, PERMISSIONS.BILLING_WRITE), generateTokenReceipt);

export default r;
