import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";
import { generateBookingConfirmationPdf } from "./confirmationPdf.service.js";
import { publicUrlFor } from "../../utils/filePaths.js";
import { postAutoJournal } from "../accounts/accounts.service.js";
import { generateInvoicePdf } from "../billing/invoicePdf.service.js";

function seq4(n) {
  return String(n).padStart(4, "0");
}

function makeNumber(prefix, idx) {
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  return `${prefix}-${ym}-${seq4(idx)}`;
}

async function mapBookingRow(pool, r) {
  const out = { ...r };
  if (r.confirmation_pdf_path) out.confirmation_pdf_url = publicUrlFor(r.confirmation_pdf_path);

  const [prop] = await pool.query("SELECT property_uid,title FROM properties WHERE id=:id", { id: r.property_id });
  const [cust] = await pool.query("SELECT customer_uid,name FROM customers WHERE id=:id", { id: r.customer_id || 0 });
  out.property_label = prop[0] ? `${prop[0].property_uid} - ${prop[0].title}` : String(r.property_id || "-");
  out.customer_label = cust[0] ? `${cust[0].customer_uid} - ${cust[0].name}` : "-";
  return out;
}

export async function listBookings(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM bookings ORDER BY id DESC");
    const enriched = [];
    for (const r of rows) {
      enriched.push(await mapBookingRow(pool, r));
    }
    return ok(res, enriched);
  } catch (e) { next(e); }
}

export async function createBooking(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    const booking_uid = `VTX-BOOK-${randomUUID().split("-")[0].toUpperCase()}`;

    const holdHours = b.hold_hours ? Number(b.hold_hours) : 48;
    const propertyId = Number(b.property_id);
    const unitId = b.unit_id ? Number(b.unit_id) : null;

    const [propRow] = await pool.query("SELECT status FROM properties WHERE id=:id", { id: propertyId });
    if (!propRow.length || propRow[0].status !== "Available") {
      return res.status(400).json({ ok: false, message: "Property is not available for hold" });
    }

    if (unitId) {
      const [unitRow] = await pool.query("SELECT status FROM units WHERE id=:id", { id: unitId });
      if (!unitRow.length || unitRow[0].status !== "Available") {
        return res.status(400).json({ ok: false, message: "Unit is not available for hold" });
      }
    }

    const [r] = await pool.query(
      `INSERT INTO bookings
      (booking_uid,property_id,unit_id,customer_id,token_amount,status,hold_expires_at,cancellation_status,refund_status,created_by)
      VALUES
      (:booking_uid,:property_id,:unit_id,:customer_id,:token_amount,:status,DATE_ADD(NOW(), INTERVAL :holdHours HOUR),'None','None',:created_by)`,
      {
        booking_uid,
        property_id: propertyId,
        unit_id: unitId,
        customer_id: b.customer_id ? Number(b.customer_id) : null,
        token_amount: b.token_amount ? Number(b.token_amount) : 0,
        status: "Hold",
        holdHours,
        created_by: req.user.id,
      }
    );

    await pool.query("UPDATE properties SET status='Hold' WHERE id=:id AND status='Available'", { id: propertyId });
    if (unitId) await pool.query("UPDATE units SET status='Hold' WHERE id=:id AND status='Available'", { id: unitId });

    return ok(res, { id: r.insertId, booking_uid }, "Hold created");
  } catch (e) { next(e); }
}

export async function confirmBooking(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM bookings WHERE id=:id", { id });
    if (!rows.length) return res.status(404).json({ ok: false, message: "Booking not found" });

    const b = rows[0];
    if (b.status !== "Hold") {
      return res.status(400).json({ ok: false, message: "Only Hold bookings can be confirmed" });
    }

    await pool.query("UPDATE bookings SET status='Booked' WHERE id=:id", { id });
    await pool.query("UPDATE properties SET status='Booked' WHERE id=:pid", { pid: b.property_id });
    if (b.unit_id) await pool.query("UPDATE units SET status='Booked' WHERE id=:uid", { uid: b.unit_id });

    const [props] = await pool.query("SELECT property_uid,title FROM properties WHERE id=:id", { id: b.property_id });
    const [cust] = await pool.query("SELECT name FROM customers WHERE id=:id", { id: b.customer_id || 0 });
    const pdf = await generateBookingConfirmationPdf({
      booking_uid: b.booking_uid,
      customerName: cust[0]?.name || "-",
      propertyLabel: props[0] ? `${props[0].property_uid} - ${props[0].title}` : String(b.property_id),
      tokenAmount: b.token_amount,
      holdExpiresAt: b.hold_expires_at,
    });

    await pool.query("UPDATE bookings SET confirmation_pdf_path=:p WHERE id=:id", { id, p: pdf.relPath });
    return ok(res, { confirmation_pdf_url: pdf.url }, "Booking confirmed");
  } catch (e) { next(e); }
}

