import { beforeEach, expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft } from "@/parallax/authoring";
import { createLegacyEnvironmentWorking } from "@/parallax/legacy-environment-working-contracts";
import { environmentVersionSchema } from "@/parallax/legacy-scene-environment-contracts";
import builtins from "@/parallax/builtin-environments.v1.json";
import { clearWorkingJournal, journalWorking, readWorkingJournal, readLegacyWorkingJournal } from "./working-recovery";
beforeEach(() => localStorage.clear());
function working() {
  const source = environmentVersionSchema.parse(builtins[0]);
  return createLegacyEnvironmentWorking({ ...source.content, id: "owned-room", origin: "MANUAL" }, source.reference, {
    operationId: "copy-room",
    sourceDefinitionId: source.reference.environmentId,
    sourceRevision: 0,
    requestDigest: "a".repeat(64),
  });
}
it("keeps legacy recovery account/definition scoped and separate from the ordinary Scene reader", () => {
  const document = working();
  journalWorking("owner", document.id, document, 19);
  expect(readLegacyWorkingJournal("owner", document.id)).toMatchObject({ document, revision: 19 });
  expect(readLegacyWorkingJournal("other-owner", document.id)).toBeNull();
  expect(readLegacyWorkingJournal("owner", "different-definition")).toBeNull();
  expect(readWorkingJournal("owner", document.id)).toBeNull();
});
it("clears only an acknowledged legacy snapshot while retaining newer unacknowledged edits", () => {
  const acknowledged = working(),
    newer = structuredClone(acknowledged);
  newer.content.name = "Newer unsaved room";
  journalWorking("owner", newer.id, newer, 20);
  clearWorkingJournal("owner", acknowledged.id, acknowledged);
  expect(readLegacyWorkingJournal("owner", newer.id)?.document).toEqual(newer);
  clearWorkingJournal("owner", newer.id, newer);
  expect(readLegacyWorkingJournal("owner", newer.id)).toBeNull();
});
it("preserves ordinary Scene recovery and refuses to reinterpret it as a legacy Environment", () => {
  const scene = createSpatialDraft("ordinary-recovery"),
    checksum = canonicalChecksum(scene);
  journalWorking("owner", scene.content.definitionId, scene, 8);
  expect(readWorkingJournal("owner", scene.content.definitionId)?.document).toEqual(scene);
  expect(readLegacyWorkingJournal("owner", scene.content.definitionId)).toBeNull();
  expect(canonicalChecksum(scene)).toBe(checksum);
});
