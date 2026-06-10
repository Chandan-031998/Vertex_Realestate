import cors from "cors";

export const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://venture.vertexsoftware.in",
  "https://venture.vertexsoftware.in",
  "https://vertex-realestate.vercel.app",
];

export const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["Content-Disposition"],
};

export default cors(corsOptions);
