import React from "react";

export default function Skeleton({ className = "h-20" }) {
  return <div className={`skeleton ${className}`} />;
}
