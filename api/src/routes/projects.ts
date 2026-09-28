import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { isUniqueViolation, pool } from "../db.js";
import { isUuid, sendValidationError } from "../validation.js";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

export const FLAG_COLUMNS = `
  f.id, f.project_id AS "projectId", f.key, f.description, f.enabled,
  f.rollout_percentage AS "rolloutPercentage",
  f.created_at AS "createdAt", f.updated_at AS "updatedAt"
`;

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

const createFlagSchema = z.object({
  key: z.string().max(64).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase letters, numbers, and dashes"),
  description: z.string().max(500).default(""),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().int().min(0).max(100).default(0),
});

async function isProjectOwner(projectId: string, userId: string): Promise<boolean> {
  if (!isUuid(projectId)) return false;
  const { rowCount } = await pool.query(
    "SELECT 1 FROM projects WHERE id = $1 AND owner_id = $2",
    [projectId, userId],
  );
  return rowCount === 1;
}

projectsRouter.get("/", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, created_at AS "createdAt" FROM projects
     WHERE owner_id = $1 ORDER BY created_at`,
    [req.userId],
  );
  res.json({ projects: rows });
});

projectsRouter.post("/", async (req, res) => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);

  const { rows: [project] } = await pool.query(
    `INSERT INTO projects (name, owner_id) VALUES ($1, $2)
     RETURNING id, name, created_at AS "createdAt"`,
    [parsed.data.name, req.userId],
  );
  res.status(201).json({ project });
});

projectsRouter.get("/:id/flags", async (req, res) => {
  if (!(await isProjectOwner(req.params.id, req.userId!))) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  const { rows } = await pool.query(
    `SELECT ${FLAG_COLUMNS} FROM flags f WHERE f.project_id = $1 ORDER BY f.key`,
    [req.params.id],
  );
  res.json({ flags: rows });
});

projectsRouter.post("/:id/flags", async (req, res) => {
  if (!(await isProjectOwner(req.params.id, req.userId!))) {
    res.status(404).json({ error: "project not found" });
    return;
  }

  const parsed = createFlagSchema.safeParse(req.body);
  if (!parsed.success) return sendValidationError(res, parsed.error);
  const { key, description, enabled, rolloutPercentage } = parsed.data;

  try {
    const { rows: [flag] } = await pool.query(
      `INSERT INTO flags AS f (project_id, key, description, enabled, rollout_percentage)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${FLAG_COLUMNS}`,
      [req.params.id, key, description, enabled, rolloutPercentage],
    );
    res.status(201).json({ flag });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: `flag "${key}" already exists in this project` });
      return;
    }
    throw err;
  }
});