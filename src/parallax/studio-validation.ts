import { versionContentSchema, type SpatialVersion } from "./contracts";
import { type DraftContent, worldTransform, previewEntityTransform } from "./authoring";
import { resolveAdaptiveScene } from "./adaptive";
import { syntheticEnvironmentEvidence } from "./adaptive-authoring";

export type SpatialFinding = {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
  entityId?: string;
  field: string;
};
export function validateSpatialAuthoring(input: DraftContent | SpatialVersion): SpatialFinding[] {
  const findings: SpatialFinding[] = [];
  const parsed = versionContentSchema.safeParse(
    "checksum" in input
      ? (({ checksum: _checksum, ...rest }) => {
          void _checksum;
          return rest;
        })(input)
      : input,
  );
  if (!parsed.success)
    return parsed.error.issues.map((i) => ({
      code: "PARALLAX_SCHEMA_INVALID",
      severity: "ERROR",
      message: i.message,
      field: i.path.join("."),
    }));
  const content = parsed.data;
  if (content.adaptive) {
    const a = content.adaptive;
    if (!a.revealOrder.length && content.entities.length > a.budget.maximumVisibleEntities)
      findings.push({
        code: "PARALLAX_STAGING_PERFORMANCE_BUDGET",
        severity: "ERROR",
        message: "Use sequential reveal or reduce simultaneous entities to the authored rendering budget.",
        field: "adaptive.budget",
      });
    for (const e of content.entities) {
      if (
        e.parentEntityId ||
        Math.hypot(e.transform.position.x, e.transform.position.y, e.transform.position.z) > 0.001
      )
        findings.push({
          code: "PARALLAX_ADAPTIVE_OFFSET_UNSAFE",
          severity: "ERROR",
          message:
            "Adaptive roots use reviewed semantic positions. Remove arbitrary offsets or use fixed on-site placement; group relationships belong in scene staging.",
          entityId: e.id,
          field: "transform.position",
        });
    }
  }
  for (const entity of content.entities) {
    const transform = worldTransform(content, entity.id);
    const width = transform.scale * entity.widthMeters;
    if (width < 0.02 || width > 5)
      findings.push({
        code: "PARALLAX_SCALE_UNSAFE",
        severity: "ERROR",
        message: "Effective object width must be between 2 cm and 5 m.",
        entityId: entity.id,
        field: "transform.scale",
      });
    if (transform.position.y < -0.1 || transform.position.y > 3)
      findings.push({
        code: "PARALLAX_HEIGHT_REVIEW",
        severity: "WARNING",
        message: "Check this object's height for seated reach and safe placement.",
        entityId: entity.id,
        field: "transform.position.y",
      });
    const layer = content.studio?.layers.find((l) => l.entityId === entity.id);
    if (
      layer &&
      !layer.visible &&
      !content.studio?.behaviors.some((b) => b.targetEntityId === entity.id && b.action === "SHOW") &&
      !content.studio?.animationTracks?.some(
        (t) => t.entityId === entity.id && t.enabled && t.property === "VISIBILITY" && t.keyframes.some((f) => f.value),
      ) &&
      !content.adaptive?.discovery.some((p) => p.entityId === entity.id && p.exactReveal)
    )
      findings.push({
        code: "PARALLAX_HIDDEN_UNREACHABLE",
        severity: "ERROR",
        message: "Hidden content needs a reveal behavior, visibility keyframe or visible Guided alternative.",
        entityId: entity.id,
        field: "studio.layers",
      });
  }
  for (const asset of content.studio?.assets ?? []) {
    // The accepted native renderer is a bounded plane/text renderer. Never imply GLB/audio support.
    findings.push({
      code: "PARALLAX_ASSET_RENDERER_UNAVAILABLE",
      severity: "ERROR",
      message:
        "Imported media requires a qualified renderer. Use built-in text, parchment or marker content for this release.",
      entityId: asset.entityId,
      field: "studio.assets",
    });
    if (
      (asset.kind === "TEXTURE" && !["PNG", "JPEG"].includes(asset.format)) ||
      (asset.kind === "MODEL" && asset.format !== "GLB") ||
      (asset.kind === "AUDIO" && !["MP3", "WAV"].includes(asset.format))
    )
      findings.push({
        code: "PARALLAX_ASSET_FORMAT_INVALID",
        severity: "ERROR",
        message: "Asset format does not match its content class.",
        entityId: asset.entityId,
        field: "studio.assets",
      });
    if (
      asset.triangles > 50000 ||
      asset.texturePixels > 4194304 ||
      asset.bytes > 10000000 ||
      asset.durationSeconds > 120
    )
      findings.push({
        code: "PARALLAX_ASSET_BUDGET_EXCEEDED",
        severity: "ERROR",
        message: "This dependency exceeds the baseline mid-tier asset budget.",
        entityId: asset.entityId,
        field: "studio.assets",
      });
  }
  if (content.entities.length > 24)
    findings.push({
      code: "PARALLAX_SCENE_BUDGET",
      severity: "WARNING",
      message: "More than 24 entities may exceed the mid-tier target. Preview estimates require device qualification.",
      field: "entities",
    });
  if ((content.studio?.visionReferences.length ?? 0) > 0)
    findings.push({
      code: "PARALLAX_VISION_PROVIDER_PENDING",
      severity: "WARNING",
      message:
        "Vision Waypoint references are pinned sibling-library declarations. Recognition remains Watchglass-owned and unavailable in this phase.",
      field: "studio.visionReferences",
    });
  return findings;
}

