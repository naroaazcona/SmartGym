const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

const AUTH_URL = process.env.AUTH_URL || "http://auth-service:3001";
const GYM_URL = process.env.GYM_URL || "http://gym-service:3002";
const TRAINING_URL = process.env.TRAINING_URL || "http://training-service:5000";

const rawCorsOrigins =
  process.env.CORS_ORIGIN || "https://smartgym-app.com,https://www.smartgym-app.com";
const CORS_ALLOWED_ORIGINS = rawCorsOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// CORS
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, health checks, server-to-server)
      if (!origin) return callback(null, true);
      if (CORS_ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

// --- Rate limiters ---

// Strict limit for login/register: 10 tries each 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Demasiados intentos. Por favor espera 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limit for AI recommendations: 20 requests each 10 min per IP
const trainingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { error: "Demasiadas peticiones al servicio de entrenamiento. Espera unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General limit for the rest: 200 requests each 10 min per IP
const generalLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 200,
  message: { error: "Demasiadas peticiones. Por favor espera unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Apply limiters ---
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/google", authLimiter);
app.use("/auth/password-recovery/start", authLimiter);
app.use("/auth/password-recovery/verify", authLimiter);
app.use("/auth/password-recovery/reset", authLimiter);
app.use("/training", trainingLimiter);
app.use(generalLimiter);

// --- Proxies ---
app.use(
  "/auth",
  createProxyMiddleware({
    target: AUTH_URL,
    changeOrigin: true,
    proxyTimeout: 10000,
    timeout: 10000,
    pathRewrite: (path) => path.replace(/^\/auth/, ""),
    logLevel: "debug",
    onProxyReq: (proxyReq, req) => {
      console.log("[AUTH]", req.method, req.originalUrl, "->", proxyReq.path);
    },
    onProxyRes: (proxyRes, req) => {
      console.log("[AUTH RES]", req.method, req.originalUrl, "STATUS", proxyRes.statusCode);
    },
    onError: (err, req, res) => {
      console.error("[AUTH PROXY ERROR]", err.code || "", err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: "Bad gateway", code: err.code, message: err.message });
      }
    },
  })
);

app.use(
  "/gym",
  createProxyMiddleware({
    target: GYM_URL,
    changeOrigin: true,
    pathRewrite: { "^/gym": "" },
    logLevel: "warn",
  })
);

app.use(
  "/training",
  createProxyMiddleware({
    target: TRAINING_URL,
    changeOrigin: true,
    pathRewrite: { "^/training": "" },
    logLevel: "warn",
  })
);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "API Gateway funcionando",
    servicios: {
      auth: AUTH_URL,
      gym: GYM_URL,
      training: TRAINING_URL,
    },
  });
});

app.listen(PORT, () => {
  console.log("API Gateway escuchando en el puerto " + PORT);
  console.log("/auth     -> " + AUTH_URL);
  console.log("/gym      -> " + GYM_URL);
  console.log("/training -> " + TRAINING_URL);
  console.log("CORS allowed origins -> " + CORS_ALLOWED_ORIGINS.join(", "));
});
