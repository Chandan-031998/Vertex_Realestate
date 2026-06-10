import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { randomUUID } from "crypto";
import path from "path";
import { publicUrlFor } from "../../utils/filePaths.js";
import { postAutoJournal } from "../accounts/accounts.service.js";

async function ensureRentalOpsTables(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS tenant_move_checklists (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      checklist_uid VARCHAR(40) NOT NULL UNIQUE,
      tenant_id BIGINT NOT NULL,
      property_id BIGINT NULL,
      unit_id BIGINT NULL,
      checklist_type VARCHAR(20) NOT NULL DEFAULT 'Move-In',
      target_date DATE NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'Pending',
      checklist_json JSON NULL,
      notes TEXT NULL,
      completed_at DATETIME NULL,
      created_by BIGINT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS tenant_complaints (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      complaint_uid VARCHAR(40) NOT NULL UNIQUE,
      tenant_id BIGINT NOT NULL,
      property_id BIGINT NULL,
      unit_id BIGINT NULL,
      category VARCHAR(60) NOT NULL DEFAULT 'General',
      title VARCHAR(180) NOT NULL,
      description TEXT NULL,
      priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
      status VARCHAR(30) NOT NULL DEFAULT 'Open',
      assigned_to BIGINT NULL,
      escalation_level VARCHAR(20) NOT NULL DEFAULT 'None',
      resolution_notes TEXT NULL,
      resolved_at DATETIME NULL,
      created_by BIGINT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  const ensureCol = async (table, column, ddl) => {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE :column`, { column });
    if (rows.length) return;
    try {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    } catch (e) {
      // Multiple requests can race on first boot; ignore duplicate-column error.
      if (e?.code !== "ER_DUP_FIELDNAME") throw e;
    }
  };

  await ensureCol("maintenance_tickets", "vendor_payment_request_status", "vendor_payment_request_status VARCHAR(20) NOT NULL DEFAULT 'None'");
  await ensureCol("maintenance_tickets", "vendor_payment_requested_amount", "vendor_payment_requested_amount DECIMAL(12,2) NULL");
  await ensureCol("maintenance_tickets", "vendor_payment_requested_at", "vendor_payment_requested_at DATETIME NULL");
  await ensureCol("maintenance_tickets", "vendor_payment_requested_by", "vendor_payment_requested_by BIGINT NULL");
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function formatPeriod(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function generateSchedulesForContract(pool, contract, months = 12) {
  const step = contract.cycle === "Quarterly" ? 3 : 1;
  const total = contract.cycle === "Quarterly" ? Math.ceil(months / 3) : months;
  for (let i = 0; i < total; i += 1) {
    const due_date = addMonths(contract.start_date, i * step);
    const period_label = formatPeriod(due_date);
    await pool.query(
      `INSERT INTO rent_schedules (contract_id,due_date,period_label,amount,late_fee,status)
       VALUES (:contract_id,:due_date,:period_label,:amount,0,'Pending')`,
      {
        contract_id: contract.id,
        due_date,
        period_label,
        amount: contract.rent_amount,
      }
    );
  }
}

export async function listContracts(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const [rows] = await pool.query("SELECT * FROM rental_contracts ORDER BY id DESC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createContract(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const b = req.body;
    const rental_uid = `VTX-RNT-${randomUUID().split("-")[0].toUpperCase()}`;
    const payload = {
      rental_uid,
      property_id: Number(b.property_id),
      unit_id: b.unit_id ? Number(b.unit_id) : null,
      owner_id: b.owner_id ? Number(b.owner_id) : null,
      tenant_id: Number(b.tenant_id),
      start_date: b.start_date,
      end_date: b.end_date || null,
      rent_amount: Number(b.rent_amount || 0),
      cycle: b.cycle || "Monthly",
      due_day: Number(b.due_day || 5),
      late_fee_type: b.late_fee_type || "Flat",
      late_fee_value: Number(b.late_fee_value || 0),
    };

    const [r] = await pool.query(
      `INSERT INTO rental_contracts
       (rental_uid,property_id,unit_id,owner_id,tenant_id,start_date,end_date,rent_amount,cycle,due_day,late_fee_type,late_fee_value,is_active)
       VALUES
       (:rental_uid,:property_id,:unit_id,:owner_id,:tenant_id,:start_date,:end_date,:rent_amount,:cycle,:due_day,:late_fee_type,:late_fee_value,1)`,
      payload
    );

    await generateSchedulesForContract(pool, { ...payload, id: r.insertId }, Number(b.generate_months || 12));
    return ok(res, { id: r.insertId, rental_uid }, "Rental contract created with schedule");
  } catch (e) { next(e); }
}

export async function listSchedules(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const where = [];
    const params = {};
    if (req.query.contract_id) {
      where.push("rs.contract_id=:contract_id");
      params.contract_id = Number(req.query.contract_id);
    }
    if (req.query.status) {
      where.push("rs.status=:status");
      params.status = String(req.query.status);
    }
    const [rows] = await pool.query(
      `SELECT rs.*, rc.rental_uid, rc.property_id, rc.tenant_id
       FROM rent_schedules rs
       JOIN rental_contracts rc ON rc.id = rs.contract_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY rs.due_date ASC, rs.id ASC`,
      params
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function collectRent(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const id = Number(req.params.id);
    const b = req.body;
    const [rows] = await pool.query("SELECT * FROM rent_schedules WHERE id=:id", { id });
    if (!rows.length) return res.status(404).json({ ok: false, message: "Schedule not found" });

    const receipt_no = `RCPT-${Date.now()}-${id}`;
    const payAmount = Number(b.amount || rows[0].amount + rows[0].late_fee || 0);

    await pool.query(
      `UPDATE rent_schedules
       SET status='Paid', paid_at=NOW(), receipt_no=:receipt_no, payment_mode=:payment_mode, payment_ref=:payment_ref
       WHERE id=:id`,
      {
        id,
        receipt_no,
        payment_mode: b.payment_mode || null,
        payment_ref: b.payment_ref || null,
      }
    );

    try {
      await postAutoJournal({
        event: "rent_received",
        amount: payAmount,
        source_type: "Rentals",
        source_id: id,
        created_by: req.user.id,
        narration: `rent_received schedule ${id}`,
      });
    } catch {
      // Keep flow resilient if accounts migration is pending.
    }

    return ok(res, { receipt_no, paid_amount: payAmount }, "Rent collected");
  } catch (e) { next(e); }
}

export async function getReceipt(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const id = Number(req.params.id);
    const [rows] = await pool.query(
      `SELECT rs.*, rc.rental_uid, rc.property_id, rc.tenant_id
       FROM rent_schedules rs
       JOIN rental_contracts rc ON rc.id = rs.contract_id
       WHERE rs.id=:id`,
      { id }
    );
    if (!rows.length) return res.status(404).json({ ok: false, message: "Receipt not found" });
    return ok(res, rows[0]);
  } catch (e) { next(e); }
}

export async function runLateFeeReminder(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const [rows] = await pool.query(
      `SELECT rs.id, rs.contract_id, rs.amount, rs.status, rs.due_date, rc.late_fee_type, rc.late_fee_value, rc.tenant_id
       FROM rent_schedules rs
       JOIN rental_contracts rc ON rc.id = rs.contract_id
       WHERE rs.status IN ('Pending','Overdue') AND rs.due_date < CURDATE()`
    );

    let updated = 0;
    for (const r of rows) {
      const late_fee = r.late_fee_type === "Percent"
        ? Number(r.amount) * (Number(r.late_fee_value) / 100)
        : Number(r.late_fee_value || 0);
      await pool.query("UPDATE rent_schedules SET status='Overdue', late_fee=:late_fee WHERE id=:id", {
        id: r.id,
        late_fee: Number(late_fee.toFixed(2)),
      });
      if (r.tenant_id) {
        await pool.query(
          "INSERT INTO notifications (user_id,type,message) VALUES (NULL,'RentReminder',:msg)",
          { msg: `Rent overdue for contract ${r.contract_id}, schedule ${r.id}` }
        );
      }
      updated += 1;
    }

    return ok(res, { updated }, "Late fee and reminders processed");
  } catch (e) { next(e); }
}

export async function listMaintenanceTickets(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const [rows] = await pool.query("SELECT * FROM maintenance_tickets ORDER BY id DESC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function raiseMaintenanceTicket(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const b = req.body;
    const ticket_uid = `VTX-MNT-${randomUUID().split("-")[0].toUpperCase()}`;
    const [r] = await pool.query(
      `INSERT INTO maintenance_tickets
       (ticket_uid,property_id,unit_id,tenant_id,title,description,priority,status,sla_due_at,cost_estimate,created_by)
       VALUES
       (:ticket_uid,:property_id,:unit_id,:tenant_id,:title,:description,:priority,'Open',:sla_due_at,:cost_estimate,:created_by)`,
      {
        ticket_uid,
        property_id: Number(b.property_id),
        unit_id: b.unit_id ? Number(b.unit_id) : null,
        tenant_id: b.tenant_id ? Number(b.tenant_id) : null,
        title: b.title,
        description: b.description || null,
        priority: b.priority || "Medium",
        sla_due_at: b.sla_due_at || null,
        cost_estimate: Number(b.cost_estimate || 0),
        created_by: req.user.id,
      }
    );
    return ok(res, { id: r.insertId, ticket_uid }, "Maintenance ticket raised");
  } catch (e) { next(e); }
}

export async function assignVendor(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const id = Number(req.params.id);
    const b = req.body;
    await pool.query(
      `UPDATE maintenance_tickets
       SET vendor_name=:vendor_name, vendor_phone=:vendor_phone, assigned_at=NOW(), status='In Progress'
       WHERE id=:id`,
      { id, vendor_name: b.vendor_name || null, vendor_phone: b.vendor_phone || null }
    );
    return ok(res, {}, "Vendor assigned");
  } catch (e) { next(e); }
}

export async function updateTicketStatus(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const id = Number(req.params.id);
    const b = req.body;
    await pool.query(
      `UPDATE maintenance_tickets
       SET status=:status, resolved_at=IF(:status IN ('Resolved','Closed'), NOW(), resolved_at), cost_actual=:cost_actual
       WHERE id=:id`,
      {
        id,
        status: b.status,
        cost_actual: b.cost_actual !== undefined ? Number(b.cost_actual) : 0,
      }
    );
    return ok(res, {}, "Ticket status updated");
  } catch (e) { next(e); }
}

export async function slaReport(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const [rows] = await pool.query(
      `SELECT *,
        CASE
          WHEN status IN ('Resolved','Closed') AND resolved_at > sla_due_at THEN 1
          WHEN status NOT IN ('Resolved','Closed') AND NOW() > sla_due_at THEN 1
          ELSE 0
        END as sla_breached
       FROM maintenance_tickets
       ORDER BY id DESC`
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function listInspections(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const [rows] = await pool.query("SELECT * FROM property_inspections ORDER BY id DESC");
    return ok(res, rows.map((r) => ({ ...r, report_url: r.report_path ? publicUrlFor(r.report_path) : null })));
  } catch (e) { next(e); }
}

export async function createInspection(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const b = req.body;
    const inspection_uid = `VTX-INSP-${randomUUID().split("-")[0].toUpperCase()}`;
    const reportPath = req.file
      ? path.join("uploads", "rentals", "inspections", req.file.filename).replace(/\\/g, "/")
      : null;

    const [r] = await pool.query(
      `INSERT INTO property_inspections
       (inspection_uid,property_id,unit_id,inspector_id,inspection_date,summary,report_path,status)
       VALUES
       (:inspection_uid,:property_id,:unit_id,:inspector_id,:inspection_date,:summary,:report_path,:status)`,
      {
        inspection_uid,
        property_id: Number(b.property_id),
        unit_id: b.unit_id ? Number(b.unit_id) : null,
        inspector_id: b.inspector_id ? Number(b.inspector_id) : req.user.id,
        inspection_date: b.inspection_date,
        summary: b.summary || null,
        report_path: reportPath,
        status: b.status || "Completed",
      }
    );
    return ok(res, { id: r.insertId, inspection_uid, report_url: reportPath ? publicUrlFor(reportPath) : null }, "Inspection logged");
  } catch (e) { next(e); }
}

export async function ownerMonthlyStatement(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const ownerId = Number(req.params.ownerId);
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));

    const [incomeRows] = await pool.query(
      `SELECT rs.*
       FROM rent_schedules rs
       JOIN rental_contracts rc ON rc.id = rs.contract_id
       WHERE rc.owner_id=:owner_id
         AND rs.status='Paid'
         AND DATE_FORMAT(rs.paid_at, '%Y-%m') = :month`,
      { owner_id: ownerId, month }
    );

    const [expenseRows] = await pool.query(
      `SELECT mt.*
       FROM maintenance_tickets mt
       JOIN owner_properties op ON op.property_id = mt.property_id
       WHERE op.owner_id=:owner_id
         AND DATE_FORMAT(COALESCE(mt.resolved_at, mt.created_at), '%Y-%m') = :month`,
      { owner_id: ownerId, month }
    );

    const income = incomeRows.reduce((a, r) => a + Number(r.amount || 0) + Number(r.late_fee || 0), 0);
    const expense = expenseRows.reduce((a, r) => a + Number(r.cost_actual || r.cost_estimate || 0), 0);

    return ok(res, {
      month,
      income,
      expense,
      net: income - expense,
      income_items: incomeRows,
      expense_items: expenseRows,
    });
  } catch (e) { next(e); }
}

export async function requestVendorPayment(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const id = Number(req.params.id);
    const amount = Number(req.body?.amount || 0);
    if (!amount || amount < 0) return res.status(400).json({ ok: false, message: "Valid amount required" });

    await pool.query(
      `UPDATE maintenance_tickets
       SET vendor_payment_request_status='Requested',
           vendor_payment_requested_amount=:amount,
           vendor_payment_requested_at=NOW(),
           vendor_payment_requested_by=:user_id
       WHERE id=:id`,
      { id, amount, user_id: req.user.id }
    );
    await pool.query(
      `INSERT INTO notifications (user_id,type,message,related_type,related_id)
       VALUES (NULL,'VendorPaymentRequest',:message,'maintenance_ticket',:id)`,
      { id, message: `Vendor payment requested for maintenance ticket ${id}.` }
    );

    return ok(res, {}, "Vendor payment request submitted");
  } catch (e) { next(e); }
}

export async function listMoveChecklists(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const params = {};
    const where = [];
    if (req.query.tenant_id) {
      where.push("m.tenant_id=:tenant_id");
      params.tenant_id = Number(req.query.tenant_id);
    }
    if (req.query.checklist_type) {
      where.push("m.checklist_type=:checklist_type");
      params.checklist_type = String(req.query.checklist_type);
    }
    if (req.query.status) {
      where.push("m.status=:status");
      params.status = String(req.query.status);
    }

    const [rows] = await pool.query(
      `SELECT m.*, t.tenant_uid, t.name as tenant_name, p.property_uid
       FROM tenant_move_checklists m
       JOIN tenants t ON t.id = m.tenant_id
       LEFT JOIN properties p ON p.id = m.property_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY m.id DESC`,
      params
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createMoveChecklist(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const b = req.body;
    const checklist_uid = `VTX-MOVE-${randomUUID().split("-")[0].toUpperCase()}`;
    const [r] = await pool.query(
      `INSERT INTO tenant_move_checklists
       (checklist_uid,tenant_id,property_id,unit_id,checklist_type,target_date,status,checklist_json,notes,created_by)
       VALUES
       (:checklist_uid,:tenant_id,:property_id,:unit_id,:checklist_type,:target_date,:status,:checklist_json,:notes,:created_by)`,
      {
        checklist_uid,
        tenant_id: Number(b.tenant_id),
        property_id: b.property_id ? Number(b.property_id) : null,
        unit_id: b.unit_id ? Number(b.unit_id) : null,
        checklist_type: b.checklist_type || "Move-In",
        target_date: b.target_date || null,
        status: b.status || "Pending",
        checklist_json: b.checklist_json ? JSON.stringify(b.checklist_json) : null,
        notes: b.notes || null,
        created_by: req.user.id,
      }
    );
    return ok(res, { id: r.insertId, checklist_uid }, "Move checklist created");
  } catch (e) { next(e); }
}

export async function updateMoveChecklist(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const id = Number(req.params.id);
    const b = req.body;
    const status = String(b.status || "Pending");
    const completionExpr = status === "Completed" ? "NOW()" : "NULL";
    await pool.query(
      `UPDATE tenant_move_checklists
       SET status=:status,
           notes=:notes,
           checklist_json=:checklist_json,
           completed_at=${completionExpr}
       WHERE id=:id`,
      {
        id,
        status,
        notes: b.notes || null,
        checklist_json: b.checklist_json ? JSON.stringify(b.checklist_json) : null,
      }
    );
    return ok(res, {}, "Checklist updated");
  } catch (e) { next(e); }
}

export async function listTenantComplaints(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const params = {};
    const where = [];
    if (req.query.tenant_id) {
      where.push("c.tenant_id=:tenant_id");
      params.tenant_id = Number(req.query.tenant_id);
    }
    if (req.query.status) {
      where.push("c.status=:status");
      params.status = String(req.query.status);
    }

    const [rows] = await pool.query(
      `SELECT c.*, t.tenant_uid, t.name as tenant_name, p.property_uid
       FROM tenant_complaints c
       JOIN tenants t ON t.id = c.tenant_id
       LEFT JOIN properties p ON p.id = c.property_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY c.id DESC`,
      params
    );
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function createTenantComplaint(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const b = req.body;
    const complaint_uid = `VTX-CMP-${randomUUID().split("-")[0].toUpperCase()}`;
    const [r] = await pool.query(
      `INSERT INTO tenant_complaints
       (complaint_uid,tenant_id,property_id,unit_id,category,title,description,priority,status,assigned_to,escalation_level,created_by)
       VALUES
       (:complaint_uid,:tenant_id,:property_id,:unit_id,:category,:title,:description,:priority,:status,:assigned_to,:escalation_level,:created_by)`,
      {
        complaint_uid,
        tenant_id: Number(b.tenant_id),
        property_id: b.property_id ? Number(b.property_id) : null,
        unit_id: b.unit_id ? Number(b.unit_id) : null,
        category: b.category || "General",
        title: b.title,
        description: b.description || null,
        priority: b.priority || "Medium",
        status: b.status || "Open",
        assigned_to: b.assigned_to ? Number(b.assigned_to) : null,
        escalation_level: b.escalation_level || "None",
        created_by: req.user.id,
      }
    );
    return ok(res, { id: r.insertId, complaint_uid }, "Complaint created");
  } catch (e) { next(e); }
}

export async function updateTenantComplaint(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const id = Number(req.params.id);
    const b = req.body;
    const status = String(b.status || "Open");
    const resolvedExpr = ["Resolved", "Closed"].includes(status) ? "NOW()" : "NULL";
    await pool.query(
      `UPDATE tenant_complaints
       SET status=:status,
           priority=:priority,
           escalation_level=:escalation_level,
           resolution_notes=:resolution_notes,
           assigned_to=:assigned_to,
           resolved_at=${resolvedExpr}
       WHERE id=:id`,
      {
        id,
        status,
        priority: b.priority || "Medium",
        escalation_level: b.escalation_level || "None",
        resolution_notes: b.resolution_notes || null,
        assigned_to: b.assigned_to ? Number(b.assigned_to) : null,
      }
    );
    return ok(res, {}, "Complaint updated");
  } catch (e) { next(e); }
}

export async function rentalProfitability(req, res, next) {
  try {
    const pool = db();
    await ensureRentalOpsTables(pool);
    const from = String(req.query.from || "1900-01-01").slice(0, 10);
    const to = String(req.query.to || "2999-12-31").slice(0, 10);
    const [rows] = await pool.query(
      `SELECT
         p.id as property_id,
         p.property_uid,
         p.title,
         COALESCE((SELECT SUM(rs.amount + rs.late_fee)
                   FROM rent_schedules rs
                   JOIN rental_contracts rc ON rc.id = rs.contract_id
                   WHERE rc.property_id = p.id
                     AND rs.status='Paid'
                     AND DATE(COALESCE(rs.paid_at, rs.updated_at, rs.created_at)) BETWEEN :from AND :to), 0) as income,
         COALESCE((SELECT SUM(COALESCE(mt.cost_actual, mt.cost_estimate, 0))
                   FROM maintenance_tickets mt
                   WHERE mt.property_id = p.id
                     AND DATE(COALESCE(mt.resolved_at, mt.created_at)) BETWEEN :from AND :to), 0) as expense
       FROM properties p
       ORDER BY p.id DESC`,
      { from, to }
    );
    const out = rows
      .map((r) => {
        const income = Number(r.income || 0);
        const expense = Number(r.expense || 0);
        const net = income - expense;
        return {
          property_id: r.property_id,
          property_uid: r.property_uid,
          title: r.title,
          income,
          expense,
          net,
          margin_pct: income > 0 ? Number(((net / income) * 100).toFixed(2)) : 0,
        };
      })
      .filter((r) => r.income !== 0 || r.expense !== 0);
    return ok(res, { from, to, rows: out });
  } catch (e) { next(e); }
}
