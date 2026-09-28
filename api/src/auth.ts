import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const JWT_SECRET = requireEnv("JWT_SECRET");

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "missing token" });
    return;
  }

  try {
    const payload = jwt.verify(header.slice("Bearer ".length), JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || !payload.sub) throw new Error("invalid payload");
    req.userId = payload.sub;
  } catch {
    res.status(401).json({ error: "invalid or expired token" });
    return;
  }

  next();
}