import { describe, expect, it } from "vitest";
import { deriveHelmPassageResilience } from "./passage-resilience";

const baseline = {
  lifecycle: "READY",
  hasPublishedEdition: true,
  memberCount: 1,
  readyMemberCount: 1,
  presentationProvider: "UNKNOWN" as const,
  attention: [],
  hasPriorPassage: false,
  currentSequence: 8,
  observedAt: new Date("2026-08-28T12:00:00.000Z"),
};

describe("Helm Phase 4 passage resilience", () => {
  it("reports an unknown adjacent provider truthfully without inventing a healthy result", () => {
    const projection = deriveHelmPassageResilience(baseline);
    expect(projection.preflight.state).toBe("UNKNOWN_DEPENDENCY");
    expect(projection.preflight.checks).toContainEqual(
      expect.objectContaining({ id: "PROVIDER", state: "UNKNOWN", source: "HelmProviderContract" }),
    );
  });

  it("blocks preflight on canonical lifecycle or Crew facts", () => {
    const projection = deriveHelmPassageResilience({ ...baseline, lifecycle: "INVITING", readyMemberCount: 0 });
    expect(projection.preflight.state).toBe("NOT_READY");
    expect(projection.preflight.checks.filter((check) => check.state === "BLOCKED").map((check) => check.id)).toEqual(
      expect.arrayContaining(["CREW", "LIFECYCLE"]),
    );
  });

  it("offers only existing governed recovery actions for a connection condition", () => {
    const projection = deriveHelmPassageResilience({
      ...baseline,
      lifecycle: "ACTIVE",
      hasPriorPassage: true,
      attention: [{ category: "CONNECTION", severity: "WARNING", title: "A Crew member recently disconnected" }],
    });
    expect(projection.recovery).toMatchObject({ state: "ACTIONABLE", evidence: { sourceRevision: 8 } });
    expect(projection.recovery.steps.map((step) => step.commandId)).toEqual(
      expect.arrayContaining(["PAUSE_VOYAGE", "REPLAY_PRESENTATION", "RESTORE_PRIOR_PASSAGE"]),
    );
    expect(projection.recovery.steps.map((step) => step.commandId)).not.toContain("FORCE_REPAIR");
  });

  it("escalates an unavailable provider instead of proposing an unsupported mutation", () => {
    const projection = deriveHelmPassageResilience({ ...baseline, presentationProvider: "UNAVAILABLE" });
    expect(projection.preflight.state).toBe("READY_WITH_WARNINGS");
    expect(projection.recovery.state).toBe("ESCALATE");
    expect(projection.recovery.steps.at(-1)).toMatchObject({ id: "ESCALATE", commandId: null });
  });
});
