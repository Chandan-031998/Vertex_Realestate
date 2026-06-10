import cron from "node-cron";
import { db } from "../../config/db.js";

// Every 10 minutes: auto release expired holds
cron.schedule("*/10 * * * *", async () => {
  try {
    const pool = db();
    const [expired] = await pool.query(
      "SELECT id, property_id, unit_id FROM bookings WHERE status='Hold' AND hold_expires_at IS NOT NULL AND hold_expires_at < NOW() LIMIT 200"
    );
    if (!expired.length) return;

    for (const b of expired) {
      await pool.query(
        "UPDATE bookings SET status='Expired', cancellation_status='Approved', cancellation_reason='Auto released due to hold expiry' WHERE id=:id",
        { id: b.id }
      );
      await pool.query("UPDATE properties SET status='Available' WHERE id=:pid AND status='Hold'", { pid: b.property_id });
      if (b.unit_id) await pool.query("UPDATE units SET status='Available' WHERE id=:uid AND status='Hold'", { uid: b.unit_id });
    }
    console.log(`⏱️ Released ${expired.length} expired holds`);
  } catch (e) {
    console.error("Hold scheduler error:", e.message);
  }
});
