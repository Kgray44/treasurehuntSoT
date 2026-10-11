import { draftSchema, type SpatialDraft } from "./authoring";
import { defaultRecipe, defaultDiscovery, type SemanticRecipe, type AdaptiveContent } from "./adaptive-contracts";
import { identityTransform } from "./contracts";
import type { Candidate, EnvironmentEvidence } from "./adaptive";

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
    recipes: roots.map((e) => defaultRecipe(e.id)),
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
  return draftSchema.parse(draft);
}
export function updateAdaptiveContent(draft: SpatialDraft, adaptive: AdaptiveContent): SpatialDraft {
  return draftSchema.parse({ ...draft, content: { ...draft.content, adaptive } });
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
}): EnvironmentEvidence {
  const candidates: Candidate[] = [];
  const add = (
    id: string,
    surface: Candidate["surface"],
    x: number,
    y: number,
    z: number,
    context: Candidate["context"],
    safe = true,
  ) => {
    candidates.push({
      id,
      surface,
      context,
      region: context.includes("ENTRANCE") ? "ENTRANCE_REGION" : "CURRENT_ROOM",
      position: { x, y, z },
      normal: surface === "WALL" ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 },
      widthMeters: surface === "WALL" ? 2 : 1.2,
      depthMeters: 1.2,
      clearanceMeters: room.clutter > 0.8 ? 0.05 : 0.35,
      reachMeters: 1,
      visibility: 0.85,
      confidence: room.tracking ? 0.95 : 0.45,
      seatedReachable: y <= 1.3,
      safe,
      occluded: false,
    });
  };
  if (room.horizontal) {
    add("table-left", "TABLE", -room.width * 0.22, 0.75, -room.depth * 0.2, ["FURNITURE"]);
    add("desk-right", "DESK", room.width * 0.22, 0.8, -room.depth * 0.25, ["FURNITURE", "WINDOW"]);
    add("table-entry", "TABLE", room.width * 0.2, 0.7, room.depth * 0.22, ["FURNITURE", "ENTRANCE"]);
    add("shelf-entry", "SHELF", -room.width * 0.22, 1.1, room.depth * 0.22, ["FURNITURE", "ENTRANCE"]);
  }
  if (room.vertical) add("wall-window", "WALL", room.width * 0.3, 1.2, -room.depth * 0.45, ["WINDOW"]);
  if (room.tracking) {
    add("floor-furniture", "FLOOR", -room.width * 0.2, 0, -room.depth * 0.1, ["FURNITURE"]);
    add("free-space", "OPEN_SPACE", 0, 0.8, -room.depth * 0.3, []);
  }
  add("unsafe-walkway", "FLOOR", 0, 0, 0, ["WALKWAY", "ENTRANCE"], false);
  return {
    schemaVersion: 1,
    frameId: `synthetic-${room.id}`,
    source: "SIMULATED",
    reliableTracking: room.tracking,
    candidates,
  };
}
