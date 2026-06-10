import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { parseCsv } from "./leads.import.js";
import { db } from "../../config/db.js";
import { scoreLead } from "./leads.scoring.js";
import { randomUUID } from "crypto";
import * as c from "./leads.controller.js";
import { joinUpload } from "../../utils/filePaths.js";

const r = Router();
r.use(authRequired);

// List / Create / details
r.get("/", requirePerm(PERMISSIONS.LEAD_READ), c.list);
r.post("/duplicates/check", requirePerm(PERMISSIONS.LEAD_READ), c.checkDuplicates);
r.post("/import/mapped", requirePerm(PERMISSIONS.LEAD_WRITE), c.importMapped);
r.get("/:id", requirePerm(PERMISSIONS.LEAD_READ), c.getOne);
r.post("/", requirePerm(PERMISSIONS.LEAD_WRITE), c.create);
r.patch("/:id/stage", requirePerm(PERMISSIONS.LEAD_WRITE), c.updateStage);
r.patch("/:id/assign", requirePerm(PERMISSIONS.LEAD_REASSIGN), c.assignLead);
r.patch("/:id/score", requirePerm(PERMISSIONS.LEAD_SCORE_OVERRIDE), c.overrideScore);
r.post("/:id/notes", requirePerm(PERMISSIONS.LEAD_WRITE), c.addNote);
r.get("/:id/calls", requirePerm(PERMISSIONS.LEAD_READ), c.listCalls);

const callDir = joinUpload("leads", "calls");
fs.mkdirSync(callDir, { recursive: true });
const callUpload = multer({ dest: callDir });
r.post("/:id/calls", requirePerm(PERMISSIONS.LEAD_WRITE), callUpload.single("attachment"), c.addCall);
r.post("/merge", requirePerm(PERMISSIONS.LEAD_MERGE), c.merge);
r.get("/followups/tasks", requirePerm(PERMISSIONS.FOLLOWUP_MANAGE), c.listFollowups);
r.post("/followups/tasks", requirePerm(PERMISSIONS.FOLLOWUP_MANAGE), c.createFollowup);
r.patch("/followups/tasks/:id/status", requirePerm(PERMISSIONS.FOLLOWUP_MANAGE), c.updateFollowupStatus);
r.post("/escalate/stale", requirePerm(PERMISSIONS.STALE_LEAD_ESCALATE), c.escalateStale);

// Bulk import (CSV)
const upload = multer({ dest: "tmp/" });
r.post("/import/csv", requirePerm(PERMISSIONS.LEAD_WRITE), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ ok:false, message:"file required" });
    const rows = parseCsv(req.file.path);
    const pool = db();
    let created = 0;

    for (const row of rows) {
      if (!row.name) continue;
      const lead_uid = `VTX-LEAD-${randomUUID().split("-")[0].toUpperCase()}`;
      const score = scoreLead({ budget: row.budget, urgency: row.urgency });
      await pool.query(
        `INSERT INTO leads (lead_uid,name,phone,email,source,campaign,budget,area_pref,type_pref,bhk_pref,urgency,stage,score)
         VALUES (:lead_uid,:name,:phone,:email,:source,:campaign,:budget,:area_pref,:type_pref,:bhk_pref,:urgency,:stage,:score)`,
        {
          lead_uid,
          name: row.name,
          phone: row.phone || null,
          email: row.email || null,
          source: row.source || null,
          campaign: row.campaign_id || row.campaign || null,
          budget: row.budget ? Number(row.budget) : null,
          area_pref: row.area_pref || null,
          type_pref: row.type_pref || null,
          bhk_pref: row.bhk_pref || null,
          urgency: row.urgency || null,
          stage: row.stage || "New",
          score,
        }
      );
      created += 1;
    }
    fs.unlinkSync(req.file.path);
    return res.json({ ok:true, message:"Imported", data:{ created }});
  } catch (e) { next(e); }
});

export default r;
