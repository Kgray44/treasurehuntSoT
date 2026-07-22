import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import {
  adminCommands,
  planSideQuestTransition,
  type AdminCommand,
  type AdminCommandReceiptTruth,
  type StagedActionReceiptIdentity,
} from "@/domain/admin";
import {
  chapterStates,
  eventTypes,
  type ClientProgressEvent,
  type ProgressEventType,
  type PublicSnapshot,
} from "@/domain/story";
import { toClientEvent } from "@/domain/visibility";
import { db } from "@/lib/db";
import { publishCampaignEvent } from "@/lib/events";
import { buildPublicSnapshot } from "@/lib/snapshot";
import { executeProgressionAction, ProgressionConflict } from "@/server/progression";

type Input = {
  command: AdminCommand;
  campaignSlug: string;
  expectedSequence: number;
  idempotencyKey: string;
  targetKey?: string;
  payload: Record<string, unknown>;
  reason?: string;
};

const legacyCommands = new Set<AdminCommand>([
  "PREPARE_CHAPTER",
  "RELEASE_CHAPTER",
  "MARK_SOLVED",
  "REVEAL_MAP",
  "REVEAL_ROUTE",
  "AWARD_ARTIFACT",
  "REVEAL_ARTIFACT_SILHOUETTE",
  "CONNECT_ARTIFACTS",
  "DISCOVER_SIDE_QUEST",
  "UPDATE_SIDE_QUEST",
  "COMPLETE_SIDE_QUEST",
  "ADD_JOURNAL_ANNOTATION",
  "ADD_LOG_ENTRY",
  "TEASE_FINALE",
  "UPDATE_FINALE_REQUIREMENT",
  "PAUSE",
  "RESUME",
  "UNDO_LAST",
]);

type CommandMutationResult = Readonly<{
  event: ClientProgressEvent;
  snapshot?: PublicSnapshot;
}>;

type EventPublicationState = Exclude<AdminCommandReceiptTruth["publication"], "NOT_APPLICABLE">;

export function commandReceipt(
  result: CommandMutationResult,
  correlationId: string,
  publication: EventPublicationState = "PROCESS_PUBLISHED",
) {
  return {
    ...result,
    kind: "PROGRESSION_EVENT" as const,
    correlationId,
    persistence: "COMMITTED" as const,
    publication,
    // Compatibility fields remain explicit about their limited scope. Neither
    // value means a Crew browser received, presented, or acknowledged it.
    delivery: publication === "PROCESS_PUBLISHED" ? ("PUBLISHED" as const) : ("PUBLICATION_FAILED" as const),
    deliveryScope: "PROCESS_SUBSCRIBERS_ONLY" as const,
    playerDelivery: "UNCONFIRMED" as const,
    playerPresentation: "UNCONFIRMED" as const,
    playerAcknowledgment: "UNCONFIRMED" as const,
    playerEvent: {
      id: result.event.id,
      type: result.event.type,
      sequence: result.event.sequence,
    },
  } satisfies CommandMutationResult &
    AdminCommandReceiptTruth & {
      correlationId: string;
      playerEvent: Pick<ClientProgressEvent, "id" | "type" | "sequence">;
    };
}

type StagedActionLike = Readonly<{
  id: string;
  command: string;
  targetKey: string | null;
  reservedSequence: number;
  status: string;
  preparedAt: Date;
}>;

export function stagedCommandReceipt(staged: StagedActionLike, correlationId: string, snapshot?: PublicSnapshot) {
  const stagedAction = Object.freeze({
    preparedActionId: staged.id,
    command: staged.command,
    targetKey: staged.targetKey,
    reservedSequence: staged.reservedSequence,
    status: staged.status,
    preparedAt: staged.preparedAt.toISOString(),
  }) satisfies StagedActionReceiptIdentity;
  return {
    kind: "STAGED_ACTION" as const,
    event: null,
    stagedAction,
    preparedActionId: staged.id,
    ...(snapshot ? { snapshot } : {}),
    correlationId,
    persistence: "COMMITTED" as const,
    publication: "NOT_APPLICABLE" as const,
    delivery: "NOT_ATTEMPTED" as const,
    deliveryScope: "NO_PLAYER_EVENT" as const,
    playerDelivery: "UNCONFIRMED" as const,
    playerPresentation: "UNCONFIRMED" as const,
    playerAcknowledgment: "UNCONFIRMED" as const,
    playerEvent: null,
  } satisfies AdminCommandReceiptTruth & {
    event: null;
    stagedAction: StagedActionReceiptIdentity;
    preparedActionId: string;
    snapshot?: PublicSnapshot;
    correlationId: string;
    playerEvent: null;
  };
}

export type AdminCommandReceipt = ReturnType<typeof commandReceipt> | ReturnType<typeof stagedCommandReceipt>;

const STORED_RESULT_VERSION = 1 as const;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

export function commandRequestFingerprint(input: Input) {
  return createHash("sha256")
    .update(
      canonicalJson({
        campaignSlug: input.campaignSlug,
        command: input.command,
        expectedSequence: input.expectedSequence,
        targetKey: input.targetKey ?? null,
        payload: input.payload,
        reason: input.reason ?? null,
      }),
    )
    .digest("hex");
}

function pendingResultEnvelope(fingerprint: string) {
  return JSON.stringify({ version: STORED_RESULT_VERSION, state: "PENDING", fingerprint });
}

function completeResultEnvelope(receipt: AdminCommandReceipt, fingerprint: string) {
  return JSON.stringify({ version: STORED_RESULT_VERSION, state: "COMPLETE", fingerprint, receipt });
}

function isUniqueConstraintFailure(error: unknown) {
  return !!error && typeof error === "object" && "code" in error && error.code === "P2002";
}

type ParsedStoredResult =
  | { kind: "pending"; fingerprint: string }
  | { kind: "complete"; fingerprint: string; receipt: AdminCommandReceipt }
  | { kind: "legacy"; receipt: AdminCommandReceipt }
  | { kind: "legacy-empty" }
  | { kind: "invalid" };

