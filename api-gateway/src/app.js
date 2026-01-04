const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// URLs configurables: en LOCAL usa localhost, en Docker puedes sobreescribir por env
const AUTH_URL = process.env.AUTH_URL || "http://127.0.0.1:3001";
const GYM_URL = process.env.GYM_URL || "http://127.0.0.1:3002";
const TRAINING_URL = process.env.TRAINING_URL || "http://127.0.0.1:5000";

// CORS: permite que el frontend en 8080 llame al gateway en 3000
app.use(
  cors({
    origin: "http://localhost:8080",
    credentials: true,
  })
);

// Auth: /auth/login -> AUTH_URL/login
app.use(
  "/auth",
  createProxyMiddleware({
    target: AUTH_URL,
    changeOrigin: true,
    proxyTimeout: 10000, // 10s
    timeout: 10000,      // 10s

    pathRewrite: (path) => path.replace(/^\/auth/, ""),

    logLevel: "debug",

    onProxyReq: (proxyReq, req) => {
      console.log("➡️  [AUTH]", req.method, req.originalUrl, "->", proxyReq.path);
    },
    onProxyRes: (proxyRes, req) => {
      console.log("✅ [AUTH RES]", req.method, req.originalUrl, "STATUS", proxyRes.statusCode);
    },
    onError: (err, req, res) => {
      console.error("❌ [AUTH PROXY ERROR]", err.code || "", err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: "Bad gateway", code: err.code, message: err.message });
      }
    },
  })
);


// Gym: /gym/... -> GYM_URL/...
app.use(
  "/gym",
  createProxyMiddleware({
    target: GYM_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/gym": "",
    },
    logLevel: "warn",
  })
);

// Training: /training/... -> TRAINING_URL/...
app.use(
  "/training",
  createProxyMiddleware({
    target: TRAINING_URL,
    changeOrigin: true,
    pathRewrite: {
      "^/training": "",
    },
    logLevel: "warn",
  })
);

// Health check del gateway
app.get("/health", (req, res) => {
  res.status(200).json({
    message: "API Gateway is running!",
    services: {
      auth: AUTH_URL,
      gym: GYM_URL,
      training: TRAINING_URL,
    },
  });
});

app.listen(PORT, () => {
  console.log("✅ API Gateway listening on port " + PORT);
  console.log("➡️  /auth     -> " + AUTH_URL);
  console.log("➡️  /gym      -> " + GYM_URL);
  console.log("➡️  /training -> " + TRAINING_URL);
});
