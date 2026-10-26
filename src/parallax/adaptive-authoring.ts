import { findSurfacePlacement } from "./surface-placement";
import { draftSchema, type SpatialDraft } from "./authoring";
import { defaultRecipe, defaultDiscovery, type SemanticRecipe, type AdaptiveContent } from "./adaptive-contracts";
import { identityTransform } from "./contracts";
import type { EnvironmentEvidence } from "./adaptive";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "./room-geometry";
import type { RoomFeature } from "./environment-contracts";
export function enableAdaptiveAuthoring(input: SpatialDraft): SpatialDraft {
  const draft = structuredClone(input);
  if (draft.content.adaptive) return draft;
  const roots = draft.content.entities;
  for (const e of roots) delete e.parentEntityId;
  draft.content.placementPolicy = "ADAPTIVE_STICKY";
  draft.content.adaptive = {
    schemaVersion: 1,
    authoringApproach: "REMOTE_SEMANTIC",
    lifecycle: "DEFINITION",
    variation: "BEST_MATCH",
    variant: 0,
    recipes: roots.map((e) => {
      const recipe = defaultRecipe(e.id);
      const anchor = draft.content.anchors.find((a) => a.id === e.anchorId);
      if (anchor?.kind === "SURFACE_RELATIVE" && anchor.alignment === "VERTICAL") {
        recipe.preferredSurfaces = ["WALL"];
        recipe.alternateSurfaces = ["TABLE", "DESK", "SHELF"];
        recipe.preferredContext = [];
        recipe.maximumHeightMeters = 1.8;
        recipe.preferredHeightMeters = 1.4;
      }
      return recipe;
    }),
    relationships: [],
    revealOrder: [],
    budget: { maximumNodes: 1024, maximumCandidatesPerEntity: 12, maximumVisibleEntities: 16 },
    discovery: roots.map((e) => defaultDiscovery(e.id)),
    calibration: {
      enabled: false,
      maturity: "SEMANTIC",
      evidenceKind: "DERIVED_METADATA",
      automaticImages: false,
      retentionDays: 7,
    },
  };
  // Each independently staged root needs its own existing anchor frame.
  for (const root of roots) {
    const old = root.anchorId,
      anchorId = `${root.id}:semantic`;
    draft.content.anchors.push({
      id: anchorId,
      kind: "LOCAL_WORLD",
      frameId: "semantic-local-frame",
      transform: identityTransform(),
    });
    root.anchorId = anchorId;
    root.coordinateSpace = "LOCAL_SESSION";
    root.transform.position = { x: 0, y: 0, z: 0 };
    const reanchor = (id: string) =>
      draft.content.entities
        .filter((e) => e.parentEntityId === id)
        .forEach((e) => {
          e.anchorId = anchorId;
          reanchor(e.id);
        });
    reanchor(root.id);
    if (!draft.content.entities.some((e) => e.anchorId === old))
      draft.content.anchors = draft.content.anchors.filter((a) => a.id !== old);
  }
  if (draft.content.studio) delete draft.content.studio.surfacePreviewFrames;
  return draftSchema.parse(draft);
}
export function updateAdaptiveContent(draft: SpatialDraft, adaptive: AdaptiveContent): SpatialDraft {
  const next = structuredClone({ ...draft, content: { ...draft.content, adaptive } });
  if (JSON.stringify(draft.content.adaptive?.recipes) !== JSON.stringify(adaptive.recipes))
    invalidateAdaptiveCalibration(next);
  if (
    next.content.placementPolicy === "CALIBRATED" &&
    !["CALIBRATED", "VERIFIED"].includes(next.content.adaptive.calibration.maturity)
  )
    next.content.placementPolicy = "ADAPTIVE_STICKY";
  return draftSchema.parse(next);
}
/** Mutates an owned draft copy; changed placement intent needs a new evidence review. */
export function invalidateAdaptiveCalibration(draft: SpatialDraft) {
  if (!draft.content.adaptive) return;
  draft.content.adaptive.calibration.maturity = "SEMANTIC";
  delete draft.content.adaptive.calibration.reviewReceiptId;
  if (draft.content.placementPolicy === "CALIBRATED") draft.content.placementPolicy = "ADAPTIVE_STICKY";
}
/** Explicit, bounded phrase grammar; never presented as an unconfigured language model. */
export function interpretPlacementPhrase(
  phrase: string,
  entityId: string,
):
  | { status: "PROPOSED"; recipe: SemanticRecipe; explanation: string }
  | { status: "UNSUPPORTED"; explanation: string } {
  const input = phrase.trim().toLowerCase();
  const surfaceTokens: [RegExp, SemanticRecipe["preferredSurfaces"][number]][] = [
    [/\bfloor\b/, "FLOOR"],
    [/\btable\b/, "TABLE"],
    [/\bdesk\b/, "DESK"],
    [/\bshelf\b/, "SHELF"],
    [/\bwall\b/, "WALL"],
    [/\bfloating\b/, "OPEN_SPACE"],
  ];
  const surfaces = surfaceTokens.filter(([p]) => p.test(input)).map(([, s]) => s);
  if (!surfaces.length || input.length > 500 || /\b(ceiling|roof|underwater|fire|road|stair|face|person)\b/.test(input))
    return {
      status: "UNSUPPORTED",
      explanation:
        "This phrase is outside the supported placement vocabulary. Choose a surface and nearby context with the guided controls; no AI interpretation was performed.",
    };
  const r = defaultRecipe(entityId);
  r.preferredSurfaces = surfaces;
  r.alternateSurfaces = [];
  if (surfaces.includes("FLOOR")) {
    r.minimumHeightMeters = 0;
    r.maximumHeightMeters = 0.3;
    r.preferredHeightMeters = 0;
  }
  if (surfaces.includes("WALL")) {
    r.minimumHeightMeters = 0.4;
    r.maximumHeightMeters = 1.8;
    r.preferredHeightMeters = 1.2;
    r.orientation = "UPRIGHT";
  }
  r.preferredContext = /\bfurniture\b/.test(input)
    ? ["FURNITURE"]
    : /\b(entrance|doorway)\b/.test(input)
      ? ["ENTRANCE"]
      : /\bwindow\b/.test(input)
        ? ["WINDOW"]
        : [];
  if (/\b(entrance|doorway)\b/.test(input)) r.searchRegion = "ENTRANCE_REGION";
  r.relativePlacement = /\bright\b/.test(input)
    ? "RIGHT"
    : /\bleft\b/.test(input)
      ? "LEFT"
      : /\bedge\b/.test(input)
        ? "EDGE"
        : "CENTER";
  if (/\b(hidden|concealed|partly)\b/.test(input)) {
    r.concealment = "PARTIAL";
    r.minimumVisibility = 0.3;
  }
  return {
    status: "PROPOSED",
    recipe: r,
    explanation:
      "Supported phrase rules proposed these surfaces and relationships. Review the structured recipe before applying; walkway, stairs, obstacle and private-region exclusions remain enforced.",
  };
}
/** Privacy-safe synthetic fixtures: geometry here describes invented reference rooms only. */
export function syntheticEnvironmentEvidence(room: {
  id: string;
  width: number;
  depth: number;
  horizontal: boolean;
  vertical: boolean;
  tracking: boolean;
  clutter: number;
  features?: RoomFeature[];
  evidence?: EnvironmentEvidence;
}): EnvironmentEvidence {
  if (room.evidence) return structuredClone(room.evidence);
  const candidates = discoverRoomSurfaces(syntheticRoomGeometry(room), room);
  const floor = candidates.find((c) => c.surface === "FLOOR")!;
  // Whole-plane bounds and the safe furniture-side staging point have distinct purposes.
  floor.exclusions = [...(floor.exclusions ?? []), { x: 0, y: 0, width: 1.2, depth: 1.2 }];
  const staging = findSurfacePlacement({ ...identityTransform(), position: floor.position }, floor, 0.8);
  if (staging)
    floor.placementOffset = {
      x: staging.position.x - floor.position.x,
      y: 0,
      z: staging.position.z - floor.position.z,
    };
  // Keep placement targets separate from non-surface free-space and hazard regions.
  const template = candidates.find((c) => c.surface === "TABLE") ?? candidates[0];
  candidates.push({
    ...template,
    id: "unsafe-walkway",
    surface: "FLOOR",
    context: ["WALKWAY", "ENTRANCE"],
    region: "ENTRANCE_REGION",
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    widthMeters: 1.2,
    depthMeters: 1.2,
    safe: false,
  });
  if (room.tracking)
    candidates.push({
      ...template,
      id: "free-space",
      surface: "OPEN_SPACE",
      context: [],
      position: { x: 0, y: 0.8, z: -room.depth * 0.3 },
      normal: { x: 0, y: 1, z: 0 },
      widthMeters: 1.2,
      depthMeters: 1.2,
      safe: true,
    });
  return {
    schemaVersion: 1,
    frameId: `synthetic-${room.id}`,
    source: "SIMULATED",
    reliableTracking: room.tracking,
    viewerPosition: { x: 0, y: 1.2, z: room.depth * 0.35 },
    candidates,
  };
}