export async function getConfirmationPdf(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT confirmation_pdf_path FROM bookings WHERE id=:id", { id });
    if (!rows.length || !rows[0].confirmation_pdf_path) return res.status(404).json({ ok: false, message: "PDF not generated" });
    return ok(res, { confirmation_pdf_url: publicUrlFor(rows[0].confirmation_pdf_path) });
  } catch (e) { next(e); }
}

export async function requestCancellation(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const reason = String(req.body.reason || "").trim();
    if (!reason) return res.status(400).json({ ok: false, message: "Cancellation reason required" });

    await pool.query(
      `UPDATE bookings
       SET cancellation_status='Requested', cancellation_reason=:reason, cancellation_requested_by=:uid, cancellation_requested_at=NOW()
       WHERE id=:id`,
      { id, uid: req.user.id, reason }
    );

    return ok(res, {}, "Cancellation requested");
  } catch (e) { next(e); }
}

export async function approveCancellation(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE bookings
       SET status='Cancelled', cancellation_status='Approved', cancellation_approved_by=:uid, cancellation_approved_at=NOW()
       WHERE id=:id`,
      { id, uid: req.user.id }
    );

    const [rows] = await pool.query("SELECT property_id, unit_id FROM bookings WHERE id=:id", { id });
    if (rows.length) {
      await pool.query("UPDATE properties SET status='Available' WHERE id=:pid", { pid: rows[0].property_id });
      if (rows[0].unit_id) await pool.query("UPDATE units SET status='Available' WHERE id=:uid", { uid: rows[0].unit_id });
    }

    return ok(res, {}, "Cancellation approved");
  } catch (e) { next(e); }
}

export async function requestRefund(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const amount = Number(req.body.amount || 0);
    const reason = String(req.body.reason || "").trim();
    if (!amount || amount <= 0) return res.status(400).json({ ok: false, message: "Valid refund amount required" });

    await pool.query(
      `UPDATE bookings
       SET refund_status='Requested', refund_amount=:amount, refund_reason=:reason, refund_requested_by=:uid, refund_requested_at=NOW()
       WHERE id=:id`,
      { id, uid: req.user.id, amount, reason: reason || null }
    );

    return ok(res, {}, "Refund requested");
  } catch (e) { next(e); }
}

export async function approveRefund(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE bookings
       SET refund_status='Approved', refund_approved_by=:uid, refund_approved_at=NOW()
       WHERE id=:id`,
      { id, uid: req.user.id }
    );
    return ok(res, {}, "Refund approved. Awaiting processing.");
  } catch (e) { next(e); }
}

export async function processRefund(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM bookings WHERE id=:id", { id });
    if (!rows.length) return res.status(404).json({ ok: false, message: "Booking not found" });
    const b = rows[0];
    if (String(b.refund_status || "") !== "Approved") {
      return res.status(400).json({ ok: false, message: "Refund must be approved before processing" });
    }
    const amount = Number(b.refund_amount || 0);
    if (amount <= 0) return res.status(400).json({ ok: false, message: "Approved refund amount is invalid" });

    const [doneRows] = await pool.query(
      "SELECT id FROM billing_notes WHERE note_type='Refund' AND reason LIKE :q ORDER BY id DESC LIMIT 1",
      { q: `%Booking ${b.booking_uid}%` }
    );
    if (doneRows.length) {
      return ok(res, { note_id: doneRows[0].id }, "Refund already processed");
    }

    const [[countRow]] = await pool.query("SELECT COUNT(*) as c FROM billing_notes WHERE note_no LIKE 'RN-%'");
    const note_no = makeNumber("RN", Number(countRow?.c || 0) + 1);

    const [nr] = await pool.query(
      `INSERT INTO billing_notes
      (note_no,note_type,invoice_id,customer_id,amount,reason,status,created_by)
      VALUES
      (:note_no,'Refund',NULL,:customer_id,:amount,:reason,'Issued',:created_by)`,
      {
        note_no,
        customer_id: b.customer_id || null,
        amount,
        reason: `Booking ${b.booking_uid} refund processed`,
        created_by: req.user.id,
      }
    );

    await pool.query(
      `UPDATE bookings
       SET refund_status='Processed'
       WHERE id=:id AND refund_status='Approved'`,
      { id }
    );

    try {
      await postAutoJournal({
        event: "refund_paid",
        amount,
        source_type: "Bookings",
        source_id: id,
        created_by: req.user.id,
        narration: `refund_paid booking ${id}`,
      });
    } catch {
      // Non-blocking to keep operations resilient across schema states.
    }

    return ok(res, { note_id: nr.insertId, note_no }, "Refund processed");
  } catch (e) { next(e); }
}

