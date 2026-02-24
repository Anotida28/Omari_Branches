import cors from "cors";
import express from "express";

import { requireAuthenticatedUser, requireWriteAccess } from "./middlewares/auth";
import { errorHandler, notFoundHandler } from "./middlewares/error";
import authRoutes from "./routes/auth.routes";
import routes from "./routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "omari-branch-system-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api", requireAuthenticatedUser, requireWriteAccess, routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
