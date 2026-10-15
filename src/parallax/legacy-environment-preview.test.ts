import { expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, previewEntityTransform } from "./authoring";
import { syntheticRoomGeometry } from "./room-geometry";
import { syntheticEnvironmentEvidence } from "./adaptive-authoring";
import { createRoomEnvironment } from "./environment-authoring";
import { prepareAssistantEnvironment } from "./assistant-environment";
import { identityTransform } from "./contracts";
import { planPhysicalAssetInsertion } from "./element-insertion-placement";
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

it("renders only exact legacy fixtures and preserves its candidate collection without invented room geometry", () => {
  const version = environmentVersionSchema.parse(builtins[0]);
  version.content.fixtures = [
    {
      id: "legacy-box",
      name: "Exact fixture",
      kind: "FURNITURE",
      position: { x: 0.6, y: 0.5, z: -0.4 },
      size: { x: 0.8, y: 1, z: 0.5 },
      color: "#123456",
    },
  ];
  const before = structuredClone(version);
  const preview = projectLegacyEnvironmentPreview(version);
  const geometry = syntheticRoomGeometry(preview);
  expect(geometry).toHaveLength(1);
  expect(geometry[0]).toMatchObject({
    id: "legacy-box",
    position: [0.6, 0.5, -0.4],
    size: [0.8, 1, 0.5],
    color: 0x123456,
    surface: null,
  });
  expect(syntheticRoomGeometry({ ...preview, fixtures: [] })).toEqual([]);
  const evidence = syntheticEnvironmentEvidence(preview);
  expect(evidence).toEqual(version.content.evidence);
  evidence.candidates[0].position.x = 9;
  expect(version).toEqual(before);
  expect(() => createRoomEnvironment(preview)).toThrow(/legacy fixtures/);
});

it("uses exact legacy candidate poses and normals for initial and retained surface frames", () => {
  const version = environmentVersionSchema.parse(builtins[0]);
  const candidate = {
    ...version.content.evidence.candidates.find((item) => item.surface === "TABLE")!,
    position: { x: 0.8, y: 1.1, z: -0.7 },
  };
  delete candidate.rotation;
  version.content.evidence.candidates = [candidate];
  const preview = projectLegacyEnvironmentPreview(version);
  const scene = createSpatialDraft("legacy-pose");
  const pose = previewEntityTransform(scene.content, scene.content.entities[0].id, preview.id, preview);
  expect(pose.position.x).toBeCloseTo(0.8);
  expect(pose.position.y).toBeCloseTo(1.11);
  expect(pose.position.z).toBeCloseTo(-0.7);
  scene.content.studio!.surfacePreviewFrames = [
    {
      anchorId: scene.content.anchors[0].id,
      environmentId: preview.id,
      surfaceId: candidate.id,
      position: { x: 9, y: 9, z: 9 },
      rotation: identityTransform().rotation,
    },
  ];
  expect(previewEntityTransform(scene.content, scene.content.entities[0].id, preview.id, preview)).toEqual(pose);
});

it("leaves pinned legacy scenes unchanged when room-aware assistance is unavailable", () => {
  const version = environmentVersionSchema.parse(builtins[0]);
  const scene = createSpatialDraft("legacy-assistance");
  scene.content.environment = version.reference;
  const before = structuredClone(scene);
  expect(() => prepareAssistantEnvironment(scene, projectLegacyEnvironmentPreview(version))).toThrow(
    /legacy Environment version/,
  );
  expect(scene).toEqual(before);
  expect(scene.content.studio).not.toHaveProperty("environment");
});

it("refuses insertion into exact occupied legacy fixtures instead of using a reference room", () => {
  const version = environmentVersionSchema.parse(builtins[0]);
  version.content.fixtures = [
    {
      id: "occupied-room",
      name: "Occupied volume",
      kind: "FURNITURE",
      position: { x: 0, y: 1, z: 0 },
      size: { x: 4, y: 2, z: 4 },
      color: "#123456",
    },
  ];
  const scene = createSpatialDraft("legacy-occupied");
  scene.content.entities = [];
  scene.content.anchors = [];
  scene.content.studio!.layers = [];
  const plan = planPhysicalAssetInsertion({
    draft: scene,
    modelId: "sofa",
    environment: projectLegacyEnvironmentPreview(version),
  });
  expect(plan.status).toBe("NO_FIT");
});

it("uses a legacy wall with an arbitrary identity and reports a missing wall instead of inventing one", () => {
  const version = environmentVersionSchema.parse(builtins[0]);
  const wall = {
    ...version.content.evidence.candidates.find((item) => item.surface === "WALL")!,
    id: "photographed-west-face",
    position: { x: -1.8, y: 1.4, z: 0.3 },
    normal: { x: 1, y: 0, z: 0 },
  };
  delete wall.rotation;
  version.content.evidence.candidates = [wall];
  const scene = createSpatialDraft("wall-projection", "Hidden Wall Message");
  const preview = projectLegacyEnvironmentPreview(version);
  const pose = previewEntityTransform(scene.content, scene.content.entities[0].id, preview.id, preview);
  expect(pose.position.x).toBeCloseTo(-1.79);
  expect(pose.position.y).toBeCloseTo(1.4);
  expect(pose.position.z).toBeCloseTo(0.3);
  expect(Math.abs(pose.rotation.y)).toBeCloseTo(Math.SQRT1_2);
  expect(() =>
    previewEntityTransform(scene.content, scene.content.entities[0].id, preview.id, {
      ...preview,
      evidence: { ...preview.evidence, candidates: [] },
    }),
  ).toThrow(/no usable support/);
  scene.content.studio!.surfacePreviewFrames = [
    {
      anchorId: scene.content.anchors[0].id,
      environmentId: preview.id,
      surfaceId: wall.id,
      position: wall.position,
      rotation: pose.rotation,
    },
  ];
  expect(() =>
    previewEntityTransform(scene.content, scene.content.entities[0].id, preview.id, {
      ...preview,
      evidence: { ...preview.evidence, candidates: [] },
    }),
  ).toThrow(/no longer has/);
  expect(() =>
    previewEntityTransform(scene.content, scene.content.entities[0].id, preview.id, {
      ...preview,
      evidence: { ...preview.evidence, candidates: [{ ...wall, normal: { x: 0, y: 1, z: 0 } }] },
    }),
  ).toThrow(/usable support/);
});
