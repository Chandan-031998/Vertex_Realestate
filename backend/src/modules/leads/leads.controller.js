import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";
import * as repo from "./leads.repo.js";
import { scoreLead } from "./leads.scoring.js";
import { audit } from "../audit/audit.service.js";
import { db } from "../../config/db.js";
import path from "path";
import { publicUrlFor } from "../../utils/filePaths.js";
import { PERMISSIONS, ROLE_PERMISSIONS, ROLES } from "../../config/roles.js";

const SALES_AGENT_ALLOWED_STAGES = new Set(["New", "Contacted", "Site Visit", "Negotiation", "Booking", "Lost"]);

function hasLeadStageOverride(role) {
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes(PERMISSIONS.LEAD_OVERRIDE_STAGE);
}

function assertStageUpdateAllowed({ role, stage }) {
  if (hasLeadStageOverride(role)) return;
  if (role === ROLES.SALES_AGENT && SALES_AGENT_ALLOWED_STAGES.has(stage)) return;
  const err = new Error(`Stage "${stage}" is not allowed for role "${role}"`);
  err.status = 403;
  throw err;
}

export async function list(req, res, next) {
  try {
    const { q="", stage="" } = req.query;
    const rows = await repo.listLeads({ q, stage });
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function getOne(req, res, next) {
  try {
    const id = Number(req.params.id);
    const lead = await repo.getLead(id);
    if (!lead) return res.status(404).json({ ok:false, message:"Not found" });
    const notes = await repo.listNotes(id);
    const calls = await repo.listCallLogs(id);
    return ok(res, {
      ...lead,
      notes,
      calls: calls.map((c) => ({ ...c, attachment_url: c.attachment_path ? publicUrlFor(c.attachment_path) : null })),
    });
  } catch (e) { next(e); }
}

export async function checkDuplicates(req, res, next) {
  try {
    const { phone = "", email = "", name = "" } = req.body || {};
    const rows = await repo.findPossibleDuplicate({ phone, email, name });
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function create(req, res, next) {
  try {
    const b = req.body;
    // dedupe check
    const dup = await repo.findPossibleDuplicate({ phone: b.phone, email: b.email, name: b.name });
    if (dup.length) {
      return res.status(409).json({ ok:false, message:"Possible duplicate lead found", data: dup });
    }

    const lead_uid = `VTX-LEAD-${randomUUID().split("-")[0].toUpperCase()}`;
    const score = scoreLead({ budget: b.budget, urgency: b.urgency });

    const requestedStage = String(b.stage || "New").trim() || "New";
    assertStageUpdateAllowed({ role: req.user?.role, stage: requestedStage });

    const id = await repo.insertLead({
      lead_uid,
      name: b.name,
      phone: b.phone || null,
      email: b.email || null,
      source: b.source || null,
      campaign: b.campaign_id || b.campaign || null,
      budget: b.budget ? Number(b.budget) : null,
      area_pref: b.area_pref || null,
      type_pref: b.type_pref || null,
      bhk_pref: b.bhk_pref || null,
      urgency: b.urgency || null,
      stage: requestedStage,
      score,
      assigned_to: b.assigned_to ? Number(b.assigned_to) : null,
      property_interest_id: b.property_interest_id ? Number(b.property_interest_id) : null,
    });

    await audit({ userId: req.user.id, action: "create", entity: "leads", entityId: String(id) });

    return ok(res, { id, lead_uid, score }, "Lead created");
  } catch (e) { next(e); }
}

export async function updateStage(req, res, next) {
  try {
    const id = Number(req.params.id);
    const stage = String(req.body?.stage || "").trim();
    if (!stage) return res.status(400).json({ ok: false, message: "stage required" });
    assertStageUpdateAllowed({ role: req.user?.role, stage });
    await repo.updateLeadStage(id, stage);
    await audit({ userId: req.user.id, action: "update_stage", entity: "leads", entityId: String(id), meta: { stage } });
    return ok(res, {}, "Stage updated");
  } catch (e) { next(e); }
}

export async function assignLead(req, res, next) {
  try {
    const id = Number(req.params.id);
    const assigned_to = Number(req.body.assigned_to);
    await repo.updateLeadAssignment(id, assigned_to || null);
    await audit({ userId: req.user.id, action: "assign", entity: "leads", entityId: String(id), meta: { assigned_to } });
    return ok(res, {}, "Lead assigned");
  } catch (e) { next(e); }
}

export async function overrideScore(req, res, next) {
  try {
    const id = Number(req.params.id);
    const score = Number(req.body.score || 0);
    const priority = String(req.body.priority_tag || "medium").trim().toLowerCase();
    await repo.updateLeadScoring(id, { score, urgency: priority });
    await audit({ userId: req.user.id, action: "score_override", entity: "leads", entityId: String(id), meta: { score, priority } });
    return ok(res, {}, "Lead score updated");
  } catch (e) { next(e); }
}

export async function merge(req, res, next) {
  try {
    const sourceId = Number(req.body.source_id);
    const targetId = Number(req.body.target_id);
    if (!sourceId || !targetId || sourceId === targetId) {
      return res.status(400).json({ ok: false, message: "Valid source_id and target_id are required" });
    }
    await repo.mergeLeads({ sourceId, targetId });
    await audit({ userId: req.user.id, action: "merge", entity: "leads", entityId: String(targetId), meta: { sourceId } });
    return ok(res, {}, "Leads merged");
  } catch (e) { next(e); }
}

export async function addNote(req, res, next) {
  try {
    const lead_id = Number(req.params.id);
    const note = String(req.body.note || "").trim();
    if (!note) return res.status(400).json({ ok:false, message:"note required" });
    const nid = await repo.addNote({ lead_id, note, created_by: req.user.id });
    return ok(res, { id: nid }, "Note added");
  } catch (e) { next(e); }
}

export async function addCall(req, res, next) {
  try {
    const lead_id = Number(req.params.id);
    const call_time = String(req.body.call_time || "").trim();
    if (!lead_id || !call_time) return res.status(400).json({ ok: false, message: "lead id and call_time required" });

    const rel = req.file
      ? path.join("uploads", "leads", "calls", req.file.filename).replace(/\\/g, "/")
      : null;

    const id = await repo.addCallLog({
      lead_id,
      call_time,
      outcome: req.body.outcome || null,
      remarks: req.body.remarks || null,
      attachment_path: rel,
      created_by: req.user.id,
    });
    return ok(res, { id, attachment_url: rel ? publicUrlFor(rel) : null }, "Call log added");
  } catch (e) { next(e); }
}

export async function listCalls(req, res, next) {
  try {
    const lead_id = Number(req.params.id);
    const rows = await repo.listCallLogs(lead_id);
    return ok(res, rows.map((c) => ({ ...c, attachment_url: c.attachment_path ? publicUrlFor(c.attachment_path) : null })));
  } catch (e) { next(e); }
}

export async function createFollowup(req, res, next) {
  try {
    const lead_id = Number(req.body.lead_id);
    const agent_id = Number(req.body.agent_id || 0) || null;
    const title = String(req.body.title || "").trim();
    const due_at = String(req.body.due_at || "").trim();
    if (!lead_id || !title || !due_at) {
      return res.status(400).json({ ok: false, message: "lead_id, title and due_at are required" });
    }
    const id = await repo.createFollowupTask({ lead_id, agent_id, title, due_at, created_by: req.user.id });
    return ok(res, { id }, "Follow-up task created");
  } catch (e) { next(e); }
}

export async function listFollowups(req, res, next) {
  try {
    const rows = await repo.listFollowupTasks({ agent_id: req.query.agent_id, status: req.query.status || "" });
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function updateFollowupStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const status = String(req.body.status || "").trim();
    if (!status) return res.status(400).json({ ok: false, message: "status required" });
    await repo.markFollowupStatus(id, status);
    return ok(res, {}, "Follow-up status updated");
  } catch (e) { next(e); }
}

export async function escalateStale(req, res, next) {
  try {
    const days = Number(req.query.days || 7);
    const stale = await repo.listStaleLeads(days);

    // Fire internal notifications for assignees where available.
    if (stale.length) {
      const pool = db();
      for (const lead of stale) {
        if (!lead.assigned_to) continue;
        await pool.query(
          "INSERT INTO notifications (user_id,type,message) VALUES (:user_id,:type,:message)",
          {
            user_id: lead.assigned_to,
            type: "LeadEscalation",
            message: `Lead ${lead.lead_uid} is stale for more than ${days} days`,
          }
        );
      }
    }

    return ok(res, { stale_count: stale.length, rows: stale }, "Stale lead escalation completed");
  } catch (e) { next(e); }
}

export async function importMapped(req, res, next) {
  try {
    const mapping = req.body?.mapping || {};
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ ok: false, message: "rows required" });

    const defaults = req.body?.defaults || {};
    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const get = (k) => {
        const src = mapping[k];
        if (!src) return defaults[k] ?? null;
        return row[src] ?? defaults[k] ?? null;
      };

      const name = String(get("name") || "").trim();
      const phone = String(get("phone") || "").trim();
      const email = String(get("email") || "").trim();
      if (!name) {
        skipped += 1;
        continue;
      }

      const dup = await repo.findPossibleDuplicate({ phone, email, name });
      if (dup.length) {
        skipped += 1;
        continue;
      }

      const lead_uid = `VTX-LEAD-${randomUUID().split("-")[0].toUpperCase()}`;
      const payload = {
        lead_uid,
        name,
        phone: phone || null,
        email: email || null,
        source: get("source") || null,
        campaign: get("campaign_id") || get("campaign") || null,
        budget: get("budget") ? Number(get("budget")) : null,
        area_pref: get("area_pref") || null,
        type_pref: get("type_pref") || null,
        bhk_pref: get("bhk_pref") || null,
        urgency: get("urgency") || null,
        stage: get("stage") || "New",
        score: scoreLead({
          budget: get("budget"),
          urgency: get("urgency"),
          areaMatch: Boolean(get("area_match")),
          typeMatch: Boolean(get("type_match")),
        }),
        assigned_to: get("assigned_to") ? Number(get("assigned_to")) : null,
        property_interest_id: get("property_interest_id") ? Number(get("property_interest_id")) : null,
      };
      await repo.insertLead(payload);
      created += 1;
    }

    return ok(res, { created, skipped }, "Imported");
  } catch (e) { next(e); }
}
