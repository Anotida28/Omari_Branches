import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import fs from "node:fs";
import path from "node:path";

import { env } from "./config/env";
import { prisma } from "./db/prisma";
import { requireAuthenticatedUser, requireWriteAccess } from "./middlewares/auth";
import { errorHandler, notFoundHandler } from "./middlewares/error";
import authRoutes from "./routes/auth.routes";
import routes from "./routes";

const app = express();
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  cors({
    origin:
      env.NODE_ENV === "production"
        ? (env.FRONTEND_URL ?? false)
        : true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

const walletLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many wallet requests, please slow down." },
});

app.get("/health", async (_req, res) => {
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.appDb = "ok";
  } catch {
    checks.appDb = "error";
  }

  try {
    const { getSourcePool, isSourceDbConfigured } = await import("./db/source-db");
    if (isSourceDbConfigured()) {
      const pool = await getSourcePool();
      await pool.request().query("SELECT 1");
      checks.sourceDb = "ok";
    } else {
      checks.sourceDb = "error";
    }
  } catch {
    checks.sourceDb = "error";
  }

  const allOk = Object.values(checks).every((s) => s === "ok");
  res.status(allOk ? 200 : 503).json({
    ok: allOk,
    service: "omari-branch-system-backend",
    checks,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletLimiter);
app.use("/api", apiLimiter, requireAuthenticatedUser, requireWriteAccess, routes);

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));

  // SPA fallback: let non-API routes resolve to the built frontend app.
  app.get("*", (req, res, next) => {
    if (req.path === "/health" || req.path === "/api" || req.path.startsWith("/api/")) {
      next();
      return;
    }

    res.sendFile(frontendIndexPath);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
