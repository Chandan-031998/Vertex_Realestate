import { ok } from "../../utils/apiResponse.js";
import { registerUser, loginUser } from "./auth.service.js";

export async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.validated.body;
    const id = await registerUser({ name, email, password, role });
    return ok(res, { id }, "Registered");
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.validated.body;
    const data = await loginUser({ email, password });
    return ok(res, data, "Logged in");
  } catch (e) {
    next(e);
  }
}
