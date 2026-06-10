export function errorMiddleware(err, req, res, next) {
  console.error("❌", err);
  const dbNetworkCodes = new Set([
    "EADDRNOTAVAIL",
    "ECONNREFUSED",
    "ENOTFOUND",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "PROTOCOL_CONNECTION_LOST",
  ]);
  if (dbNetworkCodes.has(err?.code)) {
    return res.status(503).json({
      ok: false,
      message: "Database network is unavailable. Check DB_HOST/DB_PORT and remote MySQL allowlist.",
      code: err.code,
    });
  }
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    message: err.message || "Server error",
  });
}
