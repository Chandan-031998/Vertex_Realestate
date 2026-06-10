import path from "path";
import { ENV } from "../config/env.js";

export function publicUrlFor(relPath) {
  const base = ENV.PUBLIC_BASE_URL.replace(/\/$/, "");
  const clean = relPath.replace(/^\//, "");
  return `${base}/${clean}`;
}

export function joinUpload(...parts) {
  return path.join(ENV.UPLOAD_DIR, ...parts);
}
