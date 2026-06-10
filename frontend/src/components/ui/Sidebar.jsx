import React from "react";
import { NavLink } from "react-router-dom";

export default function Sidebar({ links = [], branding, collapsed = false, onToggle, footer }) {
  return (
    <aside className={`sticky top-0 h-screen hidden md:flex flex-col transition-all duration-300 ${collapsed ? "w-[92px]" : "w-72"} p-3`}>
      <div className="surface-card p-3 h-full flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {branding?.logo_url ? <img src={branding.logo_url} alt="logo" className="h-9 w-9 rounded-xl object-contain bg-white/80" /> : null}
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-bold truncate">{branding?.app_name || "Vertex ERP"}</div>
                <div className="text-[11px] text-slate-500 truncate">{branding?.company_name || "Real Estate Module"}</div>
              </div>
            )}
          </div>
          <button type="button" className="ghost-btn px-2 py-1" onClick={onToggle}>{collapsed ? ">" : "<"}</button>
        </div>

        <nav className="mt-4 space-y-1 overflow-y-auto">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `group flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm transition ${isActive
                  ? "text-white shadow-glow"
                  : "text-slate-700 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800/40"
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? { backgroundImage: "linear-gradient(135deg, var(--brand-primary), var(--brand-accent), var(--brand-teal))" }
                  : undefined
              }
            >
              <span className="text-base">{link.icon || "•"}</span>
              {!collapsed && <span>{link.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto">{footer}</div>
      </div>
    </aside>
  );
}
