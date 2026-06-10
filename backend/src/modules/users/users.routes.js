import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { listUsers, toggleUserActive, updateUserRole, resetUserPassword } from "./users.controller.js";

const r = Router();
r.use(authRequired);

r.get("/", requirePerm(PERMISSIONS.USER_MANAGE), listUsers);
r.patch("/:id/toggle", requirePerm(PERMISSIONS.USER_MANAGE), toggleUserActive);
r.patch("/:id/role", requirePerm(PERMISSIONS.USER_MANAGE), updateUserRole);
r.patch("/:id/reset-password", requirePerm(PERMISSIONS.USER_MANAGE), resetUserPassword);

export default r;
