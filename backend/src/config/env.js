// backend/src/config/env.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// ✅ Always load backend/.env from here (most reliable)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

const schema = z.object({
  PORT: z.string().optional(),
  TRUST_PROXY: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),

  // ✅ required
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRES_IN: z.string().default("7d"),

  DB_HOST: z.string(),
  DB_PORT: z.string().default("3306"),
  DB_FAMILY: z.string().default("4"), // 4=IPv4, 6=IPv6
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),

  UPLOAD_DIR: z.string().default("src/uploads"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:4000"),
});

export const ENV = schema.parse(process.env);
