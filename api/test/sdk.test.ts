import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { pool } from "../src/db.js";
import { hashApiKey } from "../src/keys.js";
import { createApiKey, createFlag, createProject, registerUser } from "./helpers.js";

describe("sdk", () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    ({ token } = await registerUser());
    projectId = await createProject(token);
  });

  it("returns only public flag fields for a valid key", async () => {
    await createFlag(token, projectId, { key: "new-checkout", enabled: true, rolloutPercentage: 20 });
    const { key } = await createApiKey(token, projectId);

    const res = await request(app).get("/sdk/flags").set("X-API-Key", key);

    expect(res.status).toBe(200);
    expect(res.body.flags).toEqual([{ key: "new-checkout", enabled: true, rolloutPercentage: 20 }]);
  });

  it("only returns flags from the key's own project", async () => {
    const otherProjectId = await createProject(token);
    await createFlag(token, otherProjectId, { key: "secret-flag" });
    const { key } = await createApiKey(token, projectId);

    const res = await request(app).get("/sdk/flags").set("X-API-Key", key);

    expect(res.body.flags).toEqual([]);
  });

  it("rejects a missing or unknown key with 401", async () => {
    expect((await request(app).get("/sdk/flags")).status).toBe(401);
    expect((await request(app).get("/sdk/flags").set("X-API-Key", "ff_fake")).status).toBe(401);
  });

  it("rejects a revoked key with 401", async () => {
    const { id, key } = await createApiKey(token, projectId);

    const revoke = await request(app).delete(`/api-keys/${id}`).set("Authorization", `Bearer ${token}`);
    const res = await request(app).get("/sdk/flags").set("X-API-Key", key);

    expect(revoke.status).toBe(204);
    expect(res.status).toBe(401);
  });

  it("stores only the hash of the key", async () => {
    const { id, key } = await createApiKey(token, projectId);

    const { rows: [row] } = await pool.query("SELECT key_hash, prefix FROM api_keys WHERE id = $1", [id]);

    expect(row.key_hash).toBe(hashApiKey(key));
    expect(row.key_hash).not.toContain(key);
    expect(key.startsWith(row.prefix)).toBe(true);
  });
});