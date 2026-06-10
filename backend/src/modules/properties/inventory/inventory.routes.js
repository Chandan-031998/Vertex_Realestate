import { Router } from "express";
import { authRequired } from "../../../middlewares/auth.middleware.js";
import { requirePerm } from "../../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../../config/roles.js";
import * as c from "./inventory.controller.js";

const r = Router();
r.use(authRequired);

r.get("/towers", requirePerm(PERMISSIONS.PROPERTY_READ), c.listTowers);
r.post("/towers", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.addTower);
r.put("/towers/:id", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.updateTower);
r.delete("/towers/:id", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.deleteTower);

r.get("/floors", requirePerm(PERMISSIONS.PROPERTY_READ), c.listFloors);
r.post("/floors", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.addFloor);
r.put("/floors/:id", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.updateFloor);
r.delete("/floors/:id", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.deleteFloor);

r.get("/units", requirePerm(PERMISSIONS.PROPERTY_READ), c.listUnits);
r.post("/units", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.addUnit);
r.put("/units/:id", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.updateUnit);
r.delete("/units/:id", requirePerm(PERMISSIONS.INVENTORY_MANAGE), c.deleteUnit);

export default r;
