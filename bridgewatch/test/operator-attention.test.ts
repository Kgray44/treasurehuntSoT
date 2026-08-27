import { describe, expect, it } from "vitest";
import { deriveOperatorAttention } from "../lib/server.js";
import type { ObservationFact } from "../src/fabric.js";

const observedAt = "2026-08-27T12:00:00.000Z";

function fact(
  factClass: string,
  state: ObservationFact["state"],
  value: ObservationFact["value"],
  sourceId = "fixture-source",
): ObservationFact {
  return {
    key: `${sourceId}:${factClass}`,
    factClass,
    label: factClass,
    state,
    value,
    provenance: {
      sourceId: sourceId as ObservationFact["provenance"]["sourceId"],
      sourceIdentity: "Fixture source",
      reference: `fixture:${factClass}`,
      authority: "AUTHORITATIVE",
      precedence: sourceId === "git-main" ? 100 : 50,
      sourceObservedAt: observedAt,
      bridgewatchObservedAt: observedAt,
      retainedFromCache: false,
    },
    limitation: null,
  };
}

describe("Bridgewatch operator attention", () => {
  it("turns bounded source, verification, runtime, provider, and coverage facts into explainable attention", () => {
    const items = deriveOperatorAttention({
      sources: [
        {
          name: "github",
          sourceId: "github-repository-api",
          state: "DEGRADED",
          detail: "GitHub GET failed: 503",
          lastSuccessAt: observedAt,
          configured: true,
        },
      ],
      facts: [
        fact("repository.current-main", "AUTHORITATIVE", { headSha: "current-main" }, "git-main"),
        fact(
          "voyagewright.runtime-identity",
          "PROVISIONAL",
          { sourceSha: "older-runtime", runtimeState: "READY" },
          "voyagewright-runtime",
        ),
        fact("operations.provider-jobs", "PROVISIONAL", { degradedCount: 2 }, "provider-jobs"),
        fact("sounding-line.ordinary-evidence", "NOT_HISTORICALLY_RECORDED", {}, "sounding-line-evidence"),
      ],
      branches: [],
      pullRequests: [
        {
          number: 42,
          title: "Candidate",
          state: "OPEN",
          checkState: "FAILURE",
          mergeableState: "BLOCKED",
          updatedAt: observedAt,
        },
      ],
      plans: [
        {
          id: "candidate-42",
          state: "RUNNING",
          createdAt: "2026-08-20T12:00:00.000Z",
          finalDecision: null,
          nodes: [{ id: "suite-1", state: "FAILED" }],
        },
      ],
      workers: [],
      historyWarning: null,
      candidateStaleAfterMs: 60_000,
    });

    expect(items.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "SOURCE_HEALTH",
        "EXPECTED_FACT_GAP",
        "PULL_REQUEST_BLOCKED",
        "CANDIDATE_STALLED",
        "VERIFICATION_FAILURE",
        "RUNTIME_NOT_CURRENT_MAIN",
        "PROVIDER_DEGRADED",
      ]),
    );
    expect(items.find((item) => item.code === "RUNTIME_NOT_CURRENT_MAIN")).toMatchObject({
      source: { id: "voyagewright-runtime", reference: "fixture:voyagewright.runtime-identity" },
    });
    expect(items.find((item) => item.code === "PULL_REQUEST_BLOCKED")?.message).toContain("FAILURE");
  });

  it("keeps a not-configured source distinct from a disconnected source", () => {
    const items = deriveOperatorAttention({
      sources: [
        {
          name: "provider-jobs",
          sourceId: "p2:provider-jobs",
          state: "NOT_CONFIGURED",
          detail: "No approved provider status projection is configured.",
          lastSuccessAt: null,
          configured: false,
        },
      ],
      facts: [],
      branches: [],
      pullRequests: [],
      plans: [],
      workers: [],
      historyWarning: null,
      candidateStaleAfterMs: 60_000,
    });

    expect(items).toEqual([
      expect.objectContaining({
        level: "NOTICE",
        code: "SOURCE_NOT_CONFIGURED",
        source: expect.objectContaining({ id: "p2:provider-jobs" }),
      }),
    ]);
  });
});
