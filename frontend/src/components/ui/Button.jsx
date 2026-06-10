import React from "react";

export default function Button({ variant = "primary", className = "", type = "button", ...props }) {
  const map = {
    primary: "primary-btn",
    ghost: "ghost-btn",
    outline: "ghost-btn",
    danger: "rounded-2xl px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 transition",
  };
  return <button type={type} className={`${map[variant] || map.primary} ${className}`} {...props} />;
}
