import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";

export async function overview(req, res, next) {
  try {
    const pool = db();
    const [[props]] = await pool.query("SELECT COUNT(*) as total FROM properties");
    const [[leads]] = await pool.query("SELECT COUNT(*) as total FROM leads");
    const [[bookings]] = await pool.query("SELECT COUNT(*) as total FROM bookings");
    const [[unpaid]] = await pool.query("SELECT COUNT(*) as total FROM invoices WHERE status <> 'Paid'");
    return ok(res, {
      properties: props.total,
      leads: leads.total,
      bookings: bookings.total,
      invoices_unpaid: unpaid.total
    });
  } catch (e) { next(e); }
}
