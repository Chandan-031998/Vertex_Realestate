export function fingerprintLead({ phone, email, name }) {
  const p = (phone || "").replace(/\D/g, "");
  const e = (email || "").trim().toLowerCase();
  const n = (name || "").trim().toLowerCase();
  return `${p}|${e}|${n}`;
}
