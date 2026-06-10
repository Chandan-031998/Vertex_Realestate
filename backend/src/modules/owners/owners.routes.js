import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { listOwners, createOwner, assignProperty, listOwnerProperties } from "./owners.controller.js";

const r = Router();
r.use(authRequired);

r.get("/", requirePerm(PERMISSIONS.CUSTOMER_READ), listOwners);
r.post("/", requirePerm(PERMISSIONS.CUSTOMER_WRITE), createOwner);

r.get("/:id/properties", requirePerm(PERMISSIONS.CUSTOMER_READ), listOwnerProperties);
r.post("/:id/properties", requirePerm(PERMISSIONS.CUSTOMER_WRITE), assignProperty);

export default r;
