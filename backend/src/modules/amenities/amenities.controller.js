import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";

export async function listAmenities(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM amenities ORDER BY name ASC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function addAmenity(req, res, next) {
  try {
    const pool = db();
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ ok: false, message: "Name required" });
    const [r] = await pool.query("INSERT IGNORE INTO amenities (name) VALUES (:name)", { name });
    return ok(res, { id: r.insertId }, "Saved");
  } catch (e) { next(e); }
}
