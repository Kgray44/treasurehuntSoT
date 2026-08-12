import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { projectRegistry } from "../src/registry.js";
import { annotateBranches } from "../lib/server.js";

const config = loadConfig({ BRIDGEWATCH_REPOSITORY: "owner/repository" });

describe("Phase 3 branch-health policy", () => {
  it("marks materially behind or stale active branches for attention without treating merged history as stale", () => {
    const branches = annotateBranches(
      [
        {
          name: "codex/project-bridgewatch-phase3-keep-the-watch-1",
          headSha: "aaaaaaa",
          defaultSha: "bbbbbbb",
          ahead: 2,
          behind: 8,
          lastActivityAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          pullRequestNumber: 55,
          pullRequestState: "OPEN",
          compareState: "AVAILABLE",
        },
        {
          name: "codex/project-bridgewatch-phase2-wire-the-signals",
          headSha: "aaaaaaa",
          defaultSha: "bbbbbbb",
          ahead: 0,
          behind: 0,
          lastActivityAt: "2020-01-01T00:00:00.000Z",
          pullRequestNumber: 49,
          pullRequestState: "MERGED",
          compareState: "AVAILABLE",
        },
      ],
      [...projectRegistry],
      config,
    );
    expect(branches[0]).toMatchObject({ attention: true, reason: "BRANCH_BEHIND_MAIN", merged: false });
    expect(branches[1]).toMatchObject({ merged: true, stale: false, attention: false });
  });
});
