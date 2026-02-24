"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
const app_1 = __importDefault(require("./app"));
const scheduler_1 = require("./jobs/scheduler");
const port = Number(process.env.PORT || 4000);
const server = app_1.default.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/health`);
    // Start the job scheduler
    (0, scheduler_1.startScheduler)();
});
// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully");
    (0, scheduler_1.stopScheduler)();
    server.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
process.on("SIGINT", () => {
    console.log("SIGINT received, shutting down gracefully");
    (0, scheduler_1.stopScheduler)();
    server.close(() => {
        console.log("Server closed");
        process.exit(0);
    });
});
