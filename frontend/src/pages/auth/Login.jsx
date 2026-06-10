import React, { useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { setAuth } from "../../store/auth.store.js";
import { useNavigate, Link } from "react-router-dom";
import { getApiError } from "../../utils/ui.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Toast from "../../components/ui/Toast.jsx";

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: "admin@vertex.local", password: "Admin@123" });
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!form.email.trim() || !form.password) return setErr("Email and password are required");
    setLoading(true);
    try {
      const res = await http.post(endpoints.login, form);
      setAuth(res.data.data.token, res.data.data.user);
      nav("/app");
    } catch (e2) {
      setErr(getApiError(e2, "Login failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-6 flex items-center justify-center">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-6 items-stretch">
        <section className="surface-card p-8 md:p-10 hidden lg:flex flex-col justify-between min-h-[620px] animate-lift-in">
          <div>
            <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundImage: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent), var(--brand-teal))" }}>
              Vertex ERP Premium
            </div>
            <h1 className="text-5xl font-bold mt-5 leading-tight">
              Real Estate Operations,
              <span className="block mt-1" style={{ color: "var(--brand-accent)" }}>refined for speed.</span>
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mt-4 text-base">
              Pipeline, inventory, legal, rentals, billing, and analytics in one modern cockpit.
            </p>
          </div>
          <div className="h-56 rounded-3xl border border-white/30" style={{ backgroundImage: "linear-gradient(135deg, rgba(59,130,246,.35), rgba(139,92,246,.28), rgba(20,184,166,.28))" }} />
        </section>

        <div className="flex items-center justify-center animate-fade-slide">
          <Card className="w-full max-w-md p-8 md:p-9" title="Welcome Back" subtitle="Sign in to Vertex ERP - Real Estate Module">
          {err ? <Toast tone="error">{err}</Toast> : null}
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <label className="block">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
              <input className="modern-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
            <label className="block">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Password</div>
              <input className="modern-input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </label>
            <Button type="submit" className="w-full">{loading ? "Logging in..." : "Login"}</Button>
          </form>
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            No account? <Link className="font-semibold" style={{ color: "var(--brand-primary)" }} to="/register">Register</Link>
          </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
