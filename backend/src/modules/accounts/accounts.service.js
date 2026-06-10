import { db } from "../../config/db.js";

const DEFAULT_ACCOUNTS = [
  { code: "1000", name: "Cash and Bank", type: "Asset", vertex: "VTX-CASH" },
  { code: "1100", name: "Accounts Receivable", type: "Asset", vertex: "VTX-AR" },
  { code: "2100", name: "Accounts Payable", type: "Liability", vertex: "VTX-AP" },
  { code: "4001", name: "Token Income", type: "Income", vertex: "VTX-INC-TOKEN" },
  { code: "4002", name: "Rent Income", type: "Income", vertex: "VTX-INC-RENT" },
  { code: "4003", name: "Brokerage Income", type: "Income", vertex: "VTX-INC-BROKERAGE" },
  { code: "5001", name: "Refund Expense", type: "Expense", vertex: "VTX-EXP-REFUND" },
];

function mapAutoAccount(event) {
  if (event === "token_received") return "4001";
  if (event === "rent_received") return "4002";
  if (event === "brokerage_income") return "4003";
  if (event === "refund_paid") return "5001";
  return null;
}

export async function ensureDefaultCoa() {
  const pool = db();
  for (const a of DEFAULT_ACCOUNTS) {
    await pool.query(
      `INSERT INTO chart_of_accounts (account_code,account_name,account_type,vertex_account_code,is_active)
       VALUES (:account_code,:account_name,:account_type,:vertex_account_code,1)
       ON DUPLICATE KEY UPDATE account_name=VALUES(account_name), account_type=VALUES(account_type), vertex_account_code=VALUES(vertex_account_code)`,
      {
        account_code: a.code,
        account_name: a.name,
        account_type: a.type,
        vertex_account_code: a.vertex,
      }
    );
  }
}

export async function postJournalEntry({ source_type, source_id = null, narration = null, created_by = null, lines = [] }) {
  const pool = db();
  if (!lines.length) return null;

  const totalDr = lines.reduce((a, l) => a + Number(l.dr || 0), 0);
  const totalCr = lines.reduce((a, l) => a + Number(l.cr || 0), 0);
  if (Number(totalDr.toFixed(2)) !== Number(totalCr.toFixed(2))) {
    throw new Error("Journal not balanced");
  }

  const [[countRow]] = await pool.query("SELECT COUNT(*) as c FROM journal_entries");
  const journal_no = `JRN-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Number(countRow?.c || 0) + 1).padStart(4, '0')}`;

  const [jr] = await pool.query(
    "INSERT INTO journal_entries (journal_no,txn_date,source_type,source_id,narration,created_by) VALUES (:journal_no,NOW(),:source_type,:source_id,:narration,:created_by)",
    { journal_no, source_type, source_id, narration, created_by }
  );

  for (const l of lines) {
    await pool.query(
      "INSERT INTO journal_lines (journal_entry_id,account_code,dr_amount,cr_amount,line_note) VALUES (:journal_entry_id,:account_code,:dr_amount,:cr_amount,:line_note)",
      {
        journal_entry_id: jr.insertId,
        account_code: l.account_code,
        dr_amount: Number(l.dr || 0),
        cr_amount: Number(l.cr || 0),
        line_note: l.note || null,
      }
    );
  }

  return { id: jr.insertId, journal_no };
}

export async function postAutoJournal({ event, amount, source_type, source_id = null, created_by = null, narration = null }) {
  const amt = Number(amount || 0);
  if (amt <= 0) return null;

  await ensureDefaultCoa();
  const incomeOrExpense = mapAutoAccount(event);
  if (!incomeOrExpense) return null;

  const isRefund = event === "refund_paid";
  const lines = isRefund
    ? [
        { account_code: incomeOrExpense, dr: amt, cr: 0, note: event },
        { account_code: "1000", dr: 0, cr: amt, note: event },
      ]
    : [
        { account_code: "1000", dr: amt, cr: 0, note: event },
        { account_code: incomeOrExpense, dr: 0, cr: amt, note: event },
      ];

  return postJournalEntry({ source_type, source_id, created_by, narration: narration || event, lines });
}
