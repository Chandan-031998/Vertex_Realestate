import path from "path";
import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { publicUrlFor } from "../../utils/filePaths.js";

export async function addDoc(req, res, next) {
  try {
    const pool = db();
    const property_id = Number(req.body.property_id);
    const doc_type = String(req.body.doc_type || "").trim();
    if (!property_id || !doc_type) return res.status(400).json({ ok: false, message: "property_id & doc_type required" });

    const f = req.file;
    if (!f) return res.status(400).json({ ok: false, message: "file required" });

    const rel = path.join("uploads", "properties", "documents", f.filename).replace(/\\/g, "/");
    try {
      const [[v]] = await pool.query(
        "SELECT COALESCE(MAX(version_no),0) as maxv FROM property_documents WHERE property_id=:property_id AND doc_type=:doc_type",
        { property_id, doc_type }
      );
      const version_no = Number(v?.maxv || 0) + 1;
      const [r] = await pool.query(
        "INSERT INTO property_documents (property_id,doc_type,version_no,original_name,file_path) VALUES (:property_id,:doc_type,:version_no,:original_name,:file_path)",
        { property_id, doc_type, version_no, original_name: f.originalname || null, file_path: rel }
      );
      return ok(res, { id: r.insertId, version_no, url: publicUrlFor(rel) }, "Uploaded");
    } catch {
      // Backward compatibility for older schema without versioning columns.
      const [r] = await pool.query(
        "INSERT INTO property_documents (property_id,doc_type,file_path) VALUES (:property_id,:doc_type,:file_path)",
        { property_id, doc_type, file_path: rel }
      );
      return ok(res, { id: r.insertId, version_no: 1, url: publicUrlFor(rel) }, "Uploaded");
    }
  } catch (e) { next(e); }
}

export async function listDocs(req, res, next) {
  try {
    const pool = db();
    const property_id = Number(req.query.property_id);
    let rows = [];
    try {
      const [newRows] = await pool.query(
        "SELECT * FROM property_documents WHERE property_id=:property_id ORDER BY doc_type ASC, version_no DESC, id DESC",
        { property_id }
      );
      rows = newRows;
    } catch {
      const [oldRows] = await pool.query(
        "SELECT *, 1 as version_no, NULL as original_name FROM property_documents WHERE property_id=:property_id ORDER BY id DESC",
        { property_id }
      );
      rows = oldRows;
    }
    return ok(res, rows.map((r) => ({ ...r, url: publicUrlFor(r.file_path) })));
  } catch (e) { next(e); }
}
