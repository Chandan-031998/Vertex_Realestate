import { db } from "../../config/db.js";

export async function listLeads({ q = "", stage = "" }) {
  const pool = db();
  const where = [];
  const params = {};
  if (q) { where.push("(name LIKE :q OR phone LIKE :q OR email LIKE :q)"); params.q = `%${q}%`; }
  if (stage) { where.push("stage=:stage"); params.stage = stage; }
  const sql = `SELECT * FROM leads ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getLead(id) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM leads WHERE id=:id", { id });
  return rows[0] || null;
}

export async function insertLead(payload) {
  const pool = db();
  const [r] = await pool.query(
    `INSERT INTO leads (lead_uid,name,phone,email,source,campaign,budget,area_pref,type_pref,bhk_pref,urgency,stage,score,assigned_to,property_interest_id)
     VALUES (:lead_uid,:name,:phone,:email,:source,:campaign,:budget,:area_pref,:type_pref,:bhk_pref,:urgency,:stage,:score,:assigned_to,:property_interest_id)`,
    payload
  );
  return r.insertId;
}

export async function updateLeadStage(id, stage) {
  const pool = db();
  await pool.query("UPDATE leads SET stage=:stage WHERE id=:id", { id, stage });
}

export async function updateLeadAssignment(id, assigned_to) {
  const pool = db();
  await pool.query("UPDATE leads SET assigned_to=:assigned_to WHERE id=:id", { id, assigned_to });
}

export async function updateLeadScoring(id, { score, urgency }) {
  const pool = db();
  await pool.query("UPDATE leads SET score=:score, urgency=:urgency WHERE id=:id", { id, score, urgency });
}

export async function addNote({ lead_id, note, created_by }) {
  const pool = db();
  const [r] = await pool.query(
    "INSERT INTO lead_notes (lead_id,note,created_by) VALUES (:lead_id,:note,:created_by)",
    { lead_id, note, created_by }
  );
  return r.insertId;
}

export async function addCallLog({ lead_id, call_time, outcome, remarks, attachment_path, created_by }) {
  const pool = db();
  let r;
  try {
    [r] = await pool.query(
      "INSERT INTO lead_calls (lead_id,call_time,outcome,remarks,attachment_path,created_by) VALUES (:lead_id,:call_time,:outcome,:remarks,:attachment_path,:created_by)",
      { lead_id, call_time, outcome, remarks, attachment_path, created_by }
    );
  } catch {
    // Backward compatibility for schema without attachment_path.
    [r] = await pool.query(
      "INSERT INTO lead_calls (lead_id,call_time,outcome,remarks,created_by) VALUES (:lead_id,:call_time,:outcome,:remarks,:created_by)",
      { lead_id, call_time, outcome, remarks, created_by }
    );
  }
  return r.insertId;
}

export async function listCallLogs(lead_id) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM lead_calls WHERE lead_id=:lead_id ORDER BY call_time DESC, id DESC", { lead_id });
  return rows;
}

export async function listNotes(lead_id) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM lead_notes WHERE lead_id=:lead_id ORDER BY id DESC", { lead_id });
  return rows;
}

export async function mergeLeads({ sourceId, targetId }) {
  const pool = db();
  await pool.query("UPDATE lead_notes SET lead_id=:targetId WHERE lead_id=:sourceId", { sourceId, targetId });
  await pool.query("UPDATE site_visits SET lead_id=:targetId WHERE lead_id=:sourceId", { sourceId, targetId });
  await pool.query("DELETE FROM leads WHERE id=:id", { id: sourceId });
}

export async function createFollowupTask({ lead_id, agent_id, title, due_at, created_by }) {
  const pool = db();
  const [r] = await pool.query(
    `INSERT INTO lead_followups (lead_id,agent_id,title,due_at,status,created_by)
     VALUES (:lead_id,:agent_id,:title,:due_at,'Pending',:created_by)`,
    { lead_id, agent_id, title, due_at, created_by }
  );
  return r.insertId;
}

export async function listFollowupTasks({ agent_id = null, status = "" }) {
  const pool = db();
  const where = [];
  const params = {};
  if (agent_id) { where.push("agent_id=:agent_id"); params.agent_id = Number(agent_id); }
  if (status) { where.push("status=:status"); params.status = status; }
  const sql = `SELECT * FROM lead_followups ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY due_at ASC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function markFollowupStatus(id, status) {
  const pool = db();
  await pool.query("UPDATE lead_followups SET status=:status WHERE id=:id", { id, status });
}

export async function listStaleLeads(days = 7) {
  const pool = db();
  const [rows] = await pool.query(
    `SELECT * FROM leads
     WHERE stage NOT IN ('Closed','Lost')
       AND updated_at < DATE_SUB(NOW(), INTERVAL :days DAY)
     ORDER BY updated_at ASC`,
    { days: Number(days) }
  );
  return rows;
}

export async function findPossibleDuplicate({ phone, email, name }) {
  const pool = db();
  const p = (phone || "").replace(/\D/g, "");
  const e = (email || "").trim().toLowerCase();
  const n = (name || "").trim().toLowerCase();

  const [rows] = await pool.query(
    `SELECT * FROM leads
     WHERE (REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+','') = :p AND :p <> '')
        OR (LOWER(email)=:e AND :e <> '')
        OR (LOWER(name)=:n AND :n <> '')
     ORDER BY id DESC LIMIT 5`,
    { p, e, n }
  );
  return rows;
}
