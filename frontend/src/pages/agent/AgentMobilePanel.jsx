import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { getApiError } from "../../utils/ui.js";
import { getUser } from "../../store/auth.store.js";

const STAGES = ["New", "Contacted", "Site Visit", "Negotiation", "Booking", "Closed", "Lost"];
const SOURCES = ["Google", "Meta", "JustDial", "Website", "Walkin", "Referral"];

const initialLead = {
  name: "",
  phone: "",
  email: "",
  source: "Website",
  campaign_id: "",
  stage: "New",
};

export default function AgentMobilePanel() {
  const user = getUser();
  const isSalesAgent = user?.role === "Sales Agent";
  const stageOptions = isSalesAgent ? STAGES.filter((s) => s !== "Closed") : STAGES;

  const [leadForm, setLeadForm] = useState(initialLead);
  const [leadId, setLeadId] = useState("");
  const [leadStage, setLeadStage] = useState("Contacted");
  const [propertyId, setPropertyId] = useState("");
  const [photos, setPhotos] = useState([]);
  const [bookingId, setBookingId] = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [payRef, setPayRef] = useState("");

  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [leadRes, propRes, bookRes] = await Promise.all([
        http.get(endpoints.leads),
        http.get(endpoints.properties),
        http.get(endpoints.bookings),
      ]);
      const leadRows = leadRes.data.data || [];
      const propRows = propRes.data.data || [];
      const bookRows = bookRes.data.data || [];
      setLeads(leadRows);
      setProperties(propRows);
      setBookings(bookRows);
      if (!leadId && leadRows[0]) setLeadId(String(leadRows[0].id));
      if (!propertyId && propRows[0]) setPropertyId(String(propRows[0].id));
      if (!bookingId && bookRows[0]) setBookingId(String(bookRows[0].id));
    } catch (e) {
      setError(getApiError(e, "Failed to load agent panel data"));
    } finally {
      setLoading(false);
    }
  }, [bookingId, leadId, propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  const quickAddLead = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!leadForm.name.trim()) return setError("Lead name is required");
    setSaving(true);
    try {
      await http.post(endpoints.leads, leadForm);
      setLeadForm(initialLead);
      setMsg("Lead added from field");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add lead"));
    } finally {
      setSaving(false);
    }
  };

  const updateStage = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!leadId) return setError("Select a lead");
    try {
      await http.patch(endpoints.leadStage(leadId), { stage: leadStage });
      setMsg("Pipeline stage updated");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to update stage"));
    }
  };

  const uploadPhotos = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!propertyId) return setError("Select property");
    if (!photos.length) return setError("Select photos to upload");
    const fd = new FormData();
    photos.forEach((f) => fd.append("images", f));
    try {
      await http.post(endpoints.propertyAddImages(propertyId), fd);
      setPhotos([]);
      setMsg("Property photos uploaded");
    } catch (e2) {
      setError(getApiError(e2, "Failed to upload photos"));
    }
  };

  const generateTokenReceipt = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!bookingId) return setError("Select booking");
    try {
      const res = await http.post(endpoints.bookingTokenReceipt(bookingId), {
        method: payMethod,
        ref_no: payRef || null,
      });
      const pdf = res.data.data?.pdf_url;
      setMsg(`Token receipt generated: ${res.data.data?.invoice_no || "-"}`);
      if (pdf) window.open(pdf, "_blank", "noopener,noreferrer");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to generate token receipt"));
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <div className="text-xl font-bold">Mobile Agent Panel</div>
        <div className="text-sm text-slate-600">Quick field actions for leads, pipeline, property photos and token receipts</div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
      {msg && <div className="text-sm text-green-700">{msg}</div>}

      <form onSubmit={quickAddLead} className="bg-white border rounded-2xl p-4 space-y-2">
        <div className="font-semibold">Quick-add Lead</div>
        <input className="w-full border rounded-xl px-3 py-3 text-base" placeholder="Lead name" value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
        <input className="w-full border rounded-xl px-3 py-3 text-base" placeholder="Phone" value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
        <input className="w-full border rounded-xl px-3 py-3 text-base" placeholder="Email (optional)" value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <select className="border rounded-xl px-3 py-3 text-base" value={leadForm.source} onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select className="border rounded-xl px-3 py-3 text-base" value={leadForm.stage} onChange={(e) => setLeadForm({ ...leadForm, stage: e.target.value })}>
            {stageOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <input className="w-full border rounded-xl px-3 py-3 text-base" placeholder="campaign_id (optional)" value={leadForm.campaign_id} onChange={(e) => setLeadForm({ ...leadForm, campaign_id: e.target.value })} />
        <button className="w-full rounded-xl bg-slate-900 text-white py-3 text-base disabled:opacity-60" disabled={saving}>
          {saving ? "Saving..." : "Add Lead"}
        </button>
      </form>

      <form onSubmit={updateStage} className="bg-white border rounded-2xl p-4 space-y-2">
        <div className="font-semibold">Update Pipeline Stage</div>
        <select className="w-full border rounded-xl px-3 py-3 text-base" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
          <option value="">Select lead</option>
          {leads.map((l) => <option key={l.id} value={l.id}>{l.lead_uid} - {l.name}</option>)}
        </select>
        <select className="w-full border rounded-xl px-3 py-3 text-base" value={leadStage} onChange={(e) => setLeadStage(e.target.value)}>
          {stageOptions.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button className="w-full rounded-xl bg-slate-900 text-white py-3 text-base">Update Stage</button>
      </form>

      <form onSubmit={uploadPhotos} className="bg-white border rounded-2xl p-4 space-y-2">
        <div className="font-semibold">Upload Property Photos From Phone</div>
        <select className="w-full border rounded-xl px-3 py-3 text-base" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
          <option value="">Select property</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
        </select>
        <input
          className="w-full border rounded-xl px-3 py-3 text-base"
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={(e) => setPhotos(Array.from(e.target.files || []))}
        />
        <div className="text-xs text-slate-500">{photos.length ? `${photos.length} photo(s) selected` : "No photos selected"}</div>
        <button className="w-full rounded-xl bg-slate-900 text-white py-3 text-base">Upload Photos</button>
      </form>

      <form onSubmit={generateTokenReceipt} className="bg-white border rounded-2xl p-4 space-y-2">
        <div className="font-semibold">Generate Token Receipt On Field</div>
        <select className="w-full border rounded-xl px-3 py-3 text-base" value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
          <option value="">Select booking</option>
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.booking_uid} | Token {b.token_amount || 0} | {b.status}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select className="border rounded-xl px-3 py-3 text-base" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
            <option>Cash</option>
            <option>UPI</option>
            <option>Bank</option>
            <option>Cheque</option>
            <option>Card</option>
          </select>
          <input className="border rounded-xl px-3 py-3 text-base" placeholder="Ref no (optional)" value={payRef} onChange={(e) => setPayRef(e.target.value)} />
        </div>
        <button className="w-full rounded-xl bg-slate-900 text-white py-3 text-base">Generate Receipt</button>
      </form>

      <button type="button" className="w-full rounded-xl border py-3 text-base bg-white" onClick={load} disabled={loading}>
        {loading ? "Refreshing..." : "Refresh Panel Data"}
      </button>
    </div>
  );
}
