import { db } from "../../config/db.js";

export async function insertProperty(payload) {
  const pool = db();
  const [r] = await pool.query(
    `INSERT INTO properties
    (property_uid,title,type,status,description,city,area,pincode,landmark,map_link,base_price,negotiable,taxes,brokerage,maintenance_fee,stamp_duty_estimate,video_link,brochure_path,qr_path,created_by,is_published,is_featured,seo_title,seo_description,seo_keywords)
    VALUES
    (:property_uid,:title,:type,:status,:description,:city,:area,:pincode,:landmark,:map_link,:base_price,:negotiable,:taxes,:brokerage,:maintenance_fee,:stamp_duty_estimate,:video_link,:brochure_path,:qr_path,:created_by,:is_published,:is_featured,:seo_title,:seo_description,:seo_keywords)`,
    payload
  );
  return r.insertId;
}

export async function updateProperty(id, payload) {
  const pool = db();
  await pool.query(
    `UPDATE properties SET
      title=:title, type=:type, status=:status, description=:description,
      city=:city, area=:area, pincode=:pincode, landmark=:landmark, map_link=:map_link,
      base_price=:base_price, negotiable=:negotiable, taxes=:taxes, brokerage=:brokerage, maintenance_fee=:maintenance_fee, stamp_duty_estimate=:stamp_duty_estimate,
      video_link=:video_link,
      is_published=:is_published, is_featured=:is_featured,
      seo_title=:seo_title, seo_description=:seo_description, seo_keywords=:seo_keywords
    WHERE id=:id`,
    { ...payload, id }
  );
}

export async function updatePropertyIdentity(id, { property_uid, qr_path }) {
  const pool = db();
  await pool.query(
    "UPDATE properties SET property_uid=:property_uid, qr_path=:qr_path WHERE id=:id",
    { id, property_uid, qr_path }
  );
}

export async function deleteProperty(id) {
  const pool = db();
  await pool.query("DELETE FROM properties WHERE id=:id", { id });
}

export async function getProperty(id) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM properties WHERE id=:id", { id });
  return rows[0] || null;
}

export async function listProperties({ q = "", status = "", type = "" }) {
  const pool = db();
  const where = [];
  const params = {};
  if (q) {
    where.push("(title LIKE :q OR city LIKE :q OR area LIKE :q OR property_uid LIKE :q)");
    params.q = `%${q}%`;
  }
  if (status) { where.push("status=:status"); params.status = status; }
  if (type) { where.push("type=:type"); params.type = type; }

  const sql = `SELECT * FROM properties ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function listWebsiteListings() {
  const pool = db();
  const [rows] = await pool.query(
    `SELECT id,property_uid,title,type,status,city,area,base_price,video_link,brochure_path,qr_path,
            is_featured,seo_title,seo_description,seo_keywords
     FROM properties
     WHERE is_published=1 AND status IN ('Available','Hold','Booked')
     ORDER BY is_featured DESC, updated_at DESC, id DESC`
  );
  return rows;
}

export async function setAmenities(propertyId, amenityIds = []) {
  const pool = db();
  await pool.query("DELETE FROM property_amenities WHERE property_id=:property_id", { property_id: propertyId });
  for (const aid of amenityIds) {
    await pool.query("INSERT INTO property_amenities (property_id, amenity_id) VALUES (:property_id,:amenity_id)", {
      property_id: propertyId, amenity_id: aid
    });
  }
}

export async function addImages(propertyId, relPaths = []) {
  const pool = db();
  for (const p of relPaths) {
    await pool.query("INSERT INTO property_images (property_id,image_path) VALUES (:property_id,:image_path)", {
      property_id: propertyId, image_path: p
    });
  }
}

export async function listImages(propertyId) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM property_images WHERE property_id=:property_id ORDER BY id DESC", { property_id: propertyId });
  return rows;
}
