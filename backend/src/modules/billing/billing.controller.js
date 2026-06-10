import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { generateInvoicePdf } from "./invoicePdf.service.js";
import { publicUrlFor } from "../../utils/filePaths.js";
import { postAutoJournal } from "../accounts/accounts.service.js";

function seq4(n) {
  return String(n).padStart(4, "0");
}

function makeNumber(prefix, idx) {
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  return `${prefix}-${ym}-${seq4(idx)}`;
}

function calcAmounts({ amount, gst_enabled, gst_rate }) {
  const base = Number(amount || 0);
  const enabled = Boolean(gst_enabled);
  const rate = enabled ? Number(gst_rate || 0) : 0;
  const gst_amount = Number(((base * rate) / 100).toFixed(2));
  const total = Number((base + gst_amount).toFixed(2));
  return {
    taxable_amount: base,
    gst_amount,
    total_amount: total,
  };
}

function pickNumberPrefix(type, kind) {
  if (kind === "TokenReceipt") return "TR";
  if (kind === "BookingReceipt") return "BR";
  if (type === "Token") return "INV-TKN";
  return "INV";
}

export async function listInvoices(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM invoices ORDER BY id DESC");
    return ok(res, rows.map((r) => ({ ...r, pdf_url: r.pdf_path ? publicUrlFor(r.pdf_path) : null })));
  } catch (e) { next(e); }
}

export async function createInvoice(req, res, next) {
  try {
    const pool = db();
    const b = req.body;

    const type = b.type || "Token";
    const invoice_kind = b.invoice_kind || (type === "Token" ? "TokenReceipt" : "Invoice");
    const prefix = pickNumberPrefix(type, invoice_kind);

    const [[countRow]] = await pool.query(
      "SELECT COUNT(*) as c FROM invoices WHERE invoice_no LIKE :p",
      { p: `${prefix}-%` }
    );
    const invoice_no = makeNumber(prefix, Number(countRow?.c || 0) + 1);

    const gst_enabled = Boolean(b.gst_enabled) || type === "Commercial";
    const gst_rate = gst_enabled ? Number(b.gst_rate || 18) : 0;
    const amount = Number(b.amount || 0);
    const amounts = calcAmounts({ amount, gst_enabled, gst_rate });

    const [r] = await pool.query(
      `INSERT INTO invoices
      (invoice_no,type,customer_id,property_id,amount,gst_enabled,gst_rate,taxable_amount,gst_amount,total_amount,invoice_kind,amount_due,total_paid,status,invoice_date)
      VALUES
      (:invoice_no,:type,:customer_id,:property_id,:amount,:gst_enabled,:gst_rate,:taxable_amount,:gst_amount,:total_amount,:invoice_kind,:amount_due,0,:status,:invoice_date)`,
      {
        invoice_no,
        type,
        customer_id: b.customer_id ? Number(b.customer_id) : null,
        property_id: b.property_id ? Number(b.property_id) : null,
        amount,
        gst_enabled: gst_enabled ? 1 : 0,
        gst_rate,
        taxable_amount: amounts.taxable_amount,
        gst_amount: amounts.gst_amount,
        total_amount: amounts.total_amount,
        invoice_kind,
        amount_due: amounts.total_amount,
        status: "Unpaid",
        invoice_date: b.invoice_date || new Date().toISOString().slice(0, 10),
      }
    );

    return ok(res, { id: r.insertId, invoice_no }, "Invoice created");
  } catch (e) {
    // backward compatibility with older schema
    try {
      const pool = db();
      const b = req.body;
      const [[countRow]] = await pool.query("SELECT COUNT(*) as c FROM invoices");
      const invoice_no = makeNumber("INV", Number(countRow?.c || 0) + 1);
      const amount = Number(b.amount || 0);
      const [r] = await pool.query(
        "INSERT INTO invoices (invoice_no,type,customer_id,property_id,amount,amount_due,status,invoice_date) VALUES (:invoice_no,:type,:customer_id,:property_id,:amount,:amount_due,:status,:invoice_date)",
        {
          invoice_no,
          type: b.type || "Token",
          customer_id: b.customer_id ? Number(b.customer_id) : null,
          property_id: b.property_id ? Number(b.property_id) : null,
          amount,
          amount_due: amount,
          status: "Unpaid",
          invoice_date: b.invoice_date || new Date().toISOString().slice(0, 10),
        }
      );
      return ok(res, { id: r.insertId, invoice_no }, "Invoice created");
    } catch (e2) {
      next(e2);
    }
  }
}