const envelopeMarkers = new Set(["version", "state", "fingerprint", "receipt"]);
const adminCommandSet = new Set<string>(adminCommands);
const chapterStateSet = new Set<string>(chapterStates);
const eventTypeSet = new Set<string>(eventTypes);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function hasAllowedKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[] = []) {
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
}

function hasOwn(value: Record<string, unknown>, key: string) {
  return Object.hasOwn(value, key);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isStrictIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 50) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (isFiniteNumber(value)) return true;
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  return isRecord(value) && Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function optionalString(value: Record<string, unknown>, key: string) {
  return !hasOwn(value, key) || typeof value[key] === "string";
}

function optionalNonEmptyString(value: Record<string, unknown>, key: string) {
  return !hasOwn(value, key) || isNonEmptyString(value[key]);
}

function optionalFiniteNumber(value: Record<string, unknown>, key: string) {
  return !hasOwn(value, key) || isFiniteNumber(value[key]);
}

function optionalNonNegativeInteger(value: Record<string, unknown>, key: string) {
  return !hasOwn(value, key) || isNonNegativeInteger(value[key]);
}

function optionalBoolean(value: Record<string, unknown>, key: string) {
  return !hasOwn(value, key) || typeof value[key] === "boolean";
}

function optionalStrictIsoDate(value: Record<string, unknown>, key: string) {
  return !hasOwn(value, key) || isStrictIsoDate(value[key]);
}

function isFingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function isEventIdentity(value: unknown): value is Pick<ClientProgressEvent, "id" | "type" | "sequence"> {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "type", "sequence"]) &&
    isNonEmptyString(value.id) &&
    typeof value.type === "string" &&
    eventTypeSet.has(value.type) &&
    isNonNegativeInteger(value.sequence)
  );
}

function isClientProgressEvent(value: unknown): value is ClientProgressEvent {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["id", "type", "sequence", "payload", "releaseAt"]) &&
    isNonEmptyString(value.id) &&
    typeof value.type === "string" &&
    eventTypeSet.has(value.type) &&
    isNonNegativeInteger(value.sequence) &&
    isRecord(value.payload) &&
    isJsonValue(value.payload) &&
    isStrictIsoDate(value.releaseAt)
  );
}

function isPublicChapter(value: unknown): value is PublicSnapshot["chapter"] {
  if (
    !isRecord(value) ||
    !hasAllowedKeys(
      value,
      ["ordinal", "state"],
      ["title", "narrative", "objective", "riddle", "teaser", "hints", "annotations", "related", "unseen"],
    ) ||
    !isNonNegativeInteger(value.ordinal) ||
    typeof value.state !== "string" ||
    !chapterStateSet.has(value.state) ||
    !optionalString(value, "title") ||
    !optionalString(value, "narrative") ||
    !optionalString(value, "objective") ||
    !optionalString(value, "riddle") ||
    !optionalString(value, "teaser") ||
    !optionalBoolean(value, "unseen")
  )
    return false;
  if (
    hasOwn(value, "hints") &&
    (!Array.isArray(value.hints) ||
      !value.hints.every(
        (hint) =>
          isRecord(hint) &&
          hasExactKeys(hint, ["ordinal", "body", "releasedAt", "unseen"]) &&
          isNonNegativeInteger(hint.ordinal) &&
          typeof hint.body === "string" &&
          isStrictIsoDate(hint.releasedAt) &&
          typeof hint.unseen === "boolean",
      ))
  )
    return false;
  if (
    hasOwn(value, "annotations") &&
    (!Array.isArray(value.annotations) ||
      !value.annotations.every(
        (annotation) =>
          isRecord(annotation) &&
          hasExactKeys(annotation, ["key", "title", "body", "createdAt", "unseen"]) &&
          isNonEmptyString(annotation.key) &&
          typeof annotation.title === "string" &&
          typeof annotation.body === "string" &&
          isStrictIsoDate(annotation.createdAt) &&
          typeof annotation.unseen === "boolean",
      ))
  )
    return false;
  if (hasOwn(value, "related")) {
    if (
      !isRecord(value.related) ||
      !hasAllowedKeys(value.related, [], ["mapKey", "artifactKey", "sideQuestKey"]) ||
      !optionalNonEmptyString(value.related, "mapKey") ||
      !optionalNonEmptyString(value.related, "artifactKey") ||
      !optionalNonEmptyString(value.related, "sideQuestKey")
    )
      return false;
  }
  return true;
}

function isPublicArtifact(value: unknown): value is PublicSnapshot["artifacts"][number] {
  return (
    isRecord(value) &&
    hasAllowedKeys(
      value,
      ["key", "state", "displayX", "displayY", "unseen"],
      [
        "name",
        "safeName",
        "category",
        "description",
        "discoveryText",
        "silhouetteLabel",
        "assemblyGroup",
        "assemblyPosition",
        "connectedArtifactKey",
        "chapterOrdinal",
        "awardedAt",
      ],
    ) &&
    isNonEmptyString(value.key) &&
    isNonEmptyString(value.state) &&
    isFiniteNumber(value.displayX) &&
    isFiniteNumber(value.displayY) &&
    typeof value.unseen === "boolean" &&
    [
      "name",
      "safeName",
      "category",
      "description",
      "discoveryText",
      "silhouetteLabel",
      "assemblyGroup",
      "assemblyPosition",
      "connectedArtifactKey",
    ].every((key) => optionalString(value, key)) &&
    optionalNonNegativeInteger(value, "chapterOrdinal") &&
    optionalStrictIsoDate(value, "awardedAt")
  );
}

