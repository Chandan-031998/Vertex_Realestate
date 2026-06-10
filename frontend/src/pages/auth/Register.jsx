import React, { useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { Link, useNavigate } from "react-router-dom";
import { getApiError } from "../../utils/ui.js";
import Card from "../../components/ui/Card.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import Toast from "../../components/ui/Toast.jsx";

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "Sales Agent" });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!form.name.trim() || !form.email.trim() || !form.password) return setErr("Name, email, and password are required");
    setLoading(true);
    try {
      await http.post(endpoints.register, form);
      setMsg("Registered successfully. Redirecting to login...");
      setTimeout(() => nav("/login"), 700);
    } catch (e2) {
      setErr(getApiError(e2, "Register failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 p-4 gap-4">
      <section className="surface-card p-8 hidden lg:flex flex-col justify-between animate-lift-in">
        <div>
          <div className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundImage: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent), var(--brand-teal))" }}>
            Premium Workspace
          </div>
          <h1 className="text-4xl font-bold mt-4 leading-tight">Set up your team,
            <span className="block" style={{ color: "var(--brand-primary)" }}>run operations end-to-end.</span>
          </h1>
        </div>
        <div className="h-60 rounded-3xl" style={{ backgroundImage: "linear-gradient(135deg, rgba(20,184,166,.30), rgba(59,130,246,.28), rgba(139,92,246,.32))" }} />
      </section>

      <div className="flex items-center justify-center animate-fade-slide">
        <Card className="w-full max-w-md p-8" title="Create Account" subtitle="Join Vertex ERP">
          {err ? <Toast tone="error">{err}</Toast> : null}
          {msg ? <Toast tone="success">{msg}</Toast> : null}

          <form className="mt-4 space-y-3" onSubmit={submit}>
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select className="modern-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option>Admin</option>
              <option>Sales Manager</option>
              <option>Sales Agent</option>
              <option>Accounts</option>
              <option>Legal</option>
              <option>Property Manager</option>
            </select>
            <Button type="submit" className="w-full">{loading ? "Creating account..." : "Create account"}</Button>
          </form>

          <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            Have an account? <Link className="font-semibold" style={{ color: "var(--brand-primary)" }} to="/login">Login</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
