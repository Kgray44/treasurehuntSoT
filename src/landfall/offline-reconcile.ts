import type { PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";
import type { RecordedLandfallEvidence } from "@/landfall/recorded-evidence";

export type LandfallReconciliationResult = "EMPTY" | "ACCEPTED" | "DUPLICATE" | "CONFLICT" | "REVOKED" | "RETRY";
export type LandfallOutbox = {
  pending(): Promise<PlayerLandfallEvidence | null>;
  clearEvidence(): Promise<void>;
  revoke(): Promise<void>;
};
export type LandfallReconciliationTransport = {
  authorize(evidence: PlayerLandfallEvidence): Promise<
    | {
        state: "AUTHORIZED";
        sessionId: string;
        publishedVersionId: string;
        currentSequence: number;
        replayOnly: boolean;
        recordedEvidence?: RecordedLandfallEvidence | null;
      }
    | { state: "REVOKED" }
    | { state: "UNAVAILABLE" }
  >;
  submit(evidence: PlayerLandfallEvidence): Promise<"ACCEPTED" | "DUPLICATE" | "CONFLICT" | "REVOKED" | "UNAVAILABLE">;
};

/** Reauthorize every retry. A response lost after a write retries the same idempotency key. */
export class LandfallOutboxReconciler {
  private inFlight: Promise<LandfallReconciliationResult> | null = null;
  constructor(
    private readonly outbox: LandfallOutbox,
    private readonly transport: LandfallReconciliationTransport,
  ) {}
  reconcile(): Promise<LandfallReconciliationResult> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }
  private async run(): Promise<LandfallReconciliationResult> {
    try {
      const evidence = await this.outbox.pending();
      if (!evidence) return "EMPTY";
      const authority = await this.transport.authorize(evidence);
      if (authority.state === "UNAVAILABLE") return "RETRY";
      if (authority.state === "REVOKED") {
        await this.outbox.revoke();
        return "REVOKED";
      }
      // Do not submit a queued observation against a different objective. Server-side
      // One Voyage still decides duplicates and qualifications atomically.
      if (authority.sessionId !== evidence.sessionId || authority.publishedVersionId !== evidence.publishedVersionId) {
        await this.outbox.clearEvidence();
        return "CONFLICT";
      }
      const recorded = authority.recordedEvidence;
      if (
        recorded?.evidenceId === evidence.evidenceId &&
        recorded.worldspaceId === evidence.worldspaceId &&
        recorded.waypointId === evidence.waypointId
      ) {
        await this.outbox.clearEvidence();
        return "DUPLICATE";
      }
      if (authority.currentSequence !== evidence.expectedSequence || authority.replayOnly) {
        await this.outbox.clearEvidence();
        return "CONFLICT";
      }
      const result = await this.transport.submit(evidence);
      if (result === "UNAVAILABLE") return "RETRY";
      if (result === "REVOKED") await this.outbox.revoke();
      else await this.outbox.clearEvidence();
      return result;
    } catch {
      return "RETRY";
    }
  }
}
