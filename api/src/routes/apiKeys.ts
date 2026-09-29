import { Router } from "express";
import { requireAuth } from "../auth.js";
import { pool } from "../db.js";
import { isUuid } from "../validation.js";

export const apiKeysRouter = Router();
apiKeysRouter.use(requireAuth);

apiKeysRouter.delete("/:id", async (req, res) => {
  if (!isUuid(req.params.id)) {
    res.status(404).json({ error: "api key not found" });
    return;
  }

  const { rowCount } = await pool.query(
    `UPDATE api_keys k SET revoked_at = COALESCE(k.revoked_at, now())
     FROM projects p
     WHERE k.id = $1 AND k.project_id = p.id AND p.owner_id = $2`,
    [req.params.id, req.userId],
  );

  if (rowCount === 0) {
    res.status(404).json({ error: "api key not found" });
    return;
  }
  res.status(204).end();
});