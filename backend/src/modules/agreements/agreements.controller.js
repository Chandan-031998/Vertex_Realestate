import path from "path";
import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";
import { publicUrlFor } from "../../utils/filePaths.js";

const CHECKLIST_BY_TYPE = {
  Sale: ["Title Deed", "EC", "Khata", "Tax Paid Receipt", "ID Proof"],
  Rent: ["Owner ID Proof", "Tenant ID Proof", "Address Proof", "Police Verification"],
  Lease: ["Lease Draft", "Property Tax Receipt", "ID Proof", "Witness Details"],
  PM: ["Management Agreement", "Service Scope", "Owner KYC", "Property Handover Checklist"],
};

const TITLE_STATUSES = new Set(["Pending", "Verified", "Issue Found", "Cleared"]);
const LEGAL_APPROVAL_STATUSES = new Set(["Pending", "Verified", "Issue Found", "Cleared"]);
const REGISTRATION_STATUSES = new Set(["Pending", "Scheduled", "Completed"]);

let ensureColsPromise = null;

async function hasColumn(pool, table, column) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE :column`, { column });
  return rows.length > 0;
}

async function ensureAgreementColumns() {
  if (ensureColsPromise) return ensureColsPromise;
  ensureColsPromise = (async () => {
    const pool = db();
    const patches = [
      ["legal_notes", "ALTER TABLE agreement_transactions ADD COLUMN legal_notes TEXT NULL"],
      ["legal_report_path", "ALTER TABLE agreement_transactions ADD COLUMN legal_report_path TEXT NULL"],
      ["ready_for_registration_status", "ALTER TABLE agreement_transactions ADD COLUMN ready_for_registration_status VARCHAR(30) NOT NULL DEFAULT 'Pending'"],
      ["ready_for_registration_by", "ALTER TABLE agreement_transactions ADD COLUMN ready_for_registration_by BIGINT NULL"],
      ["ready_for_registration_at", "ALTER TABLE agreement_transactions ADD COLUMN ready_for_registration_at DATETIME NULL"],
      ["final_doc_status", "ALTER TABLE agreement_transactions ADD COLUMN final_doc_status VARCHAR(30) NOT NULL DEFAULT 'Pending'"],
      ["final_doc_approved_by", "ALTER TABLE agreement_transactions ADD COLUMN final_doc_approved_by BIGINT NULL"],
      ["final_doc_approved_at", "ALTER TABLE agreement_transactions ADD COLUMN final_doc_approved_at DATETIME NULL"],
    ];
    for (const [col, ddl] of patches) {
      try {
        const exists = await hasColumn(pool, "agreement_transactions", col);
        if (!exists) await pool.query(ddl);
      } catch {
        // Keep module resilient on partially migrated DBs.
      }
    }
  })();
  return ensureColsPromise;
}

function fillTemplate(templateBody, data) {
  return String(templateBody || "")
    .replaceAll("{{property_uid}}", data.property_uid || "")
    .replaceAll("{{property_title}}", data.property_title || "")
    .replaceAll("{{customer_name}}", data.customer_name || "")
    .replaceAll("{{customer_phone}}", data.customer_phone || "")
    .replaceAll("{{owner_name}}", data.owner_name || "")
    .replaceAll("{{txn_type}}", data.txn_type || "");
}

function parseStatus(v, allowed, fallback) {
  const s = String(v || "").trim();
  return allowed.has(s) ? s : fallback;
}

function txMap(r) {
  return {
    ...r,
    legal_report_url: r.legal_report_path ? publicUrlFor(r.legal_report_path) : null,
  };
}

export async function listTemplates(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM agreement_templates WHERE is_active=1 ORDER BY id DESC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createTemplate(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    const [r] = await pool.query(
      "INSERT INTO agreement_templates (name,txn_type,template_body,is_active) VALUES (:name,:txn_type,:template_body,1)",
      { name: b.name, txn_type: b.txn_type, template_body: b.template_body || "" }
    );
    return ok(res, { id: r.insertId }, "Template created");
  } catch (e) { next(e); }
}

export async function listTransactions(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM agreement_transactions ORDER BY id DESC");
    return ok(res, rows.map(txMap));
  } catch (e) { next(e); }
}

export async function createTransaction(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const b = req.body;
    const agreement_uid = `VTX-AGR-${randomUUID().split("-")[0].toUpperCase()}`;
    const [r] = await pool.query(
      `INSERT INTO agreement_transactions
      (agreement_uid,txn_type,template_id,property_id,customer_id,owner_id,status,created_by)
      VALUES
      (:agreement_uid,:txn_type,:template_id,:property_id,:customer_id,:owner_id,'Draft',:created_by)`,
      {
        agreement_uid,
        txn_type: b.txn_type,
        template_id: b.template_id ? Number(b.template_id) : null,
        property_id: b.property_id ? Number(b.property_id) : null,
        customer_id: b.customer_id ? Number(b.customer_id) : null,
        owner_id: b.owner_id ? Number(b.owner_id) : null,
        created_by: req.user.id,
      }
    );

    const checklist = CHECKLIST_BY_TYPE[b.txn_type] || [];
    for (const item of checklist) {
      await pool.query(
        "INSERT INTO agreement_checklist_items (transaction_id,item_name,is_required,is_submitted) VALUES (:transaction_id,:item_name,1,0)",
        { transaction_id: r.insertId, item_name: item }
      );
    }

    return ok(res, { id: r.insertId, agreement_uid }, "Agreement transaction created");
  } catch (e) { next(e); }
}

export async function autofillTransaction(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const id = Number(req.params.id);
    const [[t]] = await pool.query("SELECT * FROM agreement_transactions WHERE id=:id", { id });
    if (!t) return res.status(404).json({ ok: false, message: "Transaction not found" });

    const [[p]] = await pool.query("SELECT property_uid,title FROM properties WHERE id=:id", { id: t.property_id || 0 });
    const [[c]] = await pool.query("SELECT name,phone FROM customers WHERE id=:id", { id: t.customer_id || 0 });
    const [[o]] = await pool.query("SELECT name FROM owners WHERE id=:id", { id: t.owner_id || 0 });
    const [[tpl]] = await pool.query("SELECT template_body FROM agreement_templates WHERE id=:id", { id: t.template_id || 0 });

    const data = {
      txn_type: t.txn_type,
      property_uid: p?.property_uid,
      property_title: p?.title,
      customer_name: c?.name,
      customer_phone: c?.phone,
      owner_name: o?.name,
    };

    return ok(res, {
      data,
      filled_template: fillTemplate(tpl?.template_body || "", data),
    });
  } catch (e) { next(e); }
}

export async function checklistByType(req, res, next) {
  try {
    const type = String(req.query.type || "Sale");
    return ok(res, CHECKLIST_BY_TYPE[type] || []);
  } catch (e) { next(e); }
}

export async function listChecklist(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM agreement_checklist_items WHERE transaction_id=:id ORDER BY id ASC", { id });
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function updateChecklistItem(req, res, next) {
  try {
    const pool = db();
    const itemId = Number(req.params.itemId);
    await pool.query(
      "UPDATE agreement_checklist_items SET is_submitted=:is_submitted, remarks=:remarks WHERE id=:id",
      { id: itemId, is_submitted: req.body.is_submitted ? 1 : 0, remarks: req.body.remarks || null }
    );
    return ok(res, {}, "Checklist item updated");
  } catch (e) { next(e); }
}

export async function updateTitleStatus(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const id = Number(req.params.id);
    const status = parseStatus(req.body.status, TITLE_STATUSES, "Pending");
    await pool.query("UPDATE agreement_transactions SET title_verification_status=:s WHERE id=:id", { id, s: status });
    return ok(res, {}, "Title status updated");
  } catch (e) { next(e); }
}

export async function updateLegalApproval(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const id = Number(req.params.id);
    const status = parseStatus(req.body.status, LEGAL_APPROVAL_STATUSES, "Pending");
    const txStatus = status === "Cleared" ? "Approved" : "Under Review";
    await pool.query(
      "UPDATE agreement_transactions SET legal_approval_status=:s, status=:txStatus WHERE id=:id",
      { id, s: status, txStatus }
    );
    return ok(res, {}, "Legal approval updated");
  } catch (e) { next(e); }
}

export async function updateLegalReview(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const id = Number(req.params.id);
    const titleStatus = parseStatus(req.body.title_status, TITLE_STATUSES, "Pending");
    const legalStatus = parseStatus(req.body.legal_status, LEGAL_APPROVAL_STATUSES, "Pending");
    const legal_notes = String(req.body.legal_notes || "").trim() || null;
    const txStatus = legalStatus === "Cleared" ? "Approved" : "Under Review";
    await pool.query(
      `UPDATE agreement_transactions
       SET title_verification_status=:titleStatus,
           legal_approval_status=:legalStatus,
           legal_notes=:legal_notes,
           status=:txStatus
       WHERE id=:id`,
      { id, titleStatus, legalStatus, legal_notes, txStatus }
    );
    return ok(res, {}, "Legal review updated");
  } catch (e) { next(e); }
}

export async function uploadLegalReviewReport(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const id = Number(req.params.id);
    if (!req.file) return res.status(400).json({ ok: false, message: "Report file required" });
    const rel = path.join("uploads", "legal", "reviews", req.file.filename).replace(/\\/g, "/");
    await pool.query("UPDATE agreement_transactions SET legal_report_path=:p WHERE id=:id", { id, p: rel });
    return ok(res, { report_url: publicUrlFor(rel) }, "Legal review report uploaded");
  } catch (e) { next(e); }
}

export async function approveReadyForRegistration(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const id = Number(req.params.id);
    const approved = Boolean(req.body?.approved);
    const status = approved ? "Approved" : "Pending";
    await pool.query(
      `UPDATE agreement_transactions
       SET ready_for_registration_status=:status,
           ready_for_registration_by=:uid,
           ready_for_registration_at=IF(:approved, NOW(), NULL)
       WHERE id=:id`,
      { id, status, uid: req.user.id, approved: approved ? 1 : 0 }
    );
    return ok(res, {}, "Ready for registration status updated");
  } catch (e) { next(e); }
}

export async function approveFinalCompleteness(req, res, next) {
  try {
    await ensureAgreementColumns();
    const pool = db();
    const id = Number(req.params.id);
    const approved = Boolean(req.body?.approved);
    const status = approved ? "Approved" : "Pending";
    const txStatus = approved ? "Registered" : "Under Review";
    await pool.query(
      `UPDATE agreement_transactions
       SET final_doc_status=:status,
           final_doc_approved_by=:uid,
           final_doc_approved_at=IF(:approved, NOW(), NULL),
           status=:txStatus
       WHERE id=:id`,
      { id, status, uid: req.user.id, approved: approved ? 1 : 0, txStatus }
    );
    return ok(res, {}, "Final document completeness updated");
  } catch (e) { next(e); }
}

export async function upsertRegistration(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const b = req.body;
    const status = parseStatus(b.status, REGISTRATION_STATUSES, "Pending");
    const [[existing]] = await pool.query("SELECT id FROM registration_appointments WHERE transaction_id=:id", { id });
    if (existing) {
      await pool.query(
        `UPDATE registration_appointments
         SET appointment_at=:appointment_at, office_name=:office_name, slot_no=:slot_no, status=:status, notes=:notes
         WHERE transaction_id=:transaction_id`,
        {
          transaction_id: id,
          appointment_at: b.appointment_at,
          office_name: b.office_name || null,
          slot_no: b.slot_no || null,
          status,
          notes: b.notes || null,
        }
      );
    } else {
      await pool.query(
        `INSERT INTO registration_appointments
         (transaction_id,appointment_at,office_name,slot_no,status,notes)
         VALUES
         (:transaction_id,:appointment_at,:office_name,:slot_no,:status,:notes)`,
        {
          transaction_id: id,
          appointment_at: b.appointment_at,
          office_name: b.office_name || null,
          slot_no: b.slot_no || null,
          status,
          notes: b.notes || null,
        }
      );
    }
    return ok(res, {}, "Registration appointment saved");
  } catch (e) { next(e); }
}

export async function getRegistration(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [[row]] = await pool.query("SELECT * FROM registration_appointments WHERE transaction_id=:id", { id });
    return ok(res, row || null);
  } catch (e) { next(e); }
}

export async function updateEsignPlaceholder(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query(
      "UPDATE agreement_transactions SET e_sign_provider=:p, e_sign_status=:s, e_sign_reference=:r WHERE id=:id",
      {
        id,
        p: req.body.provider || null,
        s: req.body.status || "Initiated",
        r: req.body.reference || null,
      }
    );
    return ok(res, {}, "E-sign placeholder updated");
  } catch (e) { next(e); }
}
