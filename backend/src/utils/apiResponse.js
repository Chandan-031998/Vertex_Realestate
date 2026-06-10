export function ok(res, data = {}, message = "OK") {
  return res.json({ ok: true, message, data });
}
