import multer from "multer";
import path from "path";
import fs from "fs";
import { joinUpload } from "../../utils/filePaths.js";

function makeStorage(folder) {
  const abs = joinUpload(folder);
  fs.mkdirSync(abs, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, abs),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(safe);
      const base = path.basename(safe, ext);
      cb(null, `${Date.now()}_${base}${ext}`);
    },
  });
}

export const uploadProperty = multer({
  storage: makeStorage(path.join("properties", "mixed")),
  limits: { fileSize: 25 * 1024 * 1024 },
});

export const uploadDocs = multer({
  storage: makeStorage(path.join("properties", "documents")),
  limits: { fileSize: 25 * 1024 * 1024 },
});
