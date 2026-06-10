import React, { useCallback, useEffect, useState } from "react";
import { http } from "../../api/http.js";
import { endpoints } from "../../api/endpoints.js";
import { getApiError } from "../../utils/ui.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import KpiCounter from "../../components/ui/KpiCounter.jsx";
import Skeleton from "../../components/ui/Skeleton.jsx";
import Toast from "../../components/ui/Toast.jsx";

function Kpi({ title, value, tone = "var(--brand-primary)" }) {
  return (
    <Card className="group">
      <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</div>
      <div className="kpi-value mt-2" style={{ color: tone }}><KpiCounter value={value} /></div>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await http.get(endpoints.overview);
      setData(res.data.data || null);
    } catch (e) {
      setError(getApiError(e, "Failed to load dashboard overview"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      {error ? <Toast tone="error">{error}</Toast> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <>
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </>
        ) : (
          <>
            <Kpi title="Properties" value={data?.properties || 0} tone="var(--brand-primary)" />
            <Kpi title="Leads" value={data?.leads || 0} tone="var(--brand-accent)" />
            <Kpi title="Bookings" value={data?.bookings || 0} tone="var(--brand-teal)" />
            <Kpi title="Unpaid Invoices" value={data?.invoices_unpaid || 0} tone="#f97316" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2" title="Sales and Operations Pulse" subtitle="Live team summary and conversion momentum">
          <div className="h-56 rounded-3xl border border-white/20" style={{ backgroundImage: "linear-gradient(135deg, rgba(59,130,246,.22), rgba(139,92,246,.24), rgba(20,184,166,.20))" }} />
        </Card>

        <Card title="Quick Actions" subtitle="Common admin shortcuts">
          <div className="grid gap-2">
            <Button onClick={load}>Refresh Overview</Button>
            <Button variant="ghost">Create Property</Button>
            <Button variant="ghost">Add Lead</Button>
            <Button variant="ghost">Generate Report</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
