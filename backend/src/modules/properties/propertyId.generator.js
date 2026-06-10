export function generatePropertyUID(id) {
  const n = Number(id || 0);
  const seq = String(Math.max(0, n)).padStart(6, "0");
  return `VTX-RE-PROP-${seq}`;
}
