import { readFile } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { db } from "@/lib/db";
import { pilotEnvironmentEnabled } from "./authorization";
import { createStudioTale, getStudioTale, saveStudioDraft } from "@/chronicle/studio-service";
import { getBlockDefinition } from "@/chronicle/block-registry";
import { snapshotFromStudio, publishedSourceChecksum } from "@/chronicle/snapshot";
import { publishTale } from "@/chronicle/publishing";
import { createPlaythroughAndInvitations } from "@/platform/invitations";
import { launchTalePlaythrough } from "@/chronicle/progression";
import { saveDrydockScenario } from "@/drydock/scenario-store";
import { saveDrydockScenarioSuite, runDrydockScenarioSuite } from "@/drydock/suite-store";
import { roomObservationResponseSchema } from "@/watchglass/room-observation";
import { reconstructRoomFromObservation } from "@/parallax/room-reconstruction";
import { createSpatialDraft } from "@/parallax/authoring";
import { identityTransform } from "@/parallax/contracts";
import { composeTransform, inverseTransform } from "@/parallax/transforms";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "@/parallax/room-geometry";
import { findSurfacePlacement, surfaceFrameRotation } from "@/parallax/surface-placement";
import { saveSpatialDraft, releaseSpatialVersion, attachSpatialVersion } from "@/parallax/library-service";

