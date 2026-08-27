import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { DataFabricCollector, deriveCoverage, expectedFactClasses } from "../src/fabric.js";
import { projectRegistry } from "../src/registry.js";
import { normalizeSoundingLineProjection } from "../src/sounding-line.js";
import { BridgewatchStore } from "../lib/store.js";
import type { Snapshot } from "../lib/github.js";

function writeFixture(root: string) {
  mkdirSync(join(root, "Development_Docs", "Features", "catalog"), { recursive: true });
  mkdirSync(join(root, "Development_Docs", "Programs", "Deepwater"), { recursive: true });
  mkdirSync(join(root, "prisma", "migrations", "0001_fixture"), { recursive: true });
  writeFileSync(
    join(root, "Development_Docs", "document-index.json"),
    JSON.stringify({ records: [{ path: "Development_Docs/Project_Test.md", status: "current" }] }),
  );
  writeFileSync(join(root, "Development_Docs", "Features", "catalog", "bridgewatch.json"), JSON.stringify([{ id: "FT-X" }]));
  writeFileSync(
    join(root, "Development_Docs", "Programs", "Deepwater", "deepwater-phase-status.json"),
    JSON.stringify({ phases: [{ id: "deepwater-p1" }] }),
  );
  writeFileSync(join(root, "prisma", "schema.sqlite.prisma"), "model Fixture { id String @id }\n");
  writeFileSync(join(root, "prisma", "migrations", "0001_fixture", "migration.sql"), "-- fixture\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["config", "user.email", "bridgewatch@example.test"], { cwd: root });
  execFileSync("git", ["config", "user.name", "Bridgewatch fixture"], { cwd: root });
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: root });
  execFileSync("git", ["branch", "-M", "main"], { cwd: root });
  execFileSync("git", ["update-ref", "refs/remotes/origin/main", "HEAD"], { cwd: root });
}

function githubSnapshot(observedAt: string): Snapshot {
  return {
    repository: "owner/repository",
    defaultBranch: "main",
    headSha: "1111111111111111111111111111111111111111",
    pullRequests: [],
    openPullRequests: [],
    workflows: [],
    branches: [],
    observedAt,
  };
}

describe("Bridgewatch P2 data fabric", () => {
  it("collects bounded facts with precedence, coverage, durable history, and redaction", async () => {
    const root = join(tmpdir(), `bridgewatch-fabric-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
    writeFixture(root);
    const runtimeState = join(root, "runtime-state.json");
    const providerState = join(root, "provider-state.json");
    writeFileSync(
      runtimeState,
      `\uFEFF${JSON.stringify({ sourceSha: "2222222222222222222222222222222222222222", port: 4318, state: "READY", cookie: "ultra-secret" })}`,
    );
    writeFileSync(
      providerState,
      JSON.stringify({ observedAt: "2026-08-27T00:00:00.000Z", authorization: "ultra-secret", providers: [{ name: "mail", state: "HEALTHY" }] }),
    );
    const config = loadConfig({
      BRIDGEWATCH_REPOSITORY: "owner/repository",
      BRIDGEWATCH_DB_PATH: join(root, "bridgewatch.sqlite"),
      BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH: runtimeState,
      BRIDGEWATCH_PROVIDER_STATUS_PATH: providerState,
      BRIDGEWATCH_TELEMETRY_TOKEN: "test-only-token",
    });
    const store = new BridgewatchStore(config.dbPath);
    try {
      const collector = new DataFabricCollector(config, store, root);
      const observedAt = "2026-08-27T00:00:00.000Z";
      const snapshot = await collector.refresh({
        github: githubSnapshot(observedAt),
        soundingLine: normalizeSoundingLineProjection({
          schemaVersion: 1,
          observedAt,
          source: "SOUNDING_LINE_RUNTIME",
          leases: 0,
          workers: [],
          plans: [],
        }),
        projects: projectRegistry,
        workers: [],
      });

      expect(snapshot.sources).toHaveLength(11);
      expect(snapshot.facts.map((fact) => fact.factClass)).toEqual(expect.arrayContaining(expectedFactClasses.map((item) => item.id)));
      expect(store.migrationVersions()).toEqual([1, 2, 3, 4, 5]);
      expect(store.fabricFacts()).toHaveLength(snapshot.facts.length);
      const main = snapshot.coverage
        .find((entry) => entry.system === "Repository")!
        .factClasses.find((entry) => entry.id === "repository.current-main")!;
      expect(main).toMatchObject({ state: "AUTHORITATIVE", sourceId: "git-main" });
      expect(snapshot.coverage.reduce((total, entry) => total + entry.expected, 0)).toBe(expectedFactClasses.length);
      expect(JSON.stringify(snapshot)).not.toContain("ultra-secret");

      unlinkSync(join(root, "prisma", "schema.sqlite.prisma"));
      const stale = await collector.refresh({
        github: githubSnapshot(observedAt),
        soundingLine: null,
        projects: projectRegistry,
        workers: [],
      });
      const schemaSource = stale.sources.find((source) => source.id === "schema-migrations")!;
      expect(schemaSource).toMatchObject({ state: "DEGRADED", servingRetainedStaleData: true });
      expect(schemaSource.facts[0]).toMatchObject({ state: "STALE", provenance: { retainedFromCache: true } });
      expect(store.fabricFactHistory("schema-migrations:voyagewright.schema-migrations")).toHaveLength(2);
    } finally {
      store.close();
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("counts explicit unavailable and unrecorded fact classes without fabricating coverage", () => {
    const coverage = deriveCoverage([
      {
        key: "fixture:governance.records",
        factClass: "governance.records",
        label: "Indexed governing records",
        state: "NOT_HISTORICALLY_RECORDED",
        value: {},
        provenance: {
          sourceId: "governing-records",
          sourceIdentity: "fixture",
          reference: "fixture",
          authority: "AUTHORITATIVE",
          precedence: 100,
          sourceObservedAt: null,
          bridgewatchObservedAt: "2026-08-27T00:00:00.000Z",
          retainedFromCache: false,
        },
        limitation: "No approved record exists.",
      },
    ]);
    const governance = coverage.find((entry) => entry.system === "Governance")!;
    expect(governance).toMatchObject({ expected: 3, notHistoricallyRecorded: 3, unknown: 0 });
  });
});
