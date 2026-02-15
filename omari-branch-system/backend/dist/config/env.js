"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).optional(),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    API_KEY: zod_1.z.string().min(1, "API_KEY is required"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
}
exports.env = parsed.data;
