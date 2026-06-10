import React, { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, formatDateTime, getApiError } from "../../utils/ui.js";

const contractInitial = {
  property_id: "",
  unit_id: "",
  owner_id: "",
  tenant_id: "",
  start_date: "",
  end_date: "",
  rent_amount: "",
  cycle: "Monthly",
  due_day: "5",
  late_fee_type: "Flat",
  late_fee_value: "",
  generate_months: "12",
};

const ticketInitial = {
  property_id: "",
  unit_id: "",
  tenant_id: "",
  title: "",
  description: "",
  priority: "Medium",
  sla_due_at: "",
  cost_estimate: "",
};

const moveChecklistInitial = {
  tenant_id: "",
  property_id: "",
  unit_id: "",
  checklist_type: "Move-In",
  target_date: "",
  notes: "",
};

const complaintInitial = {
  tenant_id: "",
  property_id: "",
  unit_id: "",
  category: "General",
  title: "",
  description: "",
  priority: "Medium",
  escalation_level: "None",
};

const inspInitial = {
  property_id: "",
  unit_id: "",
  inspection_date: "",
  summary: "",
  status: "Completed",
  report: null,
};

export default function RentalsManagement() {
  const [contracts, setContracts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [moveChecklists, setMoveChecklists] = useState([]);
  const [complaints, setComplaints] = useState([]);

  const [contractForm, setContractForm] = useState(contractInitial);
  const [ticketForm, setTicketForm] = useState(ticketInitial);
  const [moveChecklistForm, setMoveChecklistForm] = useState(moveChecklistInitial);
  const [complaintForm, setComplaintForm] = useState(complaintInitial);
  const [inspForm, setInspForm] = useState(inspInitial);

  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [statement, setStatement] = useState(null);
  const [profitabilityRows, setProfitabilityRows] = useState([]);

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [tenantNoteForm, setTenantNoteForm] = useState({ status: "Pending", note: "" });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [cRes, sRes, tRes, iRes, oRes, pRes, tenRes, moveRes, cmpRes] = await Promise.all([
        http.get(endpoints.rentalContracts),
        http.get(endpoints.rentalSchedules),
        http.get(endpoints.maintenanceTickets),
        http.get(endpoints.inspections),
        http.get(endpoints.owners),
        http.get(endpoints.properties),
        http.get(endpoints.tenants),
        http.get(endpoints.rentalMoveChecklists),
        http.get(endpoints.rentalComplaints),
      ]);
      setContracts(cRes.data.data || []);
      setSchedules(sRes.data.data || []);
      setTickets(tRes.data.data || []);
      setInspections(iRes.data.data || []);
      const ownerRows = oRes.data.data || [];
      setOwners(ownerRows);
      setProperties(pRes.data.data || []);
      const tenantRows = tenRes.data.data || [];
      setTenants(tenantRows);
      setMoveChecklists(moveRes.data.data || []);
      setComplaints(cmpRes.data.data || []);
      if (!selectedOwnerId && ownerRows[0]) setSelectedOwnerId(String(ownerRows[0].id));
      if (!selectedTenantId && tenantRows[0]) setSelectedTenantId(String(tenantRows[0].id));
    } catch (e) {
      setError(getApiError(e, "Failed to load rental module"));
    } finally {
      setLoading(false);
    }
  }, [selectedOwnerId, selectedTenantId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const createContract = async (e) => {
    e.preventDefault();
    try {
      await http.post(endpoints.rentalContracts, {
        ...contractForm,
        property_id: Number(contractForm.property_id),
        unit_id: contractForm.unit_id ? Number(contractForm.unit_id) : null,
        owner_id: contractForm.owner_id ? Number(contractForm.owner_id) : null,
        tenant_id: Number(contractForm.tenant_id),
        rent_amount: Number(contractForm.rent_amount || 0),
        due_day: Number(contractForm.due_day || 5),
        late_fee_value: Number(contractForm.late_fee_value || 0),
        generate_months: Number(contractForm.generate_months || 12),
      });
      setContractForm(contractInitial);
      setMsg("Rent schedule created");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create rent schedule"));
    }
  };

  const collectRent = async (scheduleId) => {
    const mode = window.prompt("Payment mode", "UPI") || "UPI";
    const ref = window.prompt("Payment reference", "") || "";
    try {
      const res = await http.post(endpoints.rentalCollect(scheduleId), { payment_mode: mode, payment_ref: ref });
      setMsg(`Rent collected. Receipt: ${res.data.data?.receipt_no || "-"}`);
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Rent collection failed"));
    }
  };

  const openReceipt = async (scheduleId) => {
    try {
      const res = await http.get(endpoints.rentalReceipt(scheduleId));
      const r = res.data.data;
      alert(`Receipt: ${r.receipt_no || "-"}\nStatus: ${r.status}\nAmount: ${r.amount}\nLate Fee: ${r.late_fee}`);
    } catch (e) {
      setError(getApiError(e, "Failed to load receipt"));
    }
  };

  const runLateFee = async () => {
    try {
      const res = await http.post(endpoints.rentalOverdueRun);
      setMsg(`Late fee/reminders processed for ${res.data.data?.updated || 0} schedules`);
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed late fee run"));
    }
  };

  const raiseTicket = async (e) => {
    e.preventDefault();
    try {
      await http.post(endpoints.maintenanceTickets, {
        ...ticketForm,
        property_id: Number(ticketForm.property_id),
        unit_id: ticketForm.unit_id ? Number(ticketForm.unit_id) : null,
        tenant_id: ticketForm.tenant_id ? Number(ticketForm.tenant_id) : null,
        cost_estimate: Number(ticketForm.cost_estimate || 0),
      });
      setTicketForm(ticketInitial);
      setMsg("Maintenance ticket raised");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to raise ticket"));
    }
  };

  const assignVendor = async (id) => {
    const vendor_name = window.prompt("Vendor name", "") || "";
    const vendor_phone = window.prompt("Vendor phone", "") || "";
    if (!vendor_name) return;
    try {
      await http.post(endpoints.maintenanceAssignVendor(id), { vendor_name, vendor_phone });
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to assign vendor"));
    }
  };

  const updateTicketStatus = async (id, status) => {
    const actual = window.prompt("Actual cost", "0") || "0";
    try {
      await http.patch(endpoints.maintenanceStatus(id), { status, cost_actual: Number(actual || 0) });
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to update ticket"));
    }
  };

  const requestVendorPayment = async (id) => {
    const amount = Number(window.prompt("Vendor payment request amount", "0") || 0);
    if (!amount) return;
    try {
      await http.post(endpoints.maintenancePaymentRequest(id), { amount });
      setMsg("Vendor payment request submitted");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to request vendor payment"));
    }
  };

  const createMoveChecklist = async (e) => {
    e.preventDefault();
    try {
      await http.post(endpoints.rentalMoveChecklists, {
        ...moveChecklistForm,
        tenant_id: Number(moveChecklistForm.tenant_id),
        property_id: moveChecklistForm.property_id ? Number(moveChecklistForm.property_id) : null,
        unit_id: moveChecklistForm.unit_id ? Number(moveChecklistForm.unit_id) : null,
      });
      setMoveChecklistForm(moveChecklistInitial);
      setMsg("Move checklist created");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create checklist"));
    }
  };

  const updateMoveChecklistStatus = async (id, status) => {
    try {
      await http.patch(endpoints.rentalMoveChecklistById(id), { status });
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed to update checklist"));
    }
  };

  const createComplaint = async (e) => {
    e.preventDefault();
    try {
      await http.post(endpoints.rentalComplaints, {
        ...complaintForm,
        tenant_id: Number(complaintForm.tenant_id),
        property_id: complaintForm.property_id ? Number(complaintForm.property_id) : null,
        unit_id: complaintForm.unit_id ? Number(complaintForm.unit_id) : null,
      });
      setComplaintForm(complaintInitial);
      setMsg("Tenant complaint created");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create complaint"));
    }
  };

  const updateComplaintStatus = async (id, status) => {
    const resolution_notes = window.prompt("Resolution note (optional)", "") || "";
    try {
      await http.patch(endpoints.rentalComplaintById(id), { status, resolution_notes });
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed complaint update"));
    }
  };

  const updateTenantVerification = async (e) => {
    e.preventDefault();
    if (!selectedTenantId) return;
    try {
      await http.post(endpoints.tenantVerificationNotes(selectedTenantId), tenantNoteForm);
      setTenantNoteForm({ status: "Pending", note: "" });
      setMsg("Tenant verification status updated");
      await loadAll();
    } catch (e) {
      setError(getApiError(e, "Failed verification update"));
    }
  };

  const addInspection = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append("property_id", String(inspForm.property_id));
    if (inspForm.unit_id) fd.append("unit_id", String(inspForm.unit_id));
    fd.append("inspection_date", inspForm.inspection_date);
    fd.append("summary", inspForm.summary);
    fd.append("status", inspForm.status);
    if (inspForm.report) fd.append("report", inspForm.report);

    try {
      await http.post(endpoints.inspections, fd);
      setInspForm(inspInitial);
      setMsg("Inspection report saved");
      await loadAll();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add inspection"));
    }
  };

  const loadOwnerStatement = async () => {
    if (!selectedOwnerId) return;
    try {
      const [year, monthNum] = month.split("-").map(Number);
      const from = `${month}-01`;
      const to = new Date(year, monthNum, 0).toISOString().slice(0, 10);

      const [statementRes, profitabilityRes] = await Promise.all([
        http.get(endpoints.ownerMonthlyStatement(selectedOwnerId), { params: { month } }),
        http.get(endpoints.rentalPropertyProfitability, { params: { from, to } }),
      ]);
      setStatement(statementRes.data.data || null);
      setProfitabilityRows(profitabilityRes.data.data?.rows || []);
    } catch (e) {
      setError(getApiError(e, "Failed to load owner statement"));
    }
  };

  const overdueCount = useMemo(() => schedules.filter((s) => s.status === "Overdue").length, [schedules]);

  return (
    <div>
      <div className="text-xl font-bold">Rental & Property Management</div>
      <div className="text-sm text-slate-600">Rent schedules, tenant operations, maintenance, inspections and owner reporting</div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <div className="mt-4 grid lg:grid-cols-2 gap-4">
        <form onSubmit={createContract} className="bg-white border rounded-2xl p-3 grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold text-sm">Rent Schedule (Monthly/Quarterly)</div>
          <select className="border rounded px-2 py-1" value={contractForm.property_id} onChange={(e) => setContractForm({ ...contractForm, property_id: e.target.value })}>
            <option value="">Property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
          </select>
          <input className="border rounded px-2 py-1" placeholder="Unit ID (optional)" value={contractForm.unit_id} onChange={(e) => setContractForm({ ...contractForm, unit_id: e.target.value })} />
          <select className="border rounded px-2 py-1" value={contractForm.owner_id} onChange={(e) => setContractForm({ ...contractForm, owner_id: e.target.value })}>
            <option value="">Owner</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.owner_uid} - {o.name}</option>)}
          </select>
          <select className="border rounded px-2 py-1" value={contractForm.tenant_id} onChange={(e) => setContractForm({ ...contractForm, tenant_id: e.target.value })}>
            <option value="">Tenant</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.tenant_uid} - {t.name}</option>)}
          </select>
          <input className="border rounded px-2 py-1" type="date" value={contractForm.start_date} onChange={(e) => setContractForm({ ...contractForm, start_date: e.target.value })} />
          <input className="border rounded px-2 py-1" type="date" value={contractForm.end_date} onChange={(e) => setContractForm({ ...contractForm, end_date: e.target.value })} />
          <input className="border rounded px-2 py-1" type="number" placeholder="Rent amount" value={contractForm.rent_amount} onChange={(e) => setContractForm({ ...contractForm, rent_amount: e.target.value })} />
          <select className="border rounded px-2 py-1" value={contractForm.cycle} onChange={(e) => setContractForm({ ...contractForm, cycle: e.target.value })}>
            <option>Monthly</option><option>Quarterly</option>
          </select>
          <input className="border rounded px-2 py-1" type="number" placeholder="Due day" value={contractForm.due_day} onChange={(e) => setContractForm({ ...contractForm, due_day: e.target.value })} />
          <select className="border rounded px-2 py-1" value={contractForm.late_fee_type} onChange={(e) => setContractForm({ ...contractForm, late_fee_type: e.target.value })}>
            <option>Flat</option><option>Percent</option>
          </select>
          <input className="border rounded px-2 py-1" type="number" placeholder="Late fee value" value={contractForm.late_fee_value} onChange={(e) => setContractForm({ ...contractForm, late_fee_value: e.target.value })} />
          <input className="border rounded px-2 py-1" type="number" placeholder="Generate months" value={contractForm.generate_months} onChange={(e) => setContractForm({ ...contractForm, generate_months: e.target.value })} />
          <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Create Contract + Schedule</button>
        </form>

        <form onSubmit={raiseTicket} className="bg-white border rounded-2xl p-3 grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold text-sm">Maintenance Ticketing</div>
          <select className="border rounded px-2 py-1" value={ticketForm.property_id} onChange={(e) => setTicketForm({ ...ticketForm, property_id: e.target.value })}>
            <option value="">Property</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
          </select>
          <input className="border rounded px-2 py-1" placeholder="Unit ID" value={ticketForm.unit_id} onChange={(e) => setTicketForm({ ...ticketForm, unit_id: e.target.value })} />
          <select className="border rounded px-2 py-1" value={ticketForm.tenant_id} onChange={(e) => setTicketForm({ ...ticketForm, tenant_id: e.target.value })}>
            <option value="">Tenant</option>
            {tenants.map((t) => <option key={t.id} value={t.id}>{t.tenant_uid} - {t.name}</option>)}
          </select>
          <input className="border rounded px-2 py-1" placeholder="Title" value={ticketForm.title} onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })} />
          <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Description" value={ticketForm.description} onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })} />
          <select className="border rounded px-2 py-1" value={ticketForm.priority} onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}>
            <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
          </select>
          <input className="border rounded px-2 py-1" type="datetime-local" value={ticketForm.sla_due_at} onChange={(e) => setTicketForm({ ...ticketForm, sla_due_at: e.target.value })} />
          <input className="border rounded px-2 py-1" type="number" placeholder="Cost estimate" value={ticketForm.cost_estimate} onChange={(e) => setTicketForm({ ...ticketForm, cost_estimate: e.target.value })} />
          <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Raise Ticket</button>
        </form>
      </div>

      <div className="mt-6 bg-white border rounded-2xl overflow-hidden">
        <div className="p-3 flex items-center justify-between border-b">
          <div className="font-semibold text-sm">Rent Due/Paid + Receipts | Overdue: {overdueCount}</div>
          <button className="px-2 py-1 rounded border text-sm" type="button" onClick={runLateFee}>Run Late Fee + Reminders</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="p-3 text-left">Contract</th><th className="p-3 text-left">Due</th><th className="p-3 text-left">Amount</th><th className="p-3 text-left">Late Fee</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Action</th></tr></thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="p-3">{s.rental_uid}</td>
                <td className="p-3">{s.due_date}</td>
                <td className="p-3">{formatCurrency(s.amount)}</td>
                <td className="p-3">{formatCurrency(s.late_fee)}</td>
                <td className="p-3">{s.status}</td>
                <td className="p-3 space-x-2">
                  {s.status !== "Paid" && <button className="underline" onClick={() => collectRent(s.id)} type="button">Collect</button>}
                  <button className="underline" onClick={() => openReceipt(s.id)} type="button">Receipt</button>
                </td>
              </tr>
            ))}
            {!schedules.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="6">No schedules.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Move-In / Move-Out Checklist</div>
          <form onSubmit={createMoveChecklist} className="mt-2 grid gap-2 md:grid-cols-2">
            <select className="border rounded px-2 py-1" value={moveChecklistForm.tenant_id} onChange={(e) => setMoveChecklistForm({ ...moveChecklistForm, tenant_id: e.target.value })}>
              <option value="">Tenant</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.tenant_uid} - {t.name}</option>)}
            </select>
            <select className="border rounded px-2 py-1" value={moveChecklistForm.property_id} onChange={(e) => setMoveChecklistForm({ ...moveChecklistForm, property_id: e.target.value })}>
              <option value="">Property</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
            </select>
            <input className="border rounded px-2 py-1" placeholder="Unit ID" value={moveChecklistForm.unit_id} onChange={(e) => setMoveChecklistForm({ ...moveChecklistForm, unit_id: e.target.value })} />
            <select className="border rounded px-2 py-1" value={moveChecklistForm.checklist_type} onChange={(e) => setMoveChecklistForm({ ...moveChecklistForm, checklist_type: e.target.value })}>
              <option>Move-In</option><option>Move-Out</option>
            </select>
            <input className="border rounded px-2 py-1" type="date" value={moveChecklistForm.target_date} onChange={(e) => setMoveChecklistForm({ ...moveChecklistForm, target_date: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Notes" value={moveChecklistForm.notes} onChange={(e) => setMoveChecklistForm({ ...moveChecklistForm, notes: e.target.value })} />
            <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Create Checklist</button>
          </form>
          <div className="space-y-2 mt-3 text-sm max-h-52 overflow-auto">
            {moveChecklists.map((m) => (
              <div key={m.id} className="border rounded p-2">
                <div className="font-semibold">{m.checklist_uid} - {m.checklist_type}</div>
                <div>Tenant: {m.tenant_name} | Target: {m.target_date || "-"}</div>
                <div>Status: {m.status}</div>
                <div className="space-x-2 mt-1">
                  <button className="underline" type="button" onClick={() => updateMoveChecklistStatus(m.id, "In Progress")}>In Progress</button>
                  <button className="underline" type="button" onClick={() => updateMoveChecklistStatus(m.id, "Completed")}>Completed</button>
                </div>
              </div>
            ))}
            {!moveChecklists.length && <div className="text-slate-500">No move checklists.</div>}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Tenant Complaints / Issues</div>
          <form onSubmit={createComplaint} className="mt-2 grid gap-2 md:grid-cols-2">
            <select className="border rounded px-2 py-1" value={complaintForm.tenant_id} onChange={(e) => setComplaintForm({ ...complaintForm, tenant_id: e.target.value })}>
              <option value="">Tenant</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.tenant_uid} - {t.name}</option>)}
            </select>
            <select className="border rounded px-2 py-1" value={complaintForm.property_id} onChange={(e) => setComplaintForm({ ...complaintForm, property_id: e.target.value })}>
              <option value="">Property</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
            </select>
            <input className="border rounded px-2 py-1" placeholder="Unit ID" value={complaintForm.unit_id} onChange={(e) => setComplaintForm({ ...complaintForm, unit_id: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Category" value={complaintForm.category} onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })} />
            <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Title" value={complaintForm.title} onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })} />
            <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Description" value={complaintForm.description} onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })} />
            <select className="border rounded px-2 py-1" value={complaintForm.priority} onChange={(e) => setComplaintForm({ ...complaintForm, priority: e.target.value })}>
              <option>Low</option><option>Medium</option><option>High</option><option>Urgent</option>
            </select>
            <select className="border rounded px-2 py-1" value={complaintForm.escalation_level} onChange={(e) => setComplaintForm({ ...complaintForm, escalation_level: e.target.value })}>
              <option>None</option><option>L1</option><option>L2</option><option>L3</option>
            </select>
            <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Create Complaint</button>
          </form>
          <div className="space-y-2 mt-3 text-sm max-h-52 overflow-auto">
            {complaints.map((c) => (
              <div key={c.id} className="border rounded p-2">
                <div className="font-semibold">{c.complaint_uid} - {c.title}</div>
                <div>{c.tenant_name} | {c.category} | {c.priority}</div>
                <div>Status: {c.status} | Escalation: {c.escalation_level}</div>
                <div className="space-x-2 mt-1">
                  <button className="underline" type="button" onClick={() => updateComplaintStatus(c.id, "In Progress")}>In Progress</button>
                  <button className="underline" type="button" onClick={() => updateComplaintStatus(c.id, "Resolved")}>Resolve</button>
                  <button className="underline" type="button" onClick={() => updateComplaintStatus(c.id, "Closed")}>Close</button>
                </div>
              </div>
            ))}
            {!complaints.length && <div className="text-slate-500">No complaints.</div>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Maintenance SLA + Cost + Vendor Payment Request</div>
          <div className="space-y-2 mt-2 text-sm max-h-80 overflow-auto">
            {tickets.map((t) => (
              <div key={t.id} className="border rounded p-2">
                <div className="font-semibold">{t.ticket_uid} - {t.title}</div>
                <div>Status: {t.status} | Priority: {t.priority}</div>
                <div>SLA: {formatDateTime(t.sla_due_at)} | Cost est/actual: {formatCurrency(t.cost_estimate)} / {formatCurrency(t.cost_actual)}</div>
                <div>Vendor: {t.vendor_name || "-"} | Payout: {t.vendor_payment_request_status || "None"} {t.vendor_payment_requested_amount ? `(${formatCurrency(t.vendor_payment_requested_amount)})` : ""}</div>
                <div className="mt-1 space-x-2">
                  <button className="underline" type="button" onClick={() => assignVendor(t.id)}>Assign Vendor</button>
                  <button className="underline" type="button" onClick={() => updateTicketStatus(t.id, "In Progress")}>In Progress</button>
                  <button className="underline" type="button" onClick={() => updateTicketStatus(t.id, "Resolved")}>Resolved</button>
                  <button className="underline" type="button" onClick={() => updateTicketStatus(t.id, "Closed")}>Closed</button>
                  <button className="underline" type="button" onClick={() => requestVendorPayment(t.id)}>Request Payout</button>
                </div>
              </div>
            ))}
            {!tickets.length && <div className="text-slate-500">No maintenance tickets.</div>}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Inspections + Reports</div>
          <form onSubmit={addInspection} className="mt-2 grid gap-2 md:grid-cols-2">
            <select className="border rounded px-2 py-1" value={inspForm.property_id} onChange={(e) => setInspForm({ ...inspForm, property_id: e.target.value })}>
              <option value="">Property</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
            </select>
            <input className="border rounded px-2 py-1" placeholder="Unit ID" value={inspForm.unit_id} onChange={(e) => setInspForm({ ...inspForm, unit_id: e.target.value })} />
            <input className="border rounded px-2 py-1" type="date" value={inspForm.inspection_date} onChange={(e) => setInspForm({ ...inspForm, inspection_date: e.target.value })} />
            <input className="border rounded px-2 py-1" placeholder="Status" value={inspForm.status} onChange={(e) => setInspForm({ ...inspForm, status: e.target.value })} />
            <input className="border rounded px-2 py-1 md:col-span-2" placeholder="Summary" value={inspForm.summary} onChange={(e) => setInspForm({ ...inspForm, summary: e.target.value })} />
            <input className="border rounded px-2 py-1 md:col-span-2" type="file" onChange={(e) => setInspForm({ ...inspForm, report: e.target.files?.[0] || null })} />
            <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Add Inspection</button>
          </form>
          <div className="space-y-1 mt-2 text-sm max-h-44 overflow-auto">
            {inspections.map((i) => (
              <div key={i.id}>
                {i.inspection_uid} - {i.inspection_date} {i.report_url && <a className="underline" href={i.report_url} target="_blank" rel="noreferrer">Report</a>}
              </div>
            ))}
            {!inspections.length && <div className="text-slate-500">No inspections yet.</div>}
          </div>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Tenant Verification Status (Operations)</div>
          <form className="mt-2 grid md:grid-cols-3 gap-2" onSubmit={updateTenantVerification}>
            <select className="border rounded px-2 py-1" value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}>
              <option value="">Tenant</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.tenant_uid} - {t.name}</option>)}
            </select>
            <select className="border rounded px-2 py-1" value={tenantNoteForm.status} onChange={(e) => setTenantNoteForm({ ...tenantNoteForm, status: e.target.value })}>
              <option>Pending</option><option>Verified</option><option>Rejected</option><option>Under Review</option>
            </select>
            <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Update Status</button>
            <input className="border rounded px-2 py-1 md:col-span-3" placeholder="Operations note" value={tenantNoteForm.note} onChange={(e) => setTenantNoteForm({ ...tenantNoteForm, note: e.target.value })} />
          </form>
        </div>

        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Owner Monthly Statement + Property Profitability (Rental)</div>
          <div className="mt-2 flex gap-2 items-center flex-wrap">
            <select className="border rounded px-2 py-1" value={selectedOwnerId} onChange={(e) => setSelectedOwnerId(e.target.value)}>
              <option value="">Owner</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.owner_uid} - {o.name}</option>)}
            </select>
            <input className="border rounded px-2 py-1" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="px-2 py-1 rounded border" type="button" onClick={loadOwnerStatement}>Load Statement</button>
          </div>
          {statement && (
            <div className="mt-3 text-sm">
              <div>Month: {statement.month}</div>
              <div>Income: {formatCurrency(statement.income)}</div>
              <div>Expense: {formatCurrency(statement.expense)}</div>
              <div className="font-semibold">Net: {formatCurrency(statement.net)}</div>
            </div>
          )}
          <div className="mt-3 text-sm max-h-40 overflow-auto border-t pt-2">
            {profitabilityRows.map((r) => (
              <div key={r.property_id} className="flex justify-between gap-2 py-1">
                <span>{r.property_uid} - {r.title}</span>
                <span>{formatCurrency(r.net)} ({r.margin_pct}%)</span>
              </div>
            ))}
            {!profitabilityRows.length && <div className="text-slate-500">No property profitability rows in selected month.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
