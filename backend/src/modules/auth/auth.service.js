import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../config/db.js";
import { ENV, requireEnv } from "../../config/env.js";

export async function registerUser({ name, email, password, role }) {
  const pool = db();
  const [exist] = await pool.query("SELECT id FROM users WHERE email=:email", { email });
  if (exist.length) {
    const err = new Error("Email already registered");
    err.status = 409;
    throw err;
  }
  const password_hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query(
    "INSERT INTO users (name,email,password_hash,role,is_active) VALUES (:name,:email,:password_hash,:role,1)",
    { name, email, password_hash, role }
  );
  return r.insertId;
}

export async function loginUser({ email, password }) {
  const pool = db();
  const [rows] = await pool.query("SELECT id,name,email,password_hash,role,is_active FROM users WHERE email=:email", { email });
  if (!rows.length) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }
  const u = rows[0];
  if (!u.is_active) {
    const err = new Error("User inactive");
    err.status = 403;
    throw err;
  }
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) {
    const err = new Error("Invalid credentials");
    err.status = 401;
    throw err;
  }
  const token = jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role }, requireEnv("JWT_SECRET"), { expiresIn: ENV.JWT_EXPIRES_IN });
  return { token, user: { id: u.id, name: u.name, email: u.email, role: u.role } };
}