function isPublicMapLocation(value: unknown): value is PublicSnapshot["mapLocations"][number] {
  return (
    isRecord(value) &&
    hasAllowedKeys(
      value,
      ["key", "state", "label", "name", "unseen"],
      [
        "regionLabel",
        "locationType",
        "description",
        "exactness",
        "x",
        "y",
        "mobileX",
        "mobileY",
        "chapterOrdinal",
        "sideQuestKey",
      ],
    ) &&
    isNonEmptyString(value.key) &&
    isNonEmptyString(value.state) &&
    typeof value.label === "string" &&
    typeof value.name === "string" &&
    typeof value.unseen === "boolean" &&
    ["regionLabel", "locationType", "description", "exactness", "sideQuestKey"].every((key) =>
      optionalString(value, key),
    ) &&
    ["x", "y", "mobileX", "mobileY"].every((key) => optionalFiniteNumber(value, key)) &&
    optionalNonNegativeInteger(value, "chapterOrdinal")
  );
}

function isPublicMapRoute(value: unknown): value is PublicSnapshot["mapRoutes"][number] {
  return (
    isRecord(value) &&
    hasAllowedKeys(value, ["key", "fromKey", "toKey", "ordinal", "state", "unseen"], ["annotation"]) &&
    isNonEmptyString(value.key) &&
    isNonEmptyString(value.fromKey) &&
    isNonEmptyString(value.toKey) &&
    isNonNegativeInteger(value.ordinal) &&
    isNonEmptyString(value.state) &&
    typeof value.unseen === "boolean" &&
    optionalString(value, "annotation")
  );
}

function isPublicSideQuest(value: unknown): value is PublicSnapshot["sideQuests"][number] {
  if (
    !isRecord(value) ||
    !hasAllowedKeys(
      value,
      ["key", "state", "unseen"],
      [
        "title",
        "teaser",
        "description",
        "objectives",
        "reward",
        "completionSummary",
        "chapterOrdinal",
        "mapLocationKey",
        "artifactKey",
      ],
    ) ||
    !isNonEmptyString(value.key) ||
    !isNonEmptyString(value.state) ||
    typeof value.unseen !== "boolean" ||
    !["title", "teaser", "description", "completionSummary", "mapLocationKey", "artifactKey"].every((key) =>
      optionalString(value, key),
    ) ||
    !optionalNonNegativeInteger(value, "chapterOrdinal")
  )
    return false;
  if (
    hasOwn(value, "objectives") &&
    (!Array.isArray(value.objectives) ||
      !value.objectives.every(
        (objective) =>
          isRecord(objective) &&
          hasExactKeys(objective, ["ordinal", "body", "complete"]) &&
          isNonNegativeInteger(objective.ordinal) &&
          typeof objective.body === "string" &&
          typeof objective.complete === "boolean",
      ))
  )
    return false;
  if (hasOwn(value, "reward")) {
    if (
      !isRecord(value.reward) ||
      !hasAllowedKeys(value.reward, ["type"], ["label"]) ||
      !isNonEmptyString(value.reward.type) ||
      !optionalString(value.reward, "label")
    )
      return false;
  }
  return true;
}

function isPublicLogEntry(value: unknown): value is PublicSnapshot["log"][number] {
  return (
    isRecord(value) &&
    hasAllowedKeys(
      value,
      ["key", "sequence", "title", "summary", "timestamp", "symbol", "importance", "section", "unseen"],
      ["targetKey", "synchronization", "moonPhase"],
    ) &&
    isNonEmptyString(value.key) &&
    isNonNegativeInteger(value.sequence) &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    isStrictIsoDate(value.timestamp) &&
    typeof value.symbol === "string" &&
    (value.importance === "quiet" || value.importance === "notable" || value.importance === "major") &&
    (value.section === "journal" ||
      value.section === "chart" ||
      value.section === "treasures" ||
      value.section === "quests" ||
      value.section === "log" ||
      value.section === "finale") &&
    typeof value.unseen === "boolean" &&
    optionalNonEmptyString(value, "targetKey") &&
    (value.moonPhase === undefined ||
      value.moonPhase === "new" ||
      value.moonPhase === "waxing-crescent" ||
      value.moonPhase === "first-quarter" ||
      value.moonPhase === "waxing-gibbous" ||
      value.moonPhase === "full" ||
      value.moonPhase === "waning-gibbous" ||
      value.moonPhase === "last-quarter" ||
      value.moonPhase === "waning-crescent") &&
    (value.synchronization === undefined ||
      (isRecord(value.synchronization) &&
        hasExactKeys(value.synchronization, ["source", "synchronizedAt"]) &&
        value.synchronization.source === "offline-recovery" &&
        isStrictIsoDate(value.synchronization.synchronizedAt)))
  );
}

function isReplayablePresentation(
  value: unknown,
): value is NonNullable<PublicSnapshot["latestChapterReleasePresentation"]> {
  return (
    isRecord(value) &&
    hasExactKeys(value, [
      "eventId",
      "eventType",
      "sequence",
      "occurredAt",
      "sceneName",
      "payloadVersion",
      "payload",
      "replayPolicy",
    ]) &&
    isNonEmptyString(value.eventId) &&
    value.eventType === "CHAPTER_RELEASED" &&
    isNonNegativeInteger(value.sequence) &&
    isStrictIsoDate(value.occurredAt) &&
    value.sceneName === "chapter-release" &&
    isNonNegativeInteger(value.payloadVersion) &&
    isRecord(value.payload) &&
    hasExactKeys(value.payload, ["ordinal", "title", "narrative", "objective", "riddle"]) &&
    isNonNegativeInteger(value.payload.ordinal) &&
    typeof value.payload.title === "string" &&
    typeof value.payload.narrative === "string" &&
    typeof value.payload.objective === "string" &&
    typeof value.payload.riddle === "string" &&
    value.replayPolicy === "presentation-only"
  );
}

