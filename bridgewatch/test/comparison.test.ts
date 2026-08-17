import { describe, expect, it } from "vitest";
import { compareProgramHistory } from "../src/comparison.js";
import type { BridgewatchHistoricalEvent } from "../src/history.js";

const event = (
  kind: BridgewatchHistoricalEvent["kind"],
  entityId: string,
  observedAt: string,
): BridgewatchHistoricalEvent => ({
  id: `${kind}:${entityId}`,
  kind,
  source: "project-truth",
  entityType: "fixture",
  entityId,
  occurredAt: observedAt,
  observedAt,
  summary: `${kind} ${entityId}`,
  evidenceRefs: [],
  dedupeKey: `${kind}:${entityId}`,
});

describe("historical comparison", () => {
  it("reports exact changed entities in an arbitrary inclusive From/To window", () => {
    const result = compareProgramHistory(
      [
        event("PROJECT_DISCOVERED", "deepwater", "2026-08-10T09:00:00.000Z"),
        event("VERSION_DISCOVERED", "deepwater:v1.2", "2026-08-10T10:00:00.000Z"),
        event("PULL_REQUEST_MERGED", "88", "2026-08-10T11:00:00.000Z"),
        event("MAIN_ADVANCED", "main", "2026-08-11T10:00:00.000Z"),
      ],
      "2026-08-10T09:00:00.000Z",
      "2026-08-10T23:59:59.000Z",
    );

    expect(result.fidelity).toBe("EXACT");
    expect(result.events.map((entry) => entry.entityId)).toEqual(["deepwater", "deepwater:v1.2", "88"]);
    expect(result.changed.projectsDiscovered).toEqual(["deepwater"]);
    expect(result.changed.versionsDiscovered).toEqual(["deepwater:v1.2"]);
    expect(result.changed.pullRequestsMerged).toEqual(["88"]);
    expect(result.changed.mainAdvances).toBe(0);
  });
});
