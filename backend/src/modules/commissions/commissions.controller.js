import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";

function toNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function listAgents(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query(
      "SELECT id,name,role,email FROM users WHERE role IN ('Sales Agent','Sales Manager') AND is_active=1 ORDER BY name ASC"
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function listRules(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query(
      `SELECT r.*, u.name as agent_name
       FROM agent_commission_rules r
       LEFT JOIN users u ON u.id = r.agent_id
       ORDER BY r.is_active DESC, r.updated_at DESC`
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function upsertRule(req, res, next) {
  try {
    const pool = db();
    const b = req.body || {};
    const agent_id = Number(b.agent_id || 0);
    if (!agent_id) return res.status(400).json({ ok: false, message: "agent_id is required" });

    const rule_type = b.rule_type === "Fixed" ? "Fixed" : "Percent";
    const percentage_rate = rule_type === "Percent" ? toNumber(b.percentage_rate) : 0;
    const fixed_amount = rule_type === "Fixed" ? toNumber(b.fixed_amount) : 0;
    const effective_from = String(b.effective_from || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const effective_to = b.effective_to ? String(b.effective_to).slice(0, 10) : null;

    await pool.query("UPDATE agent_commission_rules SET is_active=0 WHERE agent_id=:agent_id", { agent_id });
    await pool.query(
      `INSERT INTO agent_commission_rules
       (agent_id,rule_type,percentage_rate,fixed_amount,effective_from,effective_to,is_active,created_by)
       VALUES (:agent_id,:rule_type,:percentage_rate,:fixed_amount,:effective_from,:effective_to,1,:created_by)`,
      {
        agent_id,
        rule_type,
        percentage_rate,
        fixed_amount,
        effective_from,
        effective_to,
        created_by: req.user.id,
      }
    );
    return ok(res, {}, "Commission rule updated");
  } catch (e) { next(e); }
}

export async function listSplits(req, res, next) {
  try {
    const pool = db();
    const where = [];
    const params = {};

    if (req.query.booking_id) {
      where.push("s.booking_id=:booking_id");
      params.booking_id = Number(req.query.booking_id);
    }
    if (req.query.agent_id) {
      where.push("s.agent_id=:agent_id");
      params.agent_id = Number(req.query.agent_id);
    }
    if (req.query.status) {
      where.push("s.status=:status");
      params.status = String(req.query.status);
    }

    const sql = `SELECT s.*, b.booking_uid, b.token_amount, u.name as agent_name
      FROM booking_commission_splits s
      LEFT JOIN bookings b ON b.id = s.booking_id
      LEFT JOIN users u ON u.id = s.agent_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY s.id DESC LIMIT 1000`;
    const [rows] = await pool.query(sql, params);
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createOrReplaceSplits(req, res, next) {
  try {
    const pool = db();
    const booking_id = Number(req.body?.booking_id || 0);
    const splits = Array.isArray(req.body?.splits) ? req.body.splits : [];
    if (!booking_id || !splits.length) {
      return res.status(400).json({ ok: false, message: "booking_id and splits are required" });
    }

    const [bookRows] = await pool.query("SELECT token_amount FROM bookings WHERE id=:id", { id: booking_id });
    if (!bookRows.length) return res.status(404).json({ ok: false, message: "Booking not found" });
    const tokenAmount = toNumber(bookRows[0].token_amount);

    await pool.query("DELETE FROM booking_commission_splits WHERE booking_id=:booking_id AND status='Pending'", { booking_id });

    for (const raw of splits) {
      const agent_id = Number(raw.agent_id || 0);
      if (!agent_id) continue;
      const share_type = raw.share_type === "Fixed" ? "Fixed" : "Percent";
      const share_value = toNumber(raw.share_value);
      const commission_amount = share_type === "Percent"
        ? Number((tokenAmount * share_value / 100).toFixed(2))
        : Number(share_value.toFixed(2));

      await pool.query(
        `INSERT INTO booking_commission_splits
         (booking_id,agent_id,share_type,share_value,commission_amount,status,note,created_by)
         VALUES (:booking_id,:agent_id,:share_type,:share_value,:commission_amount,'Pending',:note,:created_by)`,
        {
          booking_id,
          agent_id,
          share_type,
          share_value,
          commission_amount,
          note: raw.note || null,
          created_by: req.user.id,
        }
      );
    }

    return ok(res, {}, "Commission split saved");
  } catch (e) { next(e); }
}

export async function approveSplit(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE booking_commission_splits
       SET status='Approved', approved_by=:uid, approved_at=NOW()
       WHERE id=:id`,
      { id, uid: req.user.id }
    );
    return ok(res, {}, "Split approved");
  } catch (e) { next(e); }
}

export async function markSplitPaid(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query(
      `UPDATE booking_commission_splits
       SET status='Paid', paid_at=NOW()
       WHERE id=:id`,
      { id }
    );
    return ok(res, {}, "Split marked paid");
  } catch (e) { next(e); }
}

export async function createPayout(req, res, next) {
  try {
    const pool = db();
    const b = req.body || {};
    const agent_id = Number(b.agent_id || 0);
    const period_from = b.period_from ? String(b.period_from).slice(0, 10) : null;
    const period_to = b.period_to ? String(b.period_to).slice(0, 10) : null;
    if (!agent_id) return res.status(400).json({ ok: false, message: "agent_id is required" });

    const [splitRows] = await pool.query(
      `SELECT id, commission_amount
       FROM booking_commission_splits
       WHERE agent_id=:agent_id AND status='Approved' AND payout_id IS NULL
       ${period_from ? "AND DATE(created_at) >= :period_from" : ""}
       ${period_to ? "AND DATE(created_at) <= :period_to" : ""}`,
      { agent_id, period_from, period_to }
    );
    if (!splitRows.length) return res.status(400).json({ ok: false, message: "No approved commission found for payout" });

    const [[countRow]] = await pool.query("SELECT COUNT(*) as c FROM commission_payouts");
    const payout_no = `VTX-PAYOUT-${new Date().toISOString().slice(0, 7).replace("-", "")}-${String(Number(countRow?.c || 0) + 1).padStart(4, "0")}`;
    const total_amount = Number(splitRows.reduce((a, r) => a + toNumber(r.commission_amount), 0).toFixed(2));

    const [ins] = await pool.query(
      `INSERT INTO commission_payouts
       (payout_no,agent_id,period_from,period_to,total_amount,status,created_by)
       VALUES (:payout_no,:agent_id,:period_from,:period_to,:total_amount,'Pending',:created_by)`,
      {
        payout_no,
        agent_id,
        period_from,
        period_to,
        total_amount,
        created_by: req.user.id,
      }
    );

    const payout_id = ins.insertId;
    for (const s of splitRows) {
      await pool.query("UPDATE booking_commission_splits SET payout_id=:payout_id WHERE id=:id", { payout_id, id: s.id });
    }

    return ok(res, { payout_id, payout_no, total_amount }, "Payout created");
  } catch (e) { next(e); }
}

export async function approvePayout(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    await pool.query(
      "UPDATE commission_payouts SET status='Approved', approved_by=:uid, approved_at=NOW() WHERE id=:id",
      { id, uid: req.user.id }
    );
    return ok(res, {}, "Payout approved");
  } catch (e) { next(e); }
}

export async function markPayoutPaid(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const payment_mode = req.body?.payment_mode ? String(req.body.payment_mode) : null;
    const payment_ref = req.body?.payment_ref ? String(req.body.payment_ref) : null;
    await pool.query(
      `UPDATE commission_payouts
       SET status='Paid', paid_at=NOW(), payment_mode=:payment_mode, payment_ref=:payment_ref
       WHERE id=:id`,
      { id, payment_mode, payment_ref }
    );
    await pool.query(
      "UPDATE booking_commission_splits SET status='Paid', paid_at=NOW() WHERE payout_id=:id AND status IN ('Approved','Pending')",
      { id }
    );
    return ok(res, {}, "Payout marked paid");
  } catch (e) { next(e); }
}

export async function listPayouts(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query(
      `SELECT p.*, u.name as agent_name
       FROM commission_payouts p
       LEFT JOIN users u ON u.id = p.agent_id
       ORDER BY p.id DESC
       LIMIT 1000`
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function dashboard(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query(
      `SELECT
         u.id as agent_id,
         u.name as agent_name,
         u.role,
         (SELECT COUNT(*) FROM site_visits sv WHERE sv.agent_id = u.id) as site_visits,
         (SELECT COUNT(*) FROM bookings b WHERE b.created_by = u.id) as bookings,
         (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.id AND l.stage='Closed') as closures,
         (SELECT COALESCE(SUM(s.commission_amount),0) FROM booking_commission_splits s WHERE s.agent_id = u.id) as commission_total,
         (SELECT COALESCE(SUM(s.commission_amount),0) FROM booking_commission_splits s WHERE s.agent_id = u.id AND s.status='Pending') as commission_pending,
         (SELECT COALESCE(SUM(s.commission_amount),0) FROM booking_commission_splits s WHERE s.agent_id = u.id AND s.status='Approved') as commission_approved,
         (SELECT COALESCE(SUM(s.commission_amount),0) FROM booking_commission_splits s WHERE s.agent_id = u.id AND s.status='Paid') as commission_paid
       FROM users u
       WHERE u.role IN ('Sales Agent','Sales Manager')
       ORDER BY commission_paid DESC, closures DESC, bookings DESC`
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}
