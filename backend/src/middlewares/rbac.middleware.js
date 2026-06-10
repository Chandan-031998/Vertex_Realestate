import { ROLE_PERMISSIONS } from "../config/roles.js";

export function requirePerm(...perms) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(403).json({ ok: false, message: "Missing role" });

    const allowed = ROLE_PERMISSIONS[role] || [];
    const ok = perms.every(p => allowed.includes(p));
    if (!ok) return res.status(403).json({ ok: false, message: "Permission denied" });
    next();
  };
}

export function requireAnyPerm(...perms) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) return res.status(403).json({ ok: false, message: "Missing role" });

    const allowed = ROLE_PERMISSIONS[role] || [];
    const ok = perms.some((p) => allowed.includes(p));
    if (!ok) return res.status(403).json({ ok: false, message: "Permission denied" });
    next();
  };
}
