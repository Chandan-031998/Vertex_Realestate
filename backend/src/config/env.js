// backend/src/config/env.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// ✅ Always load backend/.env from here (most reliable)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const schema = z.object({
  PORT: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // Required by auth routes. Keep optional at import time so health/CORS can
  // still respond on serverless deployments with incomplete env configuration.
  JWT_SECRET: optionalString,
  JWT_EXPIRES_IN: z.string().default("7d"),

  // Required by DB-backed routes. Validated when a DB connection is created.
  DB_HOST: optionalString,
  DB_PORT: z.string().default("3306"),
  DB_FAMILY: z.string().default("4"), // 4=IPv4, 6=IPv6
  DB_USER: optionalString,
  DB_PASSWORD: optionalString,
  DB_NAME: optionalString,

  UPLOAD_DIR: z.string().default("src/uploads"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:4000"),
});

export const ENV = schema.parse(process.env);

export function requireEnv(name) {
  const value = ENV[name];
  if (!value) {
    const err = new Error(`Missing backend environment variable: ${name}`);
    err.status = 500;
    throw err;
  }
  return value;
}
