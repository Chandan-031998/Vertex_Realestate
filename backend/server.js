// backend/server.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Force-load backend/.env (fixes JWT_SECRET undefined)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

import app from "./src/app.js";
import { initDb } from "./src/config/db.js";

const PORT = process.env.PORT || 4000;

async function boot() {
  await initDb();
  await import("./src/modules/bookings/hold.scheduler.js");
  await import("./src/modules/notifications/scheduler.js");

  app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL && process.env.NODE_ENV !== "production") {
  boot().catch((e) => {
    console.error("❌ Failed to boot:", e);
    process.exit(1);
  });
}

export default function handler(req, res) {
  return app(req, res);
}
