import { describe, expect, it } from "vitest";
import { resolveArtifactGrantReceipt } from "./artifact-grant";

const at = new Date("2026-07-25T12:00:00.000Z");
const members = [
  {
    id: "owner-member",
    playerProfileId: "owner",
    status: "ACTIVE_MEMBER",
    crewRole: "SCOUT",
    joinedAt: new Date("2026-07-25T11:00:00Z"),
    removedAt: null,
  },
  {
    id: "crew-member",
    playerProfileId: "crew",
    status: "ACTIVE_MEMBER",
    crewRole: "NAVIGATOR",
    joinedAt: new Date("2026-07-25T11:30:00Z"),
    removedAt: null,
  },
  {
    id: "late-member",
    playerProfileId: "late",
    status: "ACTIVE_MEMBER",
    crewRole: "SCOUT",
    joinedAt: new Date("2026-07-25T12:01:00Z"),
    removedAt: null,
  },
  {
    id: "removed-member",
    playerProfileId: "removed",
    status: "ACTIVE_MEMBER",
    crewRole: "SCOUT",
    joinedAt: new Date("2026-07-25T11:00:00Z"),
    removedAt: new Date("2026-07-25T11:59:00Z"),
  },
];
function resolve(configuration: object) {
  return resolveArtifactGrantReceipt({
    artifactDefinitionId: "artifact-1",
    playthroughId: "voyage-1",
    publishedVersionId: "version-1",
    sourceEventId: "event-1",
    sourceBlockId: "block-1",
    occurredAt: at,
    configuration,
    memberships: members,
  });
}
describe("artifact grant receipt", () => {
  it("resolves active recipients at event time and excludes late or removed members", () => {
    expect(resolve({ recipientPolicy: "ALL_ACTIVE_PLAYERS" }).resolvedRecipientProfileIds).toEqual(["owner", "crew"]);
  });
  it("requires canonical discovery evidence", () => {
    expect(() => resolve({ recipientPolicy: "DISCOVERING_PLAYER" })).toThrow(/canonical discovery/i);
    expect(
      resolve({ recipientPolicy: "DISCOVERING_PLAYER", discoveringMembershipId: "owner-member" })
        .resolvedRecipientProfileIds,
    ).toEqual(["owner"]);
  });
  it("enforces selected and crew-role resolution", () => {
    expect(
      resolve({ recipientPolicy: "SELECTED_PLAYER", selectedRecipientProfileIds: ["crew"] })
        .resolvedRecipientProfileIds,
    ).toEqual(["crew"]);
    expect(resolve({ recipientPolicy: "CREW_ROLE", requiredCrewRole: "SCOUT" }).resolvedRecipientProfileIds).toEqual([
      "owner",
    ]);
    expect(() =>
      resolve({ recipientPolicy: "CAPTAIN_SELECTED", selectedRecipientProfileIds: ["owner", "crew"] }),
    ).toThrow(/one explicit/i);
  });
  it("retains crew-only shared inventory without personal recipients", () => {
    const receipt = resolve({ recipientPolicy: "CREW_COLLECTION_ONLY" });
    expect(receipt.resolvedRecipientProfileIds).toEqual([]);
    expect(receipt.sharedInventoryAction).toBe("ADD_SHARED_INVENTORY");
  });
  it("records correction and revocation intent without rewriting the original grant", () => {
    const receipt = resolve({
      recipientPolicy: "SELECTED_PLAYER",
      selectedRecipientProfileIds: ["owner"],
      receiptState: "REVOKED",
      correctionOfGrantId: "ee219405-87dd-4cc4-8ab8-362b1d0ff3e0",
      correctionReason: "Canonical correction",
    });
    expect(receipt.receiptState).toBe("REVOKED");
    expect(receipt.correctionOfGrantId).toBe("ee219405-87dd-4cc4-8ab8-362b1d0ff3e0");
    expect(receipt.correctionReason).toBe("Canonical correction");
  });
});