function isPublicSnapshot(value: unknown): value is PublicSnapshot {
  if (
    !isRecord(value) ||
    !hasAllowedKeys(
      value,
      [
        "campaign",
        "sequence",
        "chapter",
        "chapters",
        "artifacts",
        "mapLocations",
        "mapRoutes",
        "sideQuests",
        "sideQuest",
        "log",
        "finale",
        "unseen",
      ],
      ["latestChapterReleasePresentation", "presentationHistory"],
    ) ||
    !isRecord(value.campaign) ||
    !hasExactKeys(value.campaign, ["slug", "title", "status"]) ||
    !isNonEmptyString(value.campaign.slug) ||
    typeof value.campaign.title !== "string" ||
    isNonEmptyString(value.campaign.status) === false ||
    !isNonNegativeInteger(value.sequence) ||
    !isPublicChapter(value.chapter) ||
    !Array.isArray(value.chapters) ||
    !value.chapters.every(isPublicChapter) ||
    !Array.isArray(value.artifacts) ||
    !value.artifacts.every(isPublicArtifact) ||
    !Array.isArray(value.mapLocations) ||
    !value.mapLocations.every(isPublicMapLocation) ||
    !Array.isArray(value.mapRoutes) ||
    !value.mapRoutes.every(isPublicMapRoute) ||
    !Array.isArray(value.sideQuests) ||
    !value.sideQuests.every(isPublicSideQuest) ||
    !Array.isArray(value.log) ||
    !value.log.every(isPublicLogEntry)
  )
    return false;
  if (
    value.sideQuest !== null &&
    (!isRecord(value.sideQuest) ||
      !hasExactKeys(value.sideQuest, ["title", "state"]) ||
      typeof value.sideQuest.title !== "string" ||
      !isNonEmptyString(value.sideQuest.state))
  )
    return false;
  if (
    !isRecord(value.finale) ||
    !hasAllowedKeys(value.finale, ["state", "requirements", "unseen"], ["teaser"]) ||
    !isNonEmptyString(value.finale.state) ||
    !optionalString(value.finale, "teaser") ||
    !Array.isArray(value.finale.requirements) ||
    !value.finale.requirements.every(
      (requirement) =>
        isRecord(requirement) &&
        hasAllowedKeys(requirement, ["key", "label", "current", "target"], ["optional"]) &&
        isNonEmptyString(requirement.key) &&
        typeof requirement.label === "string" &&
        isFiniteNumber(requirement.current) &&
        isFiniteNumber(requirement.target) &&
        optionalBoolean(requirement, "optional"),
    ) ||
    typeof value.finale.unseen !== "boolean"
  )
    return false;
  if (!isRecord(value.unseen)) return false;
  const unseen = value.unseen;
  if (
    !hasExactKeys(unseen, ["journal", "chart", "treasures", "quests", "log", "finale"]) ||
    !["journal", "chart", "treasures", "quests", "log", "finale"].every((key) => isNonNegativeInteger(unseen[key]))
  )
    return false;
  if (
    hasOwn(value, "latestChapterReleasePresentation") &&
    !isReplayablePresentation(value.latestChapterReleasePresentation)
  )
    return false;
  if (
    hasOwn(value, "presentationHistory") &&
    (!Array.isArray(value.presentationHistory) || !value.presentationHistory.every(isClientProgressEvent))
  )
    return false;
  return true;
}

function isStagedActionIdentity(value: unknown): value is StagedActionReceiptIdentity {
  return (
    isRecord(value) &&
    hasExactKeys(value, ["preparedActionId", "command", "targetKey", "reservedSequence", "status", "preparedAt"]) &&
    isNonEmptyString(value.preparedActionId) &&
    typeof value.command === "string" &&
    adminCommandSet.has(value.command) &&
    (value.targetKey === null || isNonEmptyString(value.targetKey)) &&
    isNonNegativeInteger(value.reservedSequence) &&
    isNonEmptyString(value.status) &&
    value.status.length <= 64 &&
    isStrictIsoDate(value.preparedAt)
  );
}

function isAdminCommandReceipt(value: unknown): value is AdminCommandReceipt {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.correlationId) ||
    value.persistence !== "COMMITTED" ||
    value.playerDelivery !== "UNCONFIRMED" ||
    value.playerPresentation !== "UNCONFIRMED" ||
    value.playerAcknowledgment !== "UNCONFIRMED"
  )
    return false;
  if (value.kind === "PROGRESSION_EVENT")
    return (
      hasAllowedKeys(
        value,
        [
          "kind",
          "event",
          "correlationId",
          "persistence",
          "publication",
          "delivery",
          "deliveryScope",
          "playerDelivery",
          "playerPresentation",
          "playerAcknowledgment",
          "playerEvent",
        ],
        ["snapshot"],
      ) &&
      isClientProgressEvent(value.event) &&
      isEventIdentity(value.playerEvent) &&
      value.event.id === value.playerEvent.id &&
      value.event.type === value.playerEvent.type &&
      value.event.sequence === value.playerEvent.sequence &&
      ((value.publication === "PROCESS_PUBLISHED" && value.delivery === "PUBLISHED") ||
        (value.publication === "PROCESS_PUBLICATION_FAILED" && value.delivery === "PUBLICATION_FAILED")) &&
      value.deliveryScope === "PROCESS_SUBSCRIBERS_ONLY" &&
      (!hasOwn(value, "snapshot") || isPublicSnapshot(value.snapshot))
    );
  if (value.kind === "STAGED_ACTION")
    return (
      hasAllowedKeys(
        value,
        [
          "kind",
          "event",
          "stagedAction",
          "preparedActionId",
          "correlationId",
          "persistence",
          "publication",
          "delivery",
          "deliveryScope",
          "playerDelivery",
          "playerPresentation",
          "playerAcknowledgment",
          "playerEvent",
        ],
        ["snapshot"],
      ) &&
      value.event === null &&
      value.playerEvent === null &&
      isNonEmptyString(value.preparedActionId) &&
      isStagedActionIdentity(value.stagedAction) &&
      value.preparedActionId === value.stagedAction.preparedActionId &&
      value.publication === "NOT_APPLICABLE" &&
      value.delivery === "NOT_ATTEMPTED" &&
      value.deliveryScope === "NO_PLAYER_EVENT" &&
      (!hasOwn(value, "snapshot") || isPublicSnapshot(value.snapshot))
    );
  return false;
}

