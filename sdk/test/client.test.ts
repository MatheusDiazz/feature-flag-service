import { afterEach, describe, expect, it, vi } from "vitest";
import { init, type FlagConfig } from "../src/index.js";

const ttlMs = 30_000;

function fakeFetch(...responses: FlagConfig[][]) {
  let call = 0;
  return vi.fn(async () => {
    const flags = responses[Math.min(call++, responses.length - 1)];
    return new Response(JSON.stringify({ flags }), { status: 200 });
  });
}

describe("FlagClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches once and evaluates locally", async () => {
    const fetch = fakeFetch([{ key: "new-checkout", enabled: true, rolloutPercentage: 100 }]);
    const client = await init({ apiKey: "ff_test", baseUrl: "http://api.test/", fetch });

    for (let i = 0; i < 1000; i++) client.isEnabled("new-checkout", `user_${i}`);

    expect(client.isEnabled("new-checkout", "user_1")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("http://api.test/sdk/flags", { headers: { "X-API-Key": "ff_test" } });
    client.close();
  });

  it("returns false for unknown flags", async () => {
    const client = await init({ apiKey: "ff_test", baseUrl: "http://api.test", fetch: fakeFetch([]) });

    expect(client.isEnabled("does-not-exist", "user_1")).toBe(false);
    client.close();
  });

  it("picks up changes after the ttl and notifies subscribers", async () => {
    vi.useFakeTimers();
    const fetch = fakeFetch(
      [{ key: "new-checkout", enabled: false, rolloutPercentage: 100 }],
      [{ key: "new-checkout", enabled: true, rolloutPercentage: 100 }],
    );
    const client = await init({ apiKey: "ff_test", baseUrl: "http://api.test", ttlMs, fetch });
    const listener = vi.fn();
    client.subscribe(listener);

    expect(client.isEnabled("new-checkout", "user_1")).toBe(false);
    await vi.advanceTimersByTimeAsync(ttlMs);

    expect(client.isEnabled("new-checkout", "user_1")).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("keeps serving the last config when a refresh fails", async () => {
    vi.useFakeTimers();
    const fetch = fakeFetch([{ key: "new-checkout", enabled: true, rolloutPercentage: 100 }]);
    const client = await init({ apiKey: "ff_test", baseUrl: "http://api.test", ttlMs, fetch });

    fetch.mockRejectedValueOnce(new Error("network down"));
    await vi.advanceTimersByTimeAsync(ttlMs);

    expect(client.isEnabled("new-checkout", "user_1")).toBe(true);
    client.close();
  });

  it("rejects init when the api key is invalid", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "invalid" }), { status: 401 }));

    await expect(init({ apiKey: "ff_bad", baseUrl: "http://api.test", fetch })).rejects.toThrow("HTTP 401");
  });
});