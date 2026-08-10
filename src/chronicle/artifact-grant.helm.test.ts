import { describe, expect, it } from "vitest";
import { resolveArtifactGrantReceipt, type EventMembership } from "./artifact-grant";

const occurredAt = new Date("2026-07-25T12:00:00.000Z");
const participatingCaptain: EventMembership = {
  id: "captain-membership",
  playerProfileId: "captain-profile",
  status: "ACTIVE_MEMBER",
  crewRole: "SCOUT",
  joinedAt: new Date("2026-07-25T11:00:00.000Z"),
  removedAt: null,
};

function resolve(configuration: object, memberships: EventMembership[] = [participatingCaptain], at = occurredAt) {
  return resolveArtifactGrantReceipt({
    artifactDefinitionId: "artifact-1",
    playthroughId: "voyage-1",
    publishedVersionId: "version-1",
    sourceEventId: "event-1",
    sourceBlockId: "block-1",
    occurredAt: at,
    configuration,
    memberships,
  });
}

describe("Project Helm Phase 1 artifact membership integration", () => {
  it("treats a participating Captain as an ordinary member and never infers a Captain-only recipient", () => {
    expect(
      resolve({ recipientPolicy: "SELECTED_PLAYER", selectedRecipientProfileIds: ["captain-profile"] }),
    ).toMatchObject({ resolvedRecipientProfileIds: ["captain-profile"] });
    expect(() =>
      resolve({ recipientPolicy: "SELECTED_PLAYER", selectedRecipientProfileIds: ["captain-only-profile"] }),
    ).toThrow(/not eligible/i);
  });

  it("retains event-time eligibility after the canonical membership is later marked removed", () => {
    const historicalMember: EventMembership = {
      ...participatingCaptain,
      status: "REMOVED",
      removedAt: new Date("2026-07-25T12:30:00.000Z"),
    };
    expect(resolve({ recipientPolicy: "ALL_ACTIVE_PLAYERS" }, [historicalMember]).resolvedRecipientProfileIds).toEqual([
      "captain-profile",
    ]);
    expect(
      resolve({ recipientPolicy: "ALL_ACTIVE_PLAYERS" }, [historicalMember], new Date("2026-07-25T12:31:00.000Z"))
        .resolvedRecipientProfileIds,
    ).toEqual([]);
  });
});