export async function addPayment(req, res, next) {
  try {
    const pool = db();
    const invoice_id = Number(req.params.id);
    const b = req.body;
    const pay = Number(b.amount || 0);
    if (pay <= 0) return res.status(400).json({ ok: false, message: "Valid payment amount required" });

    const [invRows] = await pool.query("SELECT * FROM invoices WHERE id=:id", { id: invoice_id });
    if (!invRows.length) return res.status(404).json({ ok: false, message: "Invoice not found" });
    const inv = invRows[0];

    const dueBefore = Number(inv.amount_due || 0);
    if (pay > dueBefore) return res.status(400).json({ ok: false, message: "Payment exceeds due amount" });

    const [[countRow]] = await pool.query("SELECT COUNT(*) as c FROM payments WHERE invoice_id=:invoice_id", { invoice_id });
    const payment_no = `PMT-${invoice_id}-${seq4(Number(countRow?.c || 0) + 1)}`;

    await pool.query(
      `INSERT INTO payments
       (invoice_id,payment_no,amount,method,ref_no,cheque_no,cheque_status,note,paid_at)
       VALUES
       (:invoice_id,:payment_no,:amount,:method,:ref_no,:cheque_no,:cheque_status,:note,:paid_at)`,
      {
        invoice_id,
        payment_no,
        amount: pay,
        method: b.method || null,
        ref_no: b.ref_no || null,
        cheque_no: b.cheque_no || null,
        cheque_status: b.cheque_status || null,
        note: b.note || null,
        paid_at: b.paid_at || new Date().toISOString().slice(0, 19).replace("T", " "),
      }
    );

    const total_paid = Number((Number(inv.total_paid || 0) + pay).toFixed(2));
    const amount_due = Number((Number((inv.total_amount ?? inv.amount) || 0) - total_paid).toFixed(2));
    const status = amount_due <= 0 ? "Paid" : total_paid > 0 ? "Partial" : "Unpaid";

    await pool.query(
      "UPDATE invoices SET total_paid=:total_paid, amount_due=:amount_due, status=:status WHERE id=:id",
      { id: invoice_id, total_paid, amount_due, status }
    );

    const type = String(inv.type || "").toLowerCase();
    let event = null;
    if (type === "token") event = "token_received";
    else if (type === "rent") event = "rent_received";
    else if (type === "brokerage") event = "brokerage_income";
    if (event) {
      try {
        await postAutoJournal({
          event,
          amount: pay,
          source_type: "Billing",
          source_id: invoice_id,
          created_by: req.user.id,
          narration: `${event} via invoice ${inv.invoice_no}`,
        });
      } catch {
        // Keep billing flow resilient if accounts migration is pending.
      }
    }

    return ok(res, { amount_due, total_paid, payment_no }, "Payment added");
  } catch (e) {
    // backward compatibility
    try {
      const pool = db();
      const invoice_id = Number(req.params.id);
      const b = req.body;
      const pay = Number(b.amount || 0);
      await pool.query(
        "INSERT INTO payments (invoice_id,amount,method,ref_no,paid_at) VALUES (:invoice_id,:amount,:method,:ref_no,:paid_at)",
        {
          invoice_id,
          amount: pay,
          method: b.method || null,
          ref_no: b.ref_no || null,
          paid_at: b.paid_at || new Date().toISOString().slice(0, 19).replace("T", " "),
        }
      );
      const [inv] = await pool.query("SELECT amount_due,amount FROM invoices WHERE id=:id", { id: invoice_id });
      const due = Math.max(0, Number(inv[0]?.amount_due || inv[0]?.amount || 0) - pay);
      await pool.query("UPDATE invoices SET amount_due=:due, status=IF(:due=0,'Paid','Partial') WHERE id=:id", { due, id: invoice_id });
      return ok(res, { amount_due: due }, "Payment added");
    } catch (e2) {
      next(e2);
    }
  }
}

export async function listPayments(req, res, next) {
  try {
    const pool = db();
    const invoice_id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM payments WHERE invoice_id=:invoice_id ORDER BY id DESC", { invoice_id });
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createBillingNote(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    const type = b.note_type || "Credit";
    const prefix = type === "Refund" ? "RN" : "CN";
    const [[countRow]] = await pool.query("SELECT COUNT(*) as c FROM billing_notes WHERE note_no LIKE :p", { p: `${prefix}-%` });
    const note_no = makeNumber(prefix, Number(countRow?.c || 0) + 1);

    const [r] = await pool.query(
      `INSERT INTO billing_notes
      (note_no,note_type,invoice_id,customer_id,amount,reason,status,created_by)
      VALUES
      (:note_no,:note_type,:invoice_id,:customer_id,:amount,:reason,'Issued',:created_by)`,
      {
        note_no,
        note_type: type,
        invoice_id: b.invoice_id ? Number(b.invoice_id) : null,
        customer_id: b.customer_id ? Number(b.customer_id) : null,
        amount: Number(b.amount || 0),
        reason: b.reason || null,
        created_by: req.user.id,
      }
    );

    return ok(res, { id: r.insertId, note_no }, "Billing note created");
  } catch (e) {
    // placeholder fallback if table not yet migrated
    if (/billing_notes/i.test(String(e.message || ""))) {
      return res.status(400).json({ ok: false, message: "Apply DB migration for billing_notes table" });
    }
    next(e);
  }
}

export async function listBillingNotes(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM billing_notes ORDER BY id DESC");
    return ok(res, rows);
  } catch (e) {
    if (/billing_notes/i.test(String(e.message || ""))) return ok(res, []);
    next(e);
  }
}

export async function exportInvoicePdf(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM invoices WHERE id=:id", { id });
    if (!rows.length) return res.status(404).json({ ok: false, message: "Invoice not found" });

    const pdf = await generateInvoicePdf(rows[0]);
    try {
      await pool.query("UPDATE invoices SET pdf_path=:p WHERE id=:id", { id, p: pdf.path });
    } catch {
      // old schema may not have pdf_path
    }
    return ok(res, { pdf_url: pdf.url }, "PDF generated");
  } catch (e) { next(e); }
}

export async function sendInvoice(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const channel = String(req.body.channel || "email").toLowerCase();
    const target = String(req.body.target || "").trim();
    if (!target) return res.status(400).json({ ok: false, message: "target is required" });

    await pool.query(
      "INSERT INTO notifications (user_id,type,message) VALUES (NULL,:type,:message)",
      {
        type: "BillingDispatch",
        message: `Invoice ${id} sent via ${channel} to ${target}`,
      }
    );

    return ok(res, { channel, target }, "Invoice sent (placeholder integration)");
  } catch (e) { next(e); }
}
