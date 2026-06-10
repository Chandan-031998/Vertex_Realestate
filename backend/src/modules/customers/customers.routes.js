import { Router } from "express";
import { authRequired } from "../../middlewares/auth.middleware.js";
import { requirePerm } from "../../middlewares/rbac.middleware.js";
import { PERMISSIONS } from "../../config/roles.js";
import multer from "multer";
import fs from "fs";
import { joinUpload } from "../../utils/filePaths.js";
import {
  listCustomers,
  createCustomer,
  addKycDocument,
  listKycDocuments,
  addFamilyMember,
  listFamilyMembers,
  suggestProperties,
} from "./customers.controller.js";

const r = Router();
r.use(authRequired);

const kycDir = joinUpload("customers", "kyc");
fs.mkdirSync(kycDir, { recursive: true });
const kycUpload = multer({ dest: kycDir });

r.get("/", requirePerm(PERMISSIONS.CUSTOMER_READ), listCustomers);
r.post("/", requirePerm(PERMISSIONS.CUSTOMER_WRITE), createCustomer);

r.get("/:id/kyc", requirePerm(PERMISSIONS.CUSTOMER_READ), listKycDocuments);
r.post("/:id/kyc", requirePerm(PERMISSIONS.CUSTOMER_WRITE), kycUpload.single("file"), addKycDocument);

r.get("/:id/family", requirePerm(PERMISSIONS.CUSTOMER_READ), listFamilyMembers);
r.post("/:id/family", requirePerm(PERMISSIONS.CUSTOMER_WRITE), addFamilyMember);

r.get("/:id/suggestions", requirePerm(PERMISSIONS.CUSTOMER_READ), suggestProperties);

export default r;
