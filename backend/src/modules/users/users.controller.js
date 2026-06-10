import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { audit } from "../audit/audit.service.js";
import bcrypt from "bcryptjs";

export async function listUsers(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT id,name,email,role,is_active,created_at FROM users ORDER BY id DESC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function toggleUserActive(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query("UPDATE users SET is_active = IF(is_active=1,0,1) WHERE id=:id", { id });
    await audit({ userId: req.user.id, action: "toggle_active", entity: "users", entityId: String(id) });
    return ok(res, {}, "Updated");
  } catch (e) { next(e); }
}

export async function updateUserRole(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const { role } = req.body;
    await pool.query("UPDATE users SET role=:role WHERE id=:id", { id, role });
    await audit({ userId: req.user.id, action: "update_role", entity: "users", entityId: String(id), meta: { role } });
    return ok(res, {}, "Updated");
  } catch (e) { next(e); }
}

export async function resetUserPassword(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const provided = String(req.body?.new_password || "").trim();
    const tempPassword = provided || Math.random().toString(36).slice(-10) + "A1!";
    const password_hash = await bcrypt.hash(tempPassword, 10);

    const [r] = await pool.query("UPDATE users SET password_hash=:password_hash WHERE id=:id", { id, password_hash });
    if (!r.affectedRows) {
      return res.status(404).json({ ok: false, message: "User not found" });
    }

    await audit({ userId: req.user.id, action: "reset_password", entity: "users", entityId: String(id) });
    const response = provided ? {} : { temporary_password: tempPassword };
    return ok(res, response, "Password reset");
  } catch (e) { next(e); }
}
