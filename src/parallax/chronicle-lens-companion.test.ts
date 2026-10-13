import { expect, it } from "vitest";
import { isChronicleLensCompanion } from "./chronicle-lens-companion";
const own = { surfaceId: "phone", voyageId: "voyage", thisSession: true, role: "CHRONICLE_LENS", presence: "ACTIVE" };
it("uses only this tab's active session-bound Lens surface for the same Voyage", () => {
  expect(isChronicleLensCompanion([own], "phone", "voyage")).toBe(true);
  expect(isChronicleLensCompanion([own], null, "voyage")).toBe(false);
  expect(isChronicleLensCompanion([own], "desktop", "voyage")).toBe(false);
  expect(isChronicleLensCompanion([own], "phone", "other-voyage")).toBe(false);
  for (const change of [
    { thisSession: false },
    { role: "PRIMARY_STORY" },
    { presence: "REVOKED" },
    { presence: "DISCONNECTED" },
  ])
    expect(isChronicleLensCompanion([{ ...own, ...change }], "phone", "voyage")).toBe(false);
  expect(isChronicleLensCompanion([{ ...own, thisSession: "true" }], "phone", "voyage")).toBe(false);
  for (const malformed of [null, {}, [null], ["CHRONICLE_LENS"]])
    expect(isChronicleLensCompanion(malformed, "phone", "voyage")).toBe(false);
});