function normalizeLegacyReceipt(value: Record<string, unknown>): AdminCommandReceipt | null {
  if (isAdminCommandReceipt(value))
    return value.kind === "STAGED_ACTION"
      ? { ...value, stagedAction: Object.freeze({ ...value.stagedAction }) }
      : value;
  // Supported legacy compatibility is deliberately narrow: the exact
  // pre-envelope committed event receipt, with an optional complete public
  // snapshot. Marker-bearing, partial, or extended legacy objects fail closed.
  if (
    !hasAllowedKeys(value, ["event", "correlationId", "persistence", "delivery"], ["snapshot"]) ||
    !isClientProgressEvent(value.event) ||
    !isNonEmptyString(value.correlationId) ||
    value.persistence !== "COMMITTED" ||
    (value.delivery !== "PUBLISHED" && value.delivery !== "PUBLICATION_FAILED") ||
    (hasOwn(value, "snapshot") && !isPublicSnapshot(value.snapshot))
  )
    return null;
  const event = value.event;
  const snapshot = hasOwn(value, "snapshot") && isPublicSnapshot(value.snapshot) ? value.snapshot : undefined;
  if (event.type === "HINT_PREPARED") {
    const rawTargetKey = event.payload.targetKey;
    if (rawTargetKey !== undefined && rawTargetKey !== null && !isNonEmptyString(rawTargetKey)) return null;
    const targetKey = typeof rawTargetKey === "string" ? rawTargetKey : null;
    const preparedAt = new Date(event.releaseAt);
    return stagedCommandReceipt(
      {
        id: event.id,
        command: "PREPARE_HINT",
        targetKey,
        reservedSequence: event.sequence,
        status: "PREPARED",
        preparedAt,
      },
      value.correlationId,
      snapshot,
    );
  }
  return commandReceipt(
    { event, ...(snapshot ? { snapshot } : {}) },
    value.correlationId,
    value.delivery === "PUBLICATION_FAILED" ? "PROCESS_PUBLICATION_FAILED" : "PROCESS_PUBLISHED",
  );
}

