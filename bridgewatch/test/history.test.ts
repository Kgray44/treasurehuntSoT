import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveEvents, snapshotDigest, type BridgewatchProgramSnapshot } from "../src/history.js";
import { assertHistoryPruneTarget, BridgewatchStore } from "../lib/store.js";
import { projectProgress } from "../src/domain.js";

const initial = (capturedAt = "2026-08-01T00:00:00.000Z"): BridgewatchProgramSnapshot => ({
  schemaVersion: 1,
  capturedAt,
  projects: [
    {
      id: "watch",
      name: "Watch",
      repository: "owner/repository",
      state: "ACTIVE",
      governingReferences: ["Development_Docs/watch.md"],
      sourcePaths: ["Development_Docs/watch.md"],
      confidence: "HIGH",
      phases: [
        {
          id: "watch-p1",
          ordinal: 1,
          name: "Observe",
          scope: "Test fixture",
          state: "ACTIVE",
          milestones: [
            {
              id: "watch-p1-history",
              title: "History",
              weight: 1,
              state: "IN_PROGRESS",
              evidence: ["Development_Docs/watch.md"],
            },
          ],
        },
      ],
    },
  ],
  github: {
    repository: "owner/repository",
    defaultBranch: "main",
    headSha: "aaaaaaa",
    pullRequests: [],
    branches: [],
    observedAt: capturedAt,
  },
  workers: [],
  soundingLine: null,
});

function accepted(capturedAt = "2026-08-02T00:00:00.000Z"): BridgewatchProgramSnapshot {
  const snapshot = initial(capturedAt);
  const project = snapshot.projects[0]!;
  const phase = project.phases[0]!;
  project.state = "COMPLETE";
  phase.state = "COMPLETE";
  phase.acceptedAt = "2030-01-01T00:00:00.000Z";
  phase.completedAt = "2030-01-01T00:00:00.000Z";
  phase.integratedMainSha = "bbbbbbb";
  phase.milestones[0]!.state = "ACCEPTED";
  phase.milestones[0]!.acceptedAt = "2030-01-01T00:00:00.000Z";
  snapshot.github = {
    ...snapshot.github!,
    headSha: "bbbbbbb",
    pullRequests: [
      {
        number: 53,
        title: "Accepted watch",
        url: "https://github.com/owner/repository/pull/53",
        state: "MERGED",
        updatedAt: "2030-01-01T00:00:00.000Z",
        createdAt: "2026-08-01T00:00:00.000Z",
        mergedAt: "2030-01-01T00:00:00.000Z",
        headRef: "codex/watch",
        headSha: "bbbbbbb",
        checkState: "SUCCESS",
        mergeableState: "CLEAN",
      },
    ],
    branches: [
      {
        name: "codex/watch",
        headSha: "bbbbbbb",
        defaultSha: "bbbbbbb",
        ahead: 0,
        behind: 0,
        lastActivityAt: "2030-01-01T00:00:00.000Z",
        pullRequestNumber: 53,
        pullRequestState: "MERGED",
        compareState: "AVAILABLE",
      },
    ],
  };
  return snapshot;
}

