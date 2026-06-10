export const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://vertex-realestate.vercel.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Disposition"],
};
