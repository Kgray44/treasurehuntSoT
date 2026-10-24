import { expect, it } from "vitest";
import { createSpatialDraft, previewEntityTransforms } from "./authoring";
import { createPresetConstruction } from "./preset-construction";
import { validateSpatialAuthoring } from "./studio-validation";

it("reviews environment height in the surface frame, rather than mistaking a tabletop offset for underground placement", () => {
  const draft = createSpatialDraft("height-room");
  const room = createPresetConstruction({
    id: "bedroom",
    name: "Bedroom",
    width: 4,
    depth: 4,
    vertical: true,
  });
  draft.content.studio!.environment = room;
  const entity = draft.content.entities[0];
  entity.transform.position.y = -0.4;
  expect(
    previewEntityTransforms(draft.content, room.id, { ...room, horizontal: true, vertical: true })[entity.id].position
      .y,
  ).toBeGreaterThan(0);
  expect(validateSpatialAuthoring(draft.content).some((f) => f.code === "PARALLAX_HEIGHT_REVIEW")).toBe(false);
  entity.transform.position.z = 4;
  expect(validateSpatialAuthoring(draft.content).some((f) => f.code === "PARALLAX_HEIGHT_REVIEW")).toBe(true);
  delete draft.content.studio!.environment;
  entity.transform.position.z = 0;
  expect(validateSpatialAuthoring(draft.content).some((f) => f.code === "PARALLAX_HEIGHT_REVIEW")).toBe(true);
});
