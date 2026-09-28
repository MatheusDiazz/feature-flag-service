import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { pool } from "../db.js";
import { isUuid, sendValidationError } from "../validation.js";
import { FLAG_COLUMNS } from "./projects.js";

export const flagsRouter = Router();
flagsRouter.use(requireAuth);

const updateFlagSchema = z
  .object({
    description: z.string().max(500).optional(),
    enabled: z.boolean().optional(),
    rolloutPercentage: z.number().int().min(0).max(100).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "provide at least one field to update");

flagsRouter.patch("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "flag not found" });
    return;
  }

  const parsed = updateFlagSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { description, enabled, rolloutPercentage } = parsed.data;

  const { rows: [flag] } = await pool.query(
    `UPDATE flags f SET
       description        = COALESCE($1, f.description),
       enabled            = COALESCE($2, f.enabled),
       rollout_percentage = COALESCE($3, f.rollout_percentage),
       updated_at         = now()
     FROM projects p
     WHERE f.id = $4 AND f.project_id = p.id AND p.owner_id = $5
     RETURNING ${FLAG_COLUMNS}`,
    [description, enabled, rolloutPercentage, req.params.id, req.userId],
  );

  if (!flag) {
    res.status(404).json({ error: "flag not found" });
    return;
  }
  res.json({ flag });
});

flagsRouter.delete("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "flag not found" });
    return;
  }

  const { rowCount } = await pool.query(
    `DELETE FROM flags f USING projects p
     WHERE f.id = $1 AND f.project_id = p.id AND p.owner_id = $2`,
    [req.params.id, req.userId],
  );

  if (rowCount === 0) {
    res.status(404).json({ error: "flag not found" });
    return;
  }
  res.status(204).end();
});