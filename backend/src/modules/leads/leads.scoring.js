export function scoreLead({ budget, urgency, areaMatch = false, typeMatch = false }) {
  let score = 0;
  const b = Number(budget || 0);
  if (b >= 10000000) score += 40;
  else if (b >= 5000000) score += 30;
  else if (b >= 2000000) score += 20;
  else if (b > 0) score += 10;
  const u = String(urgency || "").toLowerCase();
  if (u === "high") score += 35;
  else if (u === "medium") score += 20;
  else if (u === "low") score += 8;

  if (areaMatch) score += 15;
  if (typeMatch) score += 10;

  return Math.max(0, Math.min(100, score));
}
