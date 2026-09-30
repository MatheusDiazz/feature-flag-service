import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../src/app.js";

export async function registerUser() {
  const email = `user-${randomUUID()}@test.com`;
  const password = "supersecret";
  const res = await request(app).post("/auth/register").send({ email, password });
  return { email, password, token: res.body.token as string };
}

export async function createProject(token: string) {
  const res = await request(app)
    .post("/projects")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test Project" });
  return res.body.project.id as string;
}

export async function createFlag(token: string, projectId: string, body: object = { key: "new-checkout" }) {
  const res = await request(app)
    .post(`/projects/${projectId}/flags`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
  return res.body.flag;
}

export async function createApiKey(token: string, projectId: string) {
  const res = await request(app)
    .post(`/projects/${projectId}/api-keys`)
    .set("Authorization", `Bearer ${token}`);
  return res.body.apiKey as { id: string; key: string; prefix: string };
}