import { describe, expect, it } from "vitest";
import { bucket, evaluate, fnv1a } from "../src/rollout.js";

const users = Array.from({ length: 10_000 }, (_, i) => `user_${i}`);
const flag = (rolloutPercentage: number, key = "new-checkout") => ({ key, enabled: true, rolloutPercentage });
const enabledUsers = (rolloutPercentage: number, key?: string) =>
  users.filter((user) => evaluate(flag(rolloutPercentage, key), user));

describe("fnv1a", () => {
  it("matches the reference FNV-1a values", () => {
    expect(fnv1a("")).toBe(0x811c9dc5);
    expect(fnv1a("a")).toBe(0xe40c292c);
  });
});

describe("rollout", () => {
  it("is deterministic: the same user always gets the same answer", () => {
    const first = users.map((user) => bucket("new-checkout", user));
    const second = users.map((user) => bucket("new-checkout", user));

    expect(second).toEqual(first);
  });

  it("enables close to the requested percentage of users", () => {
    const share = enabledUsers(20).length / users.length;

    expect(share).toBeGreaterThan(0.18);
    expect(share).toBeLessThan(0.22);
  });

  it("only adds users when the rollout increases", () => {
    const at30 = new Set(enabledUsers(30));

    for (const user of enabledUsers(20)) {
      expect(at30.has(user)).toBe(true);
    }
  });

  it("picks a different set of users for each flag", () => {
    const checkout = new Set(enabledUsers(50, "new-checkout"));
    const overlap = enabledUsers(50, "dark-mode").filter((user) => checkout.has(user)).length / users.length;

    expect(overlap).toBeGreaterThan(0.23);
    expect(overlap).toBeLessThan(0.27);
  });

  it("respects the kill switch and the 0% / 100% edges", () => {
    expect(enabledUsers(0)).toHaveLength(0);
    expect(enabledUsers(100)).toHaveLength(users.length);
    expect(users.some((user) => evaluate({ ...flag(100), enabled: false }, user))).toBe(false);
  });
});