describe("Phase 3 normalized historical events", () => {
  it("records first-class version discovery separately from governed phase history", () => {
    const before = initial();
    const after = structuredClone(before);
    after.capturedAt = "2026-08-01T01:00:00.000Z";
    after.projects[0]!.versions = [
      {
        id: "watch:v1.2",
        identity: "v1.2",
        lifecycle: "IN_DEVELOPMENT",
        confidence: "AUTHORITATIVE",
        evidence: [
          {
            kind: "GOVERNING_DOCUMENT",
            reference: "Development_Docs/Project_Watch_v1.2.md",
            confidence: "AUTHORITATIVE",
          },
        ],
      },
    ];

    expect(deriveEvents(before, after)).toContainEqual(
      expect.objectContaining({ kind: "VERSION_DISCOVERED", entityId: "watch:v1.2", projectId: "watch" }),
    );
  });

  it("emits deterministic governed transitions once and preserves source clock skew", () => {
    const before = initial();
    const after = accepted();
    const events = deriveEvents(before, after);
    expect(events.map((event) => event.kind)).toEqual(
      expect.arrayContaining([
        "PROJECT_STATE_CHANGED",
        "PHASE_STATE_CHANGED",
        "MILESTONE_STATE_CHANGED",
        "MAIN_ADVANCED",
      ]),
    );
    expect(events.find((event) => event.kind === "PHASE_STATE_CHANGED")?.occurredAt).toBe("2030-01-01T00:00:00.000Z");
    expect(deriveEvents(after, after)).toEqual([]);
    expect(deriveEvents(before, after).map((event) => event.id)).toEqual(events.map((event) => event.id));
  });

  it("does not make snapshot churn from capture timestamps or routine heartbeats", () => {
    const first = initial("2026-08-01T00:00:00.000Z");
    const second = initial("2026-08-01T00:01:00.000Z");
    second.workers = [
      {
        workerId: "worker-1",
        project: "watch",
        phase: "1",
        task: "History fixture",
        state: "WORKING",
        branch: "codex/watch",
        sourceSha: "aaaaaaa",
        host: "fixture",
        startedAt: "2026-08-01T00:00:00.000Z",
        heartbeatAt: "2026-08-01T00:01:00.000Z",
      },
    ];
    const third = structuredClone(second);
    third.workers[0]!.heartbeatAt = "2026-08-01T00:02:00.000Z";
    expect(snapshotDigest(second)).toBe(snapshotDigest(third));
    expect(snapshotDigest(first)).not.toBe(snapshotDigest(second));
  });

  it("records branch divergence without converting Git activity into progress", () => {
    const before = initial();
    const after = initial("2026-08-01T00:01:00.000Z");
    before.github!.branches = [
      {
        name: "codex/watch",
        headSha: "aaaaaaa",
        defaultSha: "aaaaaaa",
        ahead: 5,
        behind: 0,
        lastActivityAt: before.capturedAt,
        pullRequestNumber: null,
        pullRequestState: null,
        compareState: "AVAILABLE",
      },
    ];
    after.github!.branches = [
      {
        name: "codex/watch",
        headSha: "bbbbbbb",
        defaultSha: "aaaaaaa",
        ahead: 30,
        behind: 0,
        lastActivityAt: after.capturedAt,
        pullRequestNumber: null,
        pullRequestState: null,
        compareState: "AVAILABLE",
      },
    ];
    expect(deriveEvents(before, after).map((event) => event.kind)).toContain("BRANCH_HEALTH_CHANGED");
    expect(projectProgress(before.projects[0]!)).toEqual(projectProgress(after.projects[0]!));
  });

  it("captures governed PR, worker, Sounding Line, external-gate, and source transitions without heartbeat spam", () => {
    const before = initial();
    before.github!.pullRequests = [
      {
        number: 10,
        title: "Watch change",
        url: "https://github.com/owner/repository/pull/10",
        state: "OPEN",
        updatedAt: before.capturedAt,
        createdAt: before.capturedAt,
        mergedAt: null,
        headRef: "codex/watch",
        headSha: "aaaaaaa",
        checkState: "PENDING",
        mergeableState: "UNKNOWN",
      },
    ];
    before.workers = [
      {
        workerId: "worker-1",
        project: "watch",
        phase: "1",
        task: "History fixture",
        state: "WORKING",
        branch: "codex/watch",
        sourceSha: "aaaaaaa",
        host: "fixture",
        startedAt: before.capturedAt,
        heartbeatAt: before.capturedAt,
      },
    ];
    before.soundingLine = {
      schemaVersion: 1,
      observedAt: before.capturedAt,
      source: "SOUNDING_LINE_RUNTIME",
      leases: 1,
      workers: [],
      plans: [
        {
          id: "run-1",
          sourceSha: "aaaaaaa",
          gate: "mainline",
          state: "RUNNING",
          createdAt: before.capturedAt,
          cleanupState: "PENDING",
          finalDecision: null,
          nodes: [],
        },
      ],
    };
    const after = structuredClone(before);
    after.capturedAt = "2026-08-02T00:00:00.000Z";
    after.projects[0]!.phases[0]!.externalPending = ["External reviewer"];
    after.github!.pullRequests[0]!.state = "MERGED";
    after.github!.pullRequests[0]!.mergedAt = after.capturedAt;
    after.github!.pullRequests[0]!.checkState = "SUCCESS";
    after.github!.pullRequests.push(
      {
        number: 11,
        title: "Opened",
        url: "https://github.com/owner/repository/pull/11",
        state: "OPEN",
        updatedAt: after.capturedAt,
        createdAt: after.capturedAt,
        mergedAt: null,
        headRef: "codex/opened",
        headSha: "bbbbbbb",
        checkState: "PENDING",
        mergeableState: "UNKNOWN",
      },
      {
        number: 12,
        title: "Closed",
        url: "https://github.com/owner/repository/pull/12",
        state: "CLOSED",
        updatedAt: after.capturedAt,
        createdAt: after.capturedAt,
        mergedAt: null,
        headRef: "codex/closed",
        headSha: "ccccccc",
        checkState: "FAILURE",
        mergeableState: "DIRTY",
      },
    );
    after.workers[0]!.effectiveState = "BLOCKED";
    after.workers.push({ ...after.workers[0]!, workerId: "worker-2", effectiveState: undefined });
    after.soundingLine!.plans[0]!.finalDecision = "RELEASE_GO";
    after.soundingLine!.plans[0]!.nodes = [
      {
        id: "node-1",
        suiteId: "unit.bridgewatch",
        state: "FAILED",
        queuedAt: before.capturedAt,
        startedAt: before.capturedAt,
        completedAt: after.capturedAt,
        attempt: 1,
        rootFailureId: "root-1",
      },
    ];
    const kinds = deriveEvents(before, after).map((event) => event.kind);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "EXTERNAL_GATE_CHANGED",
        "PULL_REQUEST_MERGED",
        "PULL_REQUEST_CHECK_STATE_CHANGED",
        "PULL_REQUEST_OPENED",
        "PULL_REQUEST_CLOSED",
        "WORKER_BLOCKED",
        "WORKER_STARTED",
        "SOUNDING_LINE_DECISION",
        "SOUNDING_LINE_ROOT_FAILURE",
      ]),
    );
    const unavailable = structuredClone(after);
    unavailable.github = null;
    unavailable.soundingLine = null;
    expect(deriveEvents(after, unavailable).map((event) => event.kind)).toContain("SOURCE_STATE_CHANGED");
    const finished = structuredClone(after);
    finished.workers[0]!.effectiveState = "FINISHED";
    expect(deriveEvents(after, finished).map((event) => event.kind)).toContain("WORKER_FINISHED");
  });
});

