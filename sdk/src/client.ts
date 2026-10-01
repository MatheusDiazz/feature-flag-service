import { evaluate, type FlagConfig } from "./rollout.js";

export interface ClientOptions {
  apiKey: string;
  baseUrl: string;
  ttlMs?: number;
  fetch?: typeof fetch;
}

export class FlagClient {
  private flags = new Map<string, FlagConfig>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly ttlMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: ClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.ttlMs = options.ttlMs ?? 30_000;
    this.fetchFn = options.fetch ?? ((...args) => fetch(...args));
  }

  async refresh(): Promise<void> {
    const res = await this.fetchFn(`${this.baseUrl}/sdk/flags`, {
      headers: { "X-API-Key": this.apiKey },
    });
    if (!res.ok) throw new Error(`failed to fetch flags: HTTP ${res.status}`);

    const body = (await res.json()) as { flags: FlagConfig[] };
    this.flags = new Map(body.flags.map((flag) => [flag.key, flag]));
    this.listeners.forEach((listener) => listener());
  }

  start(): void {
    this.timer = setInterval(() => {
      this.refresh().catch(() => {});
    }, this.ttlMs);
  }

  close(): void {
    clearInterval(this.timer);
  }

  isEnabled(flagKey: string, userId: string): boolean {
    const flag = this.flags.get(flagKey);
    return flag ? evaluate(flag, userId) : false;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export async function init(options: ClientOptions): Promise<FlagClient> {
  const client = new FlagClient(options);
  await client.refresh();
  client.start();
  return client;
}