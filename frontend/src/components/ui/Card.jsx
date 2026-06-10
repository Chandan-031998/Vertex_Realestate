import React from "react";

export default function Card({ title, subtitle, action, className = "", children }) {
  return (
    <section className={`surface-card p-4 md:p-5 ${className}`}>
      {(title || subtitle || action) && (
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title ? <h3 className="text-sm md:text-base font-semibold">{title}</h3> : null}
            {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
