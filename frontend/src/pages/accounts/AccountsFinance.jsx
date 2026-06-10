import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, getApiError } from "../../utils/ui.js";

const coaInitial = {
  account_code: "",
  account_name: "",
  account_type: "Asset",
  parent_code: "",
  vertex_account_code: "",
};

export default function AccountsFinance() {
  const [coaRows, setCoaRows] = useState([]);
  const [journalRows, setJournalRows] = useState([]);
  const [journalLines, setJournalLines] = useState([]);
  const [selectedJournalId, setSelectedJournalId] = useState(null);

  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [pl, setPl] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [arap, setArap] = useState(null);

  const [coaForm, setCoaForm] = useState(coaInitial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const loadCore = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [coaRes, jrRes] = await Promise.all([
        http.get(endpoints.accountsCoa),
        http.get(endpoints.accountsJournals),
      ]);
      const jr = jrRes.data.data || [];
      setCoaRows(coaRes.data.data || []);
      setJournalRows(jr);
      if (!selectedJournalId && jr[0]) setSelectedJournalId(jr[0].id);
    } catch (e) {
      setError(getApiError(e, "Failed to load accounts"));
    } finally {
      setLoading(false);
    }
  }, [selectedJournalId]);

  const loadReports = useCallback(async () => {
    try {
      const [plRes, cfRes, aaRes] = await Promise.all([
        http.get(endpoints.accountsPl, { params: { month } }),
        http.get(endpoints.accountsCashflow, { params: { month } }),
        http.get(endpoints.accountsArAp),
      ]);
      setPl(plRes.data.data || null);
      setCashflow(cfRes.data.data || null);
      setArap(aaRes.data.data || null);
    } catch (e) {
      setError(getApiError(e, "Failed to load finance reports"));
    }
  }, [month]);

  useEffect(() => {
    loadCore();
  }, [loadCore]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    if (!selectedJournalId) {
      setJournalLines([]);
      return;
    }
    http.get(endpoints.accountsJournalLines(selectedJournalId)).then((r) => setJournalLines(r.data.data || [])).catch(() => setJournalLines([]));
  }, [selectedJournalId]);

  const upsertCoa = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!coaForm.account_code || !coaForm.account_name) return setError("Account code/name required");
    try {
      await http.post(endpoints.accountsCoa, coaForm);
      setMsg("Chart of account updated");
      setCoaForm(coaInitial);
      await loadCore();
    } catch (e2) {
      setError(getApiError(e2, "Failed to save chart account"));
    }
  };

  return (
    <div>
      <div className="text-xl font-bold">Accounts & Finance Integration</div>
      <div className="text-sm text-slate-600">Chart of Accounts, auto journals, and P&L/Cashflow/AR-AP reports</div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
      {msg && <div className="mt-4 text-sm text-green-700">{msg}</div>}

      <form onSubmit={upsertCoa} className="mt-4 grid gap-2 md:grid-cols-6 bg-white border rounded-2xl p-3">
        <div className="md:col-span-6 text-sm font-semibold">Chart of Accounts (Vertex Accounts Link)</div>
        <input className="border rounded px-2 py-1" placeholder="Account Code" value={coaForm.account_code} onChange={(e) => setCoaForm({ ...coaForm, account_code: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Account Name" value={coaForm.account_name} onChange={(e) => setCoaForm({ ...coaForm, account_name: e.target.value })} />
        <select className="border rounded px-2 py-1" value={coaForm.account_type} onChange={(e) => setCoaForm({ ...coaForm, account_type: e.target.value })}>
          <option>Asset</option><option>Liability</option><option>Income</option><option>Expense</option><option>Equity</option>
        </select>
        <input className="border rounded px-2 py-1" placeholder="Parent Code" value={coaForm.parent_code} onChange={(e) => setCoaForm({ ...coaForm, parent_code: e.target.value })} />
        <input className="border rounded px-2 py-1" placeholder="Vertex Account Code" value={coaForm.vertex_account_code} onChange={(e) => setCoaForm({ ...coaForm, vertex_account_code: e.target.value })} />
        <button className="px-2 py-1 rounded bg-slate-900 text-white text-sm">Save COA</button>
      </form>

      <div className="mt-4 bg-white border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50"><tr><th className="p-3 text-left">Code</th><th className="p-3 text-left">Name</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Vertex Code</th></tr></thead>
          <tbody>
            {coaRows.map((c) => (
              <tr key={c.id} className="border-t"><td className="p-3 font-mono text-xs">{c.account_code}</td><td className="p-3">{c.account_name}</td><td className="p-3">{c.account_type}</td><td className="p-3">{c.vertex_account_code || "-"}</td></tr>
            ))}
            {!coaRows.length && !loading && <tr><td className="p-6 text-slate-500" colSpan="4">No chart accounts.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid lg:grid-cols-3 gap-4">
        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Journals (Auto-post)</div>
          <div className="space-y-2 mt-2 text-sm max-h-80 overflow-auto">
            {journalRows.map((j) => (
              <button key={j.id} className={`w-full text-left border rounded p-2 ${selectedJournalId === j.id ? "border-slate-900" : ""}`} onClick={() => setSelectedJournalId(j.id)} type="button">
                <div className="font-mono text-xs">{j.journal_no}</div>
                <div>{j.source_type} #{j.source_id || "-"}</div>
                <div className="text-xs text-slate-500">{j.txn_date}</div>
              </button>
            ))}
            {!journalRows.length && <div className="text-slate-500">No journals yet.</div>}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Journal Lines</div>
          <div className="space-y-1 mt-2 text-sm max-h-80 overflow-auto">
            {journalLines.map((l) => (
              <div key={l.id} className="border rounded p-2">
                <div className="font-mono text-xs">{l.account_code}</div>
                <div>DR {formatCurrency(l.dr_amount)} | CR {formatCurrency(l.cr_amount)}</div>
                <div className="text-xs text-slate-500">{l.line_note || "-"}</div>
              </div>
            ))}
            {!journalLines.length && <div className="text-slate-500">Select journal to view lines.</div>}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-3">
          <div className="font-semibold text-sm">Finance Reports</div>
          <div className="mt-2 flex gap-2">
            <input className="border rounded px-2 py-1" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            <button className="border rounded px-2 py-1" type="button" onClick={loadReports}>Refresh</button>
          </div>

          <div className="mt-3 text-sm border rounded p-2">
            <div className="font-semibold">P&L ({pl?.month || month})</div>
            <div>Income: {formatCurrency(pl?.total_income || 0)}</div>
            <div>Expense: {formatCurrency(pl?.total_expense || 0)}</div>
            <div className="font-semibold">Net Profit: {formatCurrency(pl?.net_profit || 0)}</div>
          </div>

          <div className="mt-2 text-sm border rounded p-2">
            <div className="font-semibold">Cashflow ({cashflow?.month || month})</div>
            <div>Net Cashflow: {formatCurrency(cashflow?.net_cashflow || 0)}</div>
          </div>

          <div className="mt-2 text-sm border rounded p-2">
            <div className="font-semibold">AR/AP</div>
            <div>Accounts Receivable: {formatCurrency(arap?.accounts_receivable || 0)}</div>
            <div>Accounts Payable: {formatCurrency(arap?.accounts_payable || 0)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
