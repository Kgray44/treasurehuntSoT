import { randomUUID } from "node:crypto";
import { z } from "zod";

export const artifactRecipientPolicies = [
  "ALL_ACTIVE_PLAYERS",
  "SELECTED_PLAYER",
  "DISCOVERING_PLAYER",
  "CAPTAIN_SELECTED",
  "CREW_ROLE",
  "CREW_COLLECTION_ONLY",
  "PERSONAL_AND_CREW_COLLECTION",
] as const;
export type ArtifactRecipientPolicy = (typeof artifactRecipientPolicies)[number];

const ids = z.array(z.string().min(1).max(191)).max(32);
export const artifactGrantConfigurationSchema = z
  .object({
    recipientPolicy: z.enum(artifactRecipientPolicies).default("CREW_COLLECTION_ONLY"),
    selectedRecipientProfileIds: ids.default([]),
    requiredCrewRole: z.string().trim().min(1).max(64).nullable().optional(),
    discoveringMembershipId: z.string().min(1).max(191).nullable().optional(),
    personalGrantState: z.enum(["COLLECTED", "ENTRUSTED", "ASSEMBLY_COMPONENT"]).default("COLLECTED"),
    custodyKind: z.enum(["PERSONAL", "TEMPORARY", "NARRATIVE"]).default("PERSONAL"),
    assemblyDefinitionId: z.string().min(1).max(191).nullable().optional(),
    componentRole: z.string().trim().min(1).max(96).nullable().optional(),
    receiptState: z.enum(["ACTIVE", "REVOKED"]).default("ACTIVE"),
    correctionOfGrantId: z.string().uuid().nullable().optional(),
    correctionReason: z.string().trim().min(1).max(500).nullable().optional(),
  })
  // Artifact block configuration also carries presentation fields. Only the
  // allowlisted grant keys are copied into the immutable receipt.
  .passthrough();

export const artifactGrantReceiptSchema = z
  .object({
    schemaVersion: z.literal(1),
    grantId: z.string().uuid(),
    artifactDefinitionId: z.string().min(1).max(191),
    artifactOccurrenceId: z.string().min(1).max(191),
    publishedVersionId: z.string().min(1).max(191),
    playthroughId: z.string().min(1).max(191),
    sourceEventId: z.string().min(1).max(191),
    sourceBlockId: z.string().min(1).max(191).nullable(),
    recipientPolicy: z.enum(artifactRecipientPolicies),
    resolvedRecipientMembershipIds: ids,
    resolvedRecipientProfileIds: ids,
    discoveringMembershipId: z.string().min(1).max(191).nullable(),
    requiredCrewRole: z.string().min(1).max(64).nullable(),
    sharedInventoryAction: z.enum(["ADD_SHARED_INVENTORY"]),
    personalGrantState: z.enum(["COLLECTED", "ENTRUSTED", "ASSEMBLY_COMPONENT"]),
    custodyKind: z.enum(["PERSONAL", "TEMPORARY", "NARRATIVE"]),
    assemblyDefinitionId: z.string().min(1).max(191).nullable(),
    componentRole: z.string().min(1).max(96).nullable(),
    receiptState: z.enum(["ACTIVE", "REVOKED"]),
    occurredAt: z.string().datetime(),
    correctionOfGrantId: z.string().uuid().nullable(),
    correctionReason: z.string().min(1).max(500).nullable(),
  })
  .strict();
export type ArtifactGrantReceipt = z.infer<typeof artifactGrantReceiptSchema>;

export type EventMembership = {
  id: string;
  playerProfileId: string;
  status: string;
  crewRole: string | null;
  joinedAt: Date | null;
  removedAt: Date | null;
};

const eligible = (member: EventMembership, occurredAt: Date) =>
  ["READY", "ACTIVE_MEMBER", "COMPLETED_MEMBER"].includes(member.status) &&
  (!member.joinedAt || member.joinedAt <= occurredAt) &&
  (!member.removedAt || member.removedAt > occurredAt);

export function resolveArtifactGrantReceipt(input: {
  artifactDefinitionId: string;
  playthroughId: string;
  publishedVersionId: string;
  sourceEventId: string;
  sourceBlockId: string | null;
  occurredAt: Date;
  configuration: unknown;
  memberships: EventMembership[];
}): ArtifactGrantReceipt {
  const config = artifactGrantConfigurationSchema.parse(input.configuration);
  const active = input.memberships.filter((member) => eligible(member, input.occurredAt));
  const selected = new Set(config.selectedRecipientProfileIds);
  let resolved: EventMembership[] = [];
  if (config.recipientPolicy === "ALL_ACTIVE_PLAYERS" || config.recipientPolicy === "PERSONAL_AND_CREW_COLLECTION")
    resolved = active;
  if (config.recipientPolicy === "SELECTED_PLAYER" || config.recipientPolicy === "CAPTAIN_SELECTED") {
    if (selected.size !== 1) throw new Error(`${config.recipientPolicy} requires one explicit recipient.`);
    resolved = active.filter((member) => selected.has(member.playerProfileId));
    if (resolved.length !== 1) throw new Error("Selected artifact recipient is not eligible at grant time.");
  }
  if (config.recipientPolicy === "DISCOVERING_PLAYER") {
    if (!config.discoveringMembershipId) throw new Error("DISCOVERING_PLAYER requires canonical discovery evidence.");
    resolved = active.filter((member) => member.id === config.discoveringMembershipId);
    if (resolved.length !== 1) throw new Error("Discovering member is not eligible at grant time.");
  }
  if (config.recipientPolicy === "CREW_ROLE") {
    if (!config.requiredCrewRole) throw new Error("CREW_ROLE requires an exact crew role.");
    resolved = active.filter((member) => member.crewRole === config.requiredCrewRole);
  }
  return artifactGrantReceiptSchema.parse({
    schemaVersion: 1,
    grantId: randomUUID(),
    artifactDefinitionId: input.artifactDefinitionId,
    artifactOccurrenceId: `${input.playthroughId}:${input.sourceEventId}`,
    publishedVersionId: input.publishedVersionId,
    playthroughId: input.playthroughId,
    sourceEventId: input.sourceEventId,
    sourceBlockId: input.sourceBlockId,
    recipientPolicy: config.recipientPolicy,
    resolvedRecipientMembershipIds: resolved.map((member) => member.id),
    resolvedRecipientProfileIds: resolved.map((member) => member.playerProfileId),
    discoveringMembershipId: config.discoveringMembershipId ?? null,
    requiredCrewRole: config.requiredCrewRole ?? null,
    sharedInventoryAction: "ADD_SHARED_INVENTORY",
    personalGrantState: config.personalGrantState,
    custodyKind: config.custodyKind,
    assemblyDefinitionId: config.assemblyDefinitionId ?? null,
    componentRole: config.componentRole ?? null,
    receiptState: config.receiptState,
    occurredAt: input.occurredAt.toISOString(),
    correctionOfGrantId: config.correctionOfGrantId ?? null,
    correctionReason: config.correctionReason ?? null,
  });
}
