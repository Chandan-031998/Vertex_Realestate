// Simple CSV import (Excel -> Save As CSV)
// Expected headers: name,phone,email,source,campaign,budget,area_pref,type_pref,bhk_pref,urgency
import fs from "fs";

export function parseCsv(filePath) {
  const txt = fs.readFileSync(filePath, "utf-8");
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    const obj = {};
    headers.forEach((h, idx) => obj[h] = cols[idx] ?? "");
    rows.push(obj);
  }
  return rows;
}