function parseStoredResult(result: string | null): ParsedStoredResult {
  if (!result) return { kind: "legacy-empty" };
  try {
    const parsed = JSON.parse(result) as unknown;
    if (!isRecord(parsed)) return { kind: "invalid" };
    const hasEnvelopeMarker = Object.keys(parsed).some((key) => envelopeMarkers.has(key));
    if (!hasEnvelopeMarker) {
      const receipt = normalizeLegacyReceipt(parsed);
      return receipt ? { kind: "legacy", receipt } : { kind: "invalid" };
    }
    if (parsed.version !== STORED_RESULT_VERSION || !isFingerprint(parsed.fingerprint)) return { kind: "invalid" };
    if (parsed.state === "PENDING" && hasExactKeys(parsed, ["version", "state", "fingerprint"]))
      return { kind: "pending", fingerprint: parsed.fingerprint };
    if (
      parsed.state === "COMPLETE" &&
      hasExactKeys(parsed, ["version", "state", "fingerprint", "receipt"]) &&
      isAdminCommandReceipt(parsed.receipt)
    )
      return {
        kind: "complete",
        fingerprint: parsed.fingerprint,
        receipt:
          parsed.receipt.kind === "STAGED_ACTION"
            ? { ...parsed.receipt, stagedAction: Object.freeze({ ...parsed.receipt.stagedAction }) }
            : parsed.receipt,
      };
    return { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

async function replayExistingExecution(
  existing: {
    command: string;
    expectedSequence: number;
    status: string;
    result: string | null;
    campaignId?: string;
    correlationId?: string;
    id?: string;
  },
  input: Input,
) {
  if (existing.command !== input.command || existing.expectedSequence !== input.expectedSequence)
    throw new CommandConflict(
      "That idempotency key belongs to a different command. Refresh before confirming.",
      "IDEMPOTENCY_KEY_REUSE",
    );
  const stored = parseStoredResult(existing.result);
  const fingerprint = commandRequestFingerprint(input);
  if (stored.kind === "invalid")
    throw new CommandConflict(
      "That idempotency record is not safe to replay. Use a new confirmation.",
      "IDEMPOTENCY_RECORD_INVALID",
    );
  if ((stored.kind === "pending" || stored.kind === "complete") && stored.fingerprint !== fingerprint)
    throw new CommandConflict(
      "That idempotency key belongs to a different command request. Refresh before confirming.",
      "IDEMPOTENCY_KEY_REUSE",
    );
  if (
    (stored.kind === "legacy" || stored.kind === "legacy-empty") &&
    (input.targetKey !== undefined || Object.keys(input.payload).length > 0 || input.reason !== undefined)
  )
    throw new CommandConflict(
      "That legacy idempotency record cannot verify this command payload. Use a new confirmation.",
      "IDEMPOTENCY_KEY_REUSE",
    );
  if (existing.status === "SUCCEEDED") {
    if (stored.kind === "complete" || stored.kind === "legacy") return { ...stored.receipt, idempotentReplay: true };
    throw new CommandConflict(
      "That completed idempotency record is not safe to replay. Use a new confirmation.",
      "IDEMPOTENCY_RECORD_INVALID",
    );
  }
  if (stored.kind === "complete")
    throw new CommandConflict(
      "That idempotency record has conflicting completion state. Use a new confirmation.",
      "IDEMPOTENCY_RECORD_INVALID",
    );
  if (existing.campaignId && existing.correlationId && existing.id) {
    const committed = await recoverCommittedMutation(existing.campaignId, existing.correlationId);
    if (committed) {
      await db.commandExecution.update({
        where: { id: existing.id },
        data: {
          status: "SUCCEEDED",
          result: completeResultEnvelope(committed, fingerprint),
          completedAt: new Date(),
        },
      });
      return { ...committed, idempotentReplay: true };
    }
  }
  throw new CommandConflict("This command is already being processed.", "DUPLICATE_COMMAND");
}

async function recoverCommittedMutation(campaignId: string, correlationId: string) {
  const audit = await db.adminAuditLog.findFirst({
    where: { campaignId, correlationId, outcome: "SUCCEEDED" },
    orderBy: { createdAt: "desc" },
  });
  if (!audit) return null;
  let eventId: string | undefined;
  let preparedActionId: string | undefined;
  let reservedSequence: number | undefined;
  try {
    const metadata = JSON.parse(audit.metadata) as unknown;
    if (metadata && typeof metadata === "object" && "eventId" in metadata && typeof metadata.eventId === "string")
      eventId = metadata.eventId;
    if (
      metadata &&
      typeof metadata === "object" &&
      "preparedActionId" in metadata &&
      typeof metadata.preparedActionId === "string"
    )
      preparedActionId = metadata.preparedActionId;
    if (
      metadata &&
      typeof metadata === "object" &&
      "reservedSequence" in metadata &&
      typeof metadata.reservedSequence === "number"
    )
      reservedSequence = metadata.reservedSequence;
  } catch {
    return null;
  }
  if (preparedActionId) {
    const staged = await db.preparedAction.findFirst({ where: { id: preparedActionId, campaignId } });
    if (!staged) return null;
    return stagedCommandReceipt(
      { ...staged, reservedSequence: reservedSequence ?? staged.expectedSequence },
      correlationId,
    );
  }
  if (!eventId) return null;
  const storedEvent = await db.progressEvent.findFirst({ where: { id: eventId, campaignId } });
  if (!storedEvent) return null;
  const event = toClientEvent(storedEvent);
  try {
    publishCampaignEvent(campaignId, event);
    return commandReceipt({ event }, correlationId, "PROCESS_PUBLISHED");
  } catch {
    return commandReceipt({ event }, correlationId, "PROCESS_PUBLICATION_FAILED");
  }
}

export class CommandConflict extends Error {
  constructor(
    message: string,
    public code = "COMMAND_CONFLICT",
  ) {
    super(message);
  }
}

export class CommandFailure extends Error {
  constructor(public correlationId: string) {
    super("The Voyage action could not be completed. No progress has changed.");
  }
}

async function reserveCampaignSequence(tx: Prisma.TransactionClient, campaignId: string, expectedSequence: number) {
  const reserved = await tx.campaign.updateMany({
    where: { id: campaignId, currentSequence: expectedSequence },
    data: { currentSequence: { increment: 1 } },
  });
  if (reserved.count !== 1)
    throw new CommandConflict(
      `Voyage state changed from sequence ${expectedSequence}. Refresh Captain's Console before confirming.`,
      "STALE_SEQUENCE",
    );
  return expectedSequence + 1;
}

function eventFor(command: AdminCommand): ProgressEventType {
  const events: Partial<Record<AdminCommand, ProgressEventType>> = {
    COMPLETE_CHAPTER: "CHAPTER_REVEAL_COMPLETED",
    RELEASE_HINT: "HINT_RELEASED",
    RELEASE_NEXT_HINT: "HINT_RELEASED",
    DISCOVER_SIDE_QUEST: "SIDE_QUEST_DISCOVERED",
    ADVANCE_SIDE_QUEST: "SIDE_QUEST_UPDATED",
    RELEASE_JOURNAL_ENTRY: "NARRATIVE_MESSAGE_RELEASED",
    REQUEST_RECONCILIATION: "PLAYER_RECONCILIATION_REQUESTED",
  };
  const value = events[command];
  if (!value)
    throw new CommandConflict(
      "This Voyage action does not publish directly. Review the action and try again.",
      "UNSUPPORTED_COMMAND",
    );
  return value;
}

async function appendCustomEvent(input: Input, userId: string, correlationId: string) {
  const result = await db.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUniqueOrThrow({
      where: { slug: input.campaignSlug },
      include: {
        chapters: { orderBy: { ordinal: "asc" }, include: { hints: { orderBy: { ordinal: "asc" } } } },
        sideQuests: { include: { objectives: { orderBy: { ordinal: "asc" } } } },
        journalEntries: true,
      },
    });
    if (campaign.currentSequence !== input.expectedSequence)
      throw new CommandConflict(
        `Voyage state changed from sequence ${input.expectedSequence} to ${campaign.currentSequence}. Refresh Captain's Console and review the action again.`,
        "STALE_SEQUENCE",
      );
    if (campaign.status === "PAUSED" && input.command !== "REQUEST_RECONCILIATION")
      throw new CommandConflict("This Voyage is paused. Resume it before releasing progression.", "CAMPAIGN_PAUSED");

    const reservedSequence = await reserveCampaignSequence(tx, campaign.id, input.expectedSequence);

    let payload: Record<string, unknown> = {};
    let type = eventFor(input.command);
    if (input.command === "COMPLETE_CHAPTER") {
      const chapter = campaign.chapters.find((item) => item.state === "SOLVED");
      if (!chapter) throw new CommandConflict("Only a solved Chapter can be completed.", "INVALID_TRANSITION");
      await tx.chapter.update({ where: { id: chapter.id }, data: { state: "COMPLETE" } });
      payload = { ordinal: chapter.ordinal };
    } else if (input.command === "RELEASE_HINT" || input.command === "RELEASE_NEXT_HINT") {
      const chapter = campaign.chapters.find((item) => ["ACTIVE", "SOLVED"].includes(item.state));
      if (!chapter) throw new CommandConflict("Release the Chapter before releasing a Hint.", "PREREQUISITE_FAILED");
      const hint = input.targetKey
        ? chapter.hints.find((item) => item.id === input.targetKey || String(item.ordinal) === input.targetKey)
        : chapter.hints.find((item) => !item.releasedAt);
      if (!hint) throw new CommandConflict("No unreleased Hint is available.", "ALREADY_RELEASED");
      const priorUnreleased = chapter.hints.some((item) => item.ordinal < hint.ordinal && !item.releasedAt);
      if (priorUnreleased) throw new CommandConflict("Release earlier Hints first.", "HINT_ORDER");
      await tx.hint.update({ where: { id: hint.id }, data: { releasedAt: new Date() } });
      payload = { ordinal: chapter.ordinal, hintOrdinal: hint.ordinal, body: hint.body };
    } else if (input.command === "DISCOVER_SIDE_QUEST" || input.command === "ADVANCE_SIDE_QUEST") {
      const quest = campaign.sideQuests.find((item) => !input.targetKey || item.key === input.targetKey);
      if (!quest) throw new CommandConflict("This Echo is not configured.", "NOT_FOUND");
      const plan = planSideQuestTransition(input.command, quest.state, quest.objectives);
      if (!plan.allowed) throw new CommandConflict(plan.message, "INVALID_TRANSITION");
      if (plan.objectiveOrdinal !== undefined) {
        const objective = quest.objectives.find((item) => item.ordinal === plan.objectiveOrdinal);
        if (objective) await tx.sideQuestObjective.update({ where: { id: objective.id }, data: { complete: true } });
      }
      await tx.sideQuest.update({
        where: { id: quest.id },
        data: { state: plan.state, completedAt: plan.state === "COMPLETE" ? new Date() : null },
      });
      type = plan.eventType;
      payload =
        plan.eventType === "SIDE_QUEST_DISCOVERED"
          ? { key: quest.key, title: quest.title }
          : plan.eventType === "SIDE_QUEST_COMPLETED"
            ? { key: quest.key, title: quest.title, rewardLabel: quest.rewardLabel }
            : { key: quest.key, objectiveOrdinal: plan.objectiveOrdinal };
    } else if (input.command === "RELEASE_JOURNAL_ENTRY") {
      const title = String(input.payload.title ?? "Captain's journal entry").trim();
      const body = String(input.payload.body ?? "").trim();
      if (!body) throw new CommandConflict("Add the journal entry before releasing it.", "VALIDATION_FAILED");
      const entry = await tx.journalEntry.create({
        data: { campaignId: campaign.id, title, body, releasedAt: new Date() },
      });
      payload = { id: entry.id, title, body };
    } else {
      payload = { requestedAtSequence: campaign.currentSequence };
    }

    const event = await tx.progressEvent.create({
      data: {
        campaignId: campaign.id,
        type,
        payload: JSON.stringify(payload),
        actor: userId,
        sequence: reservedSequence,
      },
    });
    await tx.campaignSnapshot.create({
      data: { campaignId: campaign.id, sequence: event.sequence, state: JSON.stringify({ eventType: type, payload }) },
    });
    await tx.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId,
        action: input.command,
        correlationId,
        reason: input.reason,
        metadata: JSON.stringify({
          eventId: event.id,
          sequence: event.sequence,
          reservedSequence,
          targetKey: input.targetKey,
        }),
      },
    });
    return { campaignId: campaign.id, event };
  });
  const event = toClientEvent(result.event);
  publishCampaignEvent(result.campaignId, event);
  return { event, snapshot: await buildPublicSnapshot(result.campaignId) };
}

