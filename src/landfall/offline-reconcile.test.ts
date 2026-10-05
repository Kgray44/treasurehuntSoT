import { describe, expect, it, vi } from "vitest";
import { LandfallOutboxReconciler } from "@/landfall/offline-reconcile";
import type { PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";
import { projectRecordedLandfallEvidence } from "@/landfall/recorded-evidence";

const evidence: PlayerLandfallEvidence = {
  schemaVersion: 1,
  sessionId: "session",
  publishedVersionId: "version",
  worldspaceId: "town",
  waypointId: "arrival",
  evidenceId: "fix",
  expectedSequence: 4,
  idempotencyKey: "request",
  method: "PLAYER_FALLBACK",
};
const authorized = {
  state: "AUTHORIZED" as const,
  sessionId: "session",
  publishedVersionId: "version",
  currentSequence: 4,
  replayOnly: false,
};

describe("canonical offline reconciliation", () => {
  it("retains a lost response, then acknowledges the actor-bound existing event without another submission", async () => {
    let pending: PlayerLandfallEvidence | null = evidence;
    let committed = false;
    const submit = vi.fn(async () => {
      committed = true;
      return "UNAVAILABLE" as const;
    });
    const reconciler = new LandfallOutboxReconciler(
      {
        pending: async () => pending,
        clearEvidence: async () => {
          pending = null;
        },
        revoke: async () => {
          pending = null;
        },
      },
      {
        authorize: async () =>
          committed
            ? {
                ...authorized,
                currentSequence: 7,
                replayOnly: true,
                recordedEvidence: { evidenceId: "fix", worldspaceId: "town", waypointId: "arrival" },
              }
            : authorized,
        submit,
      },
    );
    const [first, concurrent] = await Promise.all([reconciler.reconcile(), reconciler.reconcile()]);
    expect(first).toBe("RETRY");
    expect(concurrent).toBe("RETRY");
    expect(pending).toBe(evidence);
    expect(await reconciler.reconcile()).toBe("DUPLICATE");
    expect(pending).toBeNull();
    expect(submit).toHaveBeenCalledOnce();
  });
  it.each(["pin", "sequence", "waypoint", "replay"])(
    "rejects %s conflicts and never retries a different objective",
    async (conflict) => {
      const clear = vi.fn(async () => undefined);
      const submit = vi.fn(async () => "ACCEPTED" as const);
      const reconciler = new LandfallOutboxReconciler(
        { pending: async () => evidence, clearEvidence: clear, revoke: clear },
        {
          authorize: async () => ({
            ...authorized,
            publishedVersionId: conflict === "pin" ? "other" : "version",
            currentSequence: conflict === "sequence" || conflict === "waypoint" ? 7 : 4,
            replayOnly: conflict === "replay",
            recordedEvidence:
              conflict === "waypoint" ? { evidenceId: "fix", worldspaceId: "town", waypointId: "other" } : null,
          }),
          submit,
        },
      );
      expect(await reconciler.reconcile()).toBe("CONFLICT");
      expect(submit).not.toHaveBeenCalled();
      expect(clear).toHaveBeenCalledOnce();
    },
  );
  it("revocation wins over any prior acknowledgement", async () => {
    const revoke = vi.fn(async () => undefined);
    const submit = vi.fn(async () => "ACCEPTED" as const);
    const reconciler = new LandfallOutboxReconciler(
      { pending: async () => evidence, clearEvidence: vi.fn(), revoke },
      { authorize: async () => ({ state: "REVOKED" }), submit },
    );
    expect(await reconciler.reconcile()).toBe("REVOKED");
    expect(revoke).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });
  it("projects receipts only for their recorded actor, pin and exact evidence identity", () => {
    const scope = { sessionId: "session", publishedVersionId: "version", playerProfileId: "player", evidenceId: "fix" };
    const payload = {
      actorProfileId: "player",
      publishedVersionId: "version",
      evidenceId: "fix",
      waypointId: "arrival",
      worldspaceId: "town",
    };
    const event = { sessionId: "session", eventType: "landfallWaypointConfirmed", payload: JSON.stringify(payload) };
    expect(projectRecordedLandfallEvidence(event, scope)).toEqual({
      evidenceId: "fix",
      waypointId: "arrival",
      worldspaceId: "town",
    });
    for (const changed of [
      { playerProfileId: "other" },
      { publishedVersionId: "other" },
      { evidenceId: "other" },
      { sessionId: "other" },
    ])
      expect(projectRecordedLandfallEvidence(event, { ...scope, ...changed })).toBeNull();
    expect(
      projectRecordedLandfallEvidence(
        { ...event, payload: JSON.stringify({ ...payload, actorProfileId: undefined }) },
        scope,
      ),
    ).toBeNull();
  });
});
