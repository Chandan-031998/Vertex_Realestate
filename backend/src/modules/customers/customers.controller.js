import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";
import path from "path";
import { publicUrlFor } from "../../utils/filePaths.js";

export async function listCustomers(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM customers ORDER BY id DESC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createCustomer(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    const customer_uid = `VTX-CUST-${randomUUID().split("-")[0].toUpperCase()}`;
    const [r] = await pool.query(
      `INSERT INTO customers
      (customer_uid,name,phone,email,address,pan,aadhaar,gst,pref_area,pref_type,pref_budget_min,pref_budget_max)
      VALUES
      (:customer_uid,:name,:phone,:email,:address,:pan,:aadhaar,:gst,:pref_area,:pref_type,:pref_budget_min,:pref_budget_max)`,
      {
        customer_uid,
        name: b.name,
        phone: b.phone || null,
        email: b.email || null,
        address: b.address || null,
        pan: b.pan || null,
        aadhaar: b.aadhaar || null,
        gst: b.gst || null,
        pref_area: b.pref_area || null,
        pref_type: b.pref_type || null,
        pref_budget_min: b.pref_budget_min ? Number(b.pref_budget_min) : null,
        pref_budget_max: b.pref_budget_max ? Number(b.pref_budget_max) : null,
      }
    );
    return ok(res, { id: r.insertId, customer_uid }, "Customer created");
  } catch (e) { next(e); }
}

export async function addKycDocument(req, res, next) {
  try {
    const pool = db();
    const customer_id = Number(req.params.id);
    const doc_type = String(req.body.doc_type || "").trim();
    if (!customer_id || !doc_type) return res.status(400).json({ ok: false, message: "customer id and doc_type required" });
    if (!req.file) return res.status(400).json({ ok: false, message: "file required" });

    const rel = path.join("uploads", "customers", "kyc", req.file.filename).replace(/\\/g, "/");
    const [r] = await pool.query(
      "INSERT INTO customer_kyc_documents (customer_id,doc_type,file_path,original_name) VALUES (:customer_id,:doc_type,:file_path,:original_name)",
      {
        customer_id,
        doc_type,
        file_path: rel,
        original_name: req.file.originalname || null,
      }
    );

    return ok(res, { id: r.insertId, url: publicUrlFor(rel) }, "KYC document uploaded");
  } catch (e) { next(e); }
}

export async function listKycDocuments(req, res, next) {
  try {
    const pool = db();
    const customer_id = Number(req.params.id);
    const [rows] = await pool.query(
      "SELECT * FROM customer_kyc_documents WHERE customer_id=:customer_id ORDER BY id DESC",
      { customer_id }
    );
    return ok(res, rows.map((r) => ({ ...r, url: publicUrlFor(r.file_path) })));
  } catch (e) { next(e); }
}

export async function addFamilyMember(req, res, next) {
  try {
    const pool = db();
    const customer_id = Number(req.params.id);
    const b = req.body;
    const [r] = await pool.query(
      "INSERT INTO customer_family_members (customer_id,name,relation,phone,email) VALUES (:customer_id,:name,:relation,:phone,:email)",
      {
        customer_id,
        name: b.name,
        relation: b.relation || null,
        phone: b.phone || null,
        email: b.email || null,
      }
    );
    return ok(res, { id: r.insertId }, "Co-applicant/family member added");
  } catch (e) { next(e); }
}

export async function listFamilyMembers(req, res, next) {
  try {
    const pool = db();
    const customer_id = Number(req.params.id);
    const [rows] = await pool.query(
      "SELECT * FROM customer_family_members WHERE customer_id=:customer_id ORDER BY id DESC",
      { customer_id }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function suggestProperties(req, res, next) {
  try {
    const pool = db();
    const customer_id = Number(req.params.id);
    const [[cust]] = await pool.query("SELECT * FROM customers WHERE id=:id", { id: customer_id });
    if (!cust) return res.status(404).json({ ok: false, message: "Customer not found" });

    const where = ["status='Available'"];
    const params = {};

    if (cust.pref_area) {
      where.push("(area LIKE :area OR city LIKE :area)");
      params.area = `%${cust.pref_area}%`;
    }
    if (cust.pref_type) {
      where.push("type=:type");
      params.type = cust.pref_type;
    }
    if (cust.pref_budget_min !== null && cust.pref_budget_min !== undefined) {
      where.push("base_price >= :bmin");
      params.bmin = Number(cust.pref_budget_min);
    }
    if (cust.pref_budget_max !== null && cust.pref_budget_max !== undefined) {
      where.push("base_price <= :bmax");
      params.bmax = Number(cust.pref_budget_max);
    }

    const [rows] = await pool.query(
      `SELECT id,property_uid,title,type,status,city,area,base_price
       FROM properties
       WHERE ${where.join(" AND ")}
       ORDER BY ABS(base_price - :ideal) ASC, id DESC
       LIMIT 50`,
      {
        ...params,
        ideal: Number(cust.pref_budget_max || cust.pref_budget_min || 0),
      }
    );

    return ok(res, rows);
  } catch (e) { next(e); }
}
