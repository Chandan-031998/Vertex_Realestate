import path from "path";
import { ok } from "../../utils/apiResponse.js";
import { publicUrlFor } from "../../utils/filePaths.js";
import { getAppSettings, updateAppSettings } from "./settings.service.js";

function mapRow(row) {
  return {
    ...row,
    logo_url: row.logo_path ? publicUrlFor(row.logo_path) : null,
  };
}

export async function getSettings(req, res, next) {
  try {
    const row = await getAppSettings();
    return ok(res, mapRow(row));
  } catch (e) { next(e); }
}

export async function saveSettings(req, res, next) {
  try {
    const rel = req.file ? path.join("uploads", "branding", req.file.filename).replace(/\\/g, "/") : null;
    const row = await updateAppSettings(req.body || {}, req.user?.id || null, rel);
    return ok(res, mapRow(row), "Application settings updated");
  } catch (e) { next(e); }
}
