import { createHash } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";
import sharp from "sharp";
import { db } from "../../../src/lib/db";
import { compactSiteFixture } from "../../../src/landfall/compact-fixtures";
import { ingestAsset } from "../../../src/chronicle/assets";
import { validateLandfallDefinition } from "../../../src/landfall/definition";
import { closureVoyage, type ClosureAccount } from "./landfall-closure";

const colours = ["#123456", "#edc844", "#a82d47", "#46a4c4"];
const referenceSvg = (negative: boolean) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240">${colours.map((colour, i) => `<rect x="${(i % 2) * 160}" y="${Math.floor(i / 2) * 120}" width="160" height="120" fill="${colours[negative ? 3 - i : i]}"/>`).join("")}</svg>`;

/** All mutation happens before opening these synthetic editions; real Player controls own progression. */
export async function phase3Voyage(
  owner: ClosureAccount,
  player: ClosureAccount,
  options: {
    kind?: "MUSEUM" | "GARDEN";
    start?: "arrival" | "landmark" | "observation";
    captain?: boolean;
    short?: boolean;
    floorOverlays?: boolean;
  } = {},
) {
  const seed = await closureVoyage(owner, player, "waypointJourney", { captain: options.captain });
  const definition = compactSiteFixture(options.kind ?? "MUSEUM");
  definition.taleId = seed.taleId;
  if (options.start && options.start !== "arrival") {
    // Focused suffix scenarios publish only their remaining ordered route
    // checkpoints. The full museum retains the complete route and must visit
    // its earlier checkpoints through the production controls.
    const startWaypoint = options.start === "landmark" ? "compact-landmark-target" : "compact-observation";
    const route = definition.routes[0];
    route.waypointIds = route.waypointIds.slice(route.waypointIds.indexOf(startWaypoint));
  }
  const version = await db.publishedTaleVersion.findUniqueOrThrow({ where: { id: seed.versionId } });
  const snapshot = JSON.parse(version.contentSnapshot);
  for (const negative of [false, true]) {
    const bytes = await sharp(Buffer.from(referenceSvg(negative)))
      .png()
      .toBuffer();
    const { asset } = await ingestAsset(
      seed.taleId,
      new File([new Uint8Array(bytes)], `synthetic-${negative ? "negative" : "mural"}.png`, { type: "image/png" }),
      owner.id,
    );
    snapshot.assets.push({
      id: asset.id,
      mediaType: asset.mediaType,
      displayName: negative ? "Synthetic negative reference" : "Synthetic mural reference",
      description: null,
      mimeType: asset.mimeType,
      width: 320,
      height: 240,
      roles: [],
      variants: asset.variants.map((variant) => ({
        id: variant.id,
        role: variant.role,
        checksum: variant.checksum,
        storageKey: variant.storageKey,
        mimeType: variant.mimeType,
      })),
    });
    if (negative) definition.context!.landmarks[0].negativeReferenceAssetIds = [asset.id];
    else definition.context!.landmarks[0].referenceAssetIds = [asset.id];
  }
  if (options.floorOverlays) {
    for (const map of definition.maps) {
      const bytes = await sharp(Buffer.from(referenceSvg(map.level === "Upper")))
        .png()
        .toBuffer();
      const { asset } = await ingestAsset(
        seed.taleId,
        new File([new Uint8Array(bytes)], `synthetic-floor-${map.id}.png`, { type: "image/png" }),
        owner.id,
      );
      snapshot.assets.push({
        id: asset.id,
        mediaType: asset.mediaType,
        displayName: `Synthetic ${map.level} floor`,
        description: null,
        mimeType: asset.mimeType,
        width: 320,
        height: 240,
        roles: [],
        variants: asset.variants.map((variant) => ({
          id: variant.id,
          role: variant.role,
          checksum: variant.checksum,
          storageKey: variant.storageKey,
          mimeType: variant.mimeType,
        })),
      });
      map.overlays = [
        {
          id: `overlay-${map.id}`,
          assetId: asset.id,
          bounds: { west: -72.001, east: -71.999, south: 43.999, north: 44.001 },
          opacity: 0.75,
          hiddenUntilRevealed: false,
          attributionLabel: `Synthetic ${map.level} floor map`,
          attributionUrl: "https://example.invalid/synthetic-floor",
          privacyClassification: "PRIVATE_REAL_WORLD",
        },
      ];
      map.offlinePolicy = "OFFLINE_PARTIAL";
    }
  }
  const chapter = snapshot.chapters[0];
  const prototype = chapter.blocks[0];
  const stages = options.short
    ? ["compact-arrival"]
    : ["compact-arrival", "compact-door", "compact-room", "compact-landmark-target", "compact-observation"];
  const ids = Object.fromEntries(
    stages.map((waypointId, index) => [waypointId, index === 0 ? seed.activeId : `${seed.activeId}-stage-${index}`]),
  );
  const blocks = stages.map((waypointId, index) => {
    const waypoint = definition.waypoints.find((item) => item.id === waypointId)!;
    const observation = waypointId === "compact-observation";
    return {
      ...prototype,
      id: ids[waypointId],
      title: waypoint.name,
      orderIndex: index,
      blockType: observation ? "locationObservation" : "waypointJourney",
      configuration: {
        heading: waypoint.name,
        worldspaceId: "town",
        waypointId,
        routeId: "compact-route",
        ...(observation
          ? {
              prompt: "Read the plaque: which word sits below the Lantern?",
              completionMode: "textAnswer",
              acceptedAnswers: ["harbour"],
              normalizeWhitespace: true,
              caseSensitive: false,
            }
          : { body: "Follow the released museum course." }),
      },
      completion: observation
        ? { mode: "textAnswer" }
        : {
            mode: "landfall",
            provider: {
              id: "landfall",
              version: 1,
              options: {
                worldspaceId: "town",
                locationId: waypointId,
                requiredOutcome: waypoint.completion.requiredOutcome,
                allowCaptainOverride: true,
                allowPlayerFallback: true,
                replayPolicy: "PRESENTATION_ONLY",
              },
            },
          },
      nextBlockId: stages[index + 1] ? ids[stages[index + 1]] : seed.nextId,
    };
  });
  chapter.blocks = [...blocks, { ...chapter.blocks[1], orderIndex: blocks.length }];
  snapshot.landfall = validateLandfallDefinition(definition);
  const contentSnapshot = JSON.stringify(snapshot);
  await db.publishedTaleVersion.update({
    where: { id: seed.versionId },
    data: { contentSnapshot, checksum: createHash("sha256").update(contentSnapshot).digest("hex") },
  });
  const startWaypoint =
    options.start === "landmark"
      ? "compact-landmark-target"
      : options.start === "observation"
        ? "compact-observation"
        : "compact-arrival";
  const activeId = ids[startWaypoint];
  await db.taleSession.update({ where: { id: seed.id }, data: { currentBlockId: activeId } });
  const initialEvents = await db.taleSessionEvent.findMany({ where: { sessionId: seed.id } });
  for (const event of initialEvents) {
    const payload =
      event.eventType === "blockEntered"
        ? { blockId: activeId, chapterId: chapter.id }
        : event.eventType === "landfallRouteSelected"
          ? { worldspaceId: "town", routeId: "compact-route" }
          : event.eventType === "landfallWaypointSelected"
            ? { worldspaceId: "town", waypointId: startWaypoint }
            : { worldspaceId: "town" };
    await db.taleSessionEvent.update({
      where: { id: event.id },
      data: { blockId: activeId, payload: JSON.stringify(payload) },
    });
  }
  return { ...seed, activeId, ids, definition };
}

