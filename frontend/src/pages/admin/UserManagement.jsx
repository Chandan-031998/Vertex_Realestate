import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { getApiError } from "../../utils/ui.js";
import { getUser } from "../../store/auth.store.js";

const ROLES = ["Admin", "Sales Manager", "Sales Agent", "Accounts", "Legal", "Property Manager"];
const createInitial = { name: "", email: "", password: "", role: "Sales Agent" };

export default function UserManagement() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState(createInitial);
  const [resetPasswords, setResetPasswords] = useState({});
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const me = getUser();
  const isAdmin = me?.role === "Admin";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await http.get(endpoints.users);
      setRows(res.data.data || []);
    } catch (e) {
      setError(getApiError(e, "Failed to load users"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const createUser = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");

    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.password) {
      setError("Name, email and password are required");
      return;
    }

    setSaving(true);
    try {
      await http.post(endpoints.register, createForm);
      setCreateForm(createInitial);
      setMsg("User created");
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create user"));
    } finally {
      setSaving(false);
    }
  };

  const updateRole = async (id, role) => {
    setError("");
    setMsg("");
    try {
      await http.patch(`${endpoints.users}/${id}/role`, { role });
      setMsg("User role updated");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to update role"));
    }
  };

  const toggleUser = async (id) => {
    setError("");
    setMsg("");
    try {
      await http.patch(`${endpoints.users}/${id}/toggle`);
      setMsg("User status updated");
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to update user status"));
    }
  };

  const resetPassword = async (id) => {
    const newPassword = (resetPasswords[id] || "").trim();
    setError("");
    setMsg("");
    try {
      const res = await http.patch(`${endpoints.users}/${id}/reset-password`, {
        new_password: newPassword || undefined,
      });
      const temp = res?.data?.data?.temporary_password;
      setMsg(temp ? `Temporary password: ${temp}` : "Password reset successful");
      setResetPasswords((prev) => ({ ...prev, [id]: "" }));
    } catch (e) {
      setError(getApiError(e, "Failed to reset password"));
    }
  };

  if (!isAdmin) {
    return (
      <div>
        <div className="text-xl font-bold">User & Role Management</div>
        <div className="mt-4 text-sm text-red-600">Only Admin can access this module.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-xl font-bold">User & Role Management</div>
      <div className="text-sm text-slate-600">Create users, assign roles, deactivate/activate, reset passwords</div>

      <form onSubmit={createUser} className="mt-4 grid gap-2 md:grid-cols-5 bg-white border rounded-2xl p-3">
        <input
          className="border rounded-xl px-3 py-2"
          placeholder="Name"
          value={createForm.name}
          onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
        />
        <input
          className="border rounded-xl px-3 py-2"
          type="email"
          placeholder="Email"
          value={createForm.email}
          onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
        />
        <input
          className="border rounded-xl px-3 py-2"
          type="password"
          placeholder="Password"
          value={createForm.password}
          onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
        />
        <select
          className="border rounded-xl px-3 py-2"
          value={createForm.role}
          onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
        >
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60" disabled={saving}>
          {saving ? "Saving..." : "Create User"}
        </button>
      </form>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={load} type="button" className="px-4 py-2 rounded-xl bg-white border" disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
        <div className="text-xs text-slate-500">Module-wise permission assignment API is not yet implemented in backend.</div>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <div className="mt-6 bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t align-top">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <select
                    className="border rounded-lg px-2 py-1"
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                  >
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">{u.is_active ? "Active" : "Inactive"}</td>
                <td className="p-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg bg-slate-100"
                      onClick={() => toggleUser(u.id)}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <input
                      className="border rounded-lg px-2 py-1"
                      type="password"
                      placeholder="New password"
                      value={resetPasswords[u.id] || ""}
                      onChange={(e) =>
                        setResetPasswords((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="px-3 py-1 rounded-lg bg-slate-900 text-white"
                      onClick={() => resetPassword(u.id)}
                    >
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length && !loading && (
              <tr>
                <td className="p-6 text-slate-500" colSpan="5">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
