import { expect, it } from "vitest";
import {
  assertSextantOnlyChronicle,
  assertSextantFormalSurfaceCount,
} from "../../../.agents/scripts/sextant-chronicle-choice";

const now = new Date("2026-10-21T18:00:00Z");
const expected = {
  voyageId: "synthetic-voyage",
  taleId: "synthetic-chronicle",
  versionId: "synthetic-edition",
};
const member = {
  playthroughId: expected.voyageId,
  status: "ACTIVE_MEMBER",
  removedAt: null,
  player: { status: "ACTIVE" },
  playthrough: {
    taleId: expected.taleId,
    publishedVersionId: expected.versionId,
    status: "ACTIVE",
    expiresAt: null,
  },
};
it("permits only the already pinned sole synthetic Chronicle without changing the input", () => {
  const before = structuredClone(member);
  expect(() => assertSextantOnlyChronicle([member], expected, now)).not.toThrow();
  expect(member).toEqual(before);
});
it.each(
  [
    [],
    [member, { ...member, playthroughId: "another-voyage" }],
    [{ ...member, playthroughId: "another-voyage" }],
    [{ ...member, playthrough: { ...member.playthrough, publishedVersionId: "another-edition" } }],
    [{ ...member, playthrough: { ...member.playthrough, taleId: "another-chronicle" } }],
    [{ ...member, player: { status: "SUSPENDED" } }],
    [{ ...member, status: "INVITED" }],
    [{ ...member, removedAt: now }],
    [{ ...member, playthrough: { ...member.playthrough, status: "CANCELLED" } }],
    [{ ...member, playthrough: { ...member.playthrough, expiresAt: now } }],
  ].map((rows) => ({ rows })),
)(
  "refuses unexpected membership/edition state instead of resetting or relying on option order (%#)",
  ({ rows }) => {
    const before = structuredClone(rows);
    expect(() => assertSextantOnlyChronicle(rows, expected, now)).toThrow(
      "SEXTANT_SINGLE_CHRONICLE_FIXTURE_REQUIRED",
    );
    expect(rows).toEqual(before);
  },
);

it("admits the pristine formal surface case without changing development fixture behavior", () => {
  expect(() => assertSextantFormalSurfaceCount(0)).not.toThrow();
});
it.each([1, 3, -1, Number.NaN])(
  "refuses a non-pristine formal surface count without clearing any row (%s)",
  (count) => {
    expect(() => assertSextantFormalSurfaceCount(count)).toThrow(
      "SEXTANT_FORMAL_PRISTINE_DEVICE_SURFACES_REQUIRED",
    );
  },
);
