import path from "path";
import { ENV } from "../config/env.js";

const uploadRoot = process.env.VERCEL
  ? path.join("/tmp", "vertex-realestate-uploads")
  : ENV.UPLOAD_DIR;

export function publicUrlFor(relPath) {
  const base = ENV.PUBLIC_BASE_URL.replace(/\/$/, "");
  const clean = relPath.replace(/^\//, "");
  return `${base}/${clean}`;
}

export function joinUpload(...parts) {
  return path.join(uploadRoot, ...parts);
}
