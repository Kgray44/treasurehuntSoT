import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BridgewatchStore } from "../lib/store.js";
import { normalizeSoundingLineProjection, SoundingLineCollector, testTotals } from "../src/sounding-line.js";

describe("Sounding Line status projection", () => {
  it("keeps root failures, blocked dependents, and retries distinct", () => {
    const projection = normalizeSoundingLineProjection({
      schemaVersion: 1,
      observedAt: "2026-08-12T00:00:00.000Z",
      source: "SOUNDING_LINE_RUNTIME",
      leases: 0,
      workers: [],
      plans: [
        {
          id: "run-1",
          sourceSha: "abc",
          gate: "mainline",
          state: "RUNNING",
          createdAt: null,
          cleanupState: "PENDING",
          finalDecision: null,
          nodes: [
            {
              id: "root",
              suiteId: "unit",
              state: "FAILED",
              queuedAt: null,
              startedAt: null,
              completedAt: null,
              attempt: 1,
              rootFailureId: "fixture-1",
            },
            ...Array.from({ length: 31 }, (_, index) => ({
              id: `blocked-${index}`,
              suiteId: "browser",
              state: "BLOCKED" as const,
              queuedAt: null,
              startedAt: null,
              completedAt: null,
              attempt: 1,
              rootFailureId: "fixture-1",
            })),
            {
              id: "retry",
              suiteId: "unit-2",
              state: "PASSED_AFTER_RETRY",
              queuedAt: null,
              startedAt: null,
              completedAt: null,
              attempt: 2,
              rootFailureId: null,
            },
          ],
        },
      ],
    });
    expect(testTotals(projection)).toMatchObject({ rootFailures: 1, blockedDependents: 31, retries: 1, passed: 1 });
  });

  it("rejects a malformed or unsupported projection", () => {
    expect(() => normalizeSoundingLineProjection({ schemaVersion: 2 })).toThrow();
  });

  it("executes the repository-owned read-only projection from the package working directory", async () => {
    const root = mkdtempSync(join(tmpdir(), "bridgewatch-sounding-line-collector-"));
    mkdirSync(join(root, "sl-fixture", "plans"), { recursive: true });
    writeFileSync(join(root, "broker-leases.json"), JSON.stringify({ version: 1, leases: [] }));
    writeFileSync(
      join(root, "sl-fixture", "run-marker.json"),
      JSON.stringify({ runId: "sl-fixture", state: "RUNNING" }),
    );
    writeFileSync(
      join(root, "sl-fixture", "plans", "sealed-plan.json"),
      JSON.stringify({
        sourceSha: "abc",
        gate: "mainline",
        semanticFallback: {
          disposition: "CONSERVATIVE_FALLBACK",
          failure: "MAPPING_DEBT",
          reasons: [
            {
              code: "MAPPING_DEBT",
              debts: [
                {
                  contractId: "bridgewatch.mounted-route",
                  owner: "bridgewatch",
                  classification: "NO_CURRENT_TEST_PROTECTOR",
                  risk: "critical",
                  reason: "No governed suite declares this contract.",
                },
              ],
            },
          ],
        },
        nodes: [],
      }),
    );
    const store = new BridgewatchStore(join(root, "bridgewatch.sqlite"));
    try {
      const collector = new SoundingLineCollector(
        { BRIDGEWATCH_REQUEST_TIMEOUT_MS: 8_000, BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH: root } as never,
        store,
      );
      await expect(collector.refresh()).resolves.toMatchObject({
        source: "SOUNDING_LINE_RUNTIME",
        plans: [
          {
            id: "sl-fixture",
            semanticFallback: "MAPPING_DEBT",
            semanticFallbackDetails: {
              reasons: [
                {
                  code: "MAPPING_DEBT",
                  debts: [
                    {
                      contractId: "bridgewatch.mounted-route",
                      reason: "No governed suite declares this contract.",
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
    } finally {
      store.close();
    }
  });

  it("classifies an unavailable projection without discarding a retained snapshot", async () => {
    const root = mkdtempSync(join(tmpdir(), "bridgewatch-sounding-line-unavailable-"));
    const store = new BridgewatchStore(join(root, "bridgewatch.sqlite"));
    try {
      const retained = normalizeSoundingLineProjection({
        schemaVersion: 1,
        observedAt: "2026-08-12T00:00:00.000Z",
        source: "SOUNDING_LINE_RUNTIME",
        leases: 0,
        workers: [],
        plans: [],
      });
      store.put("sounding-line:projection", retained, null, retained.observedAt);
      const invalidRoot = join(root, "not-a-runtime-directory");
      writeFileSync(invalidRoot, "not a directory");
      const collector = new SoundingLineCollector(
        { BRIDGEWATCH_REQUEST_TIMEOUT_MS: 200, BRIDGEWATCH_SOUNDING_LINE_PROJECTION_PATH: invalidRoot } as never,
        store,
      );
      await expect(collector.refresh()).resolves.toEqual(retained);
      expect(collector.status()).toMatchObject({ failure: "SOURCE_UNREACHABLE", lastSuccessAt: retained.observedAt });
    } finally {
      store.close();
    }
  });
});
