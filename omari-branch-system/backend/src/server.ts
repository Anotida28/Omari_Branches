import "./config/env";
import app from "./app";
import { startScheduler, stopScheduler } from "./jobs/scheduler";
import { releaseAllLocks } from "./services/job-lock.service";

const port = Number(process.env.PORT || 4000);

const server = app.listen(port, async () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);

  await releaseAllLocks();
  startScheduler();
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  stopScheduler();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  stopScheduler();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
