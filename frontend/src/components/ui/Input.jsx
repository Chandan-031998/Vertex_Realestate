import React from "react";

export default function Input({ label, className = "", as = "input", ...props }) {
  const Comp = as;
  return (
    <label className={`input-shell ${className}`}>
      <Comp placeholder=" " {...props} />
      {label ? <span className="floating-label">{label}</span> : null}
    </label>
  );
}
