import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { formatCurrency, getApiError } from "../../utils/ui.js";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function KPI({ title, value }) {
  return (
    <div className="surface-card p-4">
      <div className="text-xs text-slate-500">{title}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

export default function Reports() {
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await http.get(endpoints.reportsAnalyticsSummary, {
        params: { from: range.from, to: range.to },
      });
      setData(res.data.data || null);
    } catch (e) {
      setError(getApiError(e, "Failed to load analytics"));
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (format) => {
    setDownloading(true);
    setError("");
    try {
      const res = await http.get(endpoints.reportsAnalyticsExport, {
        params: { from: range.from, to: range.to, format },
        responseType: "blob",
      });
      const ext = format === "pdf" ? "pdf" : "xls";
      const mime = format === "pdf" ? "application/pdf" : "application/vnd.ms-excel";
      const blob = new Blob([res.data], { type: mime });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analytics_${range.from}_to_${range.to}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(getApiError(e, `Failed to export ${format.toUpperCase()}`));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xl font-bold">Reports & Analytics</div>
          <div className="text-sm text-slate-600">Inventory, funnel, source, agent, rent, maintenance and profitability dashboards</div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="text-xs text-slate-500">From</div>
            <input
              className="border rounded-xl px-3 py-2"
              type="date"
              value={range.from}
              onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-500">To</div>
            <input
              className="border rounded-xl px-3 py-2"
              type="date"
              value={range.to}
              onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            />
          </div>
          <button type="button" onClick={load} disabled={loading} className="px-3 py-2 rounded-xl bg-white border text-sm disabled:opacity-60">
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button type="button" onClick={() => download("pdf")} disabled={downloading} className="px-3 py-2 rounded-xl bg-white border text-sm disabled:opacity-60">
            Export PDF
          </button>
          <button type="button" onClick={() => download("excel")} disabled={downloading} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-60">
            Export Excel
          </button>
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <div className="mt-6 grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KPI title="Total Leads" value={data?.sales_funnel?.total_leads || 0} />
        <KPI title="Closed Leads" value={data?.sales_funnel?.closed_leads || 0} />
        <KPI title="Funnel Conversion" value={`${data?.sales_funnel?.conversion_pct || 0}%`} />
        <KPI title="Rent Due" value={formatCurrency(data?.rent_due_vs_paid?.due_total || 0)} />
        <KPI title="Rent Paid" value={formatCurrency(data?.rent_due_vs_paid?.paid_total || 0)} />
        <KPI title="Maintenance Cost" value={formatCurrency(data?.maintenance_cost_stats?.actual_cost || 0)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <div className="font-semibold">Inventory Summary By Status (Properties)</div>
          <ul className="mt-3 text-sm space-y-1">
            {(data?.inventory_summary?.properties_by_status || []).map((r, i) => (
              <li key={i} className="flex justify-between border-b py-2">
                <span>{r.status}</span><span className="font-semibold">{r.count}</span>
              </li>
            ))}
            {!data?.inventory_summary?.properties_by_status?.length && <li className="text-slate-500">No data.</li>}
          </ul>
        </div>

        <div className="surface-card p-4">
          <div className="font-semibold">Inventory Summary By Status (Units)</div>
          <ul className="mt-3 text-sm space-y-1">
            {(data?.inventory_summary?.units_by_status || []).map((r, i) => (
              <li key={i} className="flex justify-between border-b py-2">
                <span>{r.status}</span><span className="font-semibold">{r.count}</span>
              </li>
            ))}
            {!data?.inventory_summary?.units_by_status?.length && <li className="text-slate-500">No data.</li>}
          </ul>
        </div>
      </div>

      <div className="mt-6 surface-card p-4">
        <div className="font-semibold">Sales Funnel Conversion</div>
        <div className="mt-3 grid gap-2 md:grid-cols-3 text-sm">
          {(data?.sales_funnel?.by_stage || []).map((r, i) => (
            <div key={i} className="border rounded-lg p-2 flex items-center justify-between">
              <span>{r.stage}</span>
              <span className="font-semibold">{r.count}</span>
            </div>
          ))}
          {!data?.sales_funnel?.by_stage?.length && <div className="text-slate-500">No data.</div>}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="surface-card overflow-hidden">
          <div className="p-4 font-semibold">Source Performance</div>
          <table className="modern-table">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="p-3 text-left">Source</th>
                <th className="p-3 text-left">Leads</th>
                <th className="p-3 text-left">Conversions</th>
                <th className="p-3 text-left">Conversion %</th>
              </tr>
            </thead>
            <tbody>
              {(data?.source_performance || []).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{r.source}</td>
                  <td className="p-3">{r.lead_count}</td>
                  <td className="p-3">{r.conversions}</td>
                  <td className="p-3">{r.conversion_pct}%</td>
                </tr>
              ))}
              {!data?.source_performance?.length && <tr><td className="p-6 text-slate-500" colSpan="4">No data.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="surface-card overflow-hidden">
          <div className="p-4 font-semibold">Agent Performance</div>
          <table className="modern-table">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="p-3 text-left">Agent</th>
                <th className="p-3 text-left">Visits</th>
                <th className="p-3 text-left">Bookings</th>
                <th className="p-3 text-left">Closures</th>
              </tr>
            </thead>
            <tbody>
              {(data?.agent_performance || []).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-3">{r.agent_name}</td>
                  <td className="p-3">{r.site_visits}</td>
                  <td className="p-3">{r.bookings}</td>
                  <td className="p-3">{r.closures}</td>
                </tr>
              ))}
              {!data?.agent_performance?.length && <tr><td className="p-6 text-slate-500" colSpan="4">No data.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-4">
          <div className="font-semibold">Rent Due vs Paid</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span>Schedules</span><span className="font-semibold">{data?.rent_due_vs_paid?.schedule_count || 0}</span></div>
            <div className="flex justify-between"><span>Due Total</span><span className="font-semibold">{formatCurrency(data?.rent_due_vs_paid?.due_total || 0)}</span></div>
            <div className="flex justify-between"><span>Paid Total</span><span className="font-semibold">{formatCurrency(data?.rent_due_vs_paid?.paid_total || 0)}</span></div>
            <div className="flex justify-between"><span>Outstanding</span><span className="font-semibold">{formatCurrency(data?.rent_due_vs_paid?.outstanding_total || 0)}</span></div>
            <div className="flex justify-between"><span>Overdue Count</span><span className="font-semibold">{data?.rent_due_vs_paid?.overdue_count || 0}</span></div>
          </div>
        </div>

        <div className="surface-card p-4">
          <div className="font-semibold">Maintenance Cost Stats</div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><span>Tickets</span><span className="font-semibold">{data?.maintenance_cost_stats?.ticket_count || 0}</span></div>
            <div className="flex justify-between"><span>Estimated Cost</span><span className="font-semibold">{formatCurrency(data?.maintenance_cost_stats?.estimated_cost || 0)}</span></div>
            <div className="flex justify-between"><span>Actual Cost</span><span className="font-semibold">{formatCurrency(data?.maintenance_cost_stats?.actual_cost || 0)}</span></div>
            <div className="flex justify-between"><span>Avg Actual</span><span className="font-semibold">{formatCurrency(data?.maintenance_cost_stats?.avg_actual_cost || 0)}</span></div>
            <div className="flex justify-between"><span>Open/In Progress</span><span className="font-semibold">{(data?.maintenance_cost_stats?.open_count || 0) + (data?.maintenance_cost_stats?.in_progress_count || 0)}</span></div>
          </div>
        </div>
      </div>

      <div className="mt-6 surface-card overflow-hidden">
        <div className="p-4 font-semibold">Property Profitability</div>
        <table className="modern-table">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="p-3 text-left">Property</th>
              <th className="p-3 text-left">Revenue</th>
              <th className="p-3 text-left">Cost</th>
              <th className="p-3 text-left">Net Profit</th>
              <th className="p-3 text-left">Margin %</th>
            </tr>
          </thead>
          <tbody>
            {(data?.property_profitability || []).slice(0, 30).map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-3">
                  <div className="font-mono text-xs">{r.property_uid}</div>
                  <div>{r.title}</div>
                </td>
                <td className="p-3">{formatCurrency(r.gross_revenue)}</td>
                <td className="p-3">{formatCurrency(r.total_cost)}</td>
                <td className="p-3">{formatCurrency(r.net_profit)}</td>
                <td className="p-3">{r.margin_pct}%</td>
              </tr>
            ))}
            {!data?.property_profitability?.length && (
              <tr><td className="p-6 text-slate-500" colSpan="5">No profitability data in selected range.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
