import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";

import { requireAuthenticatedUser, requireWriteAccess } from "./middlewares/auth";
import { errorHandler, notFoundHandler } from "./middlewares/error";
import authRoutes from "./routes/auth.routes";
import routes from "./routes";

const app = express();
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");
const hasFrontendBuild = fs.existsSync(frontendIndexPath);

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "omari-branch-system-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api", requireAuthenticatedUser, requireWriteAccess, routes);

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
