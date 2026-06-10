import React, { useCallback, useEffect, useMemo, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { getApiError } from "../../utils/ui.js";

const tabs = ["customers", "tenants", "owners"];

const customerInitial = {
  name: "",
  phone: "",
  email: "",
  address: "",
  pan: "",
  aadhaar: "",
  gst: "",
  pref_area: "",
  pref_type: "",
  pref_budget_min: "",
  pref_budget_max: "",
};

const tenantInitial = { name: "", phone: "", email: "", verification_status: "Pending", verification_doc: null };
const ownerInitial = { name: "", phone: "", email: "", address: "", owner_type: "Rental" };

export default function CustomersList() {
  const [tab, setTab] = useState("customers");
  const [rows, setRows] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);

  const [q, setQ] = useState("");
  const [customerForm, setCustomerForm] = useState(customerInitial);
  const [tenantForm, setTenantForm] = useState(tenantInitial);
  const [ownerForm, setOwnerForm] = useState(ownerInitial);

  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);

  const [kycType, setKycType] = useState("PAN");
  const [kycFile, setKycFile] = useState(null);
  const [kycRows, setKycRows] = useState([]);

  const [familyForm, setFamilyForm] = useState({ name: "", relation: "", phone: "", email: "" });
  const [familyRows, setFamilyRows] = useState([]);

  const [tenantNoteForm, setTenantNoteForm] = useState({ status: "Pending", note: "" });
  const [tenantNotes, setTenantNotes] = useState([]);

  const [ownerMapForm, setOwnerMapForm] = useState({ property_id: "", management_type: "Rental" });
  const [ownerProps, setOwnerProps] = useState([]);

  const [suggestions, setSuggestions] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const loadCustomers = useCallback(async () => {
    const res = await http.get(endpoints.customers);
    const data = res.data.data || [];
    setRows(data);
    if (!selectedCustomerId && data[0]) setSelectedCustomerId(data[0].id);
  }, [selectedCustomerId]);

  const loadTenants = useCallback(async () => {
    const res = await http.get(endpoints.tenants);
    const data = res.data.data || [];
    setTenants(data);
    if (!selectedTenantId && data[0]) setSelectedTenantId(data[0].id);
  }, [selectedTenantId]);

  const loadOwners = useCallback(async () => {
    const [ownerRes, propRes] = await Promise.all([
      http.get(endpoints.owners),
      http.get(endpoints.properties),
    ]);
    const ownerData = ownerRes.data.data || [];
    setOwners(ownerData);
    setProperties(propRes.data.data || []);
    if (!selectedOwnerId && ownerData[0]) setSelectedOwnerId(ownerData[0].id);
  }, [selectedOwnerId]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadCustomers(), loadTenants(), loadOwners()]);
    } catch (e) {
      setError(getApiError(e, "Failed to load records"));
    } finally {
      setLoading(false);
    }
  }, [loadCustomers, loadTenants, loadOwners]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const loadCustomerExtras = useCallback(async () => {
    if (!selectedCustomerId) {
      setKycRows([]);
      setFamilyRows([]);
      setSuggestions([]);
      return;
    }
    try {
      const [kycRes, famRes] = await Promise.all([
        http.get(endpoints.customerKyc(selectedCustomerId)),
        http.get(endpoints.customerFamily(selectedCustomerId)),
      ]);
      setKycRows(kycRes.data.data || []);
      setFamilyRows(famRes.data.data || []);
    } catch {
      setKycRows([]);
      setFamilyRows([]);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    loadCustomerExtras();
  }, [loadCustomerExtras]);

  const loadTenantNotes = useCallback(async () => {
    if (!selectedTenantId) {
      setTenantNotes([]);
      return;
    }
    try {
      const res = await http.get(endpoints.tenantVerificationNotes(selectedTenantId));
      setTenantNotes(res.data.data || []);
    } catch {
      setTenantNotes([]);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    loadTenantNotes();
  }, [loadTenantNotes]);

  const loadOwnerProps = useCallback(async () => {
    if (!selectedOwnerId) {
      setOwnerProps([]);
      return;
    }
    try {
      const res = await http.get(endpoints.ownerProperties(selectedOwnerId));
      setOwnerProps(res.data.data || []);
    } catch {
      setOwnerProps([]);
    }
  }, [selectedOwnerId]);

  useEffect(() => {
    loadOwnerProps();
  }, [loadOwnerProps]);

  const filteredRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) => [r.customer_uid, r.name, r.phone, r.email].some((v) => String(v || "").toLowerCase().includes(needle)));
  }, [rows, q]);

  const createCustomer = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!customerForm.name.trim()) return setError("Customer name required");
    try {
      await http.post(endpoints.customers, customerForm);
      setCustomerForm(customerInitial);
      setMsg("Customer created");
      await loadCustomers();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create customer"));
    }
  };

  const uploadKyc = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId || !kycFile) return;
    const fd = new FormData();
    fd.append("doc_type", kycType);
    fd.append("file", kycFile);
    try {
      await http.post(endpoints.customerKyc(selectedCustomerId), fd);
      setKycFile(null);
      setMsg("KYC uploaded");
      await loadCustomerExtras();
    } catch (e2) {
      setError(getApiError(e2, "Failed KYC upload"));
    }
  };

  const addFamily = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId || !familyForm.name.trim()) return;
    try {
      await http.post(endpoints.customerFamily(selectedCustomerId), familyForm);
      setFamilyForm({ name: "", relation: "", phone: "", email: "" });
      await loadCustomerExtras();
    } catch (e2) {
      setError(getApiError(e2, "Failed to add family member"));
    }
  };

  const runSuggestions = async () => {
    if (!selectedCustomerId) return;
    try {
      const res = await http.get(endpoints.customerSuggestions(selectedCustomerId));
      setSuggestions(res.data.data || []);
    } catch (e) {
      setError(getApiError(e, "Failed suggestions"));
    }
  };

  const createTenant = async (e) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(tenantForm).forEach(([k, v]) => {
      if (k === "verification_doc") return;
      fd.append(k, v || "");
    });
    if (tenantForm.verification_doc) fd.append("verification_doc", tenantForm.verification_doc);

    try {
      await http.post(endpoints.tenants, fd);
      setTenantForm(tenantInitial);
      setMsg("Tenant created");
      await loadTenants();
    } catch (e2) {
      setError(getApiError(e2, "Failed tenant create"));
    }
  };

  const updateTenantVerification = async (e) => {
    e.preventDefault();
    if (!selectedTenantId) return;
    try {
      await http.post(endpoints.tenantVerificationNotes(selectedTenantId), tenantNoteForm);
      setTenantNoteForm({ status: "Pending", note: "" });
      await Promise.all([loadTenants(), loadTenantNotes()]);
      setMsg("Tenant verification updated");
    } catch (e2) {
      setError(getApiError(e2, "Failed verification update"));
    }
  };

  const createOwner = async (e) => {
    e.preventDefault();
    try {
      await http.post(endpoints.owners, ownerForm);
      setOwnerForm(ownerInitial);
      setMsg("Owner profile created");
      await loadOwners();
    } catch (e2) {
      setError(getApiError(e2, "Failed owner create"));
    }
  };

  const mapOwnerProperty = async (e) => {
    e.preventDefault();
    if (!selectedOwnerId || !ownerMapForm.property_id) return;
    try {
      await http.post(endpoints.ownerProperties(selectedOwnerId), {
        property_id: Number(ownerMapForm.property_id),
        management_type: ownerMapForm.management_type,
      });
      await loadOwnerProps();
      setMsg("Owner property mapped");
    } catch (e2) {
      setError(getApiError(e2, "Failed owner mapping"));
    }
  };

  return (
    <div>
      <div className="text-xl font-bold">Customer / Tenant / Owner Management</div>
      <div className="text-sm text-slate-600">KYC, co-applicants, tenant workflow, owner profiles, preference matching</div>

      <div className="mt-4 flex gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-2 rounded-xl text-sm ${tab === t ? "bg-slate-900 text-white" : "bg-white border"}`}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button onClick={refreshAll} type="button" className="px-4 py-2 rounded-xl bg-white border" disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      {tab === "customers" && (
        <div className="mt-4 grid gap-4">
          <form onSubmit={createCustomer} className="grid gap-2 md:grid-cols-6 bg-white border rounded-2xl p-3">
            <input className="border rounded-xl px-3 py-2" placeholder="Name" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Phone" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Address" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="PAN" value={customerForm.pan} onChange={(e) => setCustomerForm({ ...customerForm, pan: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Aadhaar" value={customerForm.aadhaar} onChange={(e) => setCustomerForm({ ...customerForm, aadhaar: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="GST" value={customerForm.gst} onChange={(e) => setCustomerForm({ ...customerForm, gst: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Preferred Area" value={customerForm.pref_area} onChange={(e) => setCustomerForm({ ...customerForm, pref_area: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Preferred Type" value={customerForm.pref_type} onChange={(e) => setCustomerForm({ ...customerForm, pref_type: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" type="number" placeholder="Budget Min" value={customerForm.pref_budget_min} onChange={(e) => setCustomerForm({ ...customerForm, pref_budget_min: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" type="number" placeholder="Budget Max" value={customerForm.pref_budget_max} onChange={(e) => setCustomerForm({ ...customerForm, pref_budget_max: e.target.value })} />
            <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Add Customer</button>
          </form>

          <div className="flex gap-2">
            <input className="border rounded-xl px-3 py-2 w-full" placeholder="Search customer" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="bg-white border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="text-left p-3">UID</th><th className="text-left p-3">Name</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Email</th><th className="text-left p-3">Action</th></tr></thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{r.customer_uid}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">{r.phone || "-"}</td>
                    <td className="p-3">{r.email || "-"}</td>
                    <td className="p-3"><button className="underline" onClick={() => setSelectedCustomerId(r.id)} type="button">Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!!selectedCustomerId && (
            <div className="grid md:grid-cols-3 gap-3">
              <div className="bg-white border rounded-2xl p-3">
                <div className="font-semibold text-sm">KYC Upload (PAN/Aadhaar/GST)</div>
                <form className="mt-2 grid gap-2" onSubmit={uploadKyc}>
                  <select className="border rounded px-2 py-1" value={kycType} onChange={(e) => setKycType(e.target.value)}>
                    <option>PAN</option><option>Aadhaar</option><option>GST</option>
                  </select>
                  <input type="file" onChange={(e) => setKycFile(e.target.files?.[0] || null)} />
                  <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Upload</button>
                </form>
                <div className="mt-2 space-y-1 text-sm">
                  {kycRows.map((k) => <a key={k.id} className="block underline" href={k.url} target="_blank" rel="noreferrer">{k.doc_type} - {k.original_name || "file"}</a>)}
                  {!kycRows.length && <div className="text-slate-500">No KYC docs.</div>}
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-3">
                <div className="font-semibold text-sm">Co-applicants / Family Members</div>
                <form className="mt-2 grid gap-2" onSubmit={addFamily}>
                  <input className="border rounded px-2 py-1" placeholder="Name" value={familyForm.name} onChange={(e) => setFamilyForm({ ...familyForm, name: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Relation" value={familyForm.relation} onChange={(e) => setFamilyForm({ ...familyForm, relation: e.target.value })} />
                  <input className="border rounded px-2 py-1" placeholder="Phone" value={familyForm.phone} onChange={(e) => setFamilyForm({ ...familyForm, phone: e.target.value })} />
                  <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Add</button>
                </form>
                <div className="mt-2 space-y-1 text-sm">
                  {familyRows.map((f) => <div key={f.id}>{f.name} ({f.relation || "-"})</div>)}
                  {!familyRows.length && <div className="text-slate-500">No family members.</div>}
                </div>
              </div>

              <div className="bg-white border rounded-2xl p-3">
                <div className="font-semibold text-sm">Preference Matching Engine</div>
                <button className="mt-2 px-2 py-1 rounded bg-slate-900 text-white text-sm" type="button" onClick={runSuggestions}>Suggest Properties</button>
                <div className="mt-2 space-y-1 text-sm">
                  {suggestions.map((s) => <div key={s.id}>{s.property_uid} - {s.title} ({s.city || "-"})</div>)}
                  {!suggestions.length && <div className="text-slate-500">No suggestions yet.</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "tenants" && (
        <div className="mt-4 grid gap-4">
          <form onSubmit={createTenant} className="grid gap-2 md:grid-cols-5 bg-white border rounded-2xl p-3">
            <input className="border rounded-xl px-3 py-2" placeholder="Tenant name" value={tenantForm.name} onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Phone" value={tenantForm.phone} onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Email" value={tenantForm.email} onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })} />
            <select className="border rounded-xl px-3 py-2" value={tenantForm.verification_status} onChange={(e) => setTenantForm({ ...tenantForm, verification_status: e.target.value })}>
              <option>Pending</option><option>Verified</option><option>Rejected</option>
            </select>
            <input className="border rounded-xl px-3 py-2" type="file" onChange={(e) => setTenantForm({ ...tenantForm, verification_doc: e.target.files?.[0] || null })} />
            <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Add Tenant</button>
          </form>

          <div className="bg-white border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="p-3 text-left">UID</th><th className="p-3 text-left">Name</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Verification Doc</th><th className="p-3 text-left">Action</th></tr></thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{t.tenant_uid}</td>
                    <td className="p-3">{t.name}</td>
                    <td className="p-3">{t.verification_status}</td>
                    <td className="p-3">{t.verification_doc_url ? <a className="underline" href={t.verification_doc_url} target="_blank" rel="noreferrer">Open</a> : "-"}</td>
                    <td className="p-3"><button className="underline" onClick={() => setSelectedTenantId(t.id)} type="button">Workflow</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!!selectedTenantId && (
            <div className="bg-white border rounded-2xl p-3">
              <div className="font-semibold text-sm">Tenant Verification Workflow + Notes</div>
              <form className="mt-2 grid md:grid-cols-3 gap-2" onSubmit={updateTenantVerification}>
                <select className="border rounded px-2 py-1" value={tenantNoteForm.status} onChange={(e) => setTenantNoteForm({ ...tenantNoteForm, status: e.target.value })}>
                  <option>Pending</option><option>Verified</option><option>Rejected</option>
                </select>
                <input className="border rounded px-2 py-1" placeholder="Note" value={tenantNoteForm.note} onChange={(e) => setTenantNoteForm({ ...tenantNoteForm, note: e.target.value })} />
                <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Update</button>
              </form>
              <div className="mt-2 space-y-1 text-sm">
                {tenantNotes.map((n) => <div key={n.id}>{n.status}: {n.note || "-"}</div>)}
                {!tenantNotes.length && <div className="text-slate-500">No workflow notes.</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "owners" && (
        <div className="mt-4 grid gap-4">
          <form onSubmit={createOwner} className="grid gap-2 md:grid-cols-6 bg-white border rounded-2xl p-3">
            <input className="border rounded-xl px-3 py-2" placeholder="Owner name" value={ownerForm.name} onChange={(e) => setOwnerForm({ ...ownerForm, name: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Phone" value={ownerForm.phone} onChange={(e) => setOwnerForm({ ...ownerForm, phone: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Email" value={ownerForm.email} onChange={(e) => setOwnerForm({ ...ownerForm, email: e.target.value })} />
            <input className="border rounded-xl px-3 py-2" placeholder="Address" value={ownerForm.address} onChange={(e) => setOwnerForm({ ...ownerForm, address: e.target.value })} />
            <select className="border rounded-xl px-3 py-2" value={ownerForm.owner_type} onChange={(e) => setOwnerForm({ ...ownerForm, owner_type: e.target.value })}>
              <option>Rental</option><option>Managed</option>
            </select>
            <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Add Owner</button>
          </form>

          <div className="bg-white border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr><th className="p-3 text-left">UID</th><th className="p-3 text-left">Name</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Action</th></tr></thead>
              <tbody>
                {owners.map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{o.owner_uid}</td>
                    <td className="p-3">{o.name}</td>
                    <td className="p-3">{o.owner_type}</td>
                    <td className="p-3"><button className="underline" onClick={() => setSelectedOwnerId(o.id)} type="button">Manage</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!!selectedOwnerId && (
            <div className="bg-white border rounded-2xl p-3">
              <div className="font-semibold text-sm">Owner Profiles for Rental/Managed Properties</div>
              <form className="mt-2 grid md:grid-cols-3 gap-2" onSubmit={mapOwnerProperty}>
                <select className="border rounded px-2 py-1" value={ownerMapForm.property_id} onChange={(e) => setOwnerMapForm({ ...ownerMapForm, property_id: e.target.value })}>
                  <option value="">Select Property</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.property_uid} - {p.title}</option>)}
                </select>
                <select className="border rounded px-2 py-1" value={ownerMapForm.management_type} onChange={(e) => setOwnerMapForm({ ...ownerMapForm, management_type: e.target.value })}>
                  <option>Rental</option><option>Managed</option>
                </select>
                <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Map Property</button>
              </form>
              <div className="mt-2 space-y-1 text-sm">
                {ownerProps.map((op) => <div key={op.id}>{op.property_uid} - {op.title} ({op.management_type})</div>)}
                {!ownerProps.length && <div className="text-slate-500">No mapped properties.</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
