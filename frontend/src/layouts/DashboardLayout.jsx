import React, { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearAuth, getUser } from "../store/auth.store.js";
import { http } from "../api/http.js";
import { endpoints } from "../api/endpoints.js";
import { getApiError } from "../utils/ui.js";
import Sidebar from "../components/ui/Sidebar.jsx";
import Navbar from "../components/ui/Navbar.jsx";
import Button from "../components/ui/Button.jsx";
import Badge from "../components/ui/Badge.jsx";
import Card from "../components/ui/Card.jsx";

const icons = {
  Dashboard: "▦",
  Properties: "⌂",
  Leads: "◎",
  "Agent Panel": "◉",
  Customers: "◌",
  Bookings: "▤",
  Rentals: "◒",
  Billing: "¤",
  Commissions: "◈",
  Accounts: "∑",
  Legal: "⚖",
  Reports: "◫",
  Users: "◍",
  Settings: "⚙",
};

export default function DashboardLayout() {
  const nav = useNavigate();
  const location = useLocation();
  const user = getUser();
  const isAdmin = user?.role === "Admin";
  const isSalesManager = user?.role === "Sales Manager";
  const isSalesAgent = user?.role === "Sales Agent";
  const isAccounts = user?.role === "Accounts";
  const isLegal = user?.role === "Legal";
  const isPropertyManager = user?.role === "Property Manager";

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [notifError, setNotifError] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [themeMode, setThemeMode] = useState(localStorage.getItem("vertex-theme") || "light");
  const [branding, setBranding] = useState({
    app_name: "Vertex ERP",
    company_name: "Vertex Real Estate",
    company_email: "",
    logo_url: "",
    primary_color: "#3b82f6",
    accent_color: "#8b5cf6",
    theme_mode: "light",
    ui_style: "comfortable",
    sidebar_style: "default",
  });

  const links = [
    { to: "/app", label: "Dashboard" },
    ...(isAdmin || isSalesManager || isSalesAgent || isPropertyManager ? [{ to: "/app/properties", label: "Properties" }] : []),
    ...(isAdmin || isSalesManager || isSalesAgent ? [{ to: "/app/leads", label: "Leads" }] : []),
    ...(isSalesAgent || isSalesManager || isAdmin ? [{ to: "/app/agent/mobile", label: "Agent Panel" }] : []),
    ...(isAdmin || isSalesManager || isSalesAgent || isPropertyManager ? [{ to: "/app/customers", label: "Customers" }] : []),
    ...(isAdmin || isSalesManager || isSalesAgent || isAccounts ? [{ to: "/app/bookings", label: "Bookings" }] : []),
    ...(isAdmin || isPropertyManager || isAccounts ? [{ to: "/app/rentals", label: "Rentals" }] : []),
    ...(isAdmin || isAccounts ? [{ to: "/app/billing/invoices", label: "Billing" }] : []),
    ...(isAdmin ? [{ to: "/app/commissions", label: "Commissions" }] : []),
    ...(isAdmin || isAccounts ? [{ to: "/app/accounts/finance", label: "Accounts" }] : []),
    ...(isAdmin || isLegal ? [{ to: "/app/legal/agreements", label: "Legal" }] : []),
    ...(isAdmin || isAccounts || isSalesManager || isPropertyManager || isLegal ? [{ to: "/app/reports", label: "Reports" }] : []),
    ...(isAdmin ? [{ to: "/app/admin/users", label: "Users" }, { to: "/app/admin/settings", label: "Settings" }] : []),
  ].map((l) => ({ ...l, icon: icons[l.label] || "•" }));

  const current = useMemo(() => links.find((l) => l.to === location.pathname) || links.find((l) => location.pathname.startsWith(`${l.to}/`)) || links[0], [links, location.pathname]);

  const loadNotifications = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        http.get(endpoints.notificationsMe, { params: { limit: 20 } }),
        http.get(endpoints.notificationsUnreadCount),
      ]);
      setNotifications(listRes.data.data || []);
      setUnread(Number(countRes.data.data?.unread || 0));
    } catch {
      // no-op
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await http.get(endpoints.notificationsSettings);
      setSettings(res.data.data || null);
    } catch {
      // no-op
    }
  }, [isAdmin]);

  const loadBranding = useCallback(async () => {
    try {
      const res = await http.get(endpoints.appSettings);
      const b = res.data.data || {};
      setBranding((prev) => ({ ...prev, ...b }));
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadSettings();
    loadBranding();
    const t = setInterval(loadNotifications, 60000);
    return () => clearInterval(t);
  }, [loadNotifications, loadSettings, loadBranding]);

  useEffect(() => {
    const mode = themeMode || branding.theme_mode || "light";
    document.documentElement.setAttribute("data-theme-mode", mode);
    if (mode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("vertex-theme", mode);
  }, [themeMode, branding.theme_mode]);

  useEffect(() => {
    document.documentElement.style.setProperty("--brand-primary", branding.primary_color || "#3b82f6");
    document.documentElement.style.setProperty("--brand-accent", branding.accent_color || "#8b5cf6");
    document.documentElement.setAttribute("data-ui-style", branding.ui_style || "comfortable");
  }, [branding]);

  const markRead = async (id) => {
    try {
      await http.post(endpoints.notificationsRead(id));
      await loadNotifications();
    } catch (e) {
      setNotifError(getApiError(e, "Failed to mark notification read"));
    }
  };

  const markAllRead = async () => {
    try {
      await http.post(endpoints.notificationsReadAll);
      await loadNotifications();
    } catch (e) {
      setNotifError(getApiError(e, "Failed to mark all read"));
    }
  };

  const saveSettings = async () => {
    if (!isAdmin || !settings) return;
    setSettingsSaving(true);
    try {
      await http.put(endpoints.notificationsSettings, settings);
      setNotifMsg("Notification settings saved");
      await loadSettings();
    } catch (e) {
      setNotifError(getApiError(e, "Failed to save settings"));
    } finally {
      setSettingsSaving(false);
    }
  };

  const runRemindersNow = async () => {
    if (!isAdmin) return;
    try {
      const res = await http.post(endpoints.notificationsRunNow);
      const d = res.data.data || {};
      setNotifMsg(`Reminders: Follow-ups ${d.followup || 0}, Visits ${d.visit || 0}, Rent ${d.rent_due || 0}, Agreements ${d.agreement_expiry || 0}, Holds ${d.hold_expiry || 0}`);
      await loadNotifications();
    } catch (e) {
      setNotifError(getApiError(e, "Failed to run reminders"));
    }
  };

  return (
    <div className="min-h-screen flex gap-3 p-3">
      <Sidebar
        links={links}
        branding={branding}
        collapsed={collapsed}
        onToggle={() => setCollapsed((s) => !s)}
        footer={(
          <Card className="p-3 mt-3" title={user?.name || "User"} subtitle={user?.role || ""}>
            <Button
              className="w-full"
              onClick={() => {
                clearAuth();
                nav("/login");
              }}
            >
              Logout
            </Button>
          </Card>
        )}
      />

      <main className="flex-1 min-w-0">
        <Navbar
          title={current?.label || "Module"}
          subtitle={branding.company_name || "Vertex Real Estate"}
          onToggleMobile={() => setMobileNavOpen((v) => !v)}
          right={(
            <div className="flex items-center gap-2">
              <button type="button" className="ghost-btn px-3 py-2" onClick={() => setThemeMode((m) => (m === "dark" ? "light" : "dark"))}>
                {themeMode === "dark" ? "Light" : "Dark"}
              </button>

              <div className="relative">
                <button type="button" className="ghost-btn" onClick={() => { setNotifOpen((v) => !v); if (!notifOpen) loadNotifications(); }}>
                  Bell {unread > 0 ? <Badge tone="danger" className="ml-2">{unread > 99 ? "99+" : unread}</Badge> : null}
                </button>
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-[26rem] max-w-[92vw] surface-card p-3 z-40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-sm">Notifications</div>
                      <button type="button" className="text-xs underline" onClick={markAllRead}>Mark all read</button>
                    </div>
                    {notifError ? <div className="text-xs text-rose-500 mb-2">{notifError}</div> : null}
                    {notifMsg ? <div className="text-xs text-emerald-500 mb-2">{notifMsg}</div> : null}
                    <div className="max-h-72 overflow-auto space-y-2">
                      {notifications.map((n) => (
                        <button key={n.id} type="button" className="w-full text-left glass p-2 rounded-xl" onClick={() => markRead(n.id)}>
                          <div className="text-xs text-slate-500">{n.type}</div>
                          {n.title ? <div className="text-sm font-semibold">{n.title}</div> : null}
                          <div className="text-sm">{n.message}</div>
                        </button>
                      ))}
                      {!notifications.length ? <div className="text-sm text-slate-500">No notifications.</div> : null}
                    </div>

                    {isAdmin && settings ? (
                      <div className="mt-3 border-t border-slate-200/30 pt-3">
                        <div className="font-semibold text-sm">Automation</div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <label><input type="checkbox" className="mr-1" checked={Boolean(settings.followup_enabled)} onChange={(e) => setSettings({ ...settings, followup_enabled: e.target.checked })} />Follow-up</label>
                          <label><input type="checkbox" className="mr-1" checked={Boolean(settings.visit_enabled)} onChange={(e) => setSettings({ ...settings, visit_enabled: e.target.checked })} />Visits</label>
                          <label><input type="checkbox" className="mr-1" checked={Boolean(settings.rent_due_enabled)} onChange={(e) => setSettings({ ...settings, rent_due_enabled: e.target.checked })} />Rent</label>
                          <label><input type="checkbox" className="mr-1" checked={Boolean(settings.agreement_expiry_enabled)} onChange={(e) => setSettings({ ...settings, agreement_expiry_enabled: e.target.checked })} />Agreement</label>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={runRemindersNow}>Run Now</Button>
                          <Button className="px-2 py-1 text-xs" disabled={settingsSaving} onClick={saveSettings}>{settingsSaving ? "Saving..." : "Save"}</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}
        />

        {mobileNavOpen ? (
          <div className="md:hidden surface-card p-2 mt-3 flex gap-2 overflow-x-auto">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} onClick={() => setMobileNavOpen(false)} className={({ isActive }) => `px-3 py-2 rounded-xl text-sm whitespace-nowrap ${isActive ? "text-white" : "bg-white/60 dark:bg-slate-900/50"}`} style={({ isActive }) => isActive ? { backgroundImage: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent), var(--brand-teal))" } : undefined}>
                {l.label}
              </NavLink>
            ))}
          </div>
        ) : null}

        <div className="app-page mt-3 p-1 md:p-2">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
