import React, { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { getApiError } from "../../utils/ui.js";

const TYPES = ["Sale", "Rent", "Lease", "PM"];
const LEGAL_STATUSES = ["Pending", "Verified", "Issue Found", "Cleared"];
const REG_STATUSES = ["Pending", "Scheduled", "Completed"];

export default function AgreementsLegal() {
  const [templates, setTemplates] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [owners, setOwners] = useState([]);

  const [templateForm, setTemplateForm] = useState({ name: "", txn_type: "Sale", template_body: "" });
  const [txnForm, setTxnForm] = useState({ txn_type: "Sale", template_id: "", property_id: "", customer_id: "", owner_id: "" });

  const [selectedTxnId, setSelectedTxnId] = useState(null);
  const [autofill, setAutofill] = useState(null);
  const [checklist, setChecklist] = useState([]);
  const [registration, setRegistration] = useState({ appointment_at: "", office_name: "", slot_no: "", status: "Pending", notes: "" });
  const [esign, setEsign] = useState({ provider: "", status: "Initiated", reference: "" });
  const [reviewForm, setReviewForm] = useState({ title_status: "Pending", legal_status: "Pending", legal_notes: "" });
  const [reviewReport, setReviewReport] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const selectedTx = useMemo(() => transactions.find((t) => t.id === selectedTxnId) || null, [transactions, selectedTxnId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [tplRes, txnRes, propRes, custRes, ownerRes] = await Promise.all([
        http.get(endpoints.agreementTemplates),
        http.get(endpoints.agreementTransactions),
        http.get(endpoints.properties),
        http.get(endpoints.customers),
        http.get(endpoints.owners),
      ]);
      const t = tplRes.data.data || [];
      const x = txnRes.data.data || [];
      setTemplates(t);
      setTransactions(x);
      setProperties(propRes.data.data || []);
      setCustomers(custRes.data.data || []);
      setOwners(ownerRes.data.data || []);
      if (!selectedTxnId && x[0]) setSelectedTxnId(x[0].id);
    } catch (e) {
      setError(getApiError(e, "Failed to load agreements module"));
    } finally {
      setLoading(false);
    }
  }, [selectedTxnId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadTxnDetails = useCallback(async () => {
    if (!selectedTxnId) {
      setAutofill(null);
      setChecklist([]);
      return;
    }
    try {
      const [afRes, clRes, regRes] = await Promise.all([
        http.get(endpoints.agreementAutofill(selectedTxnId)),
        http.get(endpoints.agreementChecklist(selectedTxnId)),
        http.get(endpoints.agreementRegistration(selectedTxnId)),
      ]);
      setAutofill(afRes.data.data || null);
      setChecklist(clRes.data.data || []);
      const reg = regRes.data.data;
      if (reg) {
        setRegistration({
          appointment_at: reg.appointment_at ? String(reg.appointment_at).slice(0, 16).replace(" ", "T") : "",
          office_name: reg.office_name || "",
          slot_no: reg.slot_no || "",
          status: reg.status || "Pending",
          notes: reg.notes || "",
        });
      }
    } catch {
      setAutofill(null);
      setChecklist([]);
    }
  }, [selectedTxnId]);

  useEffect(() => {
    loadTxnDetails();
  }, [loadTxnDetails]);

  useEffect(() => {
    if (!selectedTx) return;
    setReviewForm({
      title_status: selectedTx.title_verification_status || "Pending",
      legal_status: selectedTx.legal_approval_status || "Pending",
      legal_notes: selectedTx.legal_notes || "",
    });
  }, [selectedTx]);

  const createTemplate = async (e) => {
    e.preventDefault();
    try {
      await http.post(endpoints.agreementTemplates, templateForm);
      setTemplateForm({ name: "", txn_type: "Sale", template_body: "" });
      setMsg("Template created");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create template"));
    }
  };

  const createTransaction = async (e) => {
    e.preventDefault();
    try {
      await http.post(endpoints.agreementTransactions, {
        ...txnForm,
        template_id: txnForm.template_id ? Number(txnForm.template_id) : null,
        property_id: txnForm.property_id ? Number(txnForm.property_id) : null,
        customer_id: txnForm.customer_id ? Number(txnForm.customer_id) : null,
        owner_id: txnForm.owner_id ? Number(txnForm.owner_id) : null,
      });
      setTxnForm({ txn_type: "Sale", template_id: "", property_id: "", customer_id: "", owner_id: "" });
      setMsg("Agreement transaction created");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create transaction"));
    }
  };

  const patchChecklist = async (itemId, isSubmitted) => {
    try {
      await http.patch(endpoints.agreementChecklistItem(selectedTxnId, itemId), { is_submitted: isSubmitted });
      await loadTxnDetails();
    } catch (e) { setError(getApiError(e, "Failed to update checklist item")); }
  };

  const saveRegistration = async (e) => {
    e.preventDefault();
    if (!selectedTxnId || !registration.appointment_at) return;
    try {
      await http.post(endpoints.agreementRegistration(selectedTxnId), registration);
      setMsg("Registration appointment saved");
      await loadTxnDetails();
      await load();
    } catch (e2) { setError(getApiError(e2, "Failed to save registration")); }
  };

  const saveEsign = async (e) => {
    e.preventDefault();
    if (!selectedTxnId) return;
    try {
      await http.post(endpoints.agreementEsignPlaceholder(selectedTxnId), esign);
      setMsg("E-sign placeholder updated");
      await load();
    } catch (e2) { setError(getApiError(e2, "Failed to save e-sign placeholder")); }
  };

  const saveReview = async (e) => {
    e.preventDefault();
    if (!selectedTxnId) return;
    setSaving(true);
    try {
      await http.patch(endpoints.agreementReview(selectedTxnId), reviewForm);
      setMsg("Legal review updated");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to update legal review"));
    } finally {
      setSaving(false);
    }
  };

  const uploadReviewReport = async () => {
    if (!selectedTxnId || !reviewReport) return;
    const fd = new FormData();
    fd.append("report", reviewReport);
    try {
      await http.post(endpoints.agreementReviewReport(selectedTxnId), fd);
      setReviewReport(null);
      setMsg("Legal verification report uploaded");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to upload legal report"));
    }
  };

  const approveReady = async (approved) => {
    if (!selectedTxnId) return;
    try {
      await http.patch(endpoints.agreementReadyRegistration(selectedTxnId), { approved });
      setMsg("Ready for registration status updated");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to update ready-for-registration"));
    }
  };

  const approveFinal = async (approved) => {
    if (!selectedTxnId) return;
    try {
      await http.patch(endpoints.agreementFinalCompleteness(selectedTxnId), { approved });
      setMsg("Final completeness status updated");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to update final completeness"));
    }
  };

  return (
    <div>
      <div className="text-xl font-bold">Agreements & Legal</div>
      <div className="text-sm text-slate-600">Document verification, agreement lifecycle, registration tracking and compliance approvals</div>
      <div className="text-xs text-slate-500 mt-1">Restrictions enforced: no billing actions, no deletions, no commission payout actions.</div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <form onSubmit={createTemplate} className="bg-white border rounded-2xl p-3 grid gap-2">
          <div className="font-semibold text-sm">Agreement Templates (Sale/Rent/Lease/PM)</div>
          <input className="border rounded-xl px-3 py-2" placeholder="Template name" value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
          <select className="border rounded-xl px-3 py-2" value={templateForm.txn_type} onChange={(e) => setTemplateForm({ ...templateForm, txn_type: e.target.value })}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <textarea
            className="border rounded-xl px-3 py-2 min-h-32"
            placeholder="Template body. Example placeholders: {{property_uid}}, {{property_title}}, {{customer_name}}, {{owner_name}}, {{txn_type}}"
            value={templateForm.template_body}
            onChange={(e) => setTemplateForm({ ...templateForm, template_body: e.target.value })}
          />
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Create Template</button>
        </form>

        <form onSubmit={createTransaction} className="bg-white border rounded-2xl p-3 grid gap-2">
          <div className="font-semibold text-sm">Agreement Transaction</div>
          <select className="border rounded-xl px-3 py-2" value={txnForm.txn_type} onChange={(e) => setTxnForm({ ...txnForm, txn_type: e.target.value })}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={txnForm.template_id} onChange={(e) => setTxnForm({ ...txnForm, template_id: e.target.value })}>
            <option value="">Select template</option>
            {templates.filter((t) => t.txn_type === txnForm.txn_type).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={txnForm.property_id} onChange={(e) => setTxnForm({ ...txnForm, property_id: e.target.value })}>
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={txnForm.customer_id} onChange={(e) => setTxnForm({ ...txnForm, customer_id: e.target.value })}>
            <option value="">Select customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_uid} - {c.name}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={txnForm.owner_id} onChange={(e) => setTxnForm({ ...txnForm, owner_id: e.target.value })}>
            <option value="">Select owner</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.owner_uid} - {o.name}</option>)}
          </select>
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Create Transaction</button>
        </form>
      </div>

      <div className="mt-6 bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3">Agreement UID</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Title Status</th>
              <th className="text-left p-3">Legal Status</th>
              <th className="text-left p-3">Ready Reg.</th>
              <th className="text-left p-3">Final Docs</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-3 font-mono text-xs">{t.agreement_uid}</td>
                <td className="p-3">{t.txn_type}</td>
                <td className="p-3">{t.title_verification_status || "Pending"}</td>
                <td className="p-3">{t.legal_approval_status || "Pending"}</td>
                <td className="p-3">{t.ready_for_registration_status || "Pending"}</td>
                <td className="p-3">{t.final_doc_status || "Pending"}</td>
                <td className="p-3"><button className="underline" type="button" onClick={() => setSelectedTxnId(t.id)}>Manage</button></td>
              </tr>
            ))}
            {!transactions.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="7">No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {!!selectedTxnId && (
        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <div className="bg-white border rounded-2xl p-3">
            <div className="font-semibold text-sm">Auto-fill Preview</div>
            <div className="text-xs text-slate-500 mt-1">Property/customer/owner data merged into template</div>
            <pre className="mt-2 text-xs whitespace-pre-wrap max-h-64 overflow-auto">{autofill?.filled_template || "No template or data"}</pre>
          </div>

          <div className="bg-white border rounded-2xl p-3">
            <div className="font-semibold text-sm">Document Checklist</div>
            <div className="text-xs text-slate-500 mt-1">Final completeness depends on checklist closure.</div>
            <div className="space-y-2 mt-2 text-sm">
              {checklist.map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={Boolean(c.is_submitted)} onChange={(e) => patchChecklist(c.id, e.target.checked)} />
                  <span>{c.item_name}</span>
                </label>
              ))}
              {!checklist.length && <div className="text-slate-500">No checklist yet.</div>}
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-3 grid gap-3">
            <form onSubmit={saveReview} className="grid gap-2">
              <div className="font-semibold text-sm">Document Review</div>
              <select className="border rounded px-2 py-1" value={reviewForm.title_status} onChange={(e) => setReviewForm({ ...reviewForm, title_status: e.target.value })}>
                {LEGAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <select className="border rounded px-2 py-1" value={reviewForm.legal_status} onChange={(e) => setReviewForm({ ...reviewForm, legal_status: e.target.value })}>
                {LEGAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <textarea className="border rounded px-2 py-1 min-h-20" placeholder="Legal notes" value={reviewForm.legal_notes} onChange={(e) => setReviewForm({ ...reviewForm, legal_notes: e.target.value })} />
              <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm disabled:opacity-60" disabled={saving}>{saving ? "Saving..." : "Save Review"}</button>
            </form>

            <div className="grid gap-2">
              <div className="font-semibold text-sm">Verification Report Upload</div>
              <input className="border rounded px-2 py-1" type="file" onChange={(e) => setReviewReport(e.target.files?.[0] || null)} />
              <button className="px-2 py-1 rounded border text-sm" type="button" onClick={uploadReviewReport} disabled={!reviewReport}>Upload Report</button>
              {selectedTx?.legal_report_url && <a className="underline text-sm" href={selectedTx.legal_report_url} target="_blank" rel="noreferrer">Open Current Report</a>}
            </div>

            <form onSubmit={saveRegistration} className="grid gap-2">
              <div className="font-semibold text-sm">Registration Tracking</div>
              <input className="border rounded px-2 py-1" type="datetime-local" value={registration.appointment_at} onChange={(e) => setRegistration({ ...registration, appointment_at: e.target.value })} />
              <input className="border rounded px-2 py-1" placeholder="Office" value={registration.office_name} onChange={(e) => setRegistration({ ...registration, office_name: e.target.value })} />
              <input className="border rounded px-2 py-1" placeholder="Slot" value={registration.slot_no} onChange={(e) => setRegistration({ ...registration, slot_no: e.target.value })} />
              <select className="border rounded px-2 py-1" value={registration.status} onChange={(e) => setRegistration({ ...registration, status: e.target.value })}>
                {REG_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Save Registration</button>
            </form>

            <div className="grid gap-2">
              <div className="font-semibold text-sm">Approvals</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="px-2 py-1 rounded border text-sm" type="button" onClick={() => approveReady(true)}>Approve Ready Reg.</button>
                <button className="px-2 py-1 rounded border text-sm" type="button" onClick={() => approveReady(false)}>Mark Pending</button>
                <button className="px-2 py-1 rounded border text-sm" type="button" onClick={() => approveFinal(true)}>Approve Final Docs</button>
                <button className="px-2 py-1 rounded border text-sm" type="button" onClick={() => approveFinal(false)}>Mark Pending</button>
              </div>
            </div>

            <form onSubmit={saveEsign} className="grid gap-2">
              <div className="font-semibold text-sm">E-sign Integration (Placeholder)</div>
              <input className="border rounded px-2 py-1" placeholder="Provider (e.g. DocuSign)" value={esign.provider} onChange={(e) => setEsign({ ...esign, provider: e.target.value })} />
              <select className="border rounded px-2 py-1" value={esign.status} onChange={(e) => setEsign({ ...esign, status: e.target.value })}>
                <option>Not Initiated</option><option>Initiated</option><option>Signed</option><option>Failed</option>
              </select>
              <input className="border rounded px-2 py-1" placeholder="Reference ID" value={esign.reference} onChange={(e) => setEsign({ ...esign, reference: e.target.value })} />
              <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Save E-sign Placeholder</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