describe("Phase 3 history persistence", () => {
  it("derives the same durable events from a caller-retained normalized snapshot", () => {
    const store = new BridgewatchStore(
      join(mkdtempSync(join(tmpdir(), "bridgewatch-history-cache-")), "history.sqlite"),
    );
    try {
      const before = initial();
      const after = accepted();
      store.recordHistory(before);
      const result = store.recordHistory(after, { prior: before });
      expect(result.events).not.toHaveLength(0);
      expect(store.history({ since: "2026-01-01T00:00:00.000Z", limit: 100 }).events).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "PROJECT_STATE_CHANGED" })]),
      );
    } finally {
      store.close();
    }
  });

  it("deduplicates snapshots, rolls up before pruning, and protects durable history", () => {
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-history-")), "history.sqlite"));
    try {
      const before = initial();
      const after = accepted();
      before.soundingLine = {
        schemaVersion: 1,
        observedAt: before.capturedAt,
        source: "SOUNDING_LINE_RUNTIME",
        leases: 1,
        workers: [],
        plans: [
          {
            id: "accepted-run",
            sourceSha: "aaaaaaa",
            gate: "mainline",
            state: "RUNNING",
            createdAt: before.capturedAt,
            cleanupState: "PENDING",
            finalDecision: null,
            nodes: [],
          },
        ],
      };
      after.soundingLine = structuredClone(before.soundingLine);
      after.soundingLine!.observedAt = after.capturedAt;
      after.soundingLine!.plans[0]!.finalDecision = "RELEASE_GO";
      store.replaceProjectRegistry(after.projects, after.capturedAt);
      expect(store.recordHistory(before).snapshotStored).toBe(true);
      expect(store.recordHistory(structuredClone(before)).snapshotStored).toBe(false);
      expect(store.recordHistory(after).events).not.toHaveLength(0);
      expect(store.history({ since: "2026-01-01T00:00:00.000Z", limit: 100 }).events).not.toHaveLength(0);
      const dryRun = store.pruneHistory({
        eventRetentionDays: 30,
        rollupRetentionDays: 90,
        now: new Date("2026-09-15T00:00:00.000Z"),
      });
      expect(dryRun.dryRun).toBe(true);
      expect(store.projects()).toEqual(after.projects);
      const pruned = store.pruneHistory({
        eventRetentionDays: 30,
        rollupRetentionDays: 90,
        dryRun: false,
        now: new Date("2026-09-15T00:00:00.000Z"),
      });
      expect(pruned.rollupsCreated).toBeGreaterThan(0);
      expect(pruned.deleted.events).toBeGreaterThan(0);
      expect(store.dailyRollups()).toHaveLength(1);
      expect(store.projects()).toEqual(after.projects);
      expect(
        store
          .history({ since: "2026-01-01T00:00:00.000Z", limit: 100 })
          .events.some((event) => event.kind === "SOUNDING_LINE_DECISION"),
      ).toBe(true);
      expect(
        store.pruneHistory({
          eventRetentionDays: 30,
          rollupRetentionDays: 90,
          dryRun: false,
          now: new Date("2026-09-15T00:00:00.000Z"),
        }).rollupsCreated,
      ).toBe(0);
    } finally {
      store.close();
    }
  });

  it("applies migration 3 to a fresh store, rejects durable prune targets, and restores a semantic backup", async () => {
    const directory = mkdtempSync(join(tmpdir(), "bridgewatch-backup-"));
    const source = new BridgewatchStore(join(directory, "source.sqlite"));
    try {
      expect(source.migrationVersions()).toEqual([1, 2, 3, 4]);
      expect(() => assertHistoryPruneTarget("project_history")).toThrow("durable-history guard");
      expect(() => assertHistoryPruneTarget("events")).not.toThrow();
      const before = initial();
      const after = accepted();
      before.soundingLine = {
        schemaVersion: 1,
        observedAt: before.capturedAt,
        source: "SOUNDING_LINE_RUNTIME",
        leases: 1,
        workers: [],
        plans: [
          {
            id: "restore-run",
            sourceSha: "aaaaaaa",
            gate: "mainline",
            state: "RUNNING",
            createdAt: before.capturedAt,
            cleanupState: "PENDING",
            finalDecision: null,
            nodes: [],
          },
        ],
      };
      after.soundingLine = structuredClone(before.soundingLine);
      after.soundingLine!.observedAt = after.capturedAt;
      after.soundingLine!.plans[0]!.finalDecision = "RELEASE_GO";
      source.replaceProjectRegistry(after.projects, after.capturedAt);
      source.recordHistory(before);
      source.recordHistory(after);
      source.pruneHistory({
        eventRetentionDays: 30,
        rollupRetentionDays: 90,
        dryRun: false,
        now: new Date("2026-09-15T00:00:00.000Z"),
      });
      const backup = join(directory, "restored.sqlite");
      await source.backupTo(backup);
      expect(existsSync(backup)).toBe(true);
      const restored = new BridgewatchStore(backup);
      try {
        expect(restored.projects()).toEqual(after.projects);
        expect(restored.history({ since: "2026-01-01T00:00:00.000Z", limit: 100 }).events).not.toHaveLength(0);
        expect(restored.snapshotCount()).toBe(source.snapshotCount());
        expect(restored.dailyRollups()).toEqual(source.dailyRollups());
        expect(restored.migrationVersions()).toEqual([1, 2, 3, 4]);
      } finally {
        restored.close();
      }
    } finally {
      source.close();
    }
  });

  it("reports repeated independent root classifications as context without recasting them as product truth", () => {
    const store = new BridgewatchStore(join(mkdtempSync(join(tmpdir(), "bridgewatch-recurrence-")), "history.sqlite"));
    try {
      const baseline = initial("2026-08-01T00:00:00.000Z");
      store.recordHistory(baseline);
      for (const day of [1, 2, 3]) {
        const current = structuredClone(baseline);
        current.capturedAt = `2026-08-0${day + 1}T00:00:00.000Z`;
        current.soundingLine = {
          schemaVersion: 1,
          observedAt: current.capturedAt,
          source: "SOUNDING_LINE_RUNTIME",
          leases: 1,
          workers: [],
          plans: [
            {
              id: `run-${day}`,
              sourceSha: `sha-${day}`,
              gate: "mainline",
              state: "FINISHED",
              createdAt: current.capturedAt,
              cleanupState: "CLEAN",
              finalDecision: null,
              nodes: [
                {
                  id: `node-${day}`,
                  suiteId: "unit.bridgewatch",
                  state: "FAILED",
                  queuedAt: current.capturedAt,
                  startedAt: current.capturedAt,
                  completedAt: current.capturedAt,
                  attempt: 1,
                  rootFailureId: "same-root",
                },
              ],
            },
          ],
        };
        store.recordHistory(current);
        baseline.soundingLine = current.soundingLine;
        baseline.capturedAt = current.capturedAt;
      }
      expect(store.rootFailureRecurrences("2026-08-01T00:00:00.000Z")).toEqual([
        { rootFailureId: "same-root", count: 3 },
      ]);
    } finally {
      store.close();
    }
  });
});
