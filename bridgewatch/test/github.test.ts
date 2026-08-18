import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../src/config.js";
import { GithubCollector } from "../lib/github.js";
import { BridgewatchStore } from "../lib/store.js";

afterEach(() => vi.unstubAllGlobals());

describe("GitHub normalized collection", () => {
  it("keeps only the safe branch and pull fields needed for Bridgewatch history", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "bridgewatch-github-"));
    const store = new BridgewatchStore(join(scratch, "cache.sqlite"));
    const config = loadConfig({
      BRIDGEWATCH_REPOSITORY: "owner/repository",
      BRIDGEWATCH_GITHUB_API: "https://api.example.test",
      BRIDGEWATCH_GITHUB_MAX_BRANCHES: "2",
      BRIDGEWATCH_GITHUB_STATE_DIR: scratch,
    });
    vi.stubGlobal("fetch", async (target: string) => {
      const path = new URL(target).pathname;
      const body = path.endsWith("/pulls")
        ? [
            {
              number: 71,
              title: "Safe pull",
              state: "open",
              html_url: "https://github.com/owner/repository/pull/71",
              created_at: "2026-08-01T00:00:00.000Z",
              updated_at: "2026-08-01T01:00:00.000Z",
              body: "private prompt-shaped prose must not persist",
              head: { ref: "codex/safe", sha: "aaaaaaa", label: "private-email@example.test" },
            },
          ]
        : path.includes("check-runs")
          ? { check_runs: [{ status: "completed", conclusion: "success", output: { text: "private log" } }] }
          : path.includes("/compare/")
            ? {
                ahead_by: 2,
                behind_by: 1,
                head_commit: { sha: "aaaaaaa", commit: { committer: { date: "2026-08-01T01:00:00.000Z" } } },
                commits: [{ commit: { committer: { date: "2026-08-01T01:00:00.000Z" } } }],
              }
            : path.endsWith("/git/ref/heads/main")
              ? { object: { sha: "mainsha", url: "https://private.example.test" } }
              : path.endsWith("/actions/runs")
                ? { workflow_runs: [] }
                : { default_branch: "main", owner: { email: "private-email@example.test" } };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: {
          etag: "fixture",
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "42",
          "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
        },
      });
    });
    try {
      const snapshot = await new GithubCollector(config, store).refresh();
      expect(snapshot?.pullRequests[0]).toMatchObject({ number: 71, state: "OPEN", checkState: "SUCCESS" });
      expect(snapshot?.branches[0]).toMatchObject({ ahead: 2, behind: 1, compareState: "AVAILABLE" });
      expect(store.observedPullRequests()).toContainEqual(
        expect.objectContaining({ number: 71, headRef: "codex/safe" }),
      );
      expect(store.observedBranches()).toContainEqual(expect.objectContaining({ name: "codex/safe", ahead: 2 }));
      const cached = JSON.stringify(store.get<unknown>("github:pulls")?.value);
      expect(cached).not.toContain("prompt-shaped");
      expect(cached).not.toContain("private-email");
      expect(cached).not.toContain("private log");
      expect(store.sourceObservations()).toContainEqual(
        expect.objectContaining({
          name: "github",
          state: "DEGRADED",
          configured: false,
          reachable: true,
          authenticationState: "ANONYMOUS",
          rateLimitRemaining: 42,
          rateLimitLimit: 5000,
          rateMode: "CRITICAL",
        }),
      );
    } finally {
      store.close();
    }
  });

  it("batches open-pull check suites through GraphQL before bounded REST fallback", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "bridgewatch-github-"));
    const store = new BridgewatchStore(join(scratch, "cache.sqlite"));
    const config = loadConfig({
      BRIDGEWATCH_REPOSITORY: "owner/repository",
      BRIDGEWATCH_GITHUB_API: "https://api.example.test",
      BRIDGEWATCH_GITHUB_MAX_BRANCHES: "2",
      BRIDGEWATCH_GITHUB_STATE_DIR: scratch,
    });
    let graphqlCalls = 0;
    let checkRunCalls = 0;
    vi.stubGlobal("fetch", async (target: string) => {
      const path = new URL(target).pathname;
      if (path === "/graphql") {
        graphqlCalls += 1;
        return new Response(
          JSON.stringify({
            data: {
              repository: {
                pullRequests: {
                  nodes: [
                    {
                      number: 71,
                      commits: {
                        nodes: [
                          { commit: { checkSuites: { nodes: [{ status: "COMPLETED", conclusion: "SUCCESS" }] } } },
                        ],
                      },
                    },
                    {
                      number: 72,
                      commits: {
                        nodes: [{ commit: { checkSuites: { nodes: [{ status: "IN_PROGRESS", conclusion: null }] } } }],
                      },
                    },
                  ],
                },
              },
            },
          }),
          {
            status: 200,
            headers: {
              "x-ratelimit-limit": "5000",
              "x-ratelimit-remaining": "4900",
              "x-ratelimit-resource": "graphql",
            },
          },
        );
      }
      if (path.includes("check-runs")) checkRunCalls += 1;
      const body = path.endsWith("/pulls")
        ? [
            { number: 71, title: "First", state: "open", head: { ref: "codex/one", sha: "111" } },
            { number: 72, title: "Second", state: "open", head: { ref: "codex/two", sha: "222" } },
          ]
        : path.endsWith("/git/ref/heads/main")
          ? { object: { sha: "mainsha" } }
          : path.endsWith("/actions/runs")
            ? { workflow_runs: [] }
            : path.includes("/compare/")
              ? { ahead_by: 0, behind_by: 0, commits: [] }
              : { default_branch: "main" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "4900" },
      });
    });
    try {
      const snapshot = await new GithubCollector(config, store).refresh();
      expect(graphqlCalls).toBe(1);
      expect(checkRunCalls).toBe(0);
      expect(snapshot?.pullRequests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ number: 71, checkState: "SUCCESS" }),
          expect.objectContaining({ number: 72, checkState: "PENDING" }),
        ]),
      );
    } finally {
      store.close();
    }
  });

  it("falls back once to the configured user read pool when the preferred App key is unavailable", async () => {
    const scratch = mkdtempSync(join(tmpdir(), "bridgewatch-github-"));
    const store = new BridgewatchStore(join(scratch, "cache.sqlite"));
    const config = loadConfig({
      BRIDGEWATCH_REPOSITORY: "owner/repository",
      BRIDGEWATCH_GITHUB_API: "https://api.example.test",
      BRIDGEWATCH_GITHUB_STATE_DIR: scratch,
      BRIDGEWATCH_GITHUB_TOKEN: "fixture-user-token",
      BRIDGEWATCH_GITHUB_APP_ID: "123",
      BRIDGEWATCH_GITHUB_APP_INSTALLATION_ID: "456",
      BRIDGEWATCH_GITHUB_APP_PRIVATE_KEY_PATH: join(scratch, "missing-app-key.pem"),
    });
    let userRequests = 0;
    vi.stubGlobal("fetch", async (target: string) => {
      userRequests += 1;
      const path = new URL(target).pathname;
      const body =
        path === "/graphql"
          ? { data: { repository: { pullRequests: { nodes: [] } } } }
          : path.endsWith("/pulls")
            ? []
            : path.endsWith("/git/ref/heads/main")
              ? { object: { sha: "mainsha" } }
              : path.endsWith("/actions/runs")
                ? { workflow_runs: [] }
                : { default_branch: "main" };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "x-ratelimit-limit": "5000", "x-ratelimit-remaining": "4900" },
      });
    });
    try {
      const snapshot = await new GithubCollector(config, store).refresh();
      expect(snapshot?.headSha).toBe("mainsha");
      expect(userRequests).toBeGreaterThan(0);
      expect(store.sourceObservations()).toContainEqual(
        expect.objectContaining({
          name: "github",
          configured: true,
          reachable: true,
          credentialSource: "USER_TOKEN",
          appInstallationHealth: "CONFIGURED",
        }),
      );
    } finally {
      store.close();
    }
  });
});
