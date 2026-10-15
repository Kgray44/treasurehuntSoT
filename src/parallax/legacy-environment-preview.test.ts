import { expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft } from "./authoring";
import { createLegacyEnvironmentWorking } from "./legacy-environment-working-contracts";
import { environmentVersionSchema } from "./legacy-scene-environment-contracts";
import { projectLegacyEnvironmentPreview, legacyScenePreviewEnvironment } from "./legacy-environment-preview";
import type { CompatibleEnvironmentRecord } from "./environment-library-compatibility";
import builtins from "./builtin-environments.v1.json";
it.each([undefined, "INHERIT", "NORMAL", "LOW"] as const)(
  "preserves exact legacy fixtures/evidence and applies presentation %s independently",
  (lighting) => {
    const version = environmentVersionSchema.parse(builtins[0]),
      before = JSON.stringify(version);
    const preview = projectLegacyEnvironmentPreview(version, lighting ? { lighting } : undefined);
    expect(preview.fixtures).toEqual(version.content.fixtures);
    expect(preview.evidence).toEqual(version.content.evidence);
    expect(preview).not.toHaveProperty("features");
    expect(preview.light).toBe(lighting === "NORMAL" || lighting === "LOW" ? lighting : version.content.light);
    preview.evidence.candidates[0].position.x += 1;
    expect(JSON.stringify(version)).toBe(before);
  },
);
it("resolves the exact positive pin rather than a newer working definition or release", () => {
  const version = environmentVersionSchema.parse(builtins[0]);
  const working = createLegacyEnvironmentWorking(
    { ...version.content, id: "owned-room", name: "Newer working room", origin: "MANUAL" },
    version.reference,
    {
      operationId: "copy",
      sourceDefinitionId: version.reference.environmentId,
      sourceRevision: 0,
      requestDigest: "a".repeat(64),
    },
  );
  const release = {
    reference: {
      ...version.reference,
      environmentId: "owned-room",
      versionId: "owned-room:v1",
      checksum: canonicalChecksum({ ...version.content, id: "owned-room", origin: "MANUAL" }),
    },
    content: { ...version.content, id: "owned-room", origin: "MANUAL" as const },
  };
  const record = {
    representation: "SC01_SCHEMA1" as const,
    id: working.id,
    builtin: false as const,
    ownerAccountId: "owner",
    revision: 19,
    saveState: "WORKING" as const,
    archived: false,
    working,
    versions: [release],
  } satisfies CompatibleEnvironmentRecord;
  const scene = createSpatialDraft("preview-scene");
  scene.content.environment = release.reference;
  const before = canonicalChecksum(record);
  expect(legacyScenePreviewEnvironment(scene.content, [record])?.name).toBe(release.content.name);
  expect(legacyScenePreviewEnvironment(scene.content, [record])?.name).not.toBe(working.content.name);
  scene.content.environment = { ...release.reference, checksum: "0".repeat(64) };
  expect(() => legacyScenePreviewEnvironment(scene.content, [record])).toThrow("exact legacy Environment");
  expect(canonicalChecksum(record)).toBe(before);
});
