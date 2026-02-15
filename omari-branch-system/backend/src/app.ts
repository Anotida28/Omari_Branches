import express from "express";
import cors from "cors";

import { requireApiKey, validateApiKeyHeader } from "./middlewares/auth";
import { errorHandler, notFoundHandler } from "./middlewares/error";
import routes from "./routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "omari-branch-system-backend" });
});

// All API routes
app.use("/api", validateApiKeyHeader, requireApiKey, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
