import { expect, it, vi } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft } from "./authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { createEnvironmentDraft, environmentVersionSchema } from "./library-lifecycle-contracts";
import { environmentReleaseReference } from "./environment-version-resolution";
import { materializeLibraryMoment } from "./library-service";
import { sceneReference, validateSceneReference } from "./scene-reference";
import { simulationEnvironments } from "./studio-validation";

vi.mock("@/lib/db", () => ({ db: {} }));

it("binds a rich-room Scene release to its complete opaque Environment version identity", () => {
  const document = createEnvironmentDraft("reference-room", createRoomEnvironment(simulationEnvironments[0]));
  const environment = environmentVersionSchema.parse({
    format: "PARALLAX_ENVIRONMENT_VERSION_1",
    id: "v".repeat(150),
    definitionId: document.id,
    number: 1,
    createdAt: "2026-10-15T00:00:00.000Z",
    notes: "Synthetic immutable reference fixture",
    content: document,
  });
  const pin = environmentReleaseReference({
    id: environment.id,
    itemId: document.id,
    versionNumber: 1,
    checksum: canonicalChecksum(environment),
    envelope: JSON.stringify(environment),
  });
  const draft = createSpatialDraft("reference-scene");
  draft.content.environment = structuredClone(pin);
  draft.content.studio!.environment = structuredClone(document.room!);
  const moment = materializeLibraryMoment(draft, "synthetic-creator", 1);
  const before = JSON.stringify(moment);
  const reference = sceneReference(moment, "PRESERVE_ENVIRONMENT");

  expect(reference.environment).toEqual(pin);
  expect(reference.environment.versionId).toHaveLength(150);
  expect(validateSceneReference(reference, moment)).toEqual(reference);
  draft.content.studio!.environment!.features[0].yawDegrees += 5;
  draft.content.environment.revision = 2;
  expect(JSON.stringify(moment)).toBe(before);
  expect(() =>
    validateSceneReference({ ...reference, environment: { ...pin, checksum: "0".repeat(64) } }, moment),
  ).toThrow("immutable release");
});
