import type { NextFunction, Request, Response } from "express";

import { isSourceDbConfigured } from "../db/source-db";
import { getAgentTrends, listAllAgents, searchAgents } from "../services/agents.service";

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function handleListAllAgents(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isSourceDbConfigured()) {
      res.status(503).json({ error: "Source database not configured" });
      return;
    }
    const results = await listAllAgents();
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function handleSearchAgents(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isSourceDbConfigured()) {
      res.status(503).json({ error: "Source database not configured" });
      return;
    }
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      res.json([]);
      return;
    }
    const limit = Math.min(Number(req.query.limit ?? 20), 50);
    const results = await searchAgents(q, limit);
    res.json(results);
  } catch (err) {
    next(err);
  }
}

export async function handleGetAgentTrends(req: Request, res: Response, next: NextFunction) {
  try {
    if (!isSourceDbConfigured()) {
      res.status(503).json({ error: "Source database not configured" });
      return;
    }

    const agentAccounts = parseStringArray(req.query.agentAccounts);
    if (agentAccounts.length === 0) {
      res.status(400).json({ error: "At least one agentAccount is required" });
      return;
    }

    const dateFrom = parseDate(req.query.dateFrom);
    const dateTo = parseDate(req.query.dateTo);
    if (!dateFrom || !dateTo) {
      res.status(400).json({ error: "dateFrom and dateTo are required (YYYY-MM-DD)" });
      return;
    }

    const result = await getAgentTrends(agentAccounts, dateFrom, dateTo);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
