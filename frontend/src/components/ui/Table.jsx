import React from "react";

export default function Table({ headers = [], children, className = "" }) {
  return (
    <div className={`surface-card overflow-hidden ${className}`}>
      <table className="modern-table">
        {headers.length ? (
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left p-3 font-semibold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{h}</th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
