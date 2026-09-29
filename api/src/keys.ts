import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { pool } from "./db.js";

declare global {
  namespace Express {
    interface Request {
      projectId?: string;
    }
  }
}

const KEY_PREFIX = "ff_";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey() {
  const key = KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, hash: hashApiKey(key), prefix: key.slice(0, KEY_PREFIX.length + 8) };
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.get("X-API-Key");
  if (!key) {
    res.status(401).json({ error: "missing api key" });
    return;
  }

  const { rows: [apiKey] } = await pool.query<{ project_id: string }>(
    "SELECT project_id FROM api_keys WHERE key_hash = $1 AND revoked_at IS NULL",
    [hashApiKey(key)],
  );
  if (!apiKey) {
    res.status(401).json({ error: "invalid or revoked api key" });
    return;
  }

  req.projectId = apiKey.project_id;
  next();
}