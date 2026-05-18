import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { filterClankers, runBlocker } from "../src/blocker";
import { ClankerEntry, BlockerConfig, DEFAULT_SOURCE_URL } from "../src/types";

const fakeClankers: ClankerEntry[] = [
  { username: "bot1", total_prs: 10, first_pr: "2026-04-01", last_pr: "2026-05-10" },
  { username: "bot2", total_prs: 5, first_pr: "2026-03-01", last_pr: "2026-05-15" },
  { username: "bot3", total_prs: 2, first_pr: "2026-01-01", last_pr: "2026-02-01" },
  { username: "bot4", total_prs: 20, first_pr: "2026-01-01", last_pr: "2026-03-01" },
];

function baseConfig(overrides: Partial<BlockerConfig> = {}): BlockerConfig {
  return {
    minPrs: 3,
    sourceUrl: DEFAULT_SOURCE_URL,
    dryRun: true,
    extraUsernames: [],
    excludeUsernames: [],
    ...overrides,
  };
}

describe("filterClankers", () => {
  it("filters by minPrs threshold", () => {
    const config = baseConfig({ minPrs: 5 });
    const result = filterClankers(fakeClankers, config);
    assert.equal(result.length, 3);
    assert.ok(result.every((c) => c.total_prs >= 5));
  });

  it("filters by activeSince date", () => {
    const config = baseConfig({ minPrs: 1, activeSince: "2026-05-01" });
    const result = filterClankers(fakeClankers, config);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map((c) => c.username).sort(), ["bot1", "bot2"]);
  });

  it("combines minPrs and activeSince", () => {
    const config = baseConfig({ minPrs: 10, activeSince: "2026-05-01" });
    const result = filterClankers(fakeClankers, config);
    assert.equal(result.length, 1);
    assert.equal(result[0].username, "bot1");
  });

  it("returns empty when no clankers meet threshold", () => {
    const config = baseConfig({ minPrs: 100 });
    const result = filterClankers(fakeClankers, config);
    assert.equal(result.length, 0);
  });

  it("returns all when threshold is 1 and no date filter", () => {
    const config = baseConfig({ minPrs: 1 });
    const result = filterClankers(fakeClankers, config);
    assert.equal(result.length, 4);
  });
});

describe("runBlocker", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(handlers: Record<string, { status: number; body?: unknown }>) {
    globalThis.fetch = mock.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = init?.method || "GET";

      for (const [pattern, response] of Object.entries(handlers)) {
        if (url.includes(pattern)) {
          return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.status === 204 ? "No Content" : "OK",
            json: async () => response.body,
          } as Response;
        }
      }

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => [],
      } as Response;
    }) as unknown as typeof globalThis.fetch;
  }

  it("blocks accounts that meet threshold in dry-run mode", async () => {
    mockFetch({
      "clankers.json": { status: 200, body: fakeClankers },
      "/user/blocks?": { status: 200, body: [] },
    });

    const config = baseConfig({ minPrs: 5, dryRun: true });
    const result = await runBlocker("fake-token", [], config);

    assert.equal(result.blocked.length, 3);
    assert.ok(result.blocked.includes("bot1"));
    assert.ok(result.blocked.includes("bot2"));
    assert.ok(result.blocked.includes("bot4"));
  });

  it("skips already-blocked accounts", async () => {
    mockFetch({
      "clankers.json": { status: 200, body: fakeClankers },
      "/user/blocks?": { status: 200, body: [{ login: "bot1" }, { login: "bot2" }] },
    });

    const config = baseConfig({ minPrs: 5, dryRun: true });
    const result = await runBlocker("fake-token", [], config);

    assert.equal(result.alreadyBlocked.length, 2);
    assert.equal(result.blocked.length, 1);
    assert.ok(result.blocked.includes("bot4"));
  });

  it("respects exclude list (case-insensitive)", async () => {
    mockFetch({
      "clankers.json": { status: 200, body: fakeClankers },
      "/user/blocks?": { status: 200, body: [] },
    });

    const config = baseConfig({ minPrs: 5, dryRun: true, excludeUsernames: ["BOT1", "bot4"] });
    const result = await runBlocker("fake-token", [], config);

    assert.equal(result.blocked.length, 1);
    assert.ok(result.blocked.includes("bot2"));
    assert.equal(result.skipped.length, 2);
  });

  it("adds extra usernames regardless of threshold", async () => {
    mockFetch({
      "clankers.json": { status: 200, body: fakeClankers },
      "/user/blocks?": { status: 200, body: [] },
    });

    const config = baseConfig({ minPrs: 100, dryRun: true, extraUsernames: ["manual-block"] });
    const result = await runBlocker("fake-token", [], config);

    assert.equal(result.blocked.length, 1);
    assert.ok(result.blocked.includes("manual-block"));
  });

  it("blocks on personal account when orgs is empty", async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      urls.push(url);
      if (url.includes("clankers.json")) {
        return { ok: true, status: 200, json: async () => fakeClankers } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    };

    const config = baseConfig({ minPrs: 100, dryRun: true });
    await runBlocker("fake-token", [], config);

    assert.ok(urls.some((u) => u.includes("/user/blocks")));
    assert.ok(!urls.some((u) => u.includes("/orgs/")));
  });

  it("iterates multiple orgs", async () => {
    const urls: string[] = [];
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      urls.push(url);
      if (url.includes("clankers.json")) {
        return { ok: true, status: 200, json: async () => fakeClankers } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    };

    const config = baseConfig({ minPrs: 5, dryRun: true });
    const result = await runBlocker("fake-token", ["org-a", "org-b"], config);

    assert.ok(urls.some((u) => u.includes("/orgs/org-a/blocks")));
    assert.ok(urls.some((u) => u.includes("/orgs/org-b/blocks")));
    assert.ok(!urls.some((u) => u.includes("/user/blocks")));
    // Each org gets the same 3 targets blocked
    assert.equal(result.blocked.length, 6);
  });

  it("continues to next org if one fails", async () => {
    globalThis.fetch = async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("clankers.json")) {
        return { ok: true, status: 200, json: async () => fakeClankers } as Response;
      }
      if (url.includes("/orgs/bad-org/blocks?")) {
        return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    };

    const config = baseConfig({ minPrs: 5, dryRun: true });
    const result = await runBlocker("fake-token", ["bad-org", "good-org"], config);

    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].username.includes("bad-org"));
    assert.equal(result.blocked.length, 3);
  });

  it("records errors for individual block failures", async () => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("clankers.json")) {
        return { ok: true, status: 200, json: async () => fakeClankers } as Response;
      }
      if (url.includes("/user/blocks?")) {
        return { ok: true, status: 200, json: async () => [] } as Response;
      }
      if (init?.method === "PUT" && url.includes("/bot1")) {
        return { ok: false, status: 403, statusText: "Forbidden", json: async () => ({}) } as Response;
      }
      if (init?.method === "PUT") {
        return { ok: true, status: 204, statusText: "No Content", json: async () => ({}) } as Response;
      }
      return { ok: true, status: 200, json: async () => [] } as Response;
    };

    const config = baseConfig({ minPrs: 5, dryRun: false });
    const result = await runBlocker("fake-token", [], config);

    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].username, "bot1");
    assert.equal(result.blocked.length, 2);
  });
});
