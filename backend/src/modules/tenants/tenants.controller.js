import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";
import path from "path";
import { publicUrlFor } from "../../utils/filePaths.js";

export async function listTenants(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM tenants ORDER BY id DESC");
    return ok(res, rows.map((r) => ({ ...r, verification_doc_url: r.verification_doc_path ? publicUrlFor(r.verification_doc_path) : null })));
  } catch (e) { next(e); }
}

export async function createTenant(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    const tenant_uid = `VTX-TEN-${randomUUID().split("-")[0].toUpperCase()}`;
    const doc = req.file ? path.join("uploads", "tenants", "verification", req.file.filename).replace(/\\/g, "/") : null;

    const [r] = await pool.query(
      "INSERT INTO tenants (tenant_uid,name,phone,email,verification_status,verification_doc_path) VALUES (:tenant_uid,:name,:phone,:email,:verification_status,:verification_doc_path)",
      {
        tenant_uid,
        name: b.name,
        phone: b.phone || null,
        email: b.email || null,
        verification_status: b.verification_status || "Pending",
        verification_doc_path: doc,
      }
    );

    return ok(res, { id: r.insertId, tenant_uid }, "Tenant created");
  } catch (e) { next(e); }
}

export async function addVerificationNote(req, res, next) {
  try {
    const pool = db();
    const tenant_id = Number(req.params.id);
    const status = String(req.body.status || "Pending").trim();
    const note = String(req.body.note || "").trim();

    await pool.query("UPDATE tenants SET verification_status=:status WHERE id=:id", { status, id: tenant_id });
    const [r] = await pool.query(
      "INSERT INTO tenant_verification_notes (tenant_id,status,note,created_by) VALUES (:tenant_id,:status,:note,:created_by)",
      { tenant_id, status, note: note || null, created_by: req.user.id }
    );

    return ok(res, { id: r.insertId }, "Tenant verification updated");
  } catch (e) { next(e); }
}

export async function listVerificationNotes(req, res, next) {
  try {
    const pool = db();
    const tenant_id = Number(req.params.id);
    const [rows] = await pool.query(
      "SELECT * FROM tenant_verification_notes WHERE tenant_id=:tenant_id ORDER BY id DESC",
      { tenant_id }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}
