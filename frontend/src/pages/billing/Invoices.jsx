import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, getApiError } from "../../utils/ui.js";

const INVOICE_TYPES = ["Token", "Rent", "Brokerage", "Maintenance", "Commercial"];
const INVOICE_KINDS = ["Invoice", "TokenReceipt", "BookingReceipt"];
const PAYMENT_MODES = ["UPI", "Bank", "Cash", "Cheque", "Card", "NetBanking"];

const initialInvoice = {
  invoice_kind: "Invoice",
  type: "Token",
  amount: "",
  gst_enabled: false,
  gst_rate: "18",
  customer_id: "",
  property_id: "",
  invoice_date: new Date().toISOString().slice(0, 10),
};

const initialNote = {
  note_type: "Credit",
  invoice_id: "",
  customer_id: "",
  amount: "",
  reason: "",
};

export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [invoiceForm, setInvoiceForm] = useState(initialInvoice);
  const [noteForm, setNoteForm] = useState(initialNote);
  const [paymentForm, setPaymentForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invRes, custRes, propRes, noteRes] = await Promise.all([
        http.get(endpoints.invoices),
        http.get(endpoints.customers),
        http.get(endpoints.properties),
        http.get(endpoints.billingNotes),
      ]);
      setRows(invRes.data.data || []);
      setCustomers(custRes.data.data || []);
      setProperties(propRes.data.data || []);
      setNotes(noteRes.data.data || []);
    } catch (e) {
      setError(getApiError(e, "Failed to load invoices"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createInvoice = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!invoiceForm.amount) return setError("Invoice amount is required");

    setSaving(true);
    try {
      await http.post(endpoints.invoices, {
        ...invoiceForm,
        amount: Number(invoiceForm.amount),
        gst_enabled: Boolean(invoiceForm.gst_enabled),
        gst_rate: Number(invoiceForm.gst_rate || 0),
        customer_id: invoiceForm.customer_id ? Number(invoiceForm.customer_id) : null,
        property_id: invoiceForm.property_id ? Number(invoiceForm.property_id) : null,
      });
      setInvoiceForm(initialInvoice);
      setMsg("Invoice/receipt created");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create invoice"));
    } finally {
      setSaving(false);
    }
  };

  const addPayment = async (invoiceId) => {
    const p = paymentForm[invoiceId] || {
      amount: "",
      method: "UPI",
      ref_no: "",
      cheque_no: "",
      cheque_status: "Pending",
      note: "",
    };

    setError("");
    setMsg("");
    if (!p.amount) return setError("Payment amount is required");

    try {
      await http.post(endpoints.invoicePayments(invoiceId), {
        amount: Number(p.amount),
        method: p.method,
        ref_no: p.ref_no,
        cheque_no: p.method === "Cheque" ? p.cheque_no : null,
        cheque_status: p.method === "Cheque" ? p.cheque_status : null,
        note: p.note || null,
      });
      setPaymentForm((prev) => ({ ...prev, [invoiceId]: { amount: "", method: "UPI", ref_no: "", cheque_no: "", cheque_status: "Pending", note: "" } }));
      setMsg("Payment added");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to add payment"));
    }
  };

  const createNote = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!noteForm.amount) return setError("Note amount is required");

    try {
      await http.post(endpoints.billingNotes, {
        ...noteForm,
        amount: Number(noteForm.amount),
        invoice_id: noteForm.invoice_id ? Number(noteForm.invoice_id) : null,
        customer_id: noteForm.customer_id ? Number(noteForm.customer_id) : null,
      });
      setNoteForm(initialNote);
      setMsg("Credit/refund note created");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create note"));
    }
  };

  const exportPdf = async (invoiceId) => {
    try {
      const res = await http.post(endpoints.invoiceExportPdf(invoiceId));
      const url = res.data.data?.pdf_url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(getApiError(e, "Failed to export PDF"));
    }
  };

  const sendInvoice = async (invoiceId, channel) => {
    const target = window.prompt(`Enter ${channel} destination`, "") || "";
    if (!target.trim()) return;
    try {
      await http.post(endpoints.invoiceSend(invoiceId), { channel, target });
      setMsg(`Invoice sent via ${channel} (placeholder)`);
    } catch (e) {
      setError(getApiError(e, "Failed to send invoice"));
    }
  };

  return (
    <div>
      <div className="text-xl font-bold">Billing / Invoices / Receipts</div>
      <div className="text-sm text-slate-600">Numbered token/booking receipts, GST, partial payments, notes, PDF export and send placeholders</div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <form onSubmit={createInvoice} className="mt-4 grid gap-2 md:grid-cols-7 surface-card p-3">
        <select className="border rounded-xl px-3 py-2" value={invoiceForm.invoice_kind} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_kind: e.target.value })}>
          {INVOICE_KINDS.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select className="border rounded-xl px-3 py-2" value={invoiceForm.type} onChange={(e) => setInvoiceForm({ ...invoiceForm, type: e.target.value })}>
          {INVOICE_TYPES.map((v) => <option key={v}>{v}</option>)}
        </select>
        <input className="border rounded-xl px-3 py-2" placeholder="Amount" type="number" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
        <label className="border rounded-xl px-3 py-2 text-sm flex items-center gap-2">
          <input type="checkbox" checked={invoiceForm.gst_enabled} onChange={(e) => setInvoiceForm({ ...invoiceForm, gst_enabled: e.target.checked })} /> GST
        </label>
        <input className="border rounded-xl px-3 py-2" placeholder="GST rate" type="number" value={invoiceForm.gst_rate} onChange={(e) => setInvoiceForm({ ...invoiceForm, gst_rate: e.target.value })} />
        <select className="border rounded-xl px-3 py-2" value={invoiceForm.customer_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_id: e.target.value })}>
          <option value="">Customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_uid} - {c.name}</option>)}
        </select>
        <select className="border rounded-xl px-3 py-2" value={invoiceForm.property_id} onChange={(e) => setInvoiceForm({ ...invoiceForm, property_id: e.target.value })}>
          <option value="">Property</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
        </select>
        <input className="border rounded-xl px-3 py-2" type="date" value={invoiceForm.invoice_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })} />
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60" disabled={saving}>{saving ? "Saving..." : "Create"}</button>
      </form>

      <form onSubmit={createNote} className="mt-4 grid gap-2 md:grid-cols-6 surface-card p-3">
        <div className="md:col-span-6 text-sm font-semibold">Credit / Refund Note</div>
        <select className="border rounded-xl px-3 py-2" value={noteForm.note_type} onChange={(e) => setNoteForm({ ...noteForm, note_type: e.target.value })}>
          <option>Credit</option><option>Refund</option>
        </select>
        <select className="border rounded-xl px-3 py-2" value={noteForm.invoice_id} onChange={(e) => setNoteForm({ ...noteForm, invoice_id: e.target.value })}>
          <option value="">Invoice (optional)</option>
          {rows.map((r) => <option key={r.id} value={r.id}>{r.invoice_no}</option>)}
        </select>
        <select className="border rounded-xl px-3 py-2" value={noteForm.customer_id} onChange={(e) => setNoteForm({ ...noteForm, customer_id: e.target.value })}>
          <option value="">Customer (optional)</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_uid} - {c.name}</option>)}
        </select>
        <input className="border rounded-xl px-3 py-2" type="number" placeholder="Amount" value={noteForm.amount} onChange={(e) => setNoteForm({ ...noteForm, amount: e.target.value })} />
        <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="Reason" value={noteForm.reason} onChange={(e) => setNoteForm({ ...noteForm, reason: e.target.value })} />
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Create Note</button>
      </form>

      <div className="mt-4">
        <button onClick={loadAll} type="button" className="px-4 py-2 rounded-xl bg-white border" disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="mt-6 surface-card overflow-hidden">
        <table className="modern-table">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-left p-3">No</th>
              <th className="text-left p-3">Kind/Type</th>
              <th className="text-left p-3">Base + GST</th>
              <th className="text-left p-3">Paid / Due</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
              <th className="text-left p-3">Payment</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = paymentForm[r.id] || { amount: "", method: "UPI", ref_no: "", cheque_no: "", cheque_status: "Pending", note: "" };
              return (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3 font-mono text-xs">{r.invoice_no}</td>
                  <td className="p-3">{r.invoice_kind || "Invoice"} / {r.type}</td>
                  <td className="p-3">
                    <div>{formatCurrency(r.amount)}</div>
                    <div className="text-xs text-slate-500">GST {Number(r.gst_rate || 0)}%: {formatCurrency(r.gst_amount || 0)}</div>
                    <div className="text-xs text-slate-500">Total: {formatCurrency(r.total_amount || r.amount)}</div>
                  </td>
                  <td className="p-3">
                    <div>{formatCurrency(r.total_paid || 0)}</div>
                    <div className="text-xs text-slate-500">Due: {formatCurrency(r.amount_due || 0)}</div>
                  </td>
                  <td className="p-3">{r.status}</td>
                  <td className="p-3">
                    <div className="grid gap-1">
                      <button className="border rounded px-2 py-1 text-xs" onClick={() => exportPdf(r.id)} type="button">Export PDF</button>
                      <button className="border rounded px-2 py-1 text-xs" onClick={() => sendInvoice(r.id, "email")} type="button">Send Email</button>
                      <button className="border rounded px-2 py-1 text-xs" onClick={() => sendInvoice(r.id, "whatsapp")} type="button">Send WhatsApp</button>
                    </div>
                  </td>
                  <td className="p-3">
                    {Number(r.amount_due || 0) > 0 ? (
                      <div className="grid gap-1 md:grid-cols-3">
                        <input className="border rounded px-2 py-1" placeholder="Amount" type="number" value={p.amount} onChange={(e) => setPaymentForm((prev) => ({ ...prev, [r.id]: { ...p, amount: e.target.value } }))} />
                        <select className="border rounded px-2 py-1" value={p.method} onChange={(e) => setPaymentForm((prev) => ({ ...prev, [r.id]: { ...p, method: e.target.value } }))}>
                          {PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}
                        </select>
                        <input className="border rounded px-2 py-1" placeholder="Ref" value={p.ref_no} onChange={(e) => setPaymentForm((prev) => ({ ...prev, [r.id]: { ...p, ref_no: e.target.value } }))} />
                        {p.method === "Cheque" && (
                          <>
                            <input className="border rounded px-2 py-1" placeholder="Cheque No" value={p.cheque_no} onChange={(e) => setPaymentForm((prev) => ({ ...prev, [r.id]: { ...p, cheque_no: e.target.value } }))} />
                            <select className="border rounded px-2 py-1" value={p.cheque_status} onChange={(e) => setPaymentForm((prev) => ({ ...prev, [r.id]: { ...p, cheque_status: e.target.value } }))}>
                              <option>Pending</option><option>Cleared</option><option>Bounced</option>
                            </select>
                          </>
                        )}
                        <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Note" value={p.note} onChange={(e) => setPaymentForm((prev) => ({ ...prev, [r.id]: { ...p, note: e.target.value } }))} />
                        <button className="px-2 py-1 rounded bg-slate-900 text-white" type="button" onClick={() => addPayment(r.id)}>Add Payment</button>
                      </div>
                    ) : <span className="text-slate-500">No due</span>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="7">No invoices found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-6 surface-card p-3">
        <div className="font-semibold text-sm">Credit / Refund Notes</div>
        <div className="mt-2 space-y-1 text-sm">
          {notes.map((n) => (
            <div key={n.id} className="border rounded p-2">
              <span className="font-mono text-xs">{n.note_no}</span>
              <span className="ml-2">{n.note_type}</span>
              <span className="ml-2">{formatCurrency(n.amount)}</span>
              <span className="ml-2 text-slate-500">{n.status}</span>
              <div className="text-xs text-slate-500">{n.reason || "-"}</div>
            </div>
          ))}
          {!notes.length && <div className="text-slate-500">No notes.</div>}
        </div>
      </div>
    </div>
  );
}
