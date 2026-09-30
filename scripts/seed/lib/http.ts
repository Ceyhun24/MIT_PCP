// "Polite" HTTP client for the seed pipeline:
//  - checks robots.txt before every request and refuses disallowed paths
//  - waits at least 2 seconds between requests to the same domain
//    (longer if robots.txt asks for a bigger Crawl-delay)
//  - identifies itself with a User-Agent that includes a contact address

import { parseRobots, type Robots } from "./robots.ts";

export const MIN_DELAY_MS = 2000;

export class BlockedByRobotsError extends Error {
  readonly url: string;
  constructor(url: string) {
    super(`robots.txt disallows ${url}`);
    this.url = url;
  }
}

export class SiteUnreachableError extends Error {
  constructor(origin: string, cause: string) {
    super(`cannot reach ${origin} (${cause}) — check your internet connection`);
  }
}

export type PoliteFetchOptions = {
  userAgent: string;
  timeoutMs?: number;
  /** Injected for tests. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export class PoliteClient {
  private readonly robotsCache = new Map<string, Robots | null>();
  private readonly lastRequestAt = new Map<string, number>();
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly options: PoliteFetchOptions;

  constructor(options: PoliteFetchOptions) {
    this.options = options;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.now = options.now ?? Date.now;
  }

  private async throttle(host: string, extraDelayMs = 0) {
    const last = this.lastRequestAt.get(host);
    const wait = Math.max(MIN_DELAY_MS, extraDelayMs);
    if (last !== undefined) {
      const elapsed = this.now() - last;
      if (elapsed < wait) await this.sleep(wait - elapsed);
    }
    this.lastRequestAt.set(host, this.now());
  }

  private async rawFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 30000);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
        headers: { "User-Agent": this.options.userAgent, ...(init.headers ?? {}) },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async robotsFor(origin: string): Promise<Robots | null> {
    if (this.robotsCache.has(origin)) return this.robotsCache.get(origin)!;
    const host = new URL(origin).host;
    await this.throttle(host);
    let robots: Robots | null = null;
    try {
      const res = await this.rawFetch(`${origin}/robots.txt`);
      if (res.ok) {
        robots = parseRobots(await res.text(), this.options.userAgent);
      } else if (res.status === 401 || res.status === 403) {
        // Access to robots.txt itself is forbidden: treat the whole site as off-limits.
        robots = { isAllowed: () => false };
      }
      // 404 etc.: no robots.txt → everything allowed (robots = null).
    } catch (err) {
      // Without robots.txt we cannot know the rules, so nothing is fetched.
      const cause = (err as Error & { cause?: Error }).cause?.message ?? (err as Error).message;
      throw new SiteUnreachableError(origin, cause);
    }
    this.robotsCache.set(origin, robots);
    return robots;
  }

  /** Fetches a URL if robots.txt allows it. Throws BlockedByRobotsError otherwise. */
  async fetch(url: string, init: RequestInit = {}): Promise<Response> {
    const u = new URL(url);
    const robots = await this.robotsFor(u.origin);
    if (robots && !robots.isAllowed(u.pathname + u.search)) throw new BlockedByRobotsError(url);
    await this.throttle(u.host, (robots?.crawlDelaySeconds ?? 0) * 1000);
    return this.rawFetch(url, init);
  }
}
