import bcrypt from "bcryptjs";
import { initDb, db } from "../config/db.js";
import { ROLES } from "../config/roles.js";

async function seed() {
  await initDb();
  const pool = db();

  const email = "admin@vertex.local";
  const [rows] = await pool.query("SELECT id FROM users WHERE email=:email", { email });
  if (rows.length) {
    console.log("✅ Admin already exists:", email);
    process.exit(0);
  }

  const hash = await bcrypt.hash("Admin@123", 10);
  await pool.query(
    "INSERT INTO users (name,email,password_hash,role,is_active) VALUES (:name,:email,:hash,:role,1)",
    { name: "Vertex Admin", email, hash, role: ROLES.ADMIN }
  );

  // seed some common amenities
  const amenities = ["Parking", "Lift", "Security", "Power Backup", "CCTV", "Gym", "Swimming Pool"];
  for (const a of amenities) {
    await pool.query("INSERT IGNORE INTO amenities (name) VALUES (:name)", { name: a });
  }

  console.log("✅ Seed completed.");
  process.exit(0);
}

seed().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
