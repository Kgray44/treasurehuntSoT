import { createHash, randomUUID } from "node:crypto";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";
import { db } from "../../../src/lib/db";
import type { LandfallDefinition } from "../../../src/landfall/schema";
import { validateLandfallDefinition } from "../../../src/landfall/definition";
import { landfallFixture } from "../../../src/landfall/fixtures";
import { createAccountSession } from "../../../src/wayfarer/accounts";
import { ingestAsset } from "../../../src/chronicle/assets";

export async function closureAccount(label: string) {
  const unique = randomUUID();
  const now = new Date();
  const user = await db.userAccount.create({
    data: {
      status: "ACTIVE",
      claimedAt: now,
      ordinaryWorkspaceEntryAt: now,
      profile: {
        create: {
          displayName: label,
          normalizedDisplayName: `${label.toLowerCase()} ${unique}`,
          status: "ACTIVE",
          claimedAt: now,
        },
      },
      emails: {
        create: {
          normalizedEmail: `${unique}@example.test`,
          displayEmail: `${unique}@example.test`,
          isPrimary: true,
          verificationState: "VERIFIED",
          verifiedAt: now,
        },
      },
    },
    include: { profile: true },
  });
  return {
    id: user.id,
    profileId: user.profile!.id,
    token: (await createAccountSession(user.id, "Synthetic Landfall final closure browser proof")).token,
  };
}
export type ClosureAccount = Awaited<ReturnType<typeof closureAccount>>;

