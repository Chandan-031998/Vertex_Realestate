import React, { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, formatDateTime, getApiError } from "../../utils/ui.js";
import { getUser } from "../../store/auth.store.js";

const initialBookingForm = {
  property_id: "",
  unit_id: "",
  customer_id: "",
  token_amount: "",
  hold_hours: "48",
};

const initialVisitForm = {
  lead_id: "",
  property_id: "",
  agent_id: "",
  scheduled_at: "",
  route_link: "",
};

export default function BookingsList() {
  const user = getUser();
  const isAccounts = user?.role === "Accounts";
  const canWriteBooking = user?.role === "Admin" || user?.role === "Sales Manager" || user?.role === "Sales Agent";
  const canApproveBooking = user?.role === "Admin" || user?.role === "Sales Manager";
  const canApproveCancellation = user?.role === "Admin" || user?.role === "Sales Manager";
  const canApproveRefund = user?.role === "Admin" || user?.role === "Sales Manager";
  const canProcessRefund = isAccounts || user?.role === "Admin";
  const canGenerateTokenReceipt = canWriteBooking || isAccounts;
  const [rows, setRows] = useState([]);
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [visits, setVisits] = useState([]);

  const [bookingForm, setBookingForm] = useState(initialBookingForm);
  const [visitForm, setVisitForm] = useState(initialVisitForm);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [bookingsRes, propsRes, customerRes] = await Promise.all([
        http.get(endpoints.bookings),
        http.get(endpoints.properties),
        http.get(endpoints.customers),
      ]);

      setRows(bookingsRes.data.data || []);
      setProperties(propsRes.data.data || []);
      setCustomers(customerRes.data.data || []);

      if (canWriteBooking) {
        const [visitRes, leadsRes] = await Promise.all([
          http.get(endpoints.siteVisits),
          http.get(endpoints.leads),
        ]);
        setVisits(visitRes.data.data || []);
        setLeads(leadsRes.data.data || []);
      } else {
        setVisits([]);
        setLeads([]);
      }

      try {
        const unitsRes = await http.get(endpoints.inventoryUnits, { params: { floor_id: -1 } });
        setUnits(unitsRes.data.data || []);
      } catch {
        setUnits([]);
      }

      try {
        const usersRes = await http.get(endpoints.users);
        setUsers(usersRes.data.data || []);
      } catch {
        setUsers([]);
      }
    } catch (e) {
      setError(getApiError(e, "Failed to load booking workflow data"));
    } finally {
      setLoading(false);
    }
  }, [canWriteBooking]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createHold = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!bookingForm.property_id) {
      setError("Please select a property");
      return;
    }

    setSaving(true);
    try {
      await http.post(endpoints.bookings, {
        property_id: Number(bookingForm.property_id),
        unit_id: bookingForm.unit_id ? Number(bookingForm.unit_id) : null,
        customer_id: bookingForm.customer_id ? Number(bookingForm.customer_id) : null,
        token_amount: bookingForm.token_amount ? Number(bookingForm.token_amount) : 0,
        hold_hours: bookingForm.hold_hours ? Number(bookingForm.hold_hours) : 48,
      });
      setBookingForm(initialBookingForm);
      setMsg("Unit hold created");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create hold"));
    } finally {
      setSaving(false);
    }
  };

  const createVisit = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!visitForm.scheduled_at) return setError("Visit schedule date/time required");
    try {
      await http.post(endpoints.siteVisits, {
        lead_id: visitForm.lead_id ? Number(visitForm.lead_id) : null,
        property_id: visitForm.property_id ? Number(visitForm.property_id) : null,
        agent_id: visitForm.agent_id ? Number(visitForm.agent_id) : null,
        scheduled_at: visitForm.scheduled_at,
        route_link: visitForm.route_link || null,
      });
      setVisitForm(initialVisitForm);
      setMsg("Visit scheduled");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to schedule visit"));
    }
  };

  const updateVisitOutcome = async (id, outcome) => {
    const notes = window.prompt("Outcome notes (optional)", "") || "";
    try {
      await http.patch(endpoints.siteVisitOutcome(id), { outcome, notes });
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to update visit outcome"));
    }
  };

  const requestCancellation = async (id) => {
    const reason = window.prompt("Cancellation reason", "") || "";
    if (!reason.trim()) return;
    try {
      await http.post(endpoints.bookingCancelRequest(id), { reason });
      setMsg("Cancellation requested");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to request cancellation"));
    }
  };

  const approveCancellation = async (id) => {
    try {
      await http.post(endpoints.bookingCancelApprove(id));
      setMsg("Cancellation approved");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to approve cancellation"));
    }
  };

  const requestRefund = async (id) => {
    const amount = window.prompt("Refund amount", "0") || "";
    const reason = window.prompt("Refund reason", "") || "";
    if (!Number(amount)) return;
    try {
      await http.post(endpoints.bookingRefundRequest(id), { amount: Number(amount), reason });
      setMsg("Refund requested");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to request refund"));
    }
  };

  const approveRefund = async (id) => {
    try {
      await http.post(endpoints.bookingRefundApprove(id));
      setMsg("Refund approved");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to approve refund"));
    }
  };

  const processRefund = async (id) => {
    try {
      await http.post(endpoints.bookingRefundProcess(id));
      setMsg("Refund processed");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to process refund"));
    }
  };

  const confirmBooking = async (id) => {
    try {
      const res = await http.post(endpoints.bookingConfirm(id));
      const url = res.data.data?.confirmation_pdf_url;
      setMsg("Booking confirmed");
      await loadAll();
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(getApiError(e, "Failed to confirm booking"));
    }
  };

  const openConfirmationPdf = async (id, existingUrl) => {
    if (existingUrl) {
      window.open(existingUrl, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const res = await http.get(endpoints.bookingConfirmationPdf(id));
      const url = res.data.data?.confirmation_pdf_url;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(getApiError(e, "Confirmation PDF not available"));
    }
  };

  const generateTokenReceipt = async (id) => {
    try {
      const res = await http.post(endpoints.bookingTokenReceipt(id), { method: "Cash" });
      const url = res.data.data?.pdf_url;
      setMsg(`Token receipt generated: ${res.data.data?.invoice_no || "-"}`);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(getApiError(e, "Failed to generate token receipt"));
    }
  };

  const holdRows = useMemo(() => rows.filter((r) => r.status === "Hold"), [rows]);
  const visitsByDay = useMemo(() => {
    const map = new Map();
    visits.forEach((v) => {
      const d = (v.scheduled_at || "").slice(0, 10) || "Unscheduled";
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(v);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visits]);

  return (
    <div>
      <div className="text-xl font-bold">Site Visits & Booking Workflow</div>
      <div className="text-sm text-slate-600">Visit scheduler, outcome tracking, hold expiry timer, confirmation PDF, cancellation/refund approvals</div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      {canWriteBooking && (
        <div className="mt-4 grid lg:grid-cols-2 gap-4">
          <form onSubmit={createVisit} className="surface-card p-3 grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold text-sm">Visit Scheduler (Agent + Route)</div>
          <select className="border rounded-xl px-3 py-2" value={visitForm.lead_id} onChange={(e) => setVisitForm({ ...visitForm, lead_id: e.target.value })}>
            <option value="">Select lead</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.lead_uid} - {l.name}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={visitForm.property_id} onChange={(e) => setVisitForm({ ...visitForm, property_id: e.target.value })}>
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={visitForm.agent_id} onChange={(e) => setVisitForm({ ...visitForm, agent_id: e.target.value })}>
            <option value="">Assign agent ID</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.id} - {u.name}</option>)}
          </select>
          <input className="border rounded-xl px-3 py-2" type="datetime-local" value={visitForm.scheduled_at} onChange={(e) => setVisitForm({ ...visitForm, scheduled_at: e.target.value })} />
          <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="Route link (Google Maps URL)" value={visitForm.route_link} onChange={(e) => setVisitForm({ ...visitForm, route_link: e.target.value })} />
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Schedule Visit</button>
          </form>

          <form onSubmit={createHold} className="surface-card p-3 grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold text-sm">Unit Hold + Expiry</div>
          <select className="border rounded-xl px-3 py-2" value={bookingForm.property_id} onChange={(e) => setBookingForm({ ...bookingForm, property_id: e.target.value })}>
            <option value="">Select property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
          </select>
          <input className="border rounded-xl px-3 py-2" placeholder="Unit ID (optional)" value={bookingForm.unit_id} onChange={(e) => setBookingForm({ ...bookingForm, unit_id: e.target.value })} />
          <select className="border rounded-xl px-3 py-2" value={bookingForm.customer_id} onChange={(e) => setBookingForm({ ...bookingForm, customer_id: e.target.value })}>
            <option value="">Select customer</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_uid} - {c.name}</option>)}
          </select>
          <input className="border rounded-xl px-3 py-2" type="number" placeholder="Token amount" value={bookingForm.token_amount} onChange={(e) => setBookingForm({ ...bookingForm, token_amount: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" type="number" min="1" placeholder="Hold hours" value={bookingForm.hold_hours} onChange={(e) => setBookingForm({ ...bookingForm, hold_hours: e.target.value })} />
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60" disabled={saving}>
            {saving ? "Saving..." : "Create Hold"}
          </button>
          </form>
        </div>
      )}

      {canWriteBooking && (
        <div className="mt-6 surface-card p-4">
          <div className="font-semibold text-sm">Site Visits Calendar View</div>
          <div className="text-xs text-slate-500 mt-1">Grouped by scheduled date with quick route and outcome context</div>
          <div className="mt-3 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visitsByDay.map(([day, dayRows]) => (
              <div key={day} className="rounded-2xl border border-white/30 bg-white/40 dark:bg-slate-900/30 p-3">
                <div className="font-semibold text-sm">{day}</div>
                <div className="mt-2 space-y-2">
                  {dayRows.slice(0, 4).map((v) => (
                    <div key={v.id} className="rounded-xl border border-white/20 p-2 text-xs">
                      <div className="font-semibold">{v.visit_uid}</div>
                      <div>{v.property_title || "-"}</div>
                      <div className="text-slate-500">{v.agent_name || v.agent_id || "-"} • {formatDateTime(v.scheduled_at)}</div>
                    </div>
                  ))}
                  {dayRows.length > 4 && <div className="text-xs text-slate-500">+{dayRows.length - 4} more</div>}
                </div>
              </div>
            ))}
            {!visitsByDay.length && <div className="text-slate-500 text-sm">No visits scheduled.</div>}
          </div>
        </div>
      )}

      {canWriteBooking && (
        <div className="mt-6 surface-card overflow-hidden">
          <div className="p-3 font-semibold text-sm border-b">Visit Outcomes (Interested / Not Interested / Negotiation)</div>
          <table className="modern-table">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="text-left p-3">Visit UID</th>
                <th className="text-left p-3">Lead</th>
                <th className="text-left p-3">Property</th>
                <th className="text-left p-3">Agent</th>
                <th className="text-left p-3">Scheduled</th>
                <th className="text-left p-3">Route</th>
                <th className="text-left p-3">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{v.visit_uid}</td>
                  <td className="p-3">{v.lead_name || "-"}</td>
                  <td className="p-3">{v.property_title || "-"}</td>
                  <td className="p-3">{v.agent_name || v.agent_id || "-"}</td>
                  <td className="p-3">{formatDateTime(v.scheduled_at)}</td>
                  <td className="p-3">{v.route_link ? <a className="underline" href={v.route_link} target="_blank" rel="noreferrer">Route</a> : "-"}</td>
                  <td className="p-3">
                    <select className="border rounded px-2 py-1" value={v.outcome || ""} onChange={(e) => updateVisitOutcome(v.id, e.target.value)}>
                      <option value="">Pending</option>
                      <option>Interested</option>
                      <option>Not Interested</option>
                      <option>Negotiation</option>
                    </select>
                  </td>
                </tr>
              ))}
              {!visits.length && <tr><td className="p-6 text-slate-500" colSpan="7">No visits yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 surface-card overflow-hidden">
        <div className="p-3 font-semibold text-sm border-b">Bookings, Hold Timer, Confirmation & Approvals</div>
        <table className="modern-table">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-left p-3">Booking UID</th>
              <th className="text-left p-3">Property</th>
              <th className="text-left p-3">Customer</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Token</th>
              <th className="text-left p-3">Hold Expires</th>
              <th className="text-left p-3">Time Left</th>
              <th className="text-left p-3">Workflow</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="p-3 font-mono text-xs">{r.booking_uid}</td>
                <td className="p-3">{r.property_label || r.property_id}</td>
                <td className="p-3">{r.customer_label || "-"}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{formatCurrency(r.token_amount)}</td>
                <td className="p-3">{formatDateTime(r.hold_expires_at)}</td>
                <td className="p-3"><HoldTimer holdExpiresAt={r.hold_expires_at} status={r.status} now={now} /></td>
                <td className="p-3">
                  <div className="grid gap-1">
                    {canApproveBooking && r.status === "Hold" && (
                      <button className="border rounded px-2 py-1" type="button" onClick={() => confirmBooking(r.id)}>Confirm + PDF</button>
                    )}
                    {canGenerateTokenReceipt && Number(r.token_amount || 0) > 0 && (
                      <button className="border rounded px-2 py-1" type="button" onClick={() => generateTokenReceipt(r.id)}>Generate Token Receipt</button>
                    )}
                    <button className="border rounded px-2 py-1" type="button" onClick={() => openConfirmationPdf(r.id, r.confirmation_pdf_url)}>Open PDF</button>
                    {canWriteBooking && <button className="border rounded px-2 py-1" type="button" onClick={() => requestCancellation(r.id)}>Request Cancel</button>}
                    {canApproveCancellation && (
                      <button className="border rounded px-2 py-1" type="button" onClick={() => approveCancellation(r.id)}>Approve Cancel</button>
                    )}
                    {canWriteBooking && <button className="border rounded px-2 py-1" type="button" onClick={() => requestRefund(r.id)}>Request Refund</button>}
                    {canApproveRefund && (
                      <button className="border rounded px-2 py-1" type="button" onClick={() => approveRefund(r.id)}>Approve Refund</button>
                    )}
                    {canProcessRefund && r.refund_status === "Approved" && (
                      <button className="border rounded px-2 py-1" type="button" onClick={() => processRefund(r.id)}>Process Refund</button>
                    )}
                    <div className="text-xs text-slate-500">
                      Cancellation: {r.cancellation_status || "None"} | Refund: {r.refund_status || "None"}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="8">No bookings found.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-slate-500">Active holds: {holdRows.length}</div>
    </div>
  );
}

function HoldTimer({ holdExpiresAt, status, now }) {
  if (status !== "Hold" || !holdExpiresAt) return <span>-</span>;
  const expiry = new Date(holdExpiresAt).getTime();
  if (!Number.isFinite(expiry)) return <span>-</span>;
  const diff = expiry - now;
  if (diff <= 0) return <span className="text-red-600">Expired</span>;

  const total = Math.floor(diff / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return <span>{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}
