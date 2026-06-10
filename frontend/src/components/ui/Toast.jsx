import React from "react";

export default function Toast({ tone = "info", children }) {
  const toneClass = {
    info: "border-blue-300/40",
    success: "border-emerald-300/40",
    error: "border-rose-300/40",
  };
  return <div className={`toast-enter glass border ${toneClass[tone] || toneClass.info} px-4 py-2 text-sm`}>{children}</div>;
}
