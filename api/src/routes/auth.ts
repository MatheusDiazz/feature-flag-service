import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, signToken } from "../auth.js";
import { isUniqueViolation, pool } from "../db.js";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(72),
});

authRouter.post("/register", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows: [user] } = await pool.query<{ id: string; email: string }>(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email, passwordHash],
    );
    res.status(201).json({ token: signToken(user.id), user });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: "email already registered" });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid input", details: z.flattenError(parsed.error).fieldErrors });
    return;
  }
  const { email, password } = parsed.data;

  const { rows: [user] } = await pool.query<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM users WHERE email = $1",
    [email],
  );
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
  if (!user || !valid) {
    res.status(401).json({ error: "invalid email or password" });
    return;
  }

  res.json({ token: signToken(user.id), user: { id: user.id, email: user.email } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const { rows: [user] } = await pool.query(
    "SELECT id, email, created_at FROM users WHERE id = $1",
    [req.userId],
  );
  if (!user) {
    res.status(404).json({ error: "user not found" });
    return;
  }
  res.json({ user });
});