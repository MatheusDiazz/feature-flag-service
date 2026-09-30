import { afterAll, beforeEach } from "vitest";
import { pool } from "../src/db.js";

beforeEach(async () => {
  await pool.query("TRUNCATE users, projects, flags, api_keys CASCADE");
});

afterAll(async () => {
  await pool.end();
});