export async function closureVoyage(
  owner: ClosureAccount,
  player: ClosureAccount,
  kind = "livingChart",
  options: {
    virtual?: boolean;
    image?: boolean;
    route?: boolean;
    captain?: boolean;
    contextual?: boolean;
    authoredDefinition?: LandfallDefinition;
    fusion?: boolean;
  } = {},
) {
  const suffix = randomUUID();
  const tale = await db.chronicle.create({
    data: {
      slug: `landfall-closure-${suffix}`,
      title: "Synthetic Landfall closure Voyage",
      creatorId: owner.profileId,
      creatorAccountId: owner.id,
      status: "PUBLISHED",
      visibility: "PRIVATE",
    },
  });
  let definition = structuredClone(landfallFixture);
  definition.taleId = tale.id;
  definition.waypoints[0].evidenceProfile.acceptedSources.push("PLAYER_CONFIRMATION");
  definition.waypoints[0].evidenceProfile.dwellSeconds = 0;
  definition.waypoints.push({
    ...structuredClone(definition.waypoints[0]),
    id: "town-second",
    name: "Second square",
    visibility: { hiddenUntilRevealed: false },
    sequence: { afterWaypointIds: [], optional: false },
  });
  definition.waypoints.push({
    ...structuredClone(definition.waypoints[0]),
    id: "town-hidden",
    name: "Withheld destination",
    visibility: { hiddenUntilRevealed: true },
    sequence: { afterWaypointIds: [], optional: false },
  });
  definition.routes.push({
    ...structuredClone(definition.routes[0]),
    id: "hidden-route",
    name: "Withheld route",
    model: "HIDDEN",
    waypointIds: ["town-hidden"],
  });
  if (options.route) definition.routes[0].waypointIds.push("town-second");
  if (options.captain) definition.routes[0].model = "FLEXIBLE";
  const assets = [];
  if (options.virtual) {
    definition.worldspaces = [definition.worldspaces[1], definition.worldspaces[0]];
    definition.waypoints[1].visibility.hiddenUntilRevealed = false;
    if (options.image) {
      const buffer = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#305060" } })
        .png()
        .toBuffer();
      const uploaded = await ingestAsset(
        tale.id,
        new File([new Uint8Array(buffer)], "synthetic-map.png", { type: "image/png" }),
        owner.id,
      );
      const asset = uploaded.asset;
      definition.maps[1].source = { type: "ASSET_IMAGE", assetId: asset.id };
      if (definition.worldspaces[0].coordinateReference.type === "NORMALIZED_IMAGE_2D")
        definition.worldspaces[0].coordinateReference.imageAssetId = asset.id;
      assets.push({
        id: asset.id,
        mediaType: asset.mediaType,
        displayName: "Synthetic virtual map",
        description: null,
        mimeType: asset.mimeType,
        width: 400,
        height: 300,
        roles: [],
        variants: asset.variants.map((variant) => ({
          id: variant.id,
          role: variant.role,
          checksum: variant.checksum,
          storageKey: variant.storageKey,
          mimeType: variant.mimeType,
        })),
      });
    } else {
      definition.maps[1].renderer = "VECTOR_2D";
      definition.maps[1].source = { type: "AUTHORED_VECTOR" };
    }
  }
  let worldspaceId = options.virtual ? "isles" : "town";
  let waypointId = options.virtual ? "isle-region" : "town-arrival";
  let routeId: string | undefined = options.virtual ? "isle-route" : "town-route";
  if (options.contextual) {
    const waypoint = definition.waypoints.find((item) => item.id === waypointId)!;
    waypoint.regionId = "synthetic-virtual-region";
    waypoint.evidenceProfile.acceptedSources.push("WATCHGLASS");
    definition.worldspaces
      .find((item) => item.id === worldspaceId)!
      .observationPolicy.allowedSources.push("WATCHGLASS");
    definition.context = {
      regions: [
        {
          id: waypoint.regionId,
          worldspaceId,
          mapId: waypoint.mapId,
          name: "Synthetic island context",
          kind: "SITE",
          geometry: structuredClone(waypoint.geometry),
          hiddenUntilRevealed: false,
          privacyClassification: "FICTIONAL",
        },
      ],
      landmarks: [],
    };
    if (assets.length) {
      waypoint.landmarkId = "synthetic-virtual-landmark";
      definition.context.landmarks.push({
        id: waypoint.landmarkId,
        regionId: waypoint.regionId,
        waypointId,
        name: "Synthetic island arch",
        privacyClassification: "FICTIONAL",
        referenceAssetIds: [assets[0].id],
        negativeReferenceAssetIds: [],
        minimumFrames: 2,
        guidance:
          "Observe the authored island arch; use the configured confirmation when visual verification is unavailable.",
        fallback: waypoint.fallback,
      });
    }
  }
  if (options.authoredDefinition) {
    definition = validateLandfallDefinition({ ...structuredClone(options.authoredDefinition), taleId: tale.id });
    worldspaceId = definition.worldspaces[0].id;
    waypointId = definition.waypoints[0].id;
    routeId = definition.routes[0]?.id;
  }
  if (options.fusion)
    definition.waypoints.find((item) => item.id === waypointId)!.evidenceProfile.fusionPolicy = {
      version: 1,
      minimumIndependentSources: 2,
    };
  const chapterId = `chapter-${suffix}`;
  const activeId = `active-${suffix}`;
  const nextId = `next-${suffix}`;
  const configuration: Record<string, unknown> = {
    heading: "Explore the chart",
    body: "Follow the released course",
    worldspaceId,
    waypointId,
    routeId,
  };
  if (kind === "locationObservation") {
    configuration.heading = "Reach the observation square";
    configuration.prompt = "Observe the carved bird and confirm what you found";
    delete configuration.body;
  }
  if (kind === "locationReveal") {
    configuration.targetType = "WAYPOINT";
    configuration.targetId = "town-hidden";
  }
  if (kind === "locationChoice") {
    configuration.prompt = "Choose a destination";
    configuration.choices = [
      { id: "hidden-choice", label: "Take the hidden course", targetBlockId: nextId, targetWaypointId: "town-hidden" },
    ];
    configuration.reversible = false;
  }
  const publishedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    tale: {
      id: tale.id,
      slug: tale.slug,
      title: tale.title,
      subtitle: null,
      shortDescription: null,
      longDescription: null,
      coverAssetId: null,
      theme: "CARTOGRAPHERS_TABLE",
      visibility: "PRIVATE",
      playerCountMin: 1,
      playerCountMax: 4,
      estimatedDuration: null,
      contentWarnings: null,
    },
    chapters: [
      {
        id: chapterId,
        title: "Closure passage",
        subtitle: null,
        description: null,
        coverAssetId: null,
        estimatedDuration: null,
        isOptional: false,
        metadata: {},
        orderIndex: 0,
        entryBlockId: activeId,
        completionBlockId: nextId,
        blocks: [
          {
            id: activeId,
            chapterId,
            blockType: kind,
            title: kind === "locationObservation" ? "Contextual observation" : "Living navigation",
            configuration,
            presentation: {},
            completion: {},
            orderIndex: 0,
            isEnabled: true,
            nextBlockId: nextId,
            connections:
              kind === "locationChoice"
                ? [{ targetBlockId: nextId, connectionType: "CHOICE", label: "Take the hidden course", orderIndex: 0 }]
                : [],
          },
          {
            id: nextId,
            chapterId,
            blockType: "taleComplete",
            title: "Voyage complete",
            configuration: {},
            presentation: {},
            completion: {},
            orderIndex: 1,
            isEnabled: true,
            nextBlockId: null,
            connections: [],
          },
        ],
      },
    ],
    assets,
    locations: [],
    artifacts: [],
    landfall: definition,
    publishedAt,
  };
  const contentSnapshot = JSON.stringify(snapshot);
  const version = await db.publishedTaleVersion.create({
    data: {
      taleId: tale.id,
      versionNumber: 1,
      versionLabel: "Synthetic closure v1",
      publishedBy: owner.id,
      contentSnapshot,
      checksum: createHash("sha256").update(contentSnapshot).digest("hex"),
      publishedAt: new Date(publishedAt),
    },
  });
  await db.chronicle.update({ where: { id: tale.id }, data: { latestPublishedVersionId: version.id } });
  const session = await db.taleSession.create({
    data: {
      taleId: tale.id,
      publishedVersionId: version.id,
      accessTokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
      status: "ACTIVE",
      currentChapterId: chapterId,
      currentBlockId: activeId,
      currentSequence: 1,
      launchedAt: new Date(),
      captainAccountId: options.captain ? owner.id : undefined,
    },
  });
  await db.playthroughMembership.create({
    data: {
      playthroughId: session.id,
      playerProfileId: player.profileId,
      status: "ACTIVE_MEMBER",
      joinedAt: new Date(),
    },
  });
  await db.taleSessionEvent.createMany({
    data: [
      { sequence: 1, eventType: "blockEntered", payload: JSON.stringify({ blockId: activeId, chapterId }) },
      { sequence: 2, eventType: "landfallWorldspaceEntered", payload: JSON.stringify({ worldspaceId }) },
      { sequence: 3, eventType: "landfallWaypointSelected", payload: JSON.stringify({ worldspaceId, waypointId }) },
      { sequence: 4, eventType: "landfallRouteSelected", payload: JSON.stringify({ worldspaceId, routeId }) },
    ].map((event) => ({
      ...event,
      sessionId: session.id,
      publishedVersionId: version.id,
      blockId: activeId,
      sourceType: "progression",
      idempotencyKey: randomUUID(),
    })),
  });
  await db.taleSession.update({ where: { id: session.id }, data: { currentSequence: 4 } });
  return { id: session.id, activeId, nextId, taleId: tale.id, versionId: version.id, definition };
}
export async function authenticateClosure(context: BrowserContext, account: ClosureAccount, baseURL: string) {
  await context.addCookies([{ name: "wayfarer_account", value: account.token, url: baseURL, sameSite: "Lax" }]);
}
export async function openClosureJournal(page: Page, id: string) {
  await page.goto(`/player/playthroughs/${id}/journal`);
  const opening = page.getByRole("dialog", { name: "Open the voyage journal" });
  await expect
    .poll(
      async () =>
        (await opening.isVisible()) || (await page.getByRole("navigation", { name: "Journal tools" }).isVisible()),
      { timeout: 45_000 },
    )
    .toBe(true);
  if (await opening.isVisible()) await opening.getByRole("button", { name: /Open the journal/u }).click();
  await expect(page.getByRole("navigation", { name: "Journal tools" })).toBeVisible();
}
export async function openClosureMap(page: Page) {
  await page
    .getByRole("navigation", { name: "Journal tools" })
    .getByRole("button", { name: "map", exact: true })
    .click();
  await expect(page.locator(".journal-objects-drawer [data-landfall-player-chart]")).toBeVisible();
}
export async function auditNativeGeolocation(context: BrowserContext) {
  await context.addInitScript(() => {
    const geo = navigator.geolocation;
    const watch = geo.watchPosition.bind(geo);
    const clear = geo.clearWatch.bind(geo);
    const audit = {
      calls: 0,
      cleared: 0,
      samples: 0,
      nativeSamples: 0,
      active: [] as number[],
      emit: null as PositionCallback | null,
    };
    Object.defineProperty(window, "__landfallGeoAudit", { value: audit });
    Object.defineProperty(geo, "watchPosition", {
      value: (success: PositionCallback, failure: PositionErrorCallback, options: PositionOptions) => {
        audit.calls++;
        audit.emit = (fix) => {
          audit.samples++;
          success(fix);
        };
        const id = watch(
          (fix) => {
            audit.nativeSamples++;
            audit.emit!(fix);
          },
          failure,
          options,
        );
        audit.active.push(id);
        return id;
      },
    });
    Object.defineProperty(geo, "clearWatch", {
      value: (id: number) => {
        audit.cleared++;
        audit.active = audit.active.filter((item) => item !== id);
        clear(id);
      },
    });
  });
}
export async function geoAudit(page: Page) {
  return page.evaluate(
    () =>
      (
        window as unknown as {
          __landfallGeoAudit: {
            calls: number;
            cleared: number;
            samples: number;
            nativeSamples: number;
            active: number[];
          };
        }
      ).__landfallGeoAudit,
  );
}
export async function qualifiedFollowUpFixes(page: Page) {
  expect((await geoAudit(page)).nativeSamples).toBeGreaterThan(0);
  // As in the accepted Phase 1 journey, native Chromium supplies the first fix.
  // Updating its override emits POSITION_UNAVAILABLE here. Deterministic follow-up
  // fixes use the retained watch callback and the real provider/runtime/server path.
  for (const latitude of [44, 44.000001]) {
    await page.waitForTimeout(300); // The provider requires at least 250ms between distinct samples.
    await page.evaluate((latitude) => {
      const audit = (window as unknown as { __landfallGeoAudit: { emit: PositionCallback | null } }).__landfallGeoAudit;
      audit.emit?.({
        coords: {
          latitude,
          longitude: -72,
          accuracy: 5,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    }, latitude);
  }
}
