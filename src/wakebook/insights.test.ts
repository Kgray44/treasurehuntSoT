import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { projectSharedHistory } from "./insights";

describe("projectSharedHistory", () => {
  const record = (id: string, title: string, completedAt: string | null, sourceMembershipId = "owner-membership") => ({
    id,
    sourceMembershipId,
    chronicleTitleSnapshot: title,
    completedAt: completedAt ? new Date(completedAt) : null,
    startedAt: null,
    joinedAt: null,
  });

  it("keeps only shared historical snapshots and safely names first and recent Voyages", () => {
    const people = projectSharedHistory([
      {
        participantProfileId: "owner",
        sourceMembershipId: "owner-membership",
        displayNameSnapshot: "Sera",
        tombstoneState: "ACTIVE",
        participationRole: "PLAYER",
        crewRoleSnapshot: null,
        record: record("owner-record", "The Owner's Voyage", "2026-01-01T00:00:00.000Z"),
      },
      {
        participantProfileId: "crew",
        sourceMembershipId: "crew-membership-one",
        displayNameSnapshot: "Mara",
        tombstoneState: "ACTIVE",
        participationRole: "PLAYER",
        crewRoleSnapshot: "Lookout",
        record: record("first-record", "The First Wake", "2025-03-01T00:00:00.000Z"),
      },
      {
        participantProfileId: "crew",
        sourceMembershipId: "crew-membership-two",
        displayNameSnapshot: "Mara",
        tombstoneState: "ACTIVE",
        participationRole: "PLAYER",
        crewRoleSnapshot: "Lookout",
        record: record("latest-record", "The Latest Wake", "2026-03-01T00:00:00.000Z"),
      },
    ]);

    expect(people).toEqual([
      expect.objectContaining({
        label: "Mara",
        role: "Lookout",
        voyageCount: 2,
        firstSharedVoyage: expect.objectContaining({ id: "first-record" }),
        latestSharedVoyage: expect.objectContaining({ id: "latest-record" }),
      }),
    ]);
  });

  it("does not invent a first or recent date when history retained none", () => {
    const [person] = projectSharedHistory([
      {
        participantProfileId: null,
        sourceMembershipId: "crew-membership",
        displayNameSnapshot: "Removed crew",
        tombstoneState: "REMOVED",
        participationRole: "PLAYER",
        crewRoleSnapshot: null,
        record: record("undated-record", "An Undated Wake", null),
      },
    ]);

    expect(person).toMatchObject({
      label: "Former crew member",
      availability: "LIMITED",
      firstSharedVoyage: null,
      latestSharedVoyage: null,
    });
  });
});