const prefix = "parallax-room-test-";
const running = new Map<string, Promise<Awaited<ReturnType<typeof readRoomTest>>>>();
export async function readRoomTest(ownerAccountId: string) {
  const tale = await db.chronicle.findFirst({
    where: { creatorAccountId: ownerAccountId, slug: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
  });
  if (!tale) return null;
  const voyage = await db.taleSession.findFirst({
    where: { taleId: tale.id, captainAccountId: ownerAccountId, previewMode: false },
    orderBy: { startedAt: "desc" },
  });
  return {
    taleId: tale.id,
    versionId: tale.latestPublishedVersionId,
    voyageId: voyage?.id ?? null,
    status: voyage?.status ?? "NOT_STARTED",
    journalHref: voyage ? `/player/playthroughs/${voyage.id}/journal` : null,
    devicesHref: voyage ? `/account/devices?voyage=${voyage.id}` : null,
    studioHref: `/studio/parallax?chronicle=${tale.id}&block=${tale.id}:lens`,
  };
}

/** Retained authorized observation only; no image dispatch or invented replacement geometry. */
export async function provisionRoomTest(ownerAccountId: string, origin: string) {
  if (
    !pilotEnvironmentEnabled() ||
    process.env.PARALLAX_ROOM_TEST_ENABLED !== "1" ||
    ownerAccountId !== "spatial-pilot-navigator"
  )
    throw new Error("The isolated photographed-room test is not enabled.");
  const previous = running.get(ownerAccountId);
  if (previous) return previous;
  const operation = prepare(ownerAccountId, origin);
  running.set(ownerAccountId, operation);
  try {
    return await operation;
  } finally {
    running.delete(ownerAccountId);
  }
}

async function prepare(ownerAccountId: string, origin: string) {
  const bytes = await readFile("tmp/room-test-observation.private.json");
  const digest = createHash("sha256").update(bytes).digest("hex");
  const slug = `${prefix}${digest.slice(0, 16)}`;
  const observation = roomObservationResponseSchema.parse(JSON.parse(bytes.toString("utf8")));
  const reconstruction = reconstructRoomFromObservation({
    observation,
    roomId: `photo-room-${digest.slice(0, 16)}`,
    sourceMediaIds: ["authorized-local-test-photo-1", "authorized-local-test-photo-2"],
  });
  if (reconstruction.status !== "PROPOSED")
    throw new Error(`Room reconstruction requires review: ${reconstruction.message}`);
  let tale = await db.chronicle.findFirst({ where: { slug, creatorAccountId: ownerAccountId } });
  if (!tale) {
    const created = await createStudioTale({
      title: "Photographed Room · Chronicle Lens Test",
      slug,
      creatorId: ownerAccountId,
      visibility: "PRIVATE",
    });
    tale = await db.chronicle.findUniqueOrThrow({ where: { id: created.id } });
  }
  const taleId = tale.id;
  if (!tale.latestPublishedVersionId) {
    const source = await getStudioTale(taleId),
      blockId = `${taleId}:lens`,
      finaleId = `${taleId}:complete`;
    await saveStudioDraft(
      taleId,
      {
        ...source.draft,
        tale: {
          ...source.tale,
          title: "Photographed Room · Chronicle Lens Test",
          visibility: "PRIVATE",
          playerCountMin: 1,
          playerCountMax: 1,
        },
        chapters: [
          {
            ...source.draft.chapters[0],
            title: "Room test",
            blocks: [
              {
                id: blockId,
                blockType: "narrative",
                title: "Your room, a spatial story",
                configuration: {
                  ...getBlockDefinition("narrative")!.defaultConfiguration,
                  heading: "A message in your room",
                  body: "Pair your phone as Chronicle Lens, open browser AR, then align three table corners from two views. Walk slowly around the note. This estimated room and local tracker still require your physical review.",
                },
                presentation: {},
                completion: { mode: "playerConfirmation" },
                nextBlockId: finaleId,
              },
              {
                id: finaleId,
                blockType: "taleComplete",
                title: "Room test complete",
                configuration: getBlockDefinition("taleComplete")!.defaultConfiguration,
                presentation: {},
                completion: { mode: "playerConfirmation" },
              },
            ],
          },
        ],
      },
      ownerAccountId,
    );
    const draft = createSpatialDraft(randomUUID(), "Desk Map", taleId);
    draft.content.title = "A message in the photographed room";
    draft.content.studio!.environment = reconstruction.room;
    draft.content.studio!.provenance = {
      origin: "AI_ASSISTED",
      generator: "Owner-authorized retained photo observation",
      license: "Owner-authorized private test",
    };
    const entity = draft.content.entities[0];
    entity.name = "The room's hidden message";
    entity.content = "The stars are closer than they look. Find the north star, then continue your Chronicle.";
    entity.alternativeText = "A readable paper note on a clear part of the photographed room's worktable.";
    entity.widthMeters = 0.28;
    entity.interactions = ["PICK", "INSPECT"];
    draft.content.fallback.narrative = entity.content;
    const surfaces = discoverRoomSurfaces(
      syntheticRoomGeometry({ ...reconstruction.room, horizontal: true, vertical: true }),
      { tracking: true, clutter: 0 },
    );
    const choices = surfaces
      .filter((surface) => ["TABLE", "DESK"].includes(surface.surface))
      .map((surface) => ({
        surface,
        pose: findSurfacePlacement({ ...identityTransform(), position: surface.position }, surface, entity.widthMeters),
      }))
      .filter((item) => item.pose)
      .sort(
        (a, b) =>
          Math.hypot(a.surface.position.x, a.surface.position.z) -
          Math.hypot(b.surface.position.x, b.surface.position.z),
      );
    const chosen = choices[0];
    if (!chosen?.pose)
      throw new Error(
        "The observed room has no clear worktable for the test note. Edit or review the environment before publishing.",
      );
    const anchor = draft.content.anchors[0];
    const frame = { position: chosen.surface.position, rotation: surfaceFrameRotation(chosen.surface), scale: 1 };
    anchor.transform = identityTransform();
    entity.transform = composeTransform(inverseTransform(frame), chosen.pose);
    draft.content.studio!.surfacePreviewFrames = [
      {
        anchorId: anchor.id,
        environmentId: reconstruction.room.id,
        surfaceId: chosen.surface.id,
        position: frame.position,
        rotation: frame.rotation,
      },
    ];
    draft.content.studio!.animationTracks = [
      {
        id: `${draft.content.definitionId}:reveal`,
        entityId: entity.id,
        property: "OPACITY",
        enabled: true,
        interpolation: "EASE_IN_OUT",
        keyframes: [
          { id: "reveal-start", atMs: 0, value: 0 },
          { id: "reveal-end", atMs: 5000, value: 1 },
        ],
      },
    ];
    const revision = await saveSpatialDraft(ownerAccountId, draft, 0);
    const release = await releaseSpatialVersion(ownerAccountId, draft.content.definitionId, revision);
    const current = await getStudioTale(taleId);
    await attachSpatialVersion({
      ownerAccountId,
      definitionId: draft.content.definitionId,
      versionId: release.version.id,
      chronicleId: taleId,
      blockId,
      autosaveVersion: current.draft.autosaveVersion,
    });
    const snapshot = snapshotFromStudio(await getStudioTale(taleId)),
      checksum = publishedSourceChecksum(snapshot),
      scenarioId = `room-test-${randomUUID()}`,
      suiteId = `room-test-suite-${randomUUID()}`;
    await saveDrydockScenario(taleId, {
      schemaVersion: 1,
      id: scenarioId,
      revision: 1,
      sourceChecksum: checksum,
      title: "Room test baseline",
      purpose: "Complete the released spatial passage through its accessible authored path.",
      seed: digest.slice(0, 16),
      initialState: { variables: {}, inventory: [], actorMode: "PLAYER" },
      environment: {
        virtualStart: "2026-10-13T12:00:00.000Z",
        locale: "en-US",
        viewport: "MOBILE",
        reducedMotion: true,
        soundEnabled: false,
        keyboardOnly: true,
      },
      limits: { maxSteps: 20, maxStates: 20, maxTraceEntries: 100, maxVirtualMilliseconds: 60000 },
      inputs: [{ kind: "CONTINUE" }, { kind: "CONTINUE" }],
      faults: [],
      assertions: [{ kind: "RUN_COMPLETES" }, { kind: "IDEMPOTENCY_PRESERVED" }],
      tags: ["required:BASELINE_SUCCESS"],
    });
    await saveDrydockScenarioSuite(
      taleId,
      {
        schemaVersion: 1,
        id: suiteId,
        title: "Photographed room publication",
        sourceChecksum: checksum,
        members: [{ scenarioId, revision: 1 }],
      },
      checksum,
    );
    await runDrydockScenarioSuite(taleId, suiteId, snapshot);
    await publishTale(
      taleId,
      ownerAccountId,
      "Private owner-authorized estimated room test; browser prototype and physical accuracy unqualified.",
    );
    tale = await db.chronicle.findUniqueOrThrow({ where: { id: taleId } });
  }
  const existing = await db.taleSession.findFirst({
    where: { taleId, captainAccountId: ownerAccountId },
    orderBy: { startedAt: "desc" },
  });
  if (!existing) {
    const voyage = await createPlaythroughAndInvitations(
      {
        taleId,
        versionId: tale.latestPublishedVersionId!,
        voyageName: "Photographed Room Test",
        captainParticipationMode: "CAPTAIN_AND_PLAYER",
        captainMode: "RULE_CONTROLLED",
        testVoyage: true,
        players: [],
      },
      ownerAccountId,
      origin,
    );
    await launchTalePlaythrough(voyage.playthroughId, ownerAccountId);
  }
  return readRoomTest(ownerAccountId);
}