export async function executeAdminCommand(input: Input, userId: string, context: { correlationId?: string } = {}) {
  const correlationId = context.correlationId ?? randomUUID();
  const fingerprint = commandRequestFingerprint(input);
  const campaign = await db.campaign.findUniqueOrThrow({ where: { slug: input.campaignSlug } });
  const existing = await db.commandExecution.findUnique({
    where: { campaignId_idempotencyKey: { campaignId: campaign.id, idempotencyKey: input.idempotencyKey } },
  });
  if (existing) return replayExistingExecution(existing, input);
  if (campaign.currentSequence !== input.expectedSequence)
    throw new CommandConflict(
      `Voyage state changed from sequence ${input.expectedSequence} to ${campaign.currentSequence}. Refresh Captain's Console before confirming.`,
      "STALE_SEQUENCE",
    );

  let execution: { id: string };
  try {
    execution = await db.commandExecution.create({
      data: {
        campaignId: campaign.id,
        idempotencyKey: input.idempotencyKey,
        command: input.command,
        expectedSequence: input.expectedSequence,
        correlationId,
        status: "RUNNING",
        result: pendingResultEnvelope(fingerprint),
      },
    });
  } catch (error) {
    if (!isUniqueConstraintFailure(error)) throw error;
    const winner = await db.commandExecution.findUniqueOrThrow({
      where: { campaignId_idempotencyKey: { campaignId: campaign.id, idempotencyKey: input.idempotencyKey } },
    });
    return replayExistingExecution(winner, input);
  }
  try {
    let stored: AdminCommandReceipt;
    if (legacyCommands.has(input.command)) {
      const current = await db.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      if (current.currentSequence !== input.expectedSequence)
        throw new CommandConflict(
          "Another Voyage action was saved first. Refresh Captain's Console before retrying.",
          "STALE_SEQUENCE",
        );
      try {
        const result = await executeProgressionAction(
          input.campaignSlug,
          input.command as Parameters<typeof executeProgressionAction>[1],
          userId,
          {
            targetKey: input.targetKey,
            value: typeof input.payload.value === "string" ? input.payload.value : undefined,
            correlationId,
            reason: input.reason,
            expectedSequence: input.expectedSequence,
          },
        );
        stored = commandReceipt(result, correlationId);
      } catch (error) {
        if (error instanceof ProgressionConflict) throw new CommandConflict(error.message, error.code);
        throw error;
      }
    } else if (input.command === "PREPARE_HINT") {
      const staged = await stageAdminCommand(input, userId, { correlationId, reason: input.reason });
      const snapshot = await buildPublicSnapshot(campaign.id);
      stored = stagedCommandReceipt(staged, correlationId, snapshot);
    } else stored = commandReceipt(await appendCustomEvent(input, userId, correlationId), correlationId);
    await db.commandExecution.update({
      where: { id: execution.id },
      data: { status: "SUCCEEDED", result: completeResultEnvelope(stored, fingerprint), completedAt: new Date() },
    });
    return stored;
  } catch (error) {
    const committed = await recoverCommittedMutation(campaign.id, correlationId);
    if (committed) {
      await db.commandExecution.update({
        where: { id: execution.id },
        data: { status: "SUCCEEDED", result: completeResultEnvelope(committed, fingerprint), completedAt: new Date() },
      });
      return committed;
    }
    await db.commandExecution.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
      },
    });
    await db.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId,
        action: input.command,
        correlationId,
        outcome: "FAILED",
        reason: input.reason,
        metadata: JSON.stringify({ code: error instanceof CommandConflict ? error.code : "COMMAND_FAILED" }),
      },
    });
    if (error instanceof CommandConflict) throw error;
    throw new CommandFailure(correlationId);
  }
}

export async function stageAdminCommand(
  input: Pick<Input, "command" | "campaignSlug" | "expectedSequence" | "targetKey" | "payload"> & {
    scheduledFor?: string;
  },
  userId: string,
  context: { correlationId?: string; reason?: string } = {},
) {
  const correlationId = context.correlationId ?? randomUUID();
  return db.$transaction(async (tx) => {
    const campaign = await tx.campaign.findUniqueOrThrow({ where: { slug: input.campaignSlug } });
    if (campaign.currentSequence !== input.expectedSequence)
      throw new CommandConflict(
        "This prepared Voyage action is stale. Refresh Captain's Console before preparing it again.",
        "STALE_SEQUENCE",
      );
    const reservedSequence = await reserveCampaignSequence(tx, campaign.id, input.expectedSequence);
    const staged = await tx.preparedAction.create({
      data: {
        campaignId: campaign.id,
        command: input.command,
        targetKey: input.targetKey,
        payload: JSON.stringify(input.payload),
        expectedSequence: reservedSequence,
        scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : undefined,
        preparedBy: userId,
        status: input.scheduledFor ? "SCHEDULED" : "PREPARED",
      },
    });
    await tx.adminAuditLog.create({
      data: {
        campaignId: campaign.id,
        userId,
        action: `${input.command}_STAGED`,
        correlationId,
        reason: context.reason,
        metadata: JSON.stringify({
          preparedActionId: staged.id,
          expectedSequence: input.expectedSequence,
          reservedSequence,
          targetKey: input.targetKey,
          status: staged.status,
        }),
      },
    });
    return {
      ...staged,
      reservedSequence,
      publication: "NOT_APPLICABLE" as const,
      delivery: "NOT_ATTEMPTED" as const,
      deliveryScope: "NO_PLAYER_EVENT" as const,
    };
  });
}

export async function previewAdminCommand(input: Omit<Input, "idempotencyKey">) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { slug: input.campaignSlug } });
  const snapshot = await buildPublicSnapshot(campaign.id);
  const projected = structuredClone(snapshot);
  const prerequisites: string[] = [];
  if (campaign.currentSequence !== input.expectedSequence)
    prerequisites.push("Captain's Console state is stale. Refresh before continuing.");
  if (campaign.status === "PAUSED" && !["RESUME", "REQUEST_RECONCILIATION"].includes(input.command))
    prerequisites.push("Resume the Voyage first.");
  if (input.command === "RELEASE_CHAPTER" && snapshot.chapter.state !== "READY")
    prerequisites.push("Prepare this Chapter first.");
  if (input.command === "RELEASE_CHAPTER" && !prerequisites.length) projected.chapter.state = "ACTIVE";
  if (input.command === "MARK_SOLVED" && snapshot.chapter.state !== "ACTIVE")
    prerequisites.push("Only the active Chapter can be solved.");
  if (input.command === "DISCOVER_SIDE_QUEST" || input.command === "ADVANCE_SIDE_QUEST") {
    const quest = await db.sideQuest.findFirst({
      where: { campaignId: campaign.id, ...(input.targetKey ? { key: input.targetKey } : {}) },
      include: { objectives: { orderBy: { ordinal: "asc" } } },
    });
    if (!quest) prerequisites.push("This Echo is not configured.");
    else {
      const plan = planSideQuestTransition(input.command, quest.state, quest.objectives);
      if (!plan.allowed) prerequisites.push(plan.message);
    }
  }
  if (input.command === "PAUSE") projected.campaign.status = "PAUSED";
  if (input.command === "RESUME") projected.campaign.status = "ACTIVE";
  return {
    preview: true,
    watermark: "PREVIEW — NOT RELEASED",
    currentSequence: campaign.currentSequence,
    projectedSequence: campaign.currentSequence + 1,
    eventType: input.command === "PREPARE_HINT" ? "HINT_PREPARED" : eventForPreview(input.command),
    affectedSystems: affectedSystems(input.command),
    undoAvailable: !["REQUEST_RECONCILIATION", "PREPARE_HINT"].includes(input.command),
    prerequisites,
    canExecute: prerequisites.length === 0,
    snapshot: projected,
  };
}

function eventForPreview(command: AdminCommand) {
  const known: Partial<Record<AdminCommand, string>> = {
    PREPARE_CHAPTER: "CHAPTER_PREPARED",
    RELEASE_CHAPTER: "CHAPTER_RELEASED",
    MARK_SOLVED: "CHAPTER_SOLVED",
    REVEAL_MAP: "MAP_LOCATION_REVEALED",
    AWARD_ARTIFACT: "ARTIFACT_AWARDED",
    PAUSE: "CAMPAIGN_PAUSED",
    RESUME: "CAMPAIGN_RESUMED",
    UNDO_LAST: "STATE_REVERTED",
  };
  return known[command] ?? eventFor(command);
}

function affectedSystems(command: AdminCommand) {
  const systems: Partial<Record<AdminCommand, string[]>> = {
    RELEASE_CHAPTER: ["Chapter", "Passage objective", "Voyage chart", "Voyage record", "Crew presentation"],
    RELEASE_HINT: ["Hint record", "Crew view", "Voyage record"],
    RELEASE_NEXT_HINT: ["Hint record", "Crew view", "Voyage record"],
    AWARD_ARTIFACT: ["Artifact collection", "Voyage record", "Crew presentation"],
    REVEAL_MAP: ["Voyage chart", "Voyage record", "Crew presentation"],
    UNDO_LAST: ["Voyage recovery point", "Crew reconciliation", "Audit history"],
  };
  return systems[command] ?? ["Voyage state", "Voyage record"];
}