export const compactPosition = (x: number, y: number, accuracy = 5) => ({
  latitude: 44 + y / 111000,
  longitude: -72 + x / 80000,
  accuracy,
});

/** Keeps the actual foreground provider and server path; only the hardware signal is synthetic. */
export async function emitCompactFix(page: Page, x: number, y: number, accuracy = 5) {
  await page.waitForTimeout(300);
  await page.evaluate(
    (position) => {
      const audit = (window as unknown as { __landfallGeoAudit: { emit: PositionCallback | null } }).__landfallGeoAudit;
      audit.emit?.({
        coords: { ...position, altitude: null, altitudeAccuracy: null, heading: null, speed: null },
        timestamp: Date.now(),
      } as GeolocationPosition);
    },
    compactPosition(x, y, accuracy),
  );
}

/** The production camera UI still acquires, captures multiple frames, posts and receives a signed server result. */
export async function syntheticLandmarkCamera(context: BrowserContext) {
  await context.addInitScript((palette) => {
    const audit = { calls: 0, stopped: 0, frames: 0, negative: true };
    Object.defineProperty(window, "__landfallCameraAudit", { value: audit });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        audit.calls++;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        canvas.getContext("2d")!.fillRect(0, 0, 320, 240);
        const stream = canvas.captureStream(1);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => {
            audit.stopped++;
            stop();
          };
        }
        return stream;
      },
    });
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (
      this: CanvasRenderingContext2D,
      ...args: Parameters<CanvasRenderingContext2D["drawImage"]>
    ) {
      if (args[0] instanceof HTMLVideoElement) {
        audit.frames++;
        const width = this.canvas.width / 2,
          height = this.canvas.height / 2;
        palette.forEach((colour, i) => {
          // Consecutive synthetic stills vary slightly in brightness, as a
          // steady live view does. Duplicate decoded frames must not supply
          // independent evidence to the protected multi-frame comparator.
          const viewColour = palette[audit.negative ? 3 - i : i];
          const brightness = audit.frames % 2 ? -2 : 2;
          const channels = [1, 3, 5].map((offset) =>
            Math.max(0, Math.min(255, Number.parseInt(viewColour.slice(offset, offset + 2), 16) + brightness)),
          );
          this.fillStyle = `rgb(${channels.join(",")})`;
          this.fillRect((i % 2) * width, Math.floor(i / 2) * height, width, height);
        });
        return;
      }
      return Reflect.apply(drawImage, this, args);
    } as CanvasRenderingContext2D["drawImage"];
  }, colours);
}
