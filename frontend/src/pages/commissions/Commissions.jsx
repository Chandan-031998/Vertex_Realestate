import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, getApiError } from "../../utils/ui.js";

const initialRule = {
  agent_id: "",
  rule_type: "Percent",
  percentage_rate: "",
  fixed_amount: "",
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: "",
};

const initialSplitForm = {
  booking_id: "",
  splits: [{ agent_id: "", share_type: "Percent", share_value: "", note: "" }],
};

const initialPayout = {
  agent_id: "",
  period_from: "",
  period_to: "",
};

export default function Commissions() {
  const [agents, setAgents] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rules, setRules] = useState([]);
  const [splits, setSplits] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [dashboardRows, setDashboardRows] = useState([]);

  const [ruleForm, setRuleForm] = useState(initialRule);
  const [splitForm, setSplitForm] = useState(initialSplitForm);
  const [payoutForm, setPayoutForm] = useState(initialPayout);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [a, b, r, s, p, d] = await Promise.all([
        http.get(endpoints.commissionAgents),
        http.get(endpoints.bookings),
        http.get(endpoints.commissionRules),
        http.get(endpoints.commissionSplits),
        http.get(endpoints.commissionPayouts),
        http.get(endpoints.commissionDashboard),
      ]);
      setAgents(a.data.data || []);
      setBookings(b.data.data || []);
      setRules(r.data.data || []);
      setSplits(s.data.data || []);
      setPayouts(p.data.data || []);
      setDashboardRows(d.data.data || []);
    } catch (e) {
      setError(getApiError(e, "Failed to load commission module"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveRule = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!ruleForm.agent_id) return setError("Agent is required");
    try {
      await http.post(endpoints.commissionRules, {
        ...ruleForm,
        agent_id: Number(ruleForm.agent_id),
        percentage_rate: Number(ruleForm.percentage_rate || 0),
        fixed_amount: Number(ruleForm.fixed_amount || 0),
      });
      setMsg("Commission rule saved");
      setRuleForm(initialRule);
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to save rule"));
    }
  };

  const setSplitRow = (idx, key, value) => {
    setSplitForm((prev) => ({
      ...prev,
      splits: prev.splits.map((s, i) => (i === idx ? { ...s, [key]: value } : s)),
    }));
  };

  const addSplitRow = () => {
    setSplitForm((prev) => ({
      ...prev,
      splits: [...prev.splits, { agent_id: "", share_type: "Percent", share_value: "", note: "" }],
    }));
  };

  const removeSplitRow = (idx) => {
    setSplitForm((prev) => ({
      ...prev,
      splits: prev.splits.filter((_, i) => i !== idx),
    }));
  };

  const saveSplits = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!splitForm.booking_id) return setError("Booking is required");
    const clean = splitForm.splits
      .filter((s) => s.agent_id && s.share_value)
      .map((s) => ({
        agent_id: Number(s.agent_id),
        share_type: s.share_type,
        share_value: Number(s.share_value),
        note: s.note || null,
      }));
    if (!clean.length) return setError("At least one split row is required");

    try {
      await http.post(endpoints.commissionSplits, {
        booking_id: Number(splitForm.booking_id),
        splits: clean,
      });
      setMsg("Commission split saved");
      setSplitForm(initialSplitForm);
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to save split"));
    }
  };

  const createPayout = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!payoutForm.agent_id) return setError("Agent is required");
    try {
      await http.post(endpoints.commissionPayouts, {
        agent_id: Number(payoutForm.agent_id),
        period_from: payoutForm.period_from || null,
        period_to: payoutForm.period_to || null,
      });
      setMsg("Payout created");
      setPayoutForm(initialPayout);
      await load();
    } catch (e2) {
      setError(getApiError(e2, "Failed to create payout"));
    }
  };

  const approveSplit = async (id) => {
    try {
      await http.post(endpoints.commissionSplitApprove(id));
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to approve split"));
    }
  };

  const paySplit = async (id) => {
    try {
      await http.post(endpoints.commissionSplitPaid(id));
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to mark split paid"));
    }
  };

  const approvePayout = async (id) => {
    try {
      await http.post(endpoints.commissionPayoutApprove(id));
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to approve payout"));
    }
  };

  const payPayout = async (id) => {
    try {
      await http.post(endpoints.commissionPayoutPaid(id), { payment_mode: "Bank Transfer" });
      await load();
    } catch (e) {
      setError(getApiError(e, "Failed to mark payout paid"));
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xl font-bold">Agent Commission</div>
          <div className="text-sm text-slate-600">Rules, split commissions, payout approvals, and performance dashboard</div>
        </div>
        <button className="px-3 py-2 rounded-xl bg-white border text-sm" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <form onSubmit={saveRule} className="bg-white border rounded-2xl p-4 grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold">Commission Rule Per Agent</div>
          <select className="border rounded-xl px-3 py-2" value={ruleForm.agent_id} onChange={(e) => setRuleForm({ ...ruleForm, agent_id: e.target.value })}>
            <option value="">Select agent</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
          </select>
          <select className="border rounded-xl px-3 py-2" value={ruleForm.rule_type} onChange={(e) => setRuleForm({ ...ruleForm, rule_type: e.target.value })}>
            <option value="Percent">Percent</option>
            <option value="Fixed">Fixed</option>
          </select>
          <input className="border rounded-xl px-3 py-2" type="number" step="0.01" placeholder="Percent rate" value={ruleForm.percentage_rate} onChange={(e) => setRuleForm({ ...ruleForm, percentage_rate: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" type="number" step="0.01" placeholder="Fixed amount" value={ruleForm.fixed_amount} onChange={(e) => setRuleForm({ ...ruleForm, fixed_amount: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" type="date" value={ruleForm.effective_from} onChange={(e) => setRuleForm({ ...ruleForm, effective_from: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" type="date" value={ruleForm.effective_to} onChange={(e) => setRuleForm({ ...ruleForm, effective_to: e.target.value })} />
          <button className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Save Rule</button>
        </form>

        <form onSubmit={createPayout} className="bg-white border rounded-2xl p-4 grid gap-2 md:grid-cols-2">
          <div className="md:col-span-2 font-semibold">Payout Approvals</div>
          <select className="border rounded-xl px-3 py-2" value={payoutForm.agent_id} onChange={(e) => setPayoutForm({ ...payoutForm, agent_id: e.target.value })}>
            <option value="">Select agent</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="text-xs text-slate-500 flex items-center">Creates payout from approved, unpaid split commissions.</div>
          <input className="border rounded-xl px-3 py-2" type="date" value={payoutForm.period_from} onChange={(e) => setPayoutForm({ ...payoutForm, period_from: e.target.value })} />
          <input className="border rounded-xl px-3 py-2" type="date" value={payoutForm.period_to} onChange={(e) => setPayoutForm({ ...payoutForm, period_to: e.target.value })} />
          <button className="md:col-span-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Create Payout Batch</button>
        </form>
      </div>

      <form onSubmit={saveSplits} className="mt-4 bg-white border rounded-2xl p-4">
        <div className="font-semibold">Split Commission (Multi-Agent)</div>
        <div className="grid gap-2 md:grid-cols-4 mt-2">
          <select className="border rounded-xl px-3 py-2 md:col-span-2" value={splitForm.booking_id} onChange={(e) => setSplitForm({ ...splitForm, booking_id: e.target.value })}>
            <option value="">Select booking</option>
            {bookings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.booking_uid} | Token {formatCurrency(b.token_amount)} | {b.status}
              </option>
            ))}
          </select>
          <button className="px-3 py-2 rounded-xl border" type="button" onClick={addSplitRow}>Add Split Row</button>
          <button className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Save Splits</button>
        </div>

        <div className="mt-3 space-y-2">
          {splitForm.splits.map((s, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-5">
              <select className="border rounded-xl px-3 py-2" value={s.agent_id} onChange={(e) => setSplitRow(idx, "agent_id", e.target.value)}>
                <option value="">Agent</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select className="border rounded-xl px-3 py-2" value={s.share_type} onChange={(e) => setSplitRow(idx, "share_type", e.target.value)}>
                <option value="Percent">Percent</option>
                <option value="Fixed">Fixed</option>
              </select>
              <input className="border rounded-xl px-3 py-2" type="number" step="0.01" placeholder="Share value" value={s.share_value} onChange={(e) => setSplitRow(idx, "share_value", e.target.value)} />
              <input className="border rounded-xl px-3 py-2" placeholder="Note" value={s.note} onChange={(e) => setSplitRow(idx, "note", e.target.value)} />
              <button className="px-3 py-2 rounded-xl border" type="button" onClick={() => removeSplitRow(idx)}>Remove</button>
            </div>
          ))}
        </div>
      </form>

      <div className="mt-4 bg-white border rounded-2xl overflow-hidden">
        <div className="p-4 font-semibold">Payout History</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Payout No</th>
              <th className="p-3 text-left">Agent</th>
              <th className="p-3 text-left">Amount</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3 font-mono text-xs">{p.payout_no}</td>
                <td className="p-3">{p.agent_name || p.agent_id}</td>
                <td className="p-3">{formatCurrency(p.total_amount)}</td>
                <td className="p-3">{p.status}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button type="button" className="px-2 py-1 rounded border" onClick={() => approvePayout(p.id)}>Approve</button>
                    <button type="button" className="px-2 py-1 rounded border" onClick={() => payPayout(p.id)}>Mark Paid</button>
                  </div>
                </td>
              </tr>
            ))}
            {!payouts.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="5">No payouts yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="p-4 font-semibold">Commission Splits</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left">Booking</th>
                <th className="p-3 text-left">Agent</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {splits.slice(0, 20).map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-mono text-xs">{s.booking_uid || s.booking_id}</td>
                  <td className="p-3">{s.agent_name || s.agent_id}</td>
                  <td className="p-3">{formatCurrency(s.commission_amount)}</td>
                  <td className="p-3">{s.status}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button type="button" className="px-2 py-1 rounded border" onClick={() => approveSplit(s.id)}>Approve</button>
                      <button type="button" className="px-2 py-1 rounded border" onClick={() => paySplit(s.id)}>Paid</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!splits.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="5">No splits found.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="bg-white border rounded-2xl overflow-hidden">
          <div className="p-4 font-semibold">Agent Performance Dashboard</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="p-3 text-left">Agent</th>
                <th className="p-3 text-left">Visits</th>
                <th className="p-3 text-left">Bookings</th>
                <th className="p-3 text-left">Closures</th>
                <th className="p-3 text-left">Paid Comm.</th>
              </tr>
            </thead>
            <tbody>
              {dashboardRows.map((r) => (
                <tr key={r.agent_id} className="border-t">
                  <td className="p-3">{r.agent_name}</td>
                  <td className="p-3">{r.site_visits}</td>
                  <td className="p-3">{r.bookings}</td>
                  <td className="p-3">{r.closures}</td>
                  <td className="p-3">{formatCurrency(r.commission_paid)}</td>
                </tr>
              ))}
              {!dashboardRows.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="5">No performance data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 bg-white border rounded-2xl overflow-hidden">
        <div className="p-4 font-semibold">Current Commission Rules</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 text-left">Agent</th>
              <th className="p-3 text-left">Rule Type</th>
              <th className="p-3 text-left">Percent</th>
              <th className="p-3 text-left">Fixed</th>
              <th className="p-3 text-left">Effective</th>
              <th className="p-3 text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.agent_name || r.agent_id}</td>
                <td className="p-3">{r.rule_type}</td>
                <td className="p-3">{r.percentage_rate}%</td>
                <td className="p-3">{formatCurrency(r.fixed_amount)}</td>
                <td className="p-3">{r.effective_from} {r.effective_to ? `to ${r.effective_to}` : ""}</td>
                <td className="p-3">{r.is_active ? "Yes" : "No"}</td>
              </tr>
            ))}
            {!rules.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="6">No commission rules found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
