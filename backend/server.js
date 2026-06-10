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
  if (!process.env.VERCEL) {
    app.listen(PORT, () => {
      console.log(`✅ Backend running on http://localhost:${PORT}`);
    });
  }
}

boot().catch((e) => {
  console.error("❌ Failed to boot:", e);
  process.exit(1);
});

export default app;
