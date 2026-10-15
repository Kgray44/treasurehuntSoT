import { expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createRoomEnvironment } from "./environment-authoring";
import { simulationEnvironments } from "./studio-validation";
import { createEnvironmentDraft } from "./library-lifecycle-contracts";
import { environmentVersionSchema as legacyEnvironmentVersionSchema } from "./legacy-scene-environment-contracts";
import type { CompatibleEnvironmentRecord } from "./environment-library-compatibility";
import { projectEnvironmentForSpatialLibrary } from "./spatial-library-environment-catalog";
import legacyBuiltins from "./builtin-environments.v1.json";

it("shows an unreleased rich working Environment without inventing a pin or Library membership", () => {
  const draft = createEnvironmentDraft("catalog-working", createRoomEnvironment(simulationEnvironments[0]));
  draft.room!.width = 30;
  draft.room!.depth = 40;
  draft.collection = "Private study";
  draft.favorite = true;
  const lifecycle = {
    id: draft.id,
    revision: 19,
    draft,
    saveState: "WORKING" as const,
    archived: false,
    updatedAt: "2026-10-15T00:00:00.000Z",
    lastUsedAt: null,
    usageCount: 0,
    releases: [],
  };
  const record = {
    representation: "LIFECYCLE_V1" as const,
    id: draft.id,
    builtin: false as const,
    ownerAccountId: "creator",
    revision: 19,
    saveState: "WORKING" as const,
    archived: false,
    working: draft,
    lifecycle,
    versions: [],
  } satisfies CompatibleEnvironmentRecord;
  const checksum = canonicalChecksum(draft.room);
  const projected = projectEnvironmentForSpatialLibrary(record);

  expect(projected).toMatchObject({
    id: "catalog-working",
    origin: "MY_CREATIONS",
    saveState: "WORKING",
    workingRevision: 19,
    immutableVersions: [],
    widthMeters: 30,
    depthMeters: 40,
    collection: "Private study",
    favorite: true,
  });
  expect(projected.preview?.kind).toBe("RICH_ROOM");
  if (projected.preview?.kind === "RICH_ROOM") expect(projected.preview.room).toBe(draft.room);
  expect(projected.searchText).toContain("private study");
  expect(projected).not.toHaveProperty("current");
  expect(canonicalChecksum(draft.room)).toBe(checksum);
});

it("retains legacy release metadata and geometry without claiming a rich room", () => {
  const version = legacyEnvironmentVersionSchema.parse(legacyBuiltins[0]);
  const record = {
    representation: "SC01_SCHEMA1" as const,
    id: version.reference.environmentId,
    builtin: true as const,
    ownerAccountId: null,
    revision: null,
    saveState: null,
    archived: false,
    working: null,
    versions: [version],
  } satisfies CompatibleEnvironmentRecord;
  const projected = projectEnvironmentForSpatialLibrary(record);

  expect(projected).toMatchObject({
    id: version.reference.environmentId,
    name: version.content.name,
    origin: "BUILT_IN",
    workingRevision: null,
    immutableVersions: [version.reference],
    widthMeters: version.content.width,
    depthMeters: version.content.depth,
    authoredFeatureCount: version.content.fixtures.length,
    collection: null,
    favorite: null,
  });
  expect(projected.preview?.kind).toBe("LEGACY_FIXTURES");
  if (projected.preview?.kind === "LEGACY_FIXTURES")
    expect(projected.preview.environment).toBe(version.content);
  expect(projected).not.toHaveProperty("current");
});

it("keeps an archived legacy item visible even when no release metadata can supply a preview", () => {
  const record = {
    representation: "SC01_SCHEMA1" as const,
    id: "legacy-unreleased",
    builtin: false as const,
    ownerAccountId: "creator",
    revision: 7,
    saveState: "LEGACY_REVIEW" as const,
    archived: true,
    working: null,
    versions: [],
  } satisfies CompatibleEnvironmentRecord;
  const projected = projectEnvironmentForSpatialLibrary(record);

  expect(projected).toMatchObject({
    id: "legacy-unreleased",
    name: "legacy-unreleased",
    saveState: "LEGACY_REVIEW",
    archived: true,
    immutableVersions: [],
    preview: null,
    widthMeters: null,
  });
});
