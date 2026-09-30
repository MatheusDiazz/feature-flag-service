import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { createFlag, createProject, registerUser } from "./helpers.js";

describe("flags", () => {
  let token: string;
  let projectId: string;

  beforeEach(async () => {
    ({ token } = await registerUser());
    projectId = await createProject(token);
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("creates a flag with safe defaults", async () => {
    const res = await request(app).post(`/projects/${projectId}/flags`).set(auth()).send({ key: "new-checkout" });

    expect(res.status).toBe(201);
    expect(res.body.flag).toMatchObject({ key: "new-checkout", enabled: false, rolloutPercentage: 0 });
  });

  it("rejects a duplicate key in the same project with 409", async () => {
    await createFlag(token, projectId);

    const res = await request(app).post(`/projects/${projectId}/flags`).set(auth()).send({ key: "new-checkout" });

    expect(res.status).toBe(409);
  });

  it("allows the same key in different projects", async () => {
    const otherProjectId = await createProject(token);
    await createFlag(token, projectId);

    const res = await request(app).post(`/projects/${otherProjectId}/flags`).set(auth()).send({ key: "new-checkout" });

    expect(res.status).toBe(201);
  });

  it("rejects an invalid key and an out-of-range rollout with 400", async () => {
    const res = await request(app)
      .post(`/projects/${projectId}/flags`)
      .set(auth())
      .send({ key: "Bad Key!", rolloutPercentage: 150 });

    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors).toHaveProperty("key");
    expect(res.body.details.fieldErrors).toHaveProperty("rolloutPercentage");
  });

  it("updates only the fields that are sent", async () => {
    const flag = await createFlag(token, projectId, { key: "new-checkout", enabled: true, rolloutPercentage: 20 });

    const res = await request(app).patch(`/flags/${flag.id}`).set(auth()).send({ enabled: false });

    expect(res.status).toBe(200);
    expect(res.body.flag).toMatchObject({ enabled: false, rolloutPercentage: 20 });
  });

  it("rejects an empty update with 400", async () => {
    const flag = await createFlag(token, projectId);

    const res = await request(app).patch(`/flags/${flag.id}`).set(auth()).send({});

    expect(res.status).toBe(400);
  });

  it("returns 404, not 500, for a malformed id", async () => {
    const res = await request(app).patch("/flags/not-a-uuid").set(auth()).send({ enabled: true });

    expect(res.status).toBe(404);
  });

  it("hides another user's projects and flags", async () => {
    const flag = await createFlag(token, projectId);
    const intruder = await registerUser();
    const intruderAuth = { Authorization: `Bearer ${intruder.token}` };

    expect((await request(app).get(`/projects/${projectId}/flags`).set(intruderAuth)).status).toBe(404);
    expect((await request(app).patch(`/flags/${flag.id}`).set(intruderAuth).send({ enabled: true })).status).toBe(404);
    expect((await request(app).delete(`/flags/${flag.id}`).set(intruderAuth)).status).toBe(404);
  });

  it("deletes a flag", async () => {
    const flag = await createFlag(token, projectId);

    expect((await request(app).delete(`/flags/${flag.id}`).set(auth())).status).toBe(204);
    expect((await request(app).delete(`/flags/${flag.id}`).set(auth())).status).toBe(404);
  });
});