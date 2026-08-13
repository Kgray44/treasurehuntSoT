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
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-github-")), "cache.sqlite"));
    const config = loadConfig({
      BRIDGEWATCH_REPOSITORY: "owner/repository",
      BRIDGEWATCH_GITHUB_API: "https://api.example.test",
      BRIDGEWATCH_GITHUB_MAX_BRANCHES: "2",
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
      return new Response(JSON.stringify(body), { status: 200, headers: { etag: "fixture" } });
    });
    try {
      const snapshot = await new GithubCollector(config, store).refresh();
      expect(snapshot?.pullRequests[0]).toMatchObject({ number: 71, state: "OPEN", checkState: "SUCCESS" });
      expect(snapshot?.branches[0]).toMatchObject({ ahead: 2, behind: 1, compareState: "AVAILABLE" });
      const cached = JSON.stringify(store.get<unknown>("github:pulls")?.value);
      expect(cached).not.toContain("prompt-shaped");
      expect(cached).not.toContain("private-email");
      expect(cached).not.toContain("private log");
    } finally {
      store.close();
    }
  });
});
