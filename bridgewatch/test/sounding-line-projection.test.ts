import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
type SoundingLineStatus = { plans: Array<Record<string, unknown>>; workers: Array<Record<string, unknown>> };

const projectStatus = async (runtimeRoot: string) => {
  const moduleUrl = new URL("../../scripts/sounding-line/status-projection.mjs", import.meta.url).href;
  const projection = (await import(moduleUrl)) as { projectStatus: (root: string) => Promise<SoundingLineStatus> };
  return projection.projectStatus(runtimeRoot);
};

describe("Sounding Line read-only status projection", () => {
  it("reads markers, sealed plan, cleanup receipt, finalizer, and lease without mutating the runtime", async () => {
    const base = mkdtempSync(join(tmpdir(), "bridgewatch-sounding-line-"));
    const root = join(base, "sl-fixture-01");
    mkdirSync(join(root, "plans"), { recursive: true });
    mkdirSync(join(root, "receipts"), { recursive: true });
    writeFileSync(
      join(base, "broker-leases.json"),
      JSON.stringify({
        version: 1,
        leases: [
          {
            id: "lease-1",
            runId: "sl-fixture-01",
            state: "ACTIVE",
            resource: "browser-chromium",
            expiresAt: "2026-08-12T00:10:00.000Z",
          },
        ],
      }),
    );
    writeFileSync(
      join(root, "run-marker.json"),
      JSON.stringify({ runId: "sl-fixture-01", createdAt: "2026-08-12T00:00:00.000Z", state: "RUNNING" }),
    );
    writeFileSync(
      join(root, "plans", "sealed-plan.json"),
      JSON.stringify({
        sourceSha: "abc",
        gate: "mainline",
        semanticFallback: {
          disposition: "CONSERVATIVE_FALLBACK",
          failure: "UNKNOWN_IMPACT",
          reasons: [
            { code: "UNMAPPED_CHANGED_PATH", paths: ["bridgewatch/unmapped.ts"] },
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
        nodes: [
          {
            id: "unit.bridgewatch",
            state: "RUNNING",
            queuedAt: "2026-08-12T00:00:00.000Z",
            startedAt: "2026-08-12T00:00:10.000Z",
            attempt: 1,
          },
        ],
      }),
    );
    writeFileSync(join(root, "receipts", "cleanup.json"), JSON.stringify({}));
    writeFileSync(
      join(root, "sounding-line-finalization.json"),
      JSON.stringify({ decision: "RELEASE_GO_WITH_EXTERNAL_PENDING" }),
    );
    const result = await projectStatus(base);
    expect(result.plans[0]).toMatchObject({
      id: "sl-fixture-01",
      sourceSha: "abc",
      gate: "mainline",
      cleanupState: "CLEAN",
      finalDecision: "RELEASE_GO_WITH_EXTERNAL_PENDING",
      semanticFallback: "UNKNOWN_IMPACT",
      semanticFallbackDetails: {
        disposition: "CONSERVATIVE_FALLBACK",
        failure: "UNKNOWN_IMPACT",
        reasons: [
          { code: "UNMAPPED_CHANGED_PATH", paths: ["bridgewatch/unmapped.ts"] },
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
    });
    expect(result.workers[0]).toMatchObject({ lane: "browser-chromium", state: "RUNNING" });
  });
});
