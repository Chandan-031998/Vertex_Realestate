import React from "react";
import Button from "./Button.jsx";

export default function Modal({ open, title, children, onClose, footer = null }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative w-full max-w-xl surface-card modal-enter p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" className="px-2 py-1" onClick={onClose}>Close</Button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-4 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
