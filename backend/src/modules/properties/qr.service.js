import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { joinUpload, publicUrlFor } from "../../utils/filePaths.js";
import { ENV } from "../../config/env.js";

export async function generatePropertyQR(propertyUID, propertyId) {
  const relDir = path.join("uploads", "properties", "qr");
  const absDir = joinUpload("properties", "qr");
  fs.mkdirSync(absDir, { recursive: true });

  const fileName = `${propertyUID}.png`;
  const absFile = path.join(absDir, fileName);
  const target = `${ENV.CORS_ORIGIN.replace(/\/$/, "")}/app/properties/${propertyId}`;
  await QRCode.toFile(absFile, target, { width: 300 });

  const relPath = path.join(relDir, fileName).replace(/\\/g, "/");
  return { qr_path: relPath, qr_url: publicUrlFor(relPath) };
}
