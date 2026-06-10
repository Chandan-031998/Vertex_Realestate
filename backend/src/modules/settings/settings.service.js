import { db } from "../../config/db.js";

const HEX_COLOR_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const THEME_MODES = new Set(["light", "dark"]);
const UI_STYLES = new Set(["comfortable", "compact"]);
const SIDEBAR_STYLES = new Set(["default", "solid", "minimal"]);

function safeText(v, max = 255) {
  const s = String(v || "").trim();
  return s ? s.slice(0, max) : null;
}

function safeColor(v, fallback) {
  const c = String(v || "").trim();
  return HEX_COLOR_RE.test(c) ? c : fallback;
}

function safeChoice(v, allowed, fallback) {
  const s = String(v || "").trim().toLowerCase();
  return allowed.has(s) ? s : fallback;
}

async function ensureTable(pool) {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_settings (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      app_name VARCHAR(120) NULL,
      company_name VARCHAR(150) NULL,
      company_legal_name VARCHAR(190) NULL,
      company_email VARCHAR(190) NULL,
      company_phone VARCHAR(40) NULL,
      company_website VARCHAR(190) NULL,
      company_address TEXT NULL,
      company_gst VARCHAR(60) NULL,
      logo_path TEXT NULL,
      theme_mode VARCHAR(20) NOT NULL DEFAULT 'light',
      ui_style VARCHAR(20) NOT NULL DEFAULT 'comfortable',
      sidebar_style VARCHAR(20) NOT NULL DEFAULT 'default',
      primary_color VARCHAR(20) NOT NULL DEFAULT '#0f172a',
      accent_color VARCHAR(20) NOT NULL DEFAULT '#334155',
      updated_by BIGINT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
}

export async function getAppSettings() {
  const pool = db();
  await ensureTable(pool);
  const [[row]] = await pool.query("SELECT * FROM app_settings WHERE id=1");
  if (row) return row;
  await pool.query("INSERT INTO app_settings (id, app_name, company_name) VALUES (1,'Vertex ERP','Vertex Real Estate')");
  const [[created]] = await pool.query("SELECT * FROM app_settings WHERE id=1");
  return created;
}

export async function updateAppSettings(patch = {}, updatedBy = null, logoPath = null) {
  const pool = db();
  const cur = await getAppSettings();
  const next = {
    app_name: patch.app_name === undefined ? cur.app_name : safeText(patch.app_name, 120),
    company_name: patch.company_name === undefined ? cur.company_name : safeText(patch.company_name, 150),
    company_legal_name: patch.company_legal_name === undefined ? cur.company_legal_name : safeText(patch.company_legal_name, 190),
    company_email: patch.company_email === undefined ? cur.company_email : safeText(patch.company_email, 190),
    company_phone: patch.company_phone === undefined ? cur.company_phone : safeText(patch.company_phone, 40),
    company_website: patch.company_website === undefined ? cur.company_website : safeText(patch.company_website, 190),
    company_address: patch.company_address === undefined ? cur.company_address : safeText(patch.company_address, 1200),
    company_gst: patch.company_gst === undefined ? cur.company_gst : safeText(patch.company_gst, 60),
    logo_path: logoPath || cur.logo_path || null,
    theme_mode: patch.theme_mode === undefined ? cur.theme_mode : safeChoice(patch.theme_mode, THEME_MODES, "light"),
    ui_style: patch.ui_style === undefined ? cur.ui_style : safeChoice(patch.ui_style, UI_STYLES, "comfortable"),
    sidebar_style: patch.sidebar_style === undefined ? cur.sidebar_style : safeChoice(patch.sidebar_style, SIDEBAR_STYLES, "default"),
    primary_color: patch.primary_color === undefined ? cur.primary_color : safeColor(patch.primary_color, "#0f172a"),
    accent_color: patch.accent_color === undefined ? cur.accent_color : safeColor(patch.accent_color, "#334155"),
    updated_by: updatedBy,
  };

  await pool.query(
    `UPDATE app_settings SET
      app_name=:app_name,
      company_name=:company_name,
      company_legal_name=:company_legal_name,
      company_email=:company_email,
      company_phone=:company_phone,
      company_website=:company_website,
      company_address=:company_address,
      company_gst=:company_gst,
      logo_path=:logo_path,
      theme_mode=:theme_mode,
      ui_style=:ui_style,
      sidebar_style=:sidebar_style,
      primary_color=:primary_color,
      accent_color=:accent_color,
      updated_by=:updated_by
     WHERE id=1`,
    next
  );
  return getAppSettings();
}
