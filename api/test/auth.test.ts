import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { registerUser } from "./helpers.js";

describe("auth", () => {
  it("registers a user and returns a token without the password hash", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ email: "new@test.com", password: "supersecret" });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toEqual({ id: expect.any(String), email: "new@test.com" });
  });

  it("treats emails case-insensitively", async () => {
    await request(app).post("/auth/register").send({ email: "Mixed@Test.com", password: "supersecret" });

    const res = await request(app).post("/auth/login").send({ email: "mixed@test.com", password: "supersecret" });

    expect(res.status).toBe(200);
  });

  it("rejects a duplicate email with 409", async () => {
    const { email } = await registerUser();

    const res = await request(app).post("/auth/register").send({ email, password: "supersecret" });

    expect(res.status).toBe(409);
  });

  it("rejects invalid input with 400", async () => {
    const res = await request(app).post("/auth/register").send({ email: "nope", password: "123" });

    expect(res.status).toBe(400);
    expect(res.body.details.fieldErrors).toHaveProperty("email");
    expect(res.body.details.fieldErrors).toHaveProperty("password");
  });

  it("logs in with the correct password", async () => {
    const { email, password } = await registerUser();

    const res = await request(app).post("/auth/login").send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const { email } = await registerUser();

    const wrongPassword = await request(app).post("/auth/login").send({ email, password: "wrongpass" });
    const unknownEmail = await request(app).post("/auth/login").send({ email: "ghost@test.com", password: "wrongpass" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });

  it("protects /auth/me", async () => {
    const { token, email } = await registerUser();

    expect((await request(app).get("/auth/me")).status).toBe(401);
    expect((await request(app).get("/auth/me").set("Authorization", "Bearer garbage")).status).toBe(401);

    const res = await request(app).get("/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });
});