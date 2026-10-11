import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { createStudioTale, getStudioTale, saveStudioDraft } from "@/chronicle/studio-service";
import { snapshotFromStudio, publishedSourceChecksum } from "@/chronicle/snapshot";
import { publishTale } from "@/chronicle/publishing";
import { launchTalePlaythrough } from "@/chronicle/progression";
import { createPlaythroughAndInvitations } from "@/platform/invitations";
import { createSpatialDraft } from "@/parallax/authoring";
import { saveSpatialDraft, releaseSpatialVersion, attachSpatialVersion } from "@/parallax/library-service";
import { saveDrydockScenario } from "@/drydock/scenario-store";
import { saveDrydockScenarioSuite, runDrydockScenarioSuite } from "@/drydock/suite-store";
import { PILOT_SLUG, PILOT_TITLE, PILOT_EDITION, pilotLandfall, pilotChapters } from "./story";
const preparing = new Map<string, Promise<Awaited<ReturnType<typeof readPilot>>>>();

export async function isPilotVoyage(ownerAccountId: string, voyageId: string) {
  return Boolean(
    await db.taleSession.findFirst({
      where: {
        id: voyageId,
        captainAccountId: ownerAccountId,
        tale: { slug: PILOT_SLUG, creatorAccountId: ownerAccountId },
      },
      select: { id: true },
    }),
  );
}

export async function readPilot(ownerAccountId: string) {
  const tale = await db.chronicle.findFirst({ where: { slug: PILOT_SLUG, creatorAccountId: ownerAccountId } });
  if (!tale) return null;
  const voyage = await db.taleSession.findFirst({
    where: { taleId: tale.id, captainAccountId: ownerAccountId, previewMode: false },
    orderBy: { startedAt: "desc" },
  });
  const version = tale.latestPublishedVersionId
    ? await db.publishedTaleVersion.findUnique({ where: { id: tale.latestPublishedVersionId } })
    : null;
  const source = await getStudioTale(tale.id);
  const lens = source.draft.chapters.flatMap((c) => c.blocks).find((b) => b.id === `${tale.id}:lens`);
  const moment = lens?.presentation.spatialMoment as { definition?: { id?: string } } | undefined;
  return {
    edition: PILOT_EDITION,
    taleId: tale.id,
    voyageId: voyage?.id ?? null,
    status: voyage?.status ?? "NOT_STARTED",
    versionId: version?.id ?? null,
    versionLabel: version?.versionLabel ?? null,
    checksum: version?.checksum ?? null,
    sourceCommit: /^[a-f0-9]{40}$/.test(process.env.SPATIAL_PILOT_SOURCE_SHA ?? "")
      ? process.env.SPATIAL_PILOT_SOURCE_SHA!
      : "UNAVAILABLE",
    studioHref: `/studio/parallax?chronicle=${tale.id}&block=${tale.id}:lens${moment?.definition?.id ? `&definition=${encodeURIComponent(moment.definition.id)}` : ""}`,
    journalHref: voyage ? `/player/playthroughs/${voyage.id}/journal` : null,
  };
}

/** Request-scoped Creator authority is retained by every spatial authoring service. */
export async function provisionPilot(ownerAccountId: string, origin: string, replay = false) {
  const running = preparing.get(ownerAccountId);
  if (running) return running;
  const operation = preparePilot(ownerAccountId, origin, replay);
  preparing.set(ownerAccountId, operation);
  try {
    return await operation;
  } finally {
    if (preparing.get(ownerAccountId) === operation) preparing.delete(ownerAccountId);
  }
}
async function preparePilot(ownerAccountId: string, origin: string, replay: boolean) {
  let existing = await readPilot(ownerAccountId);
  if (!existing) {
    await createStudioTale({ title: PILOT_TITLE, slug: PILOT_SLUG, creatorId: ownerAccountId });
    existing = await readPilot(ownerAccountId);
  }
  if (!existing) throw new Error("The pilot draft could not be created.");
  const taleId = existing.taleId;
  if (!existing.versionId) {
    // Retry reconstructs only the task-owned unpublished draft. Immutable editions are never replaced.
    const source = await getStudioTale(taleId);
    await saveStudioDraft(
      taleId,
      {
        ...source.draft,
        tale: {
          ...source.tale,
          title: PILOT_TITLE,
          theme: "CARTOGRAPHERS_TABLE",
          visibility: "PRIVATE",
          playerCountMin: 1,
          playerCountMax: 1,
          subtitle: "A promise beyond the last marked island",
          estimatedDuration: 25,
          shortDescription:
            "Follow Iona Morrow’s unfinished chart, carry the northern light across two horizons, and bring the lost home.",
        },
        landfall: pilotLandfall(taleId),
        chapters: pilotChapters(taleId),
      },
      ownerAccountId,
    );
    const spatial = createSpatialDraft(randomUUID(), "Peeking Letter", taleId);
    spatial.scope = "MY_LIBRARY";
    spatial.content.title = "Iona Morrow’s last parchment";
    spatial.content.entities[0].name = "The Navigator’s Message";
    spatial.content.entities[0].content =
      "The northern light is not a warning. It is a welcome. Carry my chart to the lighthouse; face the compass rose, and remember the harbor that was erased.";
    spatial.content.entities[0].alternativeText =
      "A parchment bearing Iona Morrow’s message. Inspect it in Guided View.";
    spatial.content.fallback.narrative = spatial.content.entities[0].content;
    const parchment = spatial.content.entities[0];
    parchment.widthMeters = 0.36;
    spatial.content.entities.push({
      ...structuredClone(parchment),
      id: `${spatial.content.definitionId}:compass`,
      kind: "MARKER",
      name: "Morrow’s Brass Compass",
      widthMeters: 0.18,
      transform: { ...structuredClone(parchment.transform), position: { x: 0.38, y: 0, z: 0 } },
      content: "N · The northern light welcomes the returning tide.",
      alternativeText: "A brass compass rose pointing toward the northern light.",
    });
    spatial.content.studio!.layers.push({
      entityId: spatial.content.entities[1].id,
      tags: ["bearing"],
      visible: true,
      locked: false,
      selectable: true,
      audience: "BOTH",
    });
    spatial.content.studio!.behaviors = [
      {
        id: `${spatial.content.definitionId}:read-bearing`,
        trigger: "INSPECT",
        sourceEntityId: parchment.id,
        delayMs: 0,
        targetEntityId: spatial.content.entities[1].id,
        action: "HIGHLIGHT",
      },
    ];
    const revision = await saveSpatialDraft(ownerAccountId, spatial, 0);
    const release = await releaseSpatialVersion(ownerAccountId, spatial.content.definitionId, revision);
    const current = await getStudioTale(taleId);
    await attachSpatialVersion({
      ownerAccountId,
      definitionId: spatial.content.definitionId,
      versionId: release.version.id,
      chronicleId: taleId,
      blockId: `${taleId}:lens`,
      autosaveVersion: current.draft.autosaveVersion,
    });
    const snapshot = snapshotFromStudio(await getStudioTale(taleId));
    const checksum = publishedSourceChecksum(snapshot);
    const scenarioId = `pilot-${randomUUID()}`;
    await saveDrydockScenario(taleId, {
      schemaVersion: 1,
      id: scenarioId,
      revision: 1,
      sourceChecksum: checksum,
      title: "The returning tide — complete accessible voyage",
      purpose: "Traverse every released Passage without optional hardware.",
      seed: PILOT_EDITION,
      initialState: { variables: {}, inventory: [], actorMode: "PLAYER" },
      environment: {
        virtualStart: "2026-10-11T12:00:00.000Z",
        locale: "en-US",
        viewport: "DESKTOP",
        reducedMotion: true,
        soundEnabled: false,
        keyboardOnly: true,
      },
      limits: { maxSteps: 100, maxStates: 100, maxTraceEntries: 1000, maxVirtualMilliseconds: 600000 },
      inputs: snapshot.chapters.flatMap((c) => c.blocks).map(() => ({ kind: "CONTINUE" })),
      faults: [],
      assertions: [{ kind: "RUN_COMPLETES" }, { kind: "IDEMPOTENCY_PRESERVED" }],
      tags: ["required:BASELINE_SUCCESS"],
    });
    const suiteId = `pilot-suite-${randomUUID()}`;
    await saveDrydockScenarioSuite(
      taleId,
      {
        schemaVersion: 1,
        id: suiteId,
        title: "Lost Navigator publication qualification",
        sourceChecksum: checksum,
        members: [{ scenarioId, revision: 1 }],
      },
      checksum,
    );
    await runDrydockScenarioSuite(taleId, suiteId, snapshot);
    await publishTale(
      taleId,
      ownerAccountId,
      "Complete synthetic Spatial Chronicle Pilot. Optional hardware preserves the authored screen path.",
    );
    existing = (await readPilot(ownerAccountId))!;
  }
  if (existing.voyageId && !replay) return existing;
  const voyage = await createPlaythroughAndInvitations(
    {
      taleId,
      versionId: existing.versionId!,
      voyageName: "The Returning Tide",
      captainParticipationMode: "CAPTAIN_AND_PLAYER",
      captainMode: "RULE_CONTROLLED",
      testVoyage: true,
      players: [],
    },
    ownerAccountId,
    origin,
  );
  await launchTalePlaythrough(voyage.playthroughId, ownerAccountId);
  return (await readPilot(ownerAccountId))!;
}
