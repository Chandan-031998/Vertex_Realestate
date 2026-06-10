import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { getApiError } from "../../utils/ui.js";

const initialForm = {
  app_name: "",
  company_name: "",
  company_legal_name: "",
  company_email: "",
  company_phone: "",
  company_website: "",
  company_address: "",
  company_gst: "",
  theme_mode: "light",
  ui_style: "comfortable",
  sidebar_style: "default",
  primary_color: "#0f172a",
  accent_color: "#334155",
};

export default function AppSettings() {
  const [form, setForm] = useState(initialForm);
  const [logoFile, setLogoFile] = useState(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await http.get(endpoints.appSettings);
      const d = res.data.data || {};
      setForm({
        app_name: d.app_name || "",
        company_name: d.company_name || "",
        company_legal_name: d.company_legal_name || "",
        company_email: d.company_email || "",
        company_phone: d.company_phone || "",
        company_website: d.company_website || "",
        company_address: d.company_address || "",
        company_gst: d.company_gst || "",
        theme_mode: d.theme_mode || "light",
        ui_style: d.ui_style || "comfortable",
        sidebar_style: d.sidebar_style || "default",
        primary_color: d.primary_color || "#0f172a",
        accent_color: d.accent_color || "#334155",
      });
      setLogoUrl(d.logo_url || "");
    } catch (e) {
      setError(getApiError(e, "Failed to load application settings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return undefined;
    }
    const u = URL.createObjectURL(logoFile);
    setLogoPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [logoFile]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v ?? "")));
      if (logoFile) fd.append("logo", logoFile);
      await http.put(endpoints.appSettings, fd);
      setMsg("Application branding and theme updated");
      setLogoFile(null);
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="text-xl font-bold">Admin Settings</div>
      <div className="text-sm text-slate-600">Customize app name, theme, style, colors, logo and company details</div>

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-3 text-sm text-green-700">{msg}</div>}

      <form onSubmit={save} className="mt-4 bg-white border rounded-2xl p-4 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2 text-sm font-semibold">Branding</div>
        <input className="border rounded-xl px-3 py-2" placeholder="Application Name" value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Company Name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
        <input className="border rounded-xl px-3 py-2 md:col-span-2" placeholder="Legal Company Name" value={form.company_legal_name} onChange={(e) => setForm({ ...form, company_legal_name: e.target.value })} />

        <div className="md:col-span-2 text-sm font-semibold mt-2">Theme & Style</div>
        <select className="border rounded-xl px-3 py-2" value={form.theme_mode} onChange={(e) => setForm({ ...form, theme_mode: e.target.value })}>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <select className="border rounded-xl px-3 py-2" value={form.ui_style} onChange={(e) => setForm({ ...form, ui_style: e.target.value })}>
          <option value="comfortable">Comfortable</option>
          <option value="compact">Compact</option>
        </select>
        <select className="border rounded-xl px-3 py-2" value={form.sidebar_style} onChange={(e) => setForm({ ...form, sidebar_style: e.target.value })}>
          <option value="default">Default</option>
          <option value="solid">Solid Brand</option>
          <option value="minimal">Minimal</option>
        </select>
        <label className="border rounded-xl px-3 py-2 flex items-center justify-between gap-3">
          <span className="text-sm">Primary Color</span>
          <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
        </label>
        <label className="border rounded-xl px-3 py-2 flex items-center justify-between gap-3">
          <span className="text-sm">Accent Color</span>
          <input type="color" value={form.accent_color} onChange={(e) => setForm({ ...form, accent_color: e.target.value })} />
        </label>

        <div className="md:col-span-2 text-sm font-semibold mt-2">Logo</div>
        <input className="border rounded-xl px-3 py-2 md:col-span-2" type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
        {(logoUrl || logoPreview) && (
          <div className="md:col-span-2">
            <img
              src={logoPreview || logoUrl}
              alt="Company Logo"
              className="h-16 w-auto border rounded p-1 bg-white"
            />
          </div>
        )}

        <div className="md:col-span-2 text-sm font-semibold mt-2">Company Details</div>
        <input className="border rounded-xl px-3 py-2" placeholder="Company Email" value={form.company_email} onChange={(e) => setForm({ ...form, company_email: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Company Phone" value={form.company_phone} onChange={(e) => setForm({ ...form, company_phone: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="Company Website" value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })} />
        <input className="border rounded-xl px-3 py-2" placeholder="GST Number" value={form.company_gst} onChange={(e) => setForm({ ...form, company_gst: e.target.value })} />
        <textarea className="border rounded-xl px-3 py-2 md:col-span-2 min-h-24" placeholder="Company Address" value={form.company_address} onChange={(e) => setForm({ ...form, company_address: e.target.value })} />

        <div className="md:col-span-2 flex gap-2">
          <button className="px-4 py-2 rounded-xl bg-slate-900 text-white disabled:opacity-60" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button type="button" className="px-4 py-2 rounded-xl border bg-white" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </form>
    </div>
  );
}
