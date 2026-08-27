import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { BridgewatchProgramSnapshot } from "../src/history.js";

const priorEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key];
  Object.assign(process.env, priorEnv);
});

describe("Bridgewatch read-only API", () => {
  it("serves GET-only health and truthful unavailable-source state", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    process.env.BRIDGEWATCH_TELEMETRY_TOKEN = "test-telemetry-token";
    const { buildServer } = await import("../lib/server.js");
    const { app } = buildServer();
    try {
      const summary = await app.inject({ method: "GET", url: "/api/summary" });
      expect(summary.statusCode).toBe(200);
      expect(summary.json().source.state).toBe("UNAVAILABLE");
      expect(
        (await app.inject({ method: "GET", url: "/api/sources" }))
          .json()
          .find((entry: { name: string }) => entry.name === "reporter").state,
      ).toBe("HEALTHY");
      const sourceProfiles = (await app.inject({ method: "GET", url: "/api/sources" })).json();
      expect(sourceProfiles.find((entry: { name: string }) => entry.name === "github")).toMatchObject({
        sourceId: "github-repository-api",
        configured: true,
        coverage: { state: "NO_CURRENT_OBSERVATION" },
      });
      expect(sourceProfiles.find((entry: { name: string }) => entry.name === "reporter")).toMatchObject({
        coverage: { state: "SOURCE_RETURNED_NO_DATA" },
        repairability: "NOT_APPLICABLE",
      });
      expect(summary.headers["content-security-policy"]).toContain("default-src 'self'");
      const dashboard = await app.inject({ method: "GET", url: "/" });
      expect(dashboard.statusCode).toBe(200);
      expect(dashboard.body).toContain('href="/style.css"');
      expect(dashboard.body).toContain('src="/app.js"');
      expect(dashboard.body).toContain('href="/admin"');
      expect((await app.inject({ method: "GET", url: "/style.css" })).statusCode).toBe(200);
      const appScript = (await app.inject({ method: "GET", url: "/app.js" })).body;
      expect(appScript).toContain('window.location.pathname.startsWith("/bridgewatch")');
      expect(appScript).toContain('request("api/summary")');
      expect(appScript).toContain('window.addEventListener("hashchange", renderRoute)');
      expect(appScript).toContain("function renderProjectProfile");
      const mutation = await app.inject({
        method: "POST",
        url: "/api/summary",
      });
      expect(mutation.statusCode).toBe(404);
      const heartbeat = {
        workerId: "codex-bridgewatch-02",
        project: "bridgewatch",
        phase: "2",
        task: "Test activity only",
        state: "WORKING",
        branch: "codex/project-bridgewatch-phase2-wire-the-signals",
        sourceSha: "236c27241bb8d1630274f5d5412ec9addbdb8893",
        host: "test-host",
        startedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
      };
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat",
            payload: heartbeat,
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat?token=no",
            headers: { authorization: "Bearer test-telemetry-token" },
            payload: heartbeat,
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat",
            headers: { authorization: "Bearer test-telemetry-token" },
            payload: heartbeat,
          })
        ).statusCode,
      ).toBe(202);
      expect((await app.inject({ method: "GET", url: "/api/workers" })).json()[0].effectiveState).toBe("WORKING");
      expect(
        (await app.inject({ method: "GET", url: "/api/sources" }))
          .json()
          .find((entry: { name: string }) => entry.name === "reporter").state,
      ).toBe("HEALTHY");
      for (let index = 0; index < 59; index += 1)
        await app.inject({
          method: "POST",
          url: "/api/telemetry/heartbeat",
          headers: { authorization: "Bearer test-telemetry-token" },
          payload: heartbeat,
        });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/telemetry/heartbeat",
            headers: { authorization: "Bearer test-telemetry-token" },
            payload: heartbeat,
          })
        ).statusCode,
      ).toBe(429);
    } finally {
      await app.close();
    }
  });

  it("reports degraded GitHub acquisition while preserving retained observation coverage", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      const observedAt = new Date().toISOString();
      store.put(
        "github:snapshot",
        {
          repository: "owner/repository",
          defaultBranch: "main",
          headSha: "cached-main",
          observedAt,
          pullRequests: [],
          branches: [],
          workflows: [],
        },
        null,
        observedAt,
      );
      store.upsertSourceObservation({
        name: "github",
        state: "DEGRADED",
        configured: true,
        reachable: false,
        lastAttemptAt: observedAt,
        lastSuccessAt: observedAt,
        nextRetryAt: new Date(Date.now() + 60_000).toISOString(),
        detail: "GitHub GET failed: 503",
        cacheAgeMs: 0,
        authenticationState: "ANONYMOUS",
      });
      const github = (await app.inject({ method: "GET", url: "/api/sources" }))
        .json()
        .find((entry: { name: string }) => entry.name === "github");
      expect(github).toMatchObject({
        state: "DEGRADED",
        servingRetainedStaleData: true,
        coverage: { state: "BOUNDED_CURRENT" },
        failure: { classification: "SOURCE_UNREACHABLE" },
      });
      expect((await app.inject({ method: "GET", url: "/api/summary" })).json().github.headSha).toBe("cached-main");
    } finally {
      await app.close();
    }
  });

  it("serves P2 data-fabric provenance and coverage through GET-only, redacted observation routes", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    const fixtureRoot = mkdtempSync(join(tmpdir(), "bridgewatch-fabric-server-"));
    process.env.BRIDGEWATCH_DB_PATH = join(fixtureRoot, "cache.sqlite");
    process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH = join(fixtureRoot, "runtime.json");
    process.env.BRIDGEWATCH_PROVIDER_STATUS_PATH = join(fixtureRoot, "providers.json");
    writeFileSync(
      process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH,
      JSON.stringify({ sourceSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", port: 4318, cookie: "server-secret" }),
    );
    writeFileSync(
      process.env.BRIDGEWATCH_PROVIDER_STATUS_PATH,
      JSON.stringify({ providers: [{ name: "fixture", state: "HEALTHY", authorization: "server-secret" }] }),
    );
    const { buildServer } = await import("../lib/server.js");
    const { app, refreshSources } = buildServer();
    try {
      await refreshSources();
      const facts = await app.inject({ method: "GET", url: "/api/facts" });
      expect(facts.statusCode).toBe(200);
      const body = facts.json();
      expect(body.facts).toContainEqual(
        expect.objectContaining({
          factClass: "voyagewright.runtime-identity",
          provenance: expect.objectContaining({ sourceId: "voyagewright-runtime" }),
        }),
      );
      expect(body.coverage).toContainEqual(expect.objectContaining({ system: "Voyagewright", expected: 2 }));
      expect(facts.body).not.toContain("server-secret");
      const runtime = body.facts.find((item: { factClass: string }) => item.factClass === "voyagewright.runtime-identity");
      expect((await app.inject({ method: "GET", url: `/api/facts/${encodeURIComponent(runtime.key)}` })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/api/coverage" })).statusCode).toBe(200);
      expect((await app.inject({ method: "POST", url: "/api/facts" })).statusCode).toBe(404);
      expect((await app.inject({ method: "POST", url: "/api/coverage" })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("protects dashboard and human observation routes when private dashboard authentication is configured", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    process.env.BRIDGEWATCH_DASHBOARD_USERNAME = "operator";
    process.env.BRIDGEWATCH_DASHBOARD_PASSWORD = "test-password";
    const { buildServer } = await import("../lib/server.js");
    const { app } = buildServer();
    try {
      expect((await app.inject({ method: "GET", url: "/api/summary" })).statusCode).toBe(401);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/summary",
            headers: {
              authorization: `Basic ${Buffer.from("operator:test-password").toString("base64")}`,
            },
          })
        ).statusCode,
      ).toBe(200);
      expect((await app.inject({ method: "GET", url: "/healthz" })).statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("keeps program history bounded, filtered, and GET-only without changing activity API semantics", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      const capturedAt = new Date().toISOString();
      const before: BridgewatchProgramSnapshot = {
        schemaVersion: 1,
        capturedAt,
        projects: store.projects(),
        github: null,
        workers: [],
        soundingLine: null,
      };
      const baselineProject = before.projects.find((entry) => entry.id === "bridgewatch")!;
      baselineProject.state = "ACTIVE";
      baselineProject.phases[2]!.state = "ACTIVE";
      const after = structuredClone(before);
      const project = after.projects.find((entry) => entry.id === "bridgewatch")!;
      project.state = "COMPLETE";
      project.phases[2]!.state = "COMPLETE";
      store.recordHistory(before);
      store.recordHistory(after);
      const history = await app.inject({
        method: "GET",
        url: `/api/history?since=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}&project=bridgewatch`,
      });
      expect(history.statusCode).toBe(200);
      expect(history.json().events.some((event: { kind: string }) => event.kind === "PROJECT_STATE_CHANGED")).toBe(
        true,
      );
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/history?since=not-a-date",
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/history?since=2099-01-01T00%3A00%3A00.000Z",
          })
        ).statusCode,
      ).toBe(400);
      expect((await app.inject({ method: "POST", url: "/api/history" })).statusCode).toBe(404);
      expect((await app.inject({ method: "GET", url: "/api/activity" })).statusCode).toBe(200);
      const trends = await app.inject({ method: "GET", url: "/api/trends" });
      expect(trends.statusCode).toBe(200);
      expect(trends.json().acceptedTimeline).toEqual(expect.any(Array));
      expect((await app.inject({ method: "GET", url: "/api/archive?order=name" })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/api/archive?order=unknown" })).statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("continues serving current observation when the history writer fails", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    process.env.BRIDGEWATCH_TELEMETRY_TOKEN = "test-telemetry-token";
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      store.recordHistory = (() => {
        throw new Error("task-owned history fault");
      }) as typeof store.recordHistory;
      const response = await app.inject({
        method: "POST",
        url: "/api/telemetry/heartbeat",
        headers: { authorization: "Bearer test-telemetry-token" },
        payload: {
          workerId: "history-writer-fixture",
          project: "bridgewatch",
          phase: "3",
          task: "Failure posture proof",
          state: "WORKING",
          branch: "codex/project-bridgewatch-phase3-keep-the-watch-1",
          sourceSha: "aaaaaaa",
          host: "fixture",
          startedAt: new Date().toISOString(),
          heartbeatAt: new Date().toISOString(),
        },
      });
      expect(response.statusCode).toBe(202);
      const summary = await app.inject({ method: "GET", url: "/api/summary" });
      expect(summary.statusCode).toBe(200);
      expect(summary.json().history.warning).toContain("Historical persistence");
      expect(summary.json().workers[0].workerId).toBe("history-writer-fixture");
    } finally {
      await app.close();
    }
  });

  it("reconciles local repository evidence so the active Bridgewatch v1.2 branch is self-discovered", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, refreshSources } = buildServer();
    try {
      await refreshSources();
      const response = await app.inject({
        method: "GET",
        url: "/api/projects/bridgewatch",
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().versions).toContainEqual(
        expect.objectContaining({
          identity: "v1.2",
          lifecycle: "IN_DEVELOPMENT",
        }),
      );
    } finally {
      await app.close();
    }
  });

  it("serves a bounded exact custom historical comparison through a GET-only route", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      const capturedAt = new Date(Date.now() - 5_000).toISOString();
      const before: BridgewatchProgramSnapshot = {
        schemaVersion: 1,
        capturedAt,
        projects: store.projects(),
        github: null,
        workers: [],
        soundingLine: null,
      };
      before.projects[0]!.state = "COMPLETE";
      const after = structuredClone(before);
      after.capturedAt = new Date(Date.now() - 1_000).toISOString();
      after.projects[0]!.state = "ACTIVE";
      store.recordHistory(before);
      store.recordHistory(after);

      const response = await app.inject({
        method: "GET",
        url: `/api/compare?from=${encodeURIComponent(capturedAt)}&to=${encodeURIComponent(new Date().toISOString())}`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ fidelity: "EXACT" });
      expect(response.json().events).toContainEqual(expect.objectContaining({ kind: "PROJECT_STATE_CHANGED" }));
      expect((await app.inject({ method: "POST", url: "/api/compare" })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("labels comparison as rollup fidelity when detailed events have been retained only as daily aggregates", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      const before: BridgewatchProgramSnapshot = {
        schemaVersion: 1,
        capturedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
        projects: store.projects(),
        github: null,
        workers: [],
        soundingLine: null,
      };
      before.projects.find((project) => project.id === "bridgewatch")!.state = "ACTIVE";
      const after = structuredClone(before);
      after.capturedAt = new Date(Date.now() - 9 * 86_400_000).toISOString();
      after.projects.find((project) => project.id === "bridgewatch")!.state = "COMPLETE";
      store.recordHistory(before);
      store.recordHistory(after);
      store.pruneHistory({
        eventRetentionDays: 1,
        rollupRetentionDays: 90,
        dryRun: false,
      });
      const response = await app.inject({
        method: "GET",
        url: `/api/compare?from=${encodeURIComponent(before.capturedAt)}&to=${encodeURIComponent(after.capturedAt)}`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ fidelity: "ROLLUP" });
      expect(response.json().rollups).toHaveLength(1);
      expect(response.json().coarse.changedProjectIds).toContain("bridgewatch");
    } finally {
      await app.close();
    }
  });

  it("serves read-only project, version, and phase profiles as independent deep-link resources", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, refreshSources } = buildServer();
    try {
      await refreshSources();
      const versions = await app.inject({
        method: "GET",
        url: "/api/projects/bridgewatch/versions",
      });
      expect(versions.statusCode).toBe(200);
      expect(versions.json()).toContainEqual(expect.objectContaining({ identity: "v1.2" }));
      const version = await app.inject({
        method: "GET",
        url: "/api/projects/bridgewatch/versions/v1.2",
      });
      expect(version.statusCode).toBe(200);
      expect(version.json()).toMatchObject({
        projectId: "bridgewatch",
        version: { identity: "v1.2" },
      });
      const phase = await app.inject({
        method: "GET",
        url: "/api/projects/bridgewatch/phases/3",
      });
      expect(phase.statusCode).toBe(200);
      expect(phase.json()).toMatchObject({
        projectId: "bridgewatch",
        phase: { ordinal: 3, name: "Keep the Watch" },
      });
      expect(phase.json().tasks).toEqual(expect.any(Array));
      const project = await app.inject({
        method: "GET",
        url: "/api/projects/bridgewatch",
      });
      expect(project.json()).toMatchObject({
        id: "bridgewatch",
        history: expect.any(Array),
        evidence: expect.any(Array),
      });
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/projects/bridgewatch/versions/v1.2",
          })
        ).statusCode,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });

  it("provides retained GitHub, source, and Sounding Line profiles without exposing controls", async () => {
    process.env.BRIDGEWATCH_REPOSITORY = "owner/repository";
    process.env.BRIDGEWATCH_DB_PATH = join(mkdtempSync(join(tmpdir(), "bridgewatch-test-")), "cache.sqlite");
    const { buildServer } = await import("../lib/server.js");
    const { app, store } = buildServer();
    try {
      const observedAt = new Date().toISOString();
      store.put(
        "github:snapshot",
        {
          repository: "owner/repository",
          defaultBranch: "main",
          headSha: "main-sha",
          observedAt,
          pullRequests: [
            {
              number: 17,
              title: "Project Bridgewatch v1.2 Mission Control",
              url: "https://github.example.test/owner/repository/pull/17",
              state: "OPEN",
              createdAt: observedAt,
              updatedAt: observedAt,
              mergedAt: null,
              headRef: "codex/project-bridgewatch-v1.2-mission-control",
              headSha: "candidate-sha",
              checkState: "PENDING",
              mergeableState: "UNKNOWN",
            },
            {
              number: 16,
              title: "Historical Bridgewatch v1.1",
              url: "https://github.example.test/owner/repository/pull/16",
              state: "MERGED",
              createdAt: observedAt,
              updatedAt: observedAt,
              mergedAt: observedAt,
              headRef: "codex/project-bridgewatch-v1.1",
              headSha: "historical-sha",
              checkState: "SUCCESS",
              mergeableState: "CLEAN",
            },
          ],
          branches: [
            {
              name: "codex/project-bridgewatch-v1.2-mission-control",
              headSha: "candidate-sha",
              defaultSha: "main-sha",
              ahead: 2,
              behind: 0,
              lastActivityAt: observedAt,
              pullRequestNumber: 17,
              pullRequestState: "OPEN",
              compareState: "AVAILABLE",
            },
          ],
          workflows: [],
        },
        null,
        observedAt,
      );
      store.replaceTestProjection({
        schemaVersion: 1,
        observedAt,
        source: "SOUNDING_LINE_RUNTIME",
        leases: 0,
        workers: [],
        plans: [
          {
            id: "run-17",
            sourceSha: "candidate-sha",
            gate: "mainline",
            state: "COMPLETE",
            createdAt: observedAt,
            cleanupState: "CLEAN",
            finalDecision: "RELEASE_GO",
            nodes: [],
          },
        ],
      });
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/pull-requests?state=ALL",
          })
        ).json(),
      ).toHaveLength(2);
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/pull-requests?state=HISTORICAL",
          })
        ).json(),
      ).toHaveLength(1);
      const pull = await app.inject({
        method: "GET",
        url: "/api/pull-requests/17",
      });
      expect(pull.statusCode).toBe(200);
      expect(pull.json()).toMatchObject({
        pullRequest: { number: 17 },
        associations: { projectIds: ["bridgewatch"] },
      });
      const branch = await app.inject({
        method: "GET",
        url: "/api/branches/profile?name=codex%2Fproject-bridgewatch-v1.2-mission-control",
      });
      expect(branch.statusCode).toBe(200);
      expect(branch.json()).toMatchObject({
        branch: { name: "codex/project-bridgewatch-v1.2-mission-control" },
      });
      expect((await app.inject({ method: "GET", url: "/api/sources/github" })).statusCode).toBe(200);
      expect((await app.inject({ method: "GET", url: "/api/sounding-line/runs" })).json()).toContainEqual(
        expect.objectContaining({ id: "run-17" }),
      );
      expect(
        (
          await app.inject({
            method: "GET",
            url: "/api/sounding-line/runs/run-17",
          })
        ).statusCode,
      ).toBe(200);
      expect((await app.inject({ method: "POST", url: "/api/pull-requests/17" })).statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
