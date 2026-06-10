import axios from "axios";
import { getToken } from "../store/auth.store.js";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

export const http = axios.create({
  baseURL: API_BASE,
});

http.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});
