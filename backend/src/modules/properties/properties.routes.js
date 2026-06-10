import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import { uploadProperty } from "./uploads.middleware.js";
import { validate } from "../../middlewares/validate.middleware.js";
import { createPropertySchema, updatePropertySchema } from "./properties.validation.js";
import { list, getOne, create, update, remove, listWebsite, updateListingSettings, portalExportCsv, uploadImages } from "./properties.controller.js";

const r = Router();
r.get("/website-listings", listWebsite);
r.use(authRequired);

r.get("/", requirePerm(PERMISSIONS.PROPERTY_READ), list);
r.get("/portal-export/csv", requirePerm(PERMISSIONS.REPORT_EXPORT), portalExportCsv);
r.get("/:id", requirePerm(PERMISSIONS.PROPERTY_READ), getOne);
r.patch("/:id/listing-settings", requirePerm(PERMISSIONS.PROPERTY_APPROVE), updateListingSettings);
r.post("/:id/images", requirePerm(PERMISSIONS.PROPERTY_MEDIA_UPLOAD), uploadProperty.array("images", 12), uploadImages);

// Upload fields: images (multiple), brochure (single)
r.post(
  "/",
  requirePerm(PERMISSIONS.PROPERTY_CREATE),
  uploadProperty.fields([{ name: "images", maxCount: 10 }, { name: "brochure", maxCount: 1 }]),
  validate(createPropertySchema),
  create
);

r.put("/:id", requirePerm(PERMISSIONS.PROPERTY_WRITE), validate(updatePropertySchema), update);
r.delete("/:id", requirePerm(PERMISSIONS.PROPERTY_DELETE), remove);

export default r;
