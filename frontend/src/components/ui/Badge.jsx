import React from "react";

const styles = {
  neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

export default function Badge({ tone = "neutral", className = "", children }) {
  return <span className={`inline-flex items-center rounded-xl px-2.5 py-1 text-xs font-semibold ${styles[tone] || styles.neutral} ${className}`}>{children}</span>;
}
