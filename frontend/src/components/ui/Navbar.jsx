import React from "react";

export default function Navbar({ title, subtitle, right, onToggleMobile, search = "", onSearch }) {
  return (
    <header className="surface-card p-3 md:p-4 flex items-center justify-between gap-3 sticky top-3 z-30">
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" className="ghost-btn px-3 py-1 md:hidden" onClick={onToggleMobile}>Menu</button>
        <div className="min-w-0">
          <h1 className="text-base md:text-lg font-semibold truncate">{title}</h1>
          {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{subtitle}</p> : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onSearch ? (
          <input
            className="modern-input hidden lg:block w-64"
            placeholder="Search modules, records..."
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        ) : null}
        {right}
      </div>
    </header>
  );
}
