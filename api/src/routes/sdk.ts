import cors from "cors";
import { Router } from "express";
import { pool } from "../db.js";
import { requireApiKey } from "../keys.js";

export const sdkRouter = Router();
sdkRouter.use(cors());
sdkRouter.use(requireApiKey);

sdkRouter.get("/flags", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT key, enabled, rollout_percentage AS "rolloutPercentage"
     FROM flags WHERE project_id = $1 ORDER BY key`,
    [req.projectId],
  );
  res.json({ flags: rows });
});