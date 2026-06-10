import { db } from "../../../config/db.js";

export async function addTower({ property_id, name }) {
  const pool = db();
  const [r] = await pool.query("INSERT INTO towers (property_id,name) VALUES (:property_id,:name)", { property_id, name });
  return r.insertId;
}
export async function listTowers(property_id) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM towers WHERE property_id=:property_id ORDER BY id DESC", { property_id });
  return rows;
}
export async function updateTower({ id, name }) {
  const pool = db();
  await pool.query("UPDATE towers SET name=:name WHERE id=:id", { id, name });
}
export async function deleteTower(id) {
  const pool = db();
  await pool.query("DELETE FROM towers WHERE id=:id", { id });
}
export async function addFloor({ tower_id, floor_no }) {
  const pool = db();
  const [r] = await pool.query("INSERT INTO floors (tower_id,floor_no) VALUES (:tower_id,:floor_no)", { tower_id, floor_no });
  return r.insertId;
}
export async function listFloors(tower_id) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM floors WHERE tower_id=:tower_id ORDER BY floor_no ASC", { tower_id });
  return rows;
}
export async function updateFloor({ id, floor_no }) {
  const pool = db();
  await pool.query("UPDATE floors SET floor_no=:floor_no WHERE id=:id", { id, floor_no });
}
export async function deleteFloor(id) {
  const pool = db();
  await pool.query("DELETE FROM floors WHERE id=:id", { id });
}
export async function addUnit({ floor_id, unit_no, bhk, area_sqft, status, price }) {
  const pool = db();
  const [r] = await pool.query(
    "INSERT INTO units (floor_id,unit_no,bhk,area_sqft,status,price) VALUES (:floor_id,:unit_no,:bhk,:area_sqft,:status,:price)",
    { floor_id, unit_no, bhk: bhk||null, area_sqft: area_sqft||null, status: status||"Available", price: price||0 }
  );
  return r.insertId;
}
export async function listUnits(floor_id) {
  const pool = db();
  const [rows] = await pool.query("SELECT * FROM units WHERE floor_id=:floor_id ORDER BY id DESC", { floor_id });
  return rows;
}
export async function updateUnit({ id, unit_no, bhk, area_sqft, status, price }) {
  const pool = db();
  await pool.query(
    "UPDATE units SET unit_no=:unit_no,bhk=:bhk,area_sqft=:area_sqft,status=:status,price=:price WHERE id=:id",
    { id, unit_no, bhk: bhk || null, area_sqft: area_sqft || null, status: status || "Available", price: price || 0 }
  );
}
export async function deleteUnit(id) {
  const pool = db();
  await pool.query("DELETE FROM units WHERE id=:id", { id });
}
