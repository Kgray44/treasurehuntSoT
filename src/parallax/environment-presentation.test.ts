import { expect, it } from "vitest";
import { canonicalChecksum } from "@/drydock/canonical";
import { createSpatialDraft, draftSchema } from "./authoring";
import { authoredPreviewEnvironment, createRoomEnvironment } from "./environment-authoring";
import { roomEnvironmentSchema } from "./environment-contracts";
import {
  createEnvironmentDraft,
  environmentDraftSchema,
  environmentVersionSchema,
} from "./library-lifecycle-contracts";
import { simulationEnvironments } from "./studio-validation";
import { environmentVersionSchema as legacyVersionSchema } from "./legacy-scene-environment-contracts";
import legacyBuiltins from "./builtin-environments.v1.json";

it("preserves omitted lighting and exact checksums in old room, working and release schemas", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  const document = createEnvironmentDraft("old-room-definition", room);
  const version = environmentVersionSchema.parse({
    format: "PARALLAX_ENVIRONMENT_VERSION_1",
    id: "old-room-v1",
    definitionId: document.id,
    number: 1,
    createdAt: "2026-10-15T00:00:00.000Z",
    notes: "",
    content: document,
  });
  const original = JSON.stringify(version);
  const checksum = canonicalChecksum(version);
  expect(room).not.toHaveProperty("light");
  expect(roomEnvironmentSchema.parse(room)).toEqual(room);
  expect(environmentDraftSchema.parse(document)).toEqual(document);
  expect(JSON.stringify(environmentVersionSchema.parse(version))).toBe(original);
  expect(canonicalChecksum(environmentVersionSchema.parse(version))).toBe(checksum);
  expect(roomEnvironmentSchema.safeParse({ ...room, light: "BRIGHT" }).success).toBe(false);
});
it.each([undefined, "INHERIT", "NORMAL", "LOW"] as const)(
  "projects rich base light before Scene override %s without changing either source",
  (lighting) => {
    const room = createRoomEnvironment(simulationEnvironments[0]);
    room.light = "LOW";
    const scene = createSpatialDraft("presentation-scene");
    scene.content.studio!.environment = room;
    if (lighting) scene.content.scenePresentation = { lighting };
    const before = JSON.stringify(scene);
    const projected = authoredPreviewEnvironment(scene.content, { ...simulationEnvironments[0], id: room.id });
    expect(projected.light).toBe(lighting === "NORMAL" ? "NORMAL" : "LOW");
    expect(JSON.stringify(scene)).toBe(before);
    expect(draftSchema.parse(scene)).toEqual(scene);
  },
);
it("uses the historical rich-room default only while reading and respects the selected preview room", () => {
  const scene = createSpatialDraft("old-light-scene");
  scene.content.studio!.environment = createRoomEnvironment(simulationEnvironments[0]);
  const room = scene.content.studio!.environment;
  const selected = authoredPreviewEnvironment(scene.content, {
    ...simulationEnvironments[0],
    id: room.id,
    light: "LOW",
  });
  expect(selected.light).toBe("NORMAL");
  expect(room).not.toHaveProperty("light");
  const alternate = { ...simulationEnvironments[1], id: "alternate-reference", light: "LOW" };
  expect(authoredPreviewEnvironment(scene.content, alternate)).toBe(alternate);
  scene.content.scenePresentation = { lighting: "NORMAL" };
  expect(authoredPreviewEnvironment(scene.content, alternate)).toEqual({ ...alternate, light: "NORMAL" });
  expect(alternate.light).toBe("LOW");
});
it.each(["builtin", "owned-legacy", "unbound"] as const)(
  "keeps %s base lighting and applies a Scene override last",
  (source) => {
    const version = legacyVersionSchema.parse(legacyBuiltins[0]);
    const scene = createSpatialDraft("legacy-light-scene");
    if (source !== "unbound")
      scene.content.environment = {
        ...version.reference,
        ...(source === "owned-legacy" ? { environmentId: "owned-legacy" } : {}),
      };
    const fallback =
      source === "unbound"
        ? simulationEnvironments.find((e) => e.light === "LOW")!
        : { ...version.content, light: "LOW" };
    const before = JSON.stringify(fallback);
    expect(authoredPreviewEnvironment(scene.content, fallback).light).toBe("LOW");
    scene.content.scenePresentation = { lighting: "INHERIT" };
    expect(authoredPreviewEnvironment(scene.content, fallback).light).toBe("LOW");
    scene.content.scenePresentation = { lighting: "NORMAL" };
    expect(authoredPreviewEnvironment(scene.content, fallback).light).toBe("NORMAL");
    expect(JSON.stringify(fallback)).toBe(before);
  },
);
it("keeps independent Scene presentation, released room bytes and later working edits separate", () => {
  const room = createRoomEnvironment(simulationEnvironments[0]);
  room.light = "LOW";
  const document = createEnvironmentDraft("independent-light-room", room);
  const released = structuredClone(document);
  const publishedChecksum = canonicalChecksum(released);
  const first = createSpatialDraft("first-scene"),
    second = createSpatialDraft("second-scene");
  first.content.studio!.environment = structuredClone(released.room!);
  second.content.studio!.environment = structuredClone(released.room!);
  first.content.scenePresentation = { lighting: "NORMAL" };
  document.room!.light = "NORMAL";
  const fallback = { ...simulationEnvironments[0], id: released.room!.id };
  expect(authoredPreviewEnvironment(first.content, fallback).light).toBe("NORMAL");
  expect(authoredPreviewEnvironment(second.content, fallback).light).toBe("LOW");
  expect(canonicalChecksum(released)).toBe(publishedChecksum);
  expect(second.content).not.toHaveProperty("scenePresentation");
});
