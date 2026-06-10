import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ENV, requireEnv } from "./env.js";

let pool;

function createPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: requireEnv("DB_HOST"),
    port: Number(ENV.DB_PORT),
    family: Number(ENV.DB_FAMILY || 4),
    user: requireEnv("DB_USER"),
    password: requireEnv("DB_PASSWORD"),
    database: requireEnv("DB_NAME"),
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });

  return pool;
}

export async function initDb() {
  const activePool = createPool();

  // Ensure schema exists
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const schemaPath = path.join(__dirname, "..", "database", "schema.sql");

  const sql = fs.readFileSync(schemaPath, "utf-8");
  const conn = await activePool.getConnection();
  try {
    // MySQL driver doesn't support multi statements by default in pool config;
    // execute by splitting on `;` safely for this simple schema file.
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const st of statements) {
      await conn.query(st);
    }
  } finally {
    conn.release();
  }

  return activePool;
}

export function db() {
  return createPool();
}
