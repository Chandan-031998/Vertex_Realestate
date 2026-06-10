import { db } from "../../config/db.js";
import { ok } from "../../utils/apiResponse.js";
import { ensureDefaultCoa } from "./accounts.service.js";

export async function listCoa(req, res, next) {
  try {
    await ensureDefaultCoa();
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM chart_of_accounts ORDER BY account_code ASC");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function upsertCoa(req, res, next) {
  try {
    const pool = db();
    const b = req.body;
    await pool.query(
      `INSERT INTO chart_of_accounts (account_code,account_name,account_type,parent_code,vertex_account_code,is_active)
       VALUES (:account_code,:account_name,:account_type,:parent_code,:vertex_account_code,1)
       ON DUPLICATE KEY UPDATE account_name=VALUES(account_name), account_type=VALUES(account_type), parent_code=VALUES(parent_code), vertex_account_code=VALUES(vertex_account_code)`,
      {
        account_code: b.account_code,
        account_name: b.account_name,
        account_type: b.account_type,
        parent_code: b.parent_code || null,
        vertex_account_code: b.vertex_account_code || null,
      }
    );
    return ok(res, {}, "Chart of account updated");
  } catch (e) { next(e); }
}

export async function listJournals(req, res, next) {
  try {
    const pool = db();
    const [rows] = await pool.query("SELECT * FROM journal_entries ORDER BY id DESC LIMIT 500");
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function journalLines(req, res, next) {
  try {
    const pool = db();
    const id = Number(req.params.id);
    const [rows] = await pool.query("SELECT * FROM journal_lines WHERE journal_entry_id=:id ORDER BY id ASC", { id });
    return ok(res, rows);
  } catch (e) { next(e); }
}

export async function reportPL(req, res, next) {
  try {
    const pool = db();
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));

    const [incomeRows] = await pool.query(
      `SELECT jl.account_code, coa.account_name, SUM(jl.cr_amount - jl.dr_amount) as amount
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       JOIN chart_of_accounts coa ON coa.account_code = jl.account_code
       WHERE coa.account_type='Income' AND DATE_FORMAT(je.txn_date, '%Y-%m')=:month
       GROUP BY jl.account_code, coa.account_name
       ORDER BY jl.account_code`,
      { month }
    );

    const [expenseRows] = await pool.query(
      `SELECT jl.account_code, coa.account_name, SUM(jl.dr_amount - jl.cr_amount) as amount
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       JOIN chart_of_accounts coa ON coa.account_code = jl.account_code
       WHERE coa.account_type='Expense' AND DATE_FORMAT(je.txn_date, '%Y-%m')=:month
       GROUP BY jl.account_code, coa.account_name
       ORDER BY jl.account_code`,
      { month }
    );

    const total_income = incomeRows.reduce((a, r) => a + Number(r.amount || 0), 0);
    const total_expense = expenseRows.reduce((a, r) => a + Number(r.amount || 0), 0);

    return ok(res, {
      month,
      total_income,
      total_expense,
      net_profit: total_income - total_expense,
      income: incomeRows,
      expenses: expenseRows,
    });
  } catch (e) { next(e); }
}

export async function reportCashflow(req, res, next) {
  try {
    const pool = db();
    const month = String(req.query.month || new Date().toISOString().slice(0, 7));
    const [rows] = await pool.query(
      `SELECT DATE(je.txn_date) as d,
              SUM(jl.dr_amount) as cash_in,
              SUM(jl.cr_amount) as cash_out
       FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id
       WHERE jl.account_code='1000' AND DATE_FORMAT(je.txn_date, '%Y-%m')=:month
       GROUP BY DATE(je.txn_date)
       ORDER BY d ASC`,
      { month }
    );
    const net = rows.reduce((a, r) => a + Number(r.cash_in || 0) - Number(r.cash_out || 0), 0);
    return ok(res, { month, net_cashflow: net, rows });
  } catch (e) { next(e); }
}

export async function reportArAp(req, res, next) {
  try {
    const pool = db();
    const [[ar]] = await pool.query("SELECT COALESCE(SUM(amount_due),0) as total FROM invoices WHERE amount_due > 0");
    const [[ap]] = await pool.query(
      "SELECT COALESCE(SUM(amount),0) as total FROM billing_notes WHERE note_type='Refund' AND status IN ('Issued','Applied')"
    );
    return ok(res, { accounts_receivable: Number(ar.total || 0), accounts_payable: Number(ap.total || 0) });
  } catch (e) {
    if (/billing_notes/i.test(String(e.message || ""))) return ok(res, { accounts_receivable: 0, accounts_payable: 0 });
    next(e);
  }
}
