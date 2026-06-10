import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { getAutomationSettings, updateAutomationSettings, runReminderJobs } from "./notifications.service.js";

export async function listMyNotifications(req, res, next) {
  try {
    const pool = db();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE user_id=:user_id OR user_id IS NULL ORDER BY id DESC LIMIT ${limit}`,
      { user_id: req.user.id }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function markRead(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query(
      "UPDATE notifications SET is_read=1, seen_at=IFNULL(seen_at,NOW()) WHERE id=:id AND (user_id=:uid OR user_id IS NULL)",
      { id, uid: req.user.id }
    );
    return ok(res, {}, "Marked read");
  } catch (e) { next(e); }
}

export async function unreadCount(req, res, next) {
  try {
    const pool = db();
    const [[row]] = await pool.query(
      "SELECT COUNT(*) as c FROM notifications WHERE is_read=0 AND (user_id=:uid OR user_id IS NULL)",
      { uid: req.user.id }
    );
    return ok(res, { unread: Number(row?.c || 0) });
  } catch (e) { next(e); }
}

export async function markAllRead(req, res, next) {
  try {
    const pool = db();
    await pool.query(
      "UPDATE notifications SET is_read=1, seen_at=IFNULL(seen_at,NOW()) WHERE is_read=0 AND (user_id=:uid OR user_id IS NULL)",
      { uid: req.user.id }
    );
    return ok(res, {}, "All notifications marked read");
  } catch (e) { next(e); }
}

export async function getSettings(req, res, next) {
  try {
    const row = await getAutomationSettings();
    return ok(res, row);
  } catch (e) { next(e); }
}

export async function saveSettings(req, res, next) {
  try {
    const row = await updateAutomationSettings(req.body || {}, req.user.id);
    return ok(res, row, "Notification automation settings updated");
  } catch (e) { next(e); }
}

export async function runNow(req, res, next) {
  try {
    const counts = await runReminderJobs();
    return ok(res, counts, "Reminder jobs executed");
  } catch (e) { next(e); }
}