export const simulationEnvironments = [
  {
    id: "bedroom",
    name: "Bedroom",
    width: 4,
    depth: 4,
    horizontal: true,
    vertical: true,
    light: "NORMAL",
    clutter: 0.3,
    tracking: true,
  },
  {
    id: "living-room",
    name: "Living room",
    width: 6,
    depth: 5,
    horizontal: true,
    vertical: true,
    light: "NORMAL",
    clutter: 0.4,
    tracking: true,
  },
  {
    id: "dorm",
    name: "Small dorm",
    width: 2.5,
    depth: 3,
    horizontal: true,
    vertical: true,
    light: "LOW",
    clutter: 0.7,
    tracking: true,
  },
  {
    id: "office",
    name: "Office",
    width: 5,
    depth: 5,
    horizontal: true,
    vertical: true,
    light: "NORMAL",
    clutter: 0.2,
    tracking: true,
  },
  {
    id: "classroom",
    name: "Classroom",
    width: 9,
    depth: 7,
    horizontal: true,
    vertical: true,
    light: "NORMAL",
    clutter: 0.4,
    tracking: true,
  },
  {
    id: "gallery",
    name: "Gallery",
    width: 8,
    depth: 8,
    horizontal: true,
    vertical: true,
    light: "LOW",
    clutter: 0.1,
    tracking: true,
  },
  {
    id: "trail",
    name: "Outdoor trail",
    width: 3,
    depth: 12,
    horizontal: false,
    vertical: false,
    light: "NORMAL",
    clutter: 0.6,
    tracking: true,
  },
  {
    id: "plaza",
    name: "Plaza",
    width: 12,
    depth: 12,
    horizontal: true,
    vertical: false,
    light: "NORMAL",
    clutter: 0.1,
    tracking: true,
  },
  {
    id: "empty",
    name: "Empty room",
    width: 4,
    depth: 4,
    horizontal: false,
    vertical: true,
    light: "NORMAL",
    clutter: 0,
    tracking: false,
  },
  {
    id: "cluttered",
    name: "Cluttered room",
    width: 2,
    depth: 2,
    horizontal: true,
    vertical: true,
    light: "LOW",
    clutter: 0.9,
    tracking: false,
  },
] as const;
export function simulateSpatialEnvironments(content: DraftContent) {
  const issues = validateSpatialAuthoring(content);
  return simulationEnvironments.map((environment) => {
    if (content.adaptive) {
      const resolution = resolveAdaptiveScene(
        content,
        syntheticEnvironmentEvidence(environment),
        `studio-preview-${content.adaptive.variant}`,
      );
      return {
        ...environment,
        status: issues.some((i) => i.severity === "ERROR")
          ? "INVALID"
          : resolution.status === "RESOLVED"
            ? "VALID_PREVIEW"
            : "GUIDED_FALLBACK",
        reason: `${resolution.quality.replaceAll("_", " ")}; ${
          Object.values(resolution.placements)
            .map((p) => p.surface.toLowerCase())
            .join(", ") || "use accessible Guided View"
        }`,
        physicalQualification: "NOT_ESTABLISHED" as const,
        resolution,
      };
    }
    const noSurface = content.anchors.some(
      (a) =>
        a.kind === "SURFACE_RELATIVE" &&
        !(a.alignment === "HORIZONTAL" ? environment.horizontal : environment.vertical),
    );
    const outside = content.entities.some((e) => {
      const p = previewEntityTransform(content, e.id, environment.id, environment).position;
      return Math.abs(p.x) > environment.width / 2 || Math.abs(p.z) > environment.depth / 2;
    });
    const status = issues.some((i) => i.severity === "ERROR")
      ? "INVALID"
      : noSurface || outside || !environment.tracking
        ? "GUIDED_FALLBACK"
        : "VALID_PREVIEW";
    return {
      ...environment,
      status,
      reason: noSurface
        ? "No authored surface"
        : outside
          ? "Outside the reference room"
          : !environment.tracking
            ? "Insufficient tracking features"
            : "Authored fixed placement fits this synthetic room",
      physicalQualification: "NOT_ESTABLISHED" as const,
    };
  });
}
export function spatialPerformanceEstimate(content: DraftContent) {
  return {
    label: "ESTIMATE_ONLY",
    entities: content.entities.length,
    drawCalls: content.entities.length,
    triangles: content.entities.length * 2 + (content.studio?.assets.reduce((sum, a) => sum + a.triangles, 0) ?? 0),
    texturePixels: content.studio?.assets.reduce((sum, a) => sum + a.texturePixels, 0) ?? 0,
    target: "MID_TIER",
    physicalQualification: "NOT_ESTABLISHED",
  };
}
export function spatialStudioHref(definitionId: string, entityId?: string, chronicleId?: string, blockId?: string) {
  const query = new URLSearchParams({ definition: definitionId });
  if (entityId) query.set("entity", entityId);
  if (chronicleId) query.set("chronicle", chronicleId);
  if (blockId) query.set("block", blockId);
  return `/studio/parallax?${query}`;
}
