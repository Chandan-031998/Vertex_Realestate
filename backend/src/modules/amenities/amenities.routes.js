import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { listAmenities, addAmenity } from "./amenities.controller.js";

const r = Router();
r.use(authRequired);

r.get("/", requirePerm(PERMISSIONS.PROPERTY_READ), listAmenities);
r.post("/", requirePerm(PERMISSIONS.PROPERTY_WRITE), addAmenity);

export default r;
