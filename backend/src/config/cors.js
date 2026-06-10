import { ENV } from "./env.js";

export const corsOptions = {
  origin: (origin, cb) => {
    // allow server-to-server / curl requests
    if (!origin) return cb(null, true);
    const allowed = String(ENV.CORS_ORIGIN || "").split(",").map(s => s.trim());
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`), false);
  },
  credentials: true,
  exposedHeaders: ["Content-Disposition"],
};
