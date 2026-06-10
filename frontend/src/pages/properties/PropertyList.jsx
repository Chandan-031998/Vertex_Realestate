import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, getApiError } from "../../utils/ui.js";
import { getUser } from "../../store/auth.store.js";

const TYPE_OPTIONS = ["Residential", "Commercial", "Plot", "Villa", "Apartment"];
const STATUS_OPTIONS = ["Available", "Hold", "Booked", "Sold", "Rented"];

const initialForm = {
  title: "",
  type: "Residential",
  status: "Available",
  city: "",
  area: "",
  base_price: "",
  video_link: "",
  brochure: null,
  images: [],
};

export default function PropertyList() {
  const user = getUser();
  const canCreateProperty = user?.role === "Admin" || user?.role === "Property Manager";
  const canDeleteProperty = user?.role === "Admin" || user?.role === "Property Manager";
  const canExportPortal = user?.role === "Admin" || user?.role === "Sales Manager";
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [form, setForm] = useState(initialForm);
  const [exportFormat, setExportFormat] = useState("generic");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await http.get(endpoints.properties, { params: { q, status, type } });
      setRows(res.data.data || []);
    } catch (e) {
      setError(getApiError(e, "Failed to load properties"));
    } finally {
      setLoading(false);
    }
  }, [q, status, type]);

  useEffect(() => {
    load();
  }, [load]);

  const createProperty = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!form.title.trim()) {
      setError("Property title is required");
      return;
    }

    if (form.video_link.trim()) {
      try {
        const u = new URL(form.video_link.trim());
        if (!u.protocol.startsWith("http")) throw new Error("invalid");
      } catch {
        setError("Video URL must be valid http/https URL");
        return;
      }
    }

    if (form.brochure && !form.brochure.name.toLowerCase().endsWith(".pdf")) {
      setError("Brochure must be PDF");
      return;
    }

    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("type", form.type);
    fd.append("status", form.status);
    fd.append("city", form.city.trim());
    fd.append("area", form.area.trim());
    fd.append("base_price", String(form.base_price || 0));
    if (form.video_link.trim()) fd.append("video_link", form.video_link.trim());
    if (form.brochure) fd.append("brochure", form.brochure);
    for (const img of form.images) fd.append("images", img);

    setSaving(true);
    try {
      await http.post(endpoints.properties, fd);
      setForm(initialForm);
      setMsg("Property created successfully");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create property"));
    } finally {
      setSaving(false);
    }
  };

  const deleteProperty = async (id) => {
    if (!window.confirm("Delete this property?")) return;
    setError("");
    setMsg("");
    try {
      await http.delete(`${endpoints.properties}/${id}`);
      setMsg("Property deleted");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to delete property"));
    }
  };

  const downloadPortalExport = async () => {
    setError("");
    setMsg("");
    setDownloading(true);
    try {
      const res = await http.get(endpoints.propertyPortalExportCsv, {
        params: { format: exportFormat },
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `portal_export_${exportFormat}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setMsg("Portal CSV export downloaded");
    } catch (e) {
      setError(getApiError(e, "Failed to export portal CSV"));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="text-xl font-bold">Properties</div>
      <div className="text-sm text-slate-600">Auto ID, QR, gallery, brochure, and inventory controls</div>

      {canCreateProperty && (
        <form onSubmit={createProperty} className="mt-4 grid gap-2 md:grid-cols-6 surface-card p-3">
          <input
            className="border rounded-xl px-3 py-2 md:col-span-2"
            placeholder="Property title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <select className="border rounded-xl px-3 py-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPE_OPTIONS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <select className="border rounded-xl px-3 py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <input className="border rounded-xl px-3 py-2" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" placeholder="Area" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
          <input
            className="border rounded-xl px-3 py-2"
            placeholder="Base price"
            type="number"
            value={form.base_price}
            onChange={(e) => setForm({ ...form, base_price: e.target.value })}
          />
          <input
            className="border rounded-xl px-3 py-2 md:col-span-2"
            placeholder="Video URL (https://...)"
            value={form.video_link}
            onChange={(e) => setForm({ ...form, video_link: e.target.value })}
          />
          <input
            className="border rounded-xl px-3 py-2 md:col-span-2"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setForm({ ...form, images: Array.from(e.target.files || []) })}
          />
          <input
            className="border rounded-xl px-3 py-2"
            type="file"
            accept="application/pdf"
            onChange={(e) => setForm({ ...form, brochure: e.target.files?.[0] || null })}
          />
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60" disabled={saving}>
            {saving ? "Saving..." : "Add Property"}
          </button>
        </form>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-6">
        <input
          className="border rounded-xl px-3 py-2 md:col-span-2"
          placeholder="Search title/city/area/property id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="border rounded-xl px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          {STATUS_OPTIONS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select className="border rounded-xl px-3 py-2" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All type</option>
          {TYPE_OPTIONS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-white border" type="button" disabled={loading}>
          {loading ? "Loading..." : "Search"}
        </button>
      </div>

      {canExportPortal && (
        <div className="mt-3 flex items-center gap-2">
          <select className="border rounded-xl px-3 py-2" value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
            <option value="generic">Portal CSV (Generic)</option>
            <option value="magicbricks">Portal CSV (MagicBricks)</option>
            <option value="99acres">Portal CSV (99acres)</option>
          </select>
          <button
            type="button"
            className="px-3 py-2 rounded-xl bg-white border text-sm disabled:opacity-60"
            onClick={downloadPortalExport}
            disabled={downloading}
          >
            {downloading ? "Exporting..." : "Export Published Listings"}
          </button>
        </div>
      )}

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <div className="mt-6 surface-card overflow-hidden">
        <table className="modern-table">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="text-left p-3">Property UID</th>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">City</th>
              <th className="text-left p-3">Price</th>
              <th className="text-left p-3">Website</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 font-mono text-xs">{r.property_uid}</td>
                <td className="p-3">{r.title}</td>
                <td className="p-3">{r.type}</td>
                <td className="p-3">{r.status}</td>
                <td className="p-3">{r.city || "-"}</td>
                <td className="p-3">{formatCurrency(r.base_price)}</td>
                <td className="p-3">
                  <div className="flex gap-1 text-xs">
                    <span className={`px-2 py-1 rounded ${r.is_published ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-700"}`}>
                      {r.is_published ? "Published" : "Unpublished"}
                    </span>
                    {Boolean(r.is_featured) && <span className="px-2 py-1 rounded bg-amber-100 text-amber-700">Featured</span>}
                  </div>
                </td>
                <td className="p-3 space-x-3">
                  <Link className="text-slate-900 underline" to={`/app/properties/${r.id}`}>
                    View
                  </Link>
                  {canDeleteProperty && (
                    <button className="text-red-600" type="button" onClick={() => deleteProperty(r.id)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td className="p-6 text-slate-500" colSpan="8">
                  No properties found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
