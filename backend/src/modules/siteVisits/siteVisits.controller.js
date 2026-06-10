import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";

function assertRouteLink(routeLink) {
  if (!routeLink) return;
  try {
    const u = new URL(routeLink);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("invalid protocol");
  } catch {
    const err = new Error("route_link must be valid http/https URL");
    err.status = 400;
    throw err;
  }
}

export async function listVisits(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query(
      `SELECT sv.*, l.lead_uid, l.name as lead_name, p.property_uid, p.title as property_title, u.name as agent_name
       FROM site_visits sv
       LEFT JOIN leads l ON l.id = sv.lead_id
       LEFT JOIN properties p ON p.id = sv.property_id
       LEFT JOIN users u ON u.id = sv.agent_id
       ORDER BY sv.id DESC`
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createVisit(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    assertRouteLink(b.route_link || null);

    const visit_uid = `VTX-VIS-${randomUUID().split("-")[0].toUpperCase()}`;
    const [r] = await pool.query(
      "INSERT INTO site_visits (visit_uid,lead_id,property_id,scheduled_at,agent_id,route_link,outcome,notes) VALUES (:visit_uid,:lead_id,:property_id,:scheduled_at,:agent_id,:route_link,:outcome,:notes)",
      {
        visit_uid,
        lead_id: b.lead_id ? Number(b.lead_id) : null,
        property_id: b.property_id ? Number(b.property_id) : null,
        scheduled_at: b.scheduled_at,
        agent_id: b.agent_id ? Number(b.agent_id) : null,
        route_link: b.route_link || null,
        outcome: b.outcome || null,
        notes: b.notes || null,
      }
    );
    return ok(res, { id: r.insertId, visit_uid }, "Scheduled");
  } catch (e) { next(e); }
}

export async function updateOutcome(req, res, next) {
  try {
    const id = Number(req.params.id);
    const outcome = String(req.body.outcome || "").trim();
    const notes = String(req.body.notes || "").trim();
    const allowed = ["Interested", "Not Interested", "Negotiation"];
    if (!allowed.includes(outcome)) {
      return res.status(400).json({ ok: false, message: "Invalid outcome" });
    }

    const pool = db();
    await pool.query("UPDATE site_visits SET outcome=:outcome, notes=:notes WHERE id=:id", { id, outcome, notes: notes || null });
    return ok(res, {}, "Visit outcome updated");
  } catch (e) { next(e); }
}
