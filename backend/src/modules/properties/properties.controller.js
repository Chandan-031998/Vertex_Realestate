import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import * as service from "./properties.service.js";
import * as repo from "./properties.repo.js";
import { publicUrlFor } from "../../utils/filePaths.js";
import { audit } from "../audit/audit.service.js";

function csvEscape(v) {
  const s = String(v ?? "");
  if (!/[",\n]/.test(s)) return s;
  return `"${s.replace(/"/g, "\"\"")}"`;
}

function toBool(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function toPortalRows(rows, format) {
  const f = String(format || "generic").toLowerCase();
  if (f === "99acres") {
    return {
      columns: ["PropertyID", "Title", "City", "Locality", "PropertyType", "Price", "Status", "Featured", "MetaTitle", "MetaDescription", "Keywords"],
      rows: rows.map((r) => [
        r.property_uid, r.title, r.city || "", r.area || "", r.type, r.base_price || 0, r.status,
        r.is_featured ? "Yes" : "No", r.seo_title || "", r.seo_description || "", r.seo_keywords || "",
      ]),
    };
  }
  if (f === "magicbricks") {
    return {
      columns: ["ListingCode", "ProjectName", "PropertyType", "City", "Area", "Amount", "Availability", "SEO_Title", "SEO_Description", "SEO_Keywords"],
      rows: rows.map((r) => [
        r.property_uid, r.title, r.type, r.city || "", r.area || "", r.base_price || 0, r.status,
        r.seo_title || "", r.seo_description || "", r.seo_keywords || "",
      ]),
    };
  }
  return {
    columns: ["property_uid", "title", "type", "status", "city", "area", "base_price", "is_featured", "seo_title", "seo_description", "seo_keywords"],
    rows: rows.map((r) => [
      r.property_uid, r.title, r.type, r.status, r.city || "", r.area || "", r.base_price || 0,
      r.is_featured ? 1 : 0, r.seo_title || "", r.seo_description || "", r.seo_keywords || "",
    ]),
  };
}

export async function list(req, res, next) {
  try {
    const { q = "", status = "", type = "" } = req.query;
    const rows = await repo.listProperties({ q, status, type });
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function getOne(req, res, next) {
  try {
    const id = Number(req.params.id);
    const prop = await repo.getProperty(id);
    if (!prop) return res.status(404).json({ ok: false, message: "Not found" });
    const images = await repo.listImages(id);
    return ok(res, {
      ...prop,
      qr_url: prop.qr_path ? publicUrlFor(prop.qr_path) : null,
      brochure_url: prop.brochure_path ? publicUrlFor(prop.brochure_path) : null,
      images: images.map((i) => ({ ...i, url: publicUrlFor(i.image_path) })),
    });
  } catch (e) { next(e); }
}

export async function create(req, res, next) {
  try {
    const out = await service.createProperty({ body: req.body, files: req.files, userId: req.user.id });
    return ok(res, out, "Created");
  } catch (e) { next(e); }
}

export async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    await service.updateProperty({ id, body: req.body, userId: req.user.id, role: req.user.role });
    return ok(res, {}, "Updated");
  } catch (e) { next(e); }
}

export async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    await repo.deleteProperty(id);
    return ok(res, {}, "Deleted");
  } catch (e) { next(e); }
}

export async function uploadImages(req, res, next) {
  try {
    const id = Number(req.params.id);
    const prop = await repo.getProperty(id);
    if (!prop) return res.status(404).json({ ok: false, message: "Property not found" });

    const images = req.files || [];
    if (!images.length) return res.status(400).json({ ok: false, message: "images are required" });
    const relPaths = images.map((f) => `uploads/properties/mixed/${f.filename}`.replace(/\\/g, "/"));
    await repo.addImages(id, relPaths);
    await audit({ userId: req.user.id, action: "upload_images", entity: "properties", entityId: String(id), meta: { count: images.length } });
    return ok(res, { uploaded: images.length }, "Property images uploaded");
  } catch (e) { next(e); }
}

export async function listWebsite(req, res, next) {
  try {
    const rows = await repo.listWebsiteListings();
    const out = rows.map((r) => ({
      ...r,
      qr_url: r.qr_path ? publicUrlFor(r.qr_path) : null,
      brochure_url: r.brochure_path ? publicUrlFor(r.brochure_path) : null,
      property_url: `/properties/${r.id}`,
    }));
    return ok(res, out);
  } catch (e) { next(e); }
}

export async function updateListingSettings(req, res, next) {
  try {
    const id = Number(req.params.id);
    const prop = await repo.getProperty(id);
    if (!prop) return res.status(404).json({ ok: false, message: "Property not found" });

    const body = req.body || {};
    const nextPublished = body.is_published === undefined ? prop.is_published : (toBool(body.is_published) ? 1 : 0);
    if (nextPublished && !["Available", "Hold", "Booked"].includes(String(prop.status || ""))) {
      return res.status(400).json({ ok: false, message: "Only Available/Hold/Booked properties can be published" });
    }

    await repo.updateProperty(id, {
      title: prop.title,
      type: prop.type,
      status: prop.status,
      description: prop.description,
      city: prop.city,
      area: prop.area,
      pincode: prop.pincode,
      landmark: prop.landmark,
      map_link: prop.map_link,
      base_price: prop.base_price,
      negotiable: prop.negotiable,
      taxes: prop.taxes,
      brokerage: prop.brokerage,
      maintenance_fee: prop.maintenance_fee,
      stamp_duty_estimate: prop.stamp_duty_estimate,
      video_link: prop.video_link,
      is_published: nextPublished,
      is_featured: body.is_featured === undefined ? prop.is_featured : (toBool(body.is_featured) ? 1 : 0),
      seo_title: body.seo_title ?? prop.seo_title,
      seo_description: body.seo_description ?? prop.seo_description,
      seo_keywords: body.seo_keywords ?? prop.seo_keywords,
    });

    await audit({
      userId: req.user.id,
      action: "listing_settings",
      entity: "properties",
      entityId: String(id),
      meta: { is_published: nextPublished },
    });
    return ok(res, {}, "Listing settings updated");
  } catch (e) { next(e); }
}

export async function portalExportCsv(req, res, next) {
  try {
    const format = String(req.query.format || "generic");
    const rows = await repo.listWebsiteListings();
    const model = toPortalRows(rows, format);
    const csv = [model.columns.join(","), ...model.rows.map((r) => r.map(csvEscape).join(","))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="portal_export_${format}.csv"`);
    return res.status(200).send(csv);
  } catch (e) { next(e); }
}
