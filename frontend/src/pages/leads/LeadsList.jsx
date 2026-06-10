import React, { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { getApiError } from "../../utils/ui.js";
import { getUser } from "../../store/auth.store.js";

const STAGES = ["New", "Contacted", "Site Visit", "Negotiation", "Booking", "Closed", "Lost"];
const SOURCES = ["Google", "Meta", "JustDial", "Website", "Walkin", "Referral"];

const initialForm = {
  name: "",
  phone: "",
  email: "",
  source: "Google",
  campaign_id: "",
  budget: "",
  urgency: "medium",
  stage: "New",
};

const initialTask = { title: "", due_at: "", agent_id: "" };
const initialCall = { call_time: "", outcome: "Connected", remarks: "", attachment: null };

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cols = parseLine(line);
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cols[idx] ?? "";
    });
    return obj;
  });
  return { headers, rows };
}

export default function LeadsList() {
  const user = getUser();
  const isAdmin = user?.role === "Admin";
  const isSalesManager = user?.role === "Sales Manager";
  const isSalesAgent = user?.role === "Sales Agent";
  const canManagePipeline = isAdmin || isSalesManager;
  const canEscalate = canManagePipeline;
  const canBulkImport = canManagePipeline;
  const allowedStageTargets = isSalesAgent ? STAGES.filter((s) => s !== "Closed") : STAGES;

  const [rows, setRows] = useState([]);
  const [calls, setCalls] = useState([]);
  const [notes, setNotes] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(initialForm);
  const [taskForm, setTaskForm] = useState(initialTask);
  const [callForm, setCallForm] = useState(initialCall);
  const [noteText, setNoteText] = useState("");
  const [scoreEdits, setScoreEdits] = useState({});
  const [assignEdits, setAssignEdits] = useState({});
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [dragLead, setDragLead] = useState(null);

  const [importFile, setImportFile] = useState(null);
  const [importHeaders, setImportHeaders] = useState([]);
  const [importRows, setImportRows] = useState([]);
  const [mapping, setMapping] = useState({
    name: "",
    phone: "",
    email: "",
    source: "",
    campaign_id: "",
    budget: "",
    urgency: "",
    stage: "",
  });

  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [leadRes, followRes] = await Promise.all([
        http.get(endpoints.leads, { params: { q } }),
        http.get(endpoints.leadFollowups),
      ]);
      const leads = leadRes.data.data || [];
      setRows(leads);
      setFollowups(followRes.data.data || []);
      if (!selectedLeadId && leads[0]) setSelectedLeadId(leads[0].id);
    } catch (e) {
      setError(getApiError(e, "Failed to load leads"));
    } finally {
      setLoading(false);
    }
  }, [q, selectedLeadId]);

  const loadCalls = useCallback(async () => {
    if (!selectedLeadId) {
      setCalls([]);
      setNotes([]);
      return;
    }
    try {
      const [callRes, leadRes] = await Promise.all([
        http.get(endpoints.leadCalls(selectedLeadId)),
        http.get(endpoints.leadById(selectedLeadId)),
      ]);
      setCalls(callRes.data.data || []);
      setNotes(leadRes.data.data?.notes || []);
    } catch {
      setCalls([]);
      setNotes([]);
    }
  }, [selectedLeadId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadCalls();
  }, [loadCalls]);

  const checkDuplicates = async () => {
    try {
      const res = await http.post(endpoints.leadDuplicateCheck, {
        phone: form.phone,
        email: form.email,
        name: form.name,
      });
      const dups = res.data.data || [];
      if (dups.length) {
        setError(`Duplicate candidates found: ${dups.map((d) => d.lead_uid).join(", ")}`);
        return false;
      }
      return true;
    } catch (e) {
      setError(getApiError(e, "Duplicate check failed"));
      return false;
    }
  };

  const addLead = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!form.name.trim()) {
      setError("Lead name is required");
      return;
    }

    const ok = await checkDuplicates();
    if (!ok) return;

    setSaving(true);
    try {
      await http.post(endpoints.leads, {
        ...form,
        campaign: form.campaign_id || null,
        budget: form.budget ? Number(form.budget) : null,
      });
      setForm(initialForm);
      setMsg("Lead created successfully");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create lead"));
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (id, stage) => {
    setError("");
    setMsg("");
    try {
      await http.patch(endpoints.leadStage(id), { stage });
      setMsg("Lead stage updated");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to update stage"));
    }
  };

  const assignLead = async (id) => {
    setError("");
    setMsg("");
    try {
      await http.patch(endpoints.leadAssign(id), { assigned_to: Number(assignEdits[id] || 0) || null });
      setMsg("Lead assigned");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to assign lead"));
    }
  };

  const overrideScore = async (id) => {
    const edit = scoreEdits[id] || { score: "", priority_tag: "medium" };
    try {
      await http.patch(endpoints.leadScore(id), {
        score: Number(edit.score || 0),
        priority_tag: edit.priority_tag,
      });
      setMsg("Lead score updated");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to update score"));
    }
  };

  const createFollowup = async (e) => {
    e.preventDefault();
    if (!selectedLeadId || !taskForm.title || !taskForm.due_at) return;
    try {
      await http.post(endpoints.leadFollowups, {
        lead_id: selectedLeadId,
        title: taskForm.title,
        due_at: taskForm.due_at,
        agent_id: taskForm.agent_id ? Number(taskForm.agent_id) : null,
      });
      setTaskForm(initialTask);
      setMsg("Follow-up task created");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create follow-up"));
    }
  };

  const updateFollowupStatus = async (id, status) => {
    try {
      await http.patch(`${endpoints.leadFollowups}/${id}/status`, { status });
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to update follow-up"));
    }
  };

  const escalateStale = async () => {
    try {
      const res = await http.post(endpoints.leadEscalateStale);
      setMsg(`Escalated stale leads: ${res.data.data?.stale_count || 0}`);
    } catch (e) {
      setError(getApiError(e, "Failed to escalate stale leads"));
    }
  };

  const addCallLog = async (e) => {
    e.preventDefault();
    if (!selectedLeadId || !callForm.call_time) return;
    const fd = new FormData();
    fd.append("call_time", callForm.call_time);
    fd.append("outcome", callForm.outcome);
    fd.append("remarks", callForm.remarks);
    if (callForm.attachment) fd.append("attachment", callForm.attachment);

    try {
      await http.post(endpoints.leadCalls(selectedLeadId), fd);
      setCallForm(initialCall);
      setMsg("Call log added");
      await loadCalls();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add call log"));
    }
  };

  const addLeadNote = async (e) => {
    e.preventDefault();
    if (!selectedLeadId || !noteText.trim()) return;
    try {
      await http.post(endpoints.leadNotes(selectedLeadId), { note: noteText.trim() });
      setNoteText("");
      setMsg("Note added");
      await loadCalls();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add note"));
    }
  };

  const onImportFile = async (file) => {
    setImportFile(file);
    setError("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Excel files must be saved as CSV before import in this build.");
      return;
    }

    const text = await file.text();
    const parsed = parseCsvText(text);
    setImportHeaders(parsed.headers);
    setImportRows(parsed.rows.slice(0, 2000));
  };

  const runMappedImport = async () => {
    if (!importRows.length) return;
    try {
      const res = await http.post(endpoints.leadImportMapped, {
        mapping,
        rows: importRows,
        defaults: { stage: "New", source: "Google" },
      });
      setMsg(`Imported: ${res.data.data?.created || 0}, skipped: ${res.data.data?.skipped || 0}`);
      await load();
    } catch (e) {
      setError(getApiError(e, "Import failed"));
    }
  };

  const selectedLead = useMemo(() => rows.find((r) => r.id === selectedLeadId) || null, [rows, selectedLeadId]);
  const followupsForLead = useMemo(() => followups.filter((f) => f.lead_id === selectedLeadId), [followups, selectedLeadId]);

  const grouped = useMemo(() => {
    const out = {};
    STAGES.forEach((s) => {
      out[s] = rows.filter((r) => (r.stage || "New") === s);
    });
    return out;
  }, [rows]);

  return (
    <div>
      <div className="text-xl font-bold">Leads & CRM Pipeline</div>
      <div className="text-sm text-slate-600">Kanban, duplicate checks, scoring, follow-ups, calls, and bulk import mapping</div>

      <form onSubmit={addLead} className="mt-4 grid gap-2 md:grid-cols-8 surface-card p-3">
        <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="Lead name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <select className="border rounded-xl px-3 py-2" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
          {SOURCES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className="border rounded-xl px-3 py-2" placeholder="campaign_id" value={form.campaign_id} onChange={(e) => setForm({ ...form, campaign_id: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" type="number" placeholder="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
        <select className="border rounded-xl px-3 py-2" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
          <option value="high">high</option>
          <option value="medium">medium</option>
          <option value="low">low</option>
        </select>
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm" type="button" onClick={checkDuplicates}>Check Duplicates</button>
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60" disabled={saving}>
          {saving ? "Saving..." : "Add Lead"}
        </button>
      </form>

      <div className="mt-4 flex gap-2">
        <input className="border rounded-xl px-3 py-2 w-full" placeholder="Search name/phone/email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white border" type="button" disabled={loading}>{loading ? "Loading..." : "Search"}</button>
        {canEscalate && <button onClick={escalateStale} className="px-4 py-2 rounded-xl bg-white border" type="button">Escalate Stale</button>}
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <div className="mt-6 overflow-x-auto">
        <div className="grid grid-cols-7 gap-3 min-w-[1200px]">
          {STAGES.map((stage) => (
            <div
              key={stage}
              className="bg-white border rounded-xl p-2 min-h-[420px]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragLead && allowedStageTargets.includes(stage)) updateStage(dragLead.id, stage);
                setDragLead(null);
              }}
            >
              <div className="text-sm font-semibold mb-2">{stage} ({grouped[stage]?.length || 0})</div>
              <div className="space-y-2">
                {(grouped[stage] || []).map((lead) => (
                  <div
                    key={lead.id}
                    className={`border rounded-lg p-2 text-xs cursor-pointer ${selectedLeadId === lead.id ? "border-slate-900" : ""}`}
                    draggable
                    onDragStart={() => setDragLead(lead)}
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <div className="font-semibold">{lead.name}</div>
                    <div className="text-slate-500">{lead.lead_uid}</div>
                    <div className="mt-1">Score: {lead.score}</div>
                    <div className="mt-1">{lead.source || "-"} / {lead.campaign || "-"}</div>
                    {canManagePipeline && (
                      <div className="mt-2 grid gap-1">
                        <input
                          className="border rounded px-1 py-1"
                          placeholder="Agent ID"
                          value={assignEdits[lead.id] || ""}
                          onChange={(e) => setAssignEdits((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                        />
                        <button className="border rounded px-1 py-1" type="button" onClick={() => assignLead(lead.id)}>Assign</button>
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            className="border rounded px-1 py-1"
                            placeholder="Score"
                            type="number"
                            value={scoreEdits[lead.id]?.score || ""}
                            onChange={(e) => setScoreEdits((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || { priority_tag: "medium" }), score: e.target.value } }))}
                          />
                          <select
                            className="border rounded px-1 py-1"
                            value={scoreEdits[lead.id]?.priority_tag || "medium"}
                            onChange={(e) => setScoreEdits((prev) => ({ ...prev, [lead.id]: { ...(prev[lead.id] || { score: "" }), priority_tag: e.target.value } }))}
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <button className="border rounded px-1 py-1" type="button" onClick={() => overrideScore(lead.id)}>Override Score</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="surface-card p-4">
          <div className="font-semibold">Follow-up Reminders & Tasks {selectedLead ? `(${selectedLead.name})` : ""}</div>
          <form className="mt-2 grid md:grid-cols-3 gap-2" onSubmit={createFollowup}>
            <input className="border rounded px-2 py-1" placeholder="Task title" value={taskForm.title} onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })} />
            <input className="border rounded px-2 py-1" type="datetime-local" value={taskForm.due_at} onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Agent ID" value={taskForm.agent_id} onChange={(e) => setTaskForm({ ...taskForm, agent_id: e.target.value })} />
            <button className="border rounded px-2 py-1" type="submit">Create Follow-up</button>
          </form>

          <div className="mt-3 space-y-2 text-sm">
            {followupsForLead.map((f) => (
              <div key={f.id} className="border rounded p-2 flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{f.title}</div>
                  <div className="text-xs text-slate-500">Due: {f.due_at} | Agent: {f.agent_id || "-"}</div>
                </div>
                <select className="border rounded px-2 py-1" value={f.status} onChange={(e) => updateFollowupStatus(f.id, e.target.value)}>
                  <option>Pending</option>
                  <option>Done</option>
                  <option>Cancelled</option>
                </select>
              </div>
            ))}
            {!followupsForLead.length && <div className="text-slate-500">No follow-up tasks for selected lead.</div>}
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="font-semibold">Notes / Meeting Details {selectedLead ? `(${selectedLead.name})` : ""}</div>
          <form className="mt-2 grid gap-2" onSubmit={addLeadNote}>
            <textarea
              className="border rounded px-2 py-1 min-h-20"
              placeholder="Add requirement notes / meeting details"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
            <button className="border rounded px-2 py-1" type="submit">Add Note</button>
          </form>
          <div className="mt-3 space-y-2 text-sm">
            {notes.map((n) => (
              <div key={n.id} className="border rounded p-2">
                <div>{n.note}</div>
                <div className="text-xs text-slate-500 mt-1">{n.created_at}</div>
              </div>
            ))}
            {!notes.length && <div className="text-slate-500">No notes for selected lead.</div>}
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="font-semibold">Call Logs + Attachments {selectedLead ? `(${selectedLead.name})` : ""}</div>
          <form className="mt-2 grid md:grid-cols-2 gap-2" onSubmit={addCallLog}>
            <input className="border rounded px-2 py-1" type="datetime-local" value={callForm.call_time} onChange={(e) => setCallForm({ ...callForm, call_time: e.target.value })} />
            <select className="border rounded px-2 py-1" value={callForm.outcome} onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value })}>
              <option>Connected</option>
              <option>No Answer</option>
              <option>Busy</option>
              <option>Invalid</option>
              <option>Call Back</option>
            </select>
            <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Remarks" value={callForm.remarks} onChange={(e) => setCallForm({ ...callForm, remarks: e.target.value })} />
            <input className="border rounded px-2 py-1 md:col-span-2" type="file" onChange={(e) => setCallForm({ ...callForm, attachment: e.target.files?.[0] || null })} />
            <button className="border rounded px-2 py-1" type="submit">Add Call Log</button>
          </form>

          <div className="mt-3 space-y-2 text-sm">
            {calls.map((c) => (
              <div key={c.id} className="border rounded p-2">
                <div className="font-semibold">{c.outcome || "-"}</div>
                <div className="text-xs text-slate-500">{c.call_time}</div>
                <div>{c.remarks || "-"}</div>
                {c.attachment_url && <a className="underline" href={c.attachment_url} target="_blank" rel="noreferrer">Open Attachment</a>}
              </div>
            ))}
            {!calls.length && <div className="text-slate-500">No calls for selected lead.</div>}
          </div>
        </div>
      </div>

      {canBulkImport && (
        <div className="mt-6 surface-card p-4">
          <div className="font-semibold">Bulk Import (CSV with Mapping)</div>
          <div className="text-xs text-slate-500 mt-1">Upload CSV, map columns, then import. Excel files should be exported to CSV first.</div>
          <div className="mt-2 grid md:grid-cols-3 gap-2 items-center">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => onImportFile(e.target.files?.[0] || null)} />
            {importFile && <div className="text-xs">{importFile.name}</div>}
            {importRows.length > 0 && <div className="text-xs">Rows parsed: {importRows.length}</div>}
          </div>

          {!!importHeaders.length && (
            <div className="mt-3 grid md:grid-cols-4 gap-2">
              {Object.keys(mapping).map((k) => (
                <label key={k} className="text-xs">
                  <div className="mb-1">{k}</div>
                  <select className="border rounded px-2 py-1 w-full" value={mapping[k]} onChange={(e) => setMapping((prev) => ({ ...prev, [k]: e.target.value }))}>
                    <option value="">(skip)</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}

          <div className="mt-3">
            <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm" type="button" disabled={!importRows.length} onClick={runMappedImport}>
              Import with Mapping
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
