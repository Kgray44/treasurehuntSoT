import type {
  JournalPhaseOutcome,
  MotionMode,
  PresentationOutcome,
  PresentationReceipt,
} from "@/animation/core/animation-types";
import type { ClientProgressEvent, ReplayablePresentation } from "@/domain/story";

const acknowledgmentOutcomes = new Set<PresentationOutcome>(["presented", "presented-fallback", "skipped-by-user"]);

const audioOutcomes = new Set<PresentationOutcome>(["presented", "presented-fallback"]);

export type PresentationDecision = {
  shouldAcknowledge: boolean;
  retryable: boolean;
  completed: boolean;
};

export function decideChapterPresentation(
  receipt: Pick<PresentationReceipt, "acknowledgmentAllowed" | "outcome" | "requestSource">,
  alreadyAcknowledged: boolean,
): PresentationDecision {
  const completed = receipt.acknowledgmentAllowed && acknowledgmentOutcomes.has(receipt.outcome);
  const automatic = receipt.requestSource === "automatic";
  return {
    shouldAcknowledge: automatic && completed && !alreadyAcknowledged,
    retryable: automatic && !completed && !alreadyAcknowledged,
    completed,
  };
}

export function shouldSuppressChapterViewed(
  pendingEventId: string | null,
  failedEventId: string | null,
  unresolvedPersistedCeremony = false,
) {
  return Boolean(pendingEventId || failedEventId || unresolvedPersistedCeremony);
}

export function toChapterReleaseClientEvent(presentation: ReplayablePresentation): ClientProgressEvent {
  return {
    id: presentation.eventId,
    type: presentation.eventType,
    sequence: presentation.sequence,
    payload: { ...presentation.payload },
    releaseAt: presentation.occurredAt,
  };
}

export function receiptValidatesAudio(receipt: PresentationReceipt, semanticLabel: string) {
  return (
    audioOutcomes.has(receipt.outcome) &&
    (receipt.targetReport.requiredSatisfied || receipt.outcome === "presented-fallback") &&
    receipt.semanticLabelsReached.includes(semanticLabel)
  );
}

export type JournalPhaseDisposition = "continue" | "readable-fallback" | "aborted" | "failed";

export function journalPhaseDisposition(outcome: JournalPhaseOutcome): JournalPhaseDisposition {
  if (outcome.status === "completed") return "continue";
  if (outcome.status === "completed-fallback") return "readable-fallback";
  if (outcome.status === "aborted") return "aborted";
  return "failed";
}

export function canUseReadableChapterFallback(mode: MotionMode, hasReadableSource: boolean, aborted: boolean) {
  return mode === "reduced" && hasReadableSource && !aborted;
}

export function presentationDiagnostic(receipt: PresentationReceipt) {
  const visible = receipt.targetReport.observations.reduce((total, item) => total + item.visibleCount, 0);
  const duplicates = receipt.targetReport.observations.reduce((total, item) => total + item.duplicateCount, 0);
  const rejected = receipt.targetReport.observations.reduce((total, item) => total + item.ownershipRejectedCount, 0);
  return [
    `event=${receipt.eventOrActionId ?? "none"}`,
    `scene=${receipt.sceneName}`,
    `instance=${receipt.sceneInstanceId}`,
    `outcome=${receipt.outcome}`,
    `required=${receipt.targetReport.requiredSatisfied ? "yes" : "no"}`,
    `visible=${visible}`,
    `duplicates=${duplicates}`,
    `rejected=${rejected}`,
  ].join(" ");
}
