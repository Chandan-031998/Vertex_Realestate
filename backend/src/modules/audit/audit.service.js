import { db } from "../../config/db.js";

export async function audit({ userId, action, entity, entityId = null, meta = null }) {
  const pool = db();
  await pool.query(
    "INSERT INTO audit_logs (user_id, action, entity, entity_id, meta) VALUES (:user_id,:action,:entity,:entity_id,:meta)",
    { user_id: userId || null, action, entity, entity_id: entityId, meta: meta ? JSON.stringify(meta) : null }
  );
}
