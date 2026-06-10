import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";

function parseRange(req) {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(today.getDate() - 30);
  const from = String(req.query.from || defaultFrom.toISOString().slice(0, 10)).slice(0, 10);
  const to = String(req.query.to || today.toISOString().slice(0, 10)).slice(0, 10);
  return { from, to };
}

function esc(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function makePdf(lines) {
  const content = ["BT", "/F1 10 Tf", "42 805 Td", "14 TL"];
  for (const l of lines) {
    content.push(`(${esc(l)}) Tj`);
    content.push("T*");
  }
  content.push("ET");
  const stream = content.join("\n");

  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offs = [0];
  for (const o of objs) {
    offs.push(Buffer.byteLength(pdf));
    pdf += o;
  }
  const x = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objs.length; i += 1) pdf += `${String(offs[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return Buffer.from(pdf);
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (!/[",\n]/.test(s)) return s;
  return `"${s.replace(/"/g, "\"\"")}"`;
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

async function hasColumn(pool, table, column) {
  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE :column`, { column });
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function invoiceRevenueStrategy(pool) {
  const [hasTotalPaid, hasAmount, hasAmountDue, hasInvoiceDate, hasCreatedAt] = await Promise.all([
    hasColumn(pool, "invoices", "total_paid"),
    hasColumn(pool, "invoices", "amount"),
    hasColumn(pool, "invoices", "amount_due"),
    hasColumn(pool, "invoices", "invoice_date"),
    hasColumn(pool, "invoices", "created_at"),
  ]);

  const revenueExpr = hasTotalPaid
    ? "SUM(COALESCE(i.total_paid, 0))"
    : hasAmount && hasAmountDue
      ? "SUM(GREATEST(COALESCE(i.amount, 0) - COALESCE(i.amount_due, 0), 0))"
      : hasAmount
        ? "SUM(COALESCE(i.amount, 0))"
        : "0";

  const dateExpr = hasInvoiceDate
    ? "DATE(i.invoice_date)"
    : hasCreatedAt
      ? "DATE(i.created_at)"
      : null;

  return { revenueExpr, dateExpr };
}

async function bookingRefundStrategy(pool) {
  const [hasRefundAmount, hasRefundStatus, hasRefundApprovedAt, hasCreatedAt] = await Promise.all([
    hasColumn(pool, "bookings", "refund_amount"),
    hasColumn(pool, "bookings", "refund_status"),
    hasColumn(pool, "bookings", "refund_approved_at"),
    hasColumn(pool, "bookings", "created_at"),
  ]);

  if (!hasRefundAmount) {
    return { refundExpr: "0", refundDateExpr: null, refundStatusExpr: null };
  }

  const refundExpr = "SUM(COALESCE(b2.refund_amount, 0))";
  const refundDateExpr = hasRefundApprovedAt
    ? "DATE(COALESCE(b2.refund_approved_at, b2.created_at))"
    : hasCreatedAt
      ? "DATE(b2.created_at)"
      : null;
  const refundStatusExpr = hasRefundStatus ? "b2.refund_status IN ('Approved','Processed')" : null;
  return { refundExpr, refundDateExpr, refundStatusExpr };
}

async function buildAnalytics(pool, from, to) {
  const dateParams = { from, to };
  const invoiceStrategy = await invoiceRevenueStrategy(pool);
  const bookingRefund = await bookingRefundStrategy(pool);

  const [inventoryProperty] = await pool.query(
    `SELECT status, COUNT(*) as count
     FROM properties
     WHERE DATE(created_at) BETWEEN :from AND :to
     GROUP BY status
     ORDER BY count DESC`,
    dateParams
  );
  const [inventoryUnits] = await pool.query(
    `SELECT u.status, COUNT(*) as count
     FROM units u
     WHERE DATE(u.created_at) BETWEEN :from AND :to
     GROUP BY u.status
     ORDER BY count DESC`,
    dateParams
  );

  const [funnelRows] = await pool.query(
    `SELECT stage, COUNT(*) as count
     FROM leads
     WHERE DATE(created_at) BETWEEN :from AND :to
     GROUP BY stage
     ORDER BY count DESC`,
    dateParams
  );
  const funnelTotal = funnelRows.reduce((a, r) => a + num(r.count), 0);
  const funnelClosed = funnelRows
    .filter((r) => String(r.stage || "").toLowerCase() === "closed")
    .reduce((a, r) => a + num(r.count), 0);

  const [sourceRows] = await pool.query(
    `SELECT
       COALESCE(source, 'Unknown') as source,
       COUNT(*) as lead_count,
       SUM(CASE WHEN stage='Closed' THEN 1 ELSE 0 END) as conversions,
       ROUND((SUM(CASE WHEN stage='Closed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100, 2) as conversion_pct
     FROM leads
     WHERE DATE(created_at) BETWEEN :from AND :to
     GROUP BY COALESCE(source, 'Unknown')
     ORDER BY lead_count DESC`,
    dateParams
  );

  const [agentRows] = await pool.query(
    `SELECT
       u.id as agent_id,
       u.name as agent_name,
       u.role,
       (SELECT COUNT(*) FROM site_visits sv WHERE sv.agent_id=u.id AND DATE(sv.created_at) BETWEEN :from AND :to) as site_visits,
       (SELECT COUNT(*) FROM bookings b WHERE b.created_by=u.id AND DATE(b.created_at) BETWEEN :from AND :to) as bookings,
       (SELECT COUNT(*) FROM leads l WHERE l.assigned_to=u.id AND l.stage='Closed' AND DATE(l.created_at) BETWEEN :from AND :to) as closures
     FROM users u
     WHERE u.role IN ('Sales Agent','Sales Manager')
     ORDER BY closures DESC, bookings DESC, site_visits DESC`,
    dateParams
  );

  const [rentRows] = await pool.query(
    `SELECT
       COUNT(*) as schedule_count,
       SUM(amount + late_fee) as due_total,
       SUM(CASE WHEN status='Paid' THEN amount + late_fee ELSE 0 END) as paid_total,
       SUM(CASE WHEN status IN ('Pending','Overdue') THEN amount + late_fee ELSE 0 END) as outstanding_total,
       SUM(CASE WHEN status='Overdue' THEN 1 ELSE 0 END) as overdue_count
     FROM rent_schedules
     WHERE DATE(due_date) BETWEEN :from AND :to`,
    dateParams
  );

  const [maintenanceRows] = await pool.query(
    `SELECT
       COUNT(*) as ticket_count,
       SUM(cost_estimate) as estimated_cost,
       SUM(cost_actual) as actual_cost,
       ROUND(AVG(cost_actual), 2) as avg_actual_cost,
       SUM(CASE WHEN status='Open' THEN 1 ELSE 0 END) as open_count,
       SUM(CASE WHEN status='In Progress' THEN 1 ELSE 0 END) as in_progress_count,
       SUM(CASE WHEN status='Resolved' THEN 1 ELSE 0 END) as resolved_count,
       SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) as closed_count
     FROM maintenance_tickets
     WHERE DATE(created_at) BETWEEN :from AND :to`,
    dateParams
  );

  const [profitabilityRows] = await pool.query(
    `SELECT
       p.id as property_id,
       p.property_uid,
       p.title,
       p.status,
       COALESCE((SELECT ${invoiceStrategy.revenueExpr} FROM invoices i WHERE i.property_id=p.id ${
         invoiceStrategy.dateExpr ? `AND ${invoiceStrategy.dateExpr} BETWEEN :from AND :to` : ""
       }), 0) as invoice_revenue,
       COALESCE((SELECT SUM(b.token_amount) FROM bookings b WHERE b.property_id=p.id AND b.status IN ('Booked','Sold','Rented') AND DATE(b.created_at) BETWEEN :from AND :to), 0) as token_revenue,
       COALESCE((SELECT SUM(mt.cost_actual) FROM maintenance_tickets mt WHERE mt.property_id=p.id AND DATE(mt.created_at) BETWEEN :from AND :to), 0) as maintenance_cost,
       COALESCE((SELECT ${bookingRefund.refundExpr} FROM bookings b2 WHERE b2.property_id=p.id ${
         bookingRefund.refundStatusExpr ? `AND ${bookingRefund.refundStatusExpr}` : ""
       } ${
         bookingRefund.refundDateExpr ? `AND ${bookingRefund.refundDateExpr} BETWEEN :from AND :to` : ""
       }), 0) as refunds
     FROM properties p
     ORDER BY p.id DESC`,
    dateParams
  );
  const profitability = profitabilityRows
    .map((r) => {
      const gross_revenue = num(r.invoice_revenue) + num(r.token_revenue);
      const total_cost = num(r.maintenance_cost) + num(r.refunds);
      const net_profit = gross_revenue - total_cost;
      return {
        property_id: r.property_id,
        property_uid: r.property_uid,
        title: r.title,
        status: r.status,
        gross_revenue,
        total_cost,
        net_profit,
        margin_pct: gross_revenue > 0 ? Number(((net_profit / gross_revenue) * 100).toFixed(2)) : 0,
      };
    })
    .filter((r) => r.gross_revenue !== 0 || r.total_cost !== 0)
    .sort((a, b) => b.net_profit - a.net_profit);

  return {
    range: { from, to },
    inventory_summary: {
      properties_by_status: inventoryProperty,
      units_by_status: inventoryUnits,
    },
    sales_funnel: {
      total_leads: funnelTotal,
      closed_leads: funnelClosed,
      conversion_pct: funnelTotal > 0 ? Number(((funnelClosed / funnelTotal) * 100).toFixed(2)) : 0,
      by_stage: funnelRows,
    },
    source_performance: sourceRows,
    agent_performance: agentRows.map((r) => ({
      ...r,
      closure_rate_pct: num(r.bookings) > 0 ? Number(((num(r.closures) / num(r.bookings)) * 100).toFixed(2)) : 0,
    })),
    rent_due_vs_paid: {
      schedule_count: num(rentRows[0]?.schedule_count),
      due_total: num(rentRows[0]?.due_total),
      paid_total: num(rentRows[0]?.paid_total),
      outstanding_total: num(rentRows[0]?.outstanding_total),
      overdue_count: num(rentRows[0]?.overdue_count),
    },
    maintenance_cost_stats: {
      ticket_count: num(maintenanceRows[0]?.ticket_count),
      estimated_cost: num(maintenanceRows[0]?.estimated_cost),
      actual_cost: num(maintenanceRows[0]?.actual_cost),
      avg_actual_cost: num(maintenanceRows[0]?.avg_actual_cost),
      open_count: num(maintenanceRows[0]?.open_count),
      in_progress_count: num(maintenanceRows[0]?.in_progress_count),
      resolved_count: num(maintenanceRows[0]?.resolved_count),
      closed_count: num(maintenanceRows[0]?.closed_count),
    },
    property_profitability: profitability,
  };
}

export async function salesFunnel(req, res, next) {
  try {
    const pool = db();
    const { from, to } = parseRange(req);
    const [rows] = await pool.query(
      "SELECT stage, COUNT(*) as count FROM leads WHERE DATE(created_at) BETWEEN :from AND :to GROUP BY stage ORDER BY count DESC",
      { from, to }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function rentDues(req, res, next) {
  try {
    const pool = db();
    const { from, to } = parseRange(req);
    const [rows] = await pool.query(
      `SELECT id,period_label,due_date,amount,late_fee,status,receipt_no
       FROM rent_schedules
       WHERE DATE(due_date) BETWEEN :from AND :to
       ORDER BY due_date DESC LIMIT 300`,
      { from, to }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function agentPerformance(req, res, next) {
  try {
    const pool = db();
    const { from, to } = parseRange(req);
    const [rows] = await pool.query(
      `SELECT
         u.id as agent_id,
         u.name as agent_name,
         (SELECT COUNT(*) FROM site_visits sv WHERE sv.agent_id=u.id AND DATE(sv.created_at) BETWEEN :from AND :to) as site_visits,
         (SELECT COUNT(*) FROM bookings b WHERE b.created_by=u.id AND DATE(b.created_at) BETWEEN :from AND :to) as bookings,
         (SELECT COUNT(*) FROM leads l WHERE l.assigned_to=u.id AND l.stage='Closed' AND DATE(l.created_at) BETWEEN :from AND :to) as closures
       FROM users u
       WHERE u.role IN ('Sales Agent','Sales Manager')
       ORDER BY closures DESC, bookings DESC, site_visits DESC`,
      { from, to }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function sourcePerformance(req, res, next) {
  try {
    const pool = db();
    const { from, to } = parseRange(req);
    const [rows] = await pool.query(
      `SELECT
         COALESCE(source, 'Unknown') as source,
         COUNT(*) as lead_count,
         SUM(CASE WHEN stage='Closed' THEN 1 ELSE 0 END) as closures,
         ROUND((SUM(CASE WHEN stage='Closed' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0)) * 100, 2) as conversion_pct
       FROM leads
       WHERE DATE(created_at) BETWEEN :from AND :to
       GROUP BY COALESCE(source, 'Unknown')
       ORDER BY lead_count DESC`,
      { from, to }
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function upsertCampaignSpend(req, res, next) {
  try {
    const pool = db();
    const month_label = String(req.body?.month || new Date().toISOString().slice(0, 7)).slice(0, 7);
    const source = String(req.body?.source || "").trim();
    const campaign = String(req.body?.campaign || "").trim() || null;
    const spend_amount = Number(req.body?.spend_amount || 0);
    if (!source) return res.status(400).json({ ok: false, message: "source is required" });

    await pool.query(
      `INSERT INTO marketing_campaign_spend (month_label,source,campaign,spend_amount,created_by)
       VALUES (:month_label,:source,:campaign,:spend_amount,:created_by)
       ON DUPLICATE KEY UPDATE spend_amount=VALUES(spend_amount), updated_at=CURRENT_TIMESTAMP`,
      { month_label, source, campaign, spend_amount, created_by: req.user.id }
    );
    return ok(res, {}, "Campaign spend updated");
  } catch (e) { next(e); }
}

export async function campaignPerformance(req, res, next) {
  try {
    const pool = db();
    const month = String(req.query.month || new Date().toISOString().slice(0, 7)).slice(0, 7);
    const [rows] = await pool.query(
      `SELECT
         base.source,
         base.campaign,
         base.lead_count,
         base.conversions,
         ROUND((base.conversions / NULLIF(base.lead_count, 0)) * 100, 2) as conversion_pct,
         COALESCE(ms.spend_amount, 0) as spend_amount,
         ROUND(COALESCE(ms.spend_amount, 0) / NULLIF(base.lead_count, 0), 2) as cpl
       FROM (
         SELECT
           COALESCE(source, 'Unknown') as source,
           COALESCE(campaign, 'General') as campaign,
           COUNT(*) as lead_count,
           SUM(CASE WHEN stage='Closed' THEN 1 ELSE 0 END) as conversions
         FROM leads
         WHERE DATE_FORMAT(created_at, '%Y-%m') = :month
         GROUP BY COALESCE(source, 'Unknown'), COALESCE(campaign, 'General')
       ) base
       LEFT JOIN marketing_campaign_spend ms
         ON ms.month_label = :month
        AND ms.source = base.source
        AND COALESCE(ms.campaign, 'General') = base.campaign
       ORDER BY conversions DESC, lead_count DESC`,
      { month }
    );
    return ok(res, { month, rows });
  } catch (e) { next(e); }
}

export async function analyticsSummary(req, res, next) {
  try {
    const pool = db();
    const { from, to } = parseRange(req);
    const out = await buildAnalytics(pool, from, to);
    return ok(res, out);
  } catch (e) { next(e); }
}

export async function exportAnalytics(req, res, next) {
  try {
    const pool = db();
    const { from, to } = parseRange(req);
    const format = String(req.query.format || "excel").toLowerCase();
    const data = await buildAnalytics(pool, from, to);

    if (format === "pdf") {
      const lines = [
        `Vertex Reports & Analytics (${from} to ${to})`,
        "",
        "Inventory Summary",
        ...data.inventory_summary.properties_by_status.map((r) => `Property ${r.status}: ${r.count}`),
        ...data.inventory_summary.units_by_status.map((r) => `Unit ${r.status}: ${r.count}`),
        "",
        `Sales Funnel: Total ${data.sales_funnel.total_leads}, Closed ${data.sales_funnel.closed_leads}, Conversion ${data.sales_funnel.conversion_pct}%`,
        "",
        "Source Performance",
        ...data.source_performance.slice(0, 10).map((r) => `${r.source}: Leads ${r.lead_count}, Conv ${r.conversions}, ${r.conversion_pct}%`),
        "",
        "Rent Due vs Paid",
        `Due ${data.rent_due_vs_paid.due_total}, Paid ${data.rent_due_vs_paid.paid_total}, Outstanding ${data.rent_due_vs_paid.outstanding_total}`,
        "",
        "Maintenance Cost Stats",
        `Tickets ${data.maintenance_cost_stats.ticket_count}, Estimated ${data.maintenance_cost_stats.estimated_cost}, Actual ${data.maintenance_cost_stats.actual_cost}`,
        "",
        "Top Property Profitability",
        ...data.property_profitability.slice(0, 10).map((r) => `${r.property_uid}: Revenue ${r.gross_revenue}, Cost ${r.total_cost}, Net ${r.net_profit}`),
      ];
      const pdf = makePdf(lines.slice(0, 180));
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="analytics_${from}_to_${to}.pdf"`);
      return res.status(200).send(pdf);
    }

    const csvLines = [];
    csvLines.push(`Report Range,${from},${to}`);
    csvLines.push("");
    csvLines.push("Inventory Summary - Properties");
    csvLines.push("Status,Count");
    data.inventory_summary.properties_by_status.forEach((r) => csvLines.push(`${csvEscape(r.status)},${num(r.count)}`));
    csvLines.push("");
    csvLines.push("Inventory Summary - Units");
    csvLines.push("Status,Count");
    data.inventory_summary.units_by_status.forEach((r) => csvLines.push(`${csvEscape(r.status)},${num(r.count)}`));
    csvLines.push("");
    csvLines.push("Sales Funnel Conversion");
    csvLines.push(`Total Leads,${data.sales_funnel.total_leads}`);
    csvLines.push(`Closed Leads,${data.sales_funnel.closed_leads}`);
    csvLines.push(`Conversion %,${data.sales_funnel.conversion_pct}`);
    csvLines.push("");
    csvLines.push("Source Performance");
    csvLines.push("Source,Leads,Conversions,Conversion %");
    data.source_performance.forEach((r) => csvLines.push(`${csvEscape(r.source)},${num(r.lead_count)},${num(r.conversions)},${num(r.conversion_pct)}`));
    csvLines.push("");
    csvLines.push("Agent Performance");
    csvLines.push("Agent,Role,Site Visits,Bookings,Closures,Closure Rate %");
    data.agent_performance.forEach((r) => csvLines.push(`${csvEscape(r.agent_name)},${csvEscape(r.role)},${num(r.site_visits)},${num(r.bookings)},${num(r.closures)},${num(r.closure_rate_pct)}`));
    csvLines.push("");
    csvLines.push("Rent Due vs Paid");
    csvLines.push(`Schedule Count,${data.rent_due_vs_paid.schedule_count}`);
    csvLines.push(`Due Total,${data.rent_due_vs_paid.due_total}`);
    csvLines.push(`Paid Total,${data.rent_due_vs_paid.paid_total}`);
    csvLines.push(`Outstanding Total,${data.rent_due_vs_paid.outstanding_total}`);
    csvLines.push(`Overdue Count,${data.rent_due_vs_paid.overdue_count}`);
    csvLines.push("");
    csvLines.push("Maintenance Cost Stats");
    csvLines.push(`Ticket Count,${data.maintenance_cost_stats.ticket_count}`);
    csvLines.push(`Estimated Cost,${data.maintenance_cost_stats.estimated_cost}`);
    csvLines.push(`Actual Cost,${data.maintenance_cost_stats.actual_cost}`);
    csvLines.push(`Avg Actual Cost,${data.maintenance_cost_stats.avg_actual_cost}`);
    csvLines.push("");
    csvLines.push("Property Profitability");
    csvLines.push("Property UID,Title,Status,Gross Revenue,Total Cost,Net Profit,Margin %");
    data.property_profitability.forEach((r) => {
      csvLines.push(`${csvEscape(r.property_uid)},${csvEscape(r.title)},${csvEscape(r.status)},${num(r.gross_revenue)},${num(r.total_cost)},${num(r.net_profit)},${num(r.margin_pct)}`);
    });

    const csv = csvLines.join("\n");
    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="analytics_${from}_to_${to}.xls"`);
    return res.status(200).send(csv);
  } catch (e) { next(e); }
}