export async function generateTokenReceipt(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM bookings WHERE id=:id", { id });
    if (!rows.length) return res.status(404).json({ ok: false, message: "Booking not found" });
    const b = rows[0];
    const tokenAmount = Number(b.token_amount || 0);
    if (tokenAmount <= 0) return res.status(400).json({ ok: false, message: "Booking token amount is not set" });

    const [[countRow]] = await pool.query("SELECT COUNT(*) as c FROM invoices WHERE invoice_no LIKE 'TR-%'");
    const invoice_no = makeNumber("TR", Number(countRow?.c || 0) + 1);

    let invoiceId = null;
    try {
      const [ins] = await pool.query(
        `INSERT INTO invoices
         (invoice_no,type,customer_id,property_id,amount,gst_enabled,gst_rate,taxable_amount,gst_amount,total_amount,invoice_kind,amount_due,total_paid,status,invoice_date)
         VALUES
         (:invoice_no,'Token',:customer_id,:property_id,:amount,0,0,:taxable_amount,0,:total_amount,'TokenReceipt',0,:total_paid,'Paid',:invoice_date)`,
        {
          invoice_no,
          customer_id: b.customer_id || null,
          property_id: b.property_id || null,
          amount: tokenAmount,
          taxable_amount: tokenAmount,
          total_amount: tokenAmount,
          total_paid: tokenAmount,
          invoice_date: new Date().toISOString().slice(0, 10),
        }
      );
      invoiceId = ins.insertId;
      await pool.query(
        `INSERT INTO payments (invoice_id,payment_no,amount,method,ref_no,note,paid_at)
         VALUES (:invoice_id,:payment_no,:amount,:method,:ref_no,:note,NOW())`,
        {
          invoice_id: invoiceId,
          payment_no: `PMT-${invoiceId}-0001`,
          amount: tokenAmount,
          method: req.body?.method || "Cash",
          ref_no: req.body?.ref_no || null,
          note: "Token receipt generated from field",
        }
      );
    } catch {
      const [ins] = await pool.query(
        `INSERT INTO invoices
         (invoice_no,type,customer_id,property_id,amount,amount_due,status,invoice_date)
         VALUES
         (:invoice_no,'Token',:customer_id,:property_id,:amount,0,'Paid',:invoice_date)`,
        {
          invoice_no,
          customer_id: b.customer_id || null,
          property_id: b.property_id || null,
          amount: tokenAmount,
          invoice_date: new Date().toISOString().slice(0, 10),
        }
      );
      invoiceId = ins.insertId;
      await pool.query(
        `INSERT INTO payments (invoice_id,amount,method,ref_no,note,paid_at)
         VALUES (:invoice_id,:amount,:method,:ref_no,:note,NOW())`,
        {
          invoice_id: invoiceId,
          amount: tokenAmount,
          method: req.body?.method || "Cash",
          ref_no: req.body?.ref_no || null,
          note: "Token receipt generated from field",
        }
      );
    }

    let pdfUrl = null;
    try {
      const [invRows] = await pool.query("SELECT * FROM invoices WHERE id=:id", { id: invoiceId });
      const pdf = await generateInvoicePdf(invRows[0]);
      await pool.query("UPDATE invoices SET pdf_path=:p WHERE id=:id", { id: invoiceId, p: pdf.path });
      pdfUrl = pdf.url;
    } catch {
      // Keep field flow usable even if pdf_path column is not migrated.
    }

    try {
      await postAutoJournal({
        event: "token_received",
        amount: tokenAmount,
        source_type: "Bookings",
        source_id: id,
        created_by: req.user.id,
        narration: `token_received booking ${id}`,
      });
    } catch {
      // Non-blocking for compatibility.
    }

    return ok(res, { invoice_id: invoiceId, invoice_no, pdf_url: pdfUrl }, "Token receipt generated");
  } catch (e) { next(e); }
}

// Backward-compatible endpoint retained for old UI actions.
export async function cancelBooking(req, res, next) {
  return requestCancellation(req, res, next);
}
