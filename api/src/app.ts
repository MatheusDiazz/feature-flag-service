import express, { type NextFunction, type Request, type Response } from "express";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { flagsRouter } from "./routes/flags.js";
import { projectsRouter } from "./routes/projects.js";
import { apiKeysRouter } from "./routes/apiKeys.js";
import { sdkRouter } from "./routes/sdk.js";
export const app = express();
app.use(express.json());
app.use("/api-keys", apiKeysRouter);
app.use("/sdk", sdkRouter);
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

app.use("/auth", authRouter);
app.use("/projects", projectsRouter);
app.use("/flags", flagsRouter);
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.status && err.status < 500) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal server error" });
});