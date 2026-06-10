import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import {
  listMyNotifications,
  markRead,
  unreadCount,
  markAllRead,
  getSettings,
  saveSettings,
  runNow,
} from "./notifications.controller.js";

const r = Router();
r.use(authRequired);

r.get("/me", listMyNotifications);
r.get("/me/unread-count", unreadCount);
r.post("/me/read-all", markAllRead);
r.post("/:id/read", markRead);
r.get("/settings", requirePerm(PERMISSIONS.MASTER_SETTINGS_MANAGE), getSettings);
r.put("/settings", requirePerm(PERMISSIONS.MASTER_SETTINGS_MANAGE), saveSettings);
r.post("/run-reminders", requirePerm(PERMISSIONS.MASTER_SETTINGS_MANAGE), runNow);

export default r;
