"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./config/env");
const app_1 = __importDefault(require("./app"));
const port = Number(process.env.PORT || 4000);
app_1.default.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/health`);
});
