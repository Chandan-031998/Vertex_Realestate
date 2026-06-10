import { ok } from "../../../utils/apiResponse.js";
import * as repo from "./inventory.repo.js";

export async function addTower(req, res, next) {
  try {
    const id = await repo.addTower({ property_id: Number(req.body.property_id), name: req.body.name });
    return ok(res, { id }, "Tower added");
  } catch (e) { next(e); }
}
export async function listTowers(req, res, next) {
  try {
    const rows = await repo.listTowers(Number(req.query.property_id));
    return ok(res, rows);
  } catch (e) { next(e); }
}
export async function updateTower(req, res, next) {
  try {
    await repo.updateTower({ id: Number(req.params.id), name: req.body.name });
    return ok(res, {}, "Tower updated");
  } catch (e) { next(e); }
}
export async function deleteTower(req, res, next) {
  try {
    await repo.deleteTower(Number(req.params.id));
    return ok(res, {}, "Tower deleted");
  } catch (e) { next(e); }
}

export async function addFloor(req, res, next) {
  try {
    const id = await repo.addFloor({ tower_id: Number(req.body.tower_id), floor_no: Number(req.body.floor_no) });
    return ok(res, { id }, "Floor added");
  } catch (e) { next(e); }
}
export async function listFloors(req, res, next) {
  try {
    const rows = await repo.listFloors(Number(req.query.tower_id));
    return ok(res, rows);
  } catch (e) { next(e); }
}
export async function updateFloor(req, res, next) {
  try {
    await repo.updateFloor({ id: Number(req.params.id), floor_no: Number(req.body.floor_no) });
    return ok(res, {}, "Floor updated");
  } catch (e) { next(e); }
}
export async function deleteFloor(req, res, next) {
  try {
    await repo.deleteFloor(Number(req.params.id));
    return ok(res, {}, "Floor deleted");
  } catch (e) { next(e); }
}

export async function addUnit(req, res, next) {
  try {
    const id = await repo.addUnit({
      floor_id: Number(req.body.floor_id),
      unit_no: req.body.unit_no,
      bhk: req.body.bhk,
      area_sqft: req.body.area_sqft ? Number(req.body.area_sqft) : null,
      status: req.body.status,
      price: req.body.price ? Number(req.body.price) : 0
    });
    return ok(res, { id }, "Unit added");
  } catch (e) { next(e); }
}
export async function listUnits(req, res, next) {
  try {
    const rows = await repo.listUnits(Number(req.query.floor_id));
    return ok(res, rows);
  } catch (e) { next(e); }
}
export async function updateUnit(req, res, next) {
  try {
    await repo.updateUnit({
      id: Number(req.params.id),
      unit_no: req.body.unit_no,
      bhk: req.body.bhk,
      area_sqft: req.body.area_sqft ? Number(req.body.area_sqft) : null,
      status: req.body.status,
      price: req.body.price ? Number(req.body.price) : 0,
    });
    return ok(res, {}, "Unit updated");
  } catch (e) { next(e); }
}
export async function deleteUnit(req, res, next) {
  try {
    await repo.deleteUnit(Number(req.params.id));
    return ok(res, {}, "Unit deleted");
  } catch (e) { next(e); }
}
