import { expect, it, vi } from "vitest";
import { createSpatialDraft } from "./authoring";
import { assertPinnedSceneEnvironment } from "./environment-version-resolution";
import legacyBuiltins from "./builtin-environments.v1.json";

vi.mock("@/lib/db", () => ({ db: {} }));

it("preserves the legacy pinned Environment geometry guard before saving a Scene", async () => {
  const draft = createSpatialDraft("legacy-bounds-audit");
  draft.content.environment = legacyBuiltins[0].reference;
  draft.content.entities[0].transform.position.x = 99;
  const before = JSON.stringify(draft);

  await expect(assertPinnedSceneEnvironment("synthetic-creator", draft, {} as never)).rejects.toThrow();
  expect(JSON.stringify(draft)).toBe(before);
});
