import jwt from "jsonwebtoken";
import { ENV } from "../config/env.js";

export function authRequired(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
  if (!token) return res.status(401).json({ ok: false, message: "Missing token" });
  if (!ENV.JWT_SECRET) {
    return res.status(500).json({ ok: false, message: "Missing backend environment variable: JWT_SECRET" });
  }

  try {
    const payload = jwt.verify(token, ENV.JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, message: "Invalid token" });
  }
}
