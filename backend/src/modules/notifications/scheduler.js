import cron from "node-cron";
import { runReminderJobs } from "./notifications.service.js";

// Every 15 minutes: generate reminder notifications.
cron.schedule("*/15 * * * *", async () => {
  try {
    await runReminderJobs();
  } catch (e) {
    console.error("Notification scheduler error:", e.message);
  }
});
