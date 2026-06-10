import path from "path";
import { generatePropertyUID } from "./propertyId.generator.js";
import { generatePropertyQR } from "./qr.service.js";
import * as repo from "./properties.repo.js";
import { audit } from "../audit/audit.service.js";

function toNum(v, def = 0) {
  if (v === undefined || v === null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function toBool(v) {
  return v === true || v === 1 || v === "1" || v === "true";
}

function normalizeStatus(status) {
  const s = String(status || "").trim();
  if (!s) return "";
  if (s.toLowerCase() === "on hold") return "Hold";
  return s;
}

function assertVideoUrl(videoLink) {
  if (!videoLink) return;
  let u;
  try {
    u = new URL(videoLink);
  } catch {
    const err = new Error("video_link must be a valid URL");
    err.status = 400;
    throw err;
  }
  if (!["http:", "https:"].includes(u.protocol)) {
    const err = new Error("video_link must use http/https");
    err.status = 400;
    throw err;
  }
}

function assertBrochurePdf(brochure) {
  if (!brochure) return;
  const isPdfByType = String(brochure.mimetype || "").toLowerCase().includes("pdf");
  const isPdfByName = String(brochure.originalname || "").toLowerCase().endsWith(".pdf");
  if (!isPdfByType && !isPdfByName) {
    const err = new Error("Brochure must be a PDF file");
    err.status = 400;
    throw err;
  }
}

function assertStatusTransition(currentStatus, nextStatus) {
  const from = normalizeStatus(currentStatus || "Available") || "Available";
  const to = normalizeStatus(nextStatus || from) || from;
  if (from === to) return to;

  const allowed = {
    Available: ["Hold"],
    Hold: ["Booked", "Available"],
    Booked: ["Sold", "Rented"],
    Sold: [],
    Rented: [],
  };

  if (!allowed[from] || !allowed[from].includes(to)) {
    const err = new Error(`Invalid status transition: ${from} -> ${to}`);
    err.status = 400;
    throw err;
  }
  return to;
}

export async function createProperty({ body, files, userId }) {
  const brochure = files?.brochure?.[0];
  const images = files?.images || [];

  assertBrochurePdf(brochure);
  assertVideoUrl(body.video_link || null);

  const normalizedStatus = normalizeStatus(body.status || "Available") || "Available";

  const payload = {
    // temporary value, replaced immediately after insert with sequenced format
    property_uid: `TMP-${Date.now()}`,
    title: body.title,
    type: body.type,
    status: normalizedStatus,
    description: body.description || null,

    city: body.city || null,
    area: body.area || null,
    pincode: body.pincode || null,
    landmark: body.landmark || null,
    map_link: body.map_link || null,

    base_price: toNum(body.base_price),
    negotiable: toBool(body.negotiable) ? 1 : 0,
    taxes: toNum(body.taxes),
    brokerage: toNum(body.brokerage),
    maintenance_fee: toNum(body.maintenance_fee),
    stamp_duty_estimate: toNum(body.stamp_duty_estimate),

    video_link: body.video_link || null,
    brochure_path: brochure ? path.join("uploads", "properties", "mixed", brochure.filename).replace(/\\/g, "/") : null,
    qr_path: null,

    created_by: userId || null,

    is_published: toBool(body.is_published) ? 1 : 0,
    is_featured: toBool(body.is_featured) ? 1 : 0,
    seo_title: body.seo_title || null,
    seo_description: body.seo_description || null,
    seo_keywords: body.seo_keywords || null,
  };

  const id = await repo.insertProperty(payload);
  const property_uid = generatePropertyUID(id);
  const qr = await generatePropertyQR(property_uid, id);
  await repo.updatePropertyIdentity(id, { property_uid, qr_path: qr.qr_path });

  const relPaths = images.map((f) => path.join("uploads", "properties", "mixed", f.filename).replace(/\\/g, "/"));
  await repo.addImages(id, relPaths);

  if (Array.isArray(body.amenity_ids)) {
    await repo.setAmenities(id, body.amenity_ids.map(Number));
  }

  await audit({ userId, action: "create", entity: "properties", entityId: String(id), meta: { property_uid } });

  return { id, property_uid, qr_url: qr.qr_url };
}

export async function updateProperty({ id, body, userId, role }) {
  const existing = await repo.getProperty(id);
  if (!existing) {
    const err = new Error("Property not found");
    err.status = 404;
    throw err;
  }

  if (role === "Sales Manager") {
    const allowed = new Set(["base_price", "negotiable", "status"]);
    const incoming = Object.keys(body || {});
    const invalid = incoming.filter((k) => !allowed.has(k));
    if (invalid.length) {
      const err = new Error("Sales Manager can only update: base_price, negotiable, status");
      err.status = 403;
      throw err;
    }
  }

  assertVideoUrl(body.video_link ?? existing.video_link);
  const nextStatus = body.status === undefined
    ? existing.status
    : assertStatusTransition(existing.status, body.status);

  const payload = {
    title: body.title ?? existing.title,
    type: body.type ?? existing.type,
    status: nextStatus,
    description: body.description ?? existing.description,

    city: body.city ?? existing.city,
    area: body.area ?? existing.area,
    pincode: body.pincode ?? existing.pincode,
    landmark: body.landmark ?? existing.landmark,
    map_link: body.map_link ?? existing.map_link,

    base_price: toNum(body.base_price, existing.base_price),
    negotiable: body.negotiable === undefined ? existing.negotiable : toBool(body.negotiable) ? 1 : 0,
    taxes: toNum(body.taxes, existing.taxes),
    brokerage: toNum(body.brokerage, existing.brokerage),
    maintenance_fee: toNum(body.maintenance_fee, existing.maintenance_fee),
    stamp_duty_estimate: toNum(body.stamp_duty_estimate, existing.stamp_duty_estimate),

    video_link: body.video_link ?? existing.video_link,

    is_published: body.is_published === undefined ? existing.is_published : toBool(body.is_published) ? 1 : 0,
    is_featured: body.is_featured === undefined ? existing.is_featured : toBool(body.is_featured) ? 1 : 0,
    seo_title: body.seo_title ?? existing.seo_title,
    seo_description: body.seo_description ?? existing.seo_description,
    seo_keywords: body.seo_keywords ?? existing.seo_keywords,
  };

  await repo.updateProperty(id, payload);

  if (Array.isArray(body.amenity_ids)) {
    await repo.setAmenities(id, body.amenity_ids.map(Number));
  }

  await audit({ userId, action: "update", entity: "properties", entityId: String(id) });
  return true;
}
