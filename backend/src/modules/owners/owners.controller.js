import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";

export async function listOwners(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM owners ORDER BY id DESC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createOwner(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    const owner_uid = `VTX-OWN-${randomUUID().split("-")[0].toUpperCase()}`;
    const [r] = await pool.query(
      "INSERT INTO owners (owner_uid,name,phone,email,address,owner_type) VALUES (:owner_uid,:name,:phone,:email,:address,:owner_type)",
      {
        owner_uid,
        name: b.name,
        phone: b.phone || null,
        email: b.email || null,
        address: b.address || null,
        owner_type: b.owner_type || "Rental",
      }
    );
    return ok(res, { id: r.insertId, owner_uid }, "Owner created");
  } catch (e) { next(e); }
}

export async function assignProperty(req, res, next) {
  try {
    const pool = db();
    const owner_id = Number(req.params.id);
    const property_id = Number(req.body.property_id);
    const management_type = String(req.body.management_type || "Rental");

    const [r] = await pool.query(
      `INSERT INTO owner_properties (owner_id,property_id,management_type)
       VALUES (:owner_id,:property_id,:management_type)
       ON DUPLICATE KEY UPDATE management_type=:management_type`,
      { owner_id, property_id, management_type }
    );

    return ok(res, { id: r.insertId || null }, "Property mapped to owner");
  } catch (e) { next(e); }
}

export async function listOwnerProperties(req, res, next) {
  try {
    const pool = db();
    const owner_id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT op.*, p.property_uid, p.title, p.city, p.area, p.status
       FROM owner_properties op
       JOIN properties p ON p.id = op.property_id
       WHERE op.owner_id=:owner_id
       ORDER BY op.id DESC`,
      { owner_id }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}
