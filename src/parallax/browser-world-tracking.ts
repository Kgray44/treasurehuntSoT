import { z } from "zod";
import type { CameraLease } from "@/sextant/camera";
import { resolvedTransformSchema, spatialId, type Transform } from "./contracts";
import type { TrackingRay } from "./browser-tracking-rays";

/** Provider data is ephemeral. Authored geometry and Chronicle progression never use engine map formats. */
export const browserTrackingSampleSchema = z.strictObject({
  sessionId: spatialId,
  timestampMs: z.number().finite().nonnegative(),
  method: z.enum(["VISUAL_INERTIAL_SLAM", "VISUAL_SLAM", "IMAGE_TARGET", "MARKER", "ORIENTATION", "GPS", "REPLAY"]),
  status: z.enum(["INITIALIZING", "TRACKING", "LIMITED", "LOST", "SUSPENDED"]),
  confidence: z.enum(["NONE", "ROTATION_ONLY", "POSITION_NO_SCALE", "METRIC_6DOF"]),
  // +Y up, camera looks -Z; pose of camera in the provider's session frame.
  sessionFromCamera: resolvedTransformSchema.nullable(),
  reason: z.string().max(300),
});
export type BrowserTrackingSample = z.infer<typeof browserTrackingSampleSchema>;
export type BrowserTrackingPlane = {
  id: string;
  transform: Transform;
  alignment: "HORIZONTAL" | "VERTICAL";
  width: number;
  depth: number;
  evidence: "DETECTED" | "ESTIMATED";
};
export interface BrowserWorldTrackingProvider {
  readonly providerId: string;
  readonly version: string;
  readonly method: BrowserTrackingSample["method"];
  read(): BrowserTrackingSample | null;
  cameraIntrinsics(): { width: number; height: number; focal: number } | null;
  /** Column-major WebGL projection for the displayed camera viewport, including SDK crop/intrinsics. */
  cameraProjection?(width: number, height: number, near: number, far: number): ArrayLike<number> | null;
  ray(normalizedX: number, normalizedY: number): TrackingRay | null;
  start(input: {
    lease: CameraLease;
    video: HTMLVideoElement;
    motionGranted: boolean;
    signal: AbortSignal;
    sample: (sample: BrowserTrackingSample) => void;
  }): Promise<void>;
  planes(): readonly BrowserTrackingPlane[];
  hitTest(normalizedX: number, normalizedY: number): Transform | null;
  stop(): Promise<void>;
}

/** Rotation, target tracking, GPS and prerecorded poses must never be called live world tracking. */
export function hasLiveWorldPose(raw: unknown, nowMs: number, sessionId: string): raw is BrowserTrackingSample {
  const parsed = browserTrackingSampleSchema.safeParse(raw);
  if (!parsed.success) return false;
  const s = parsed.data;
  return (
    s.sessionId === sessionId &&
    Number.isFinite(nowMs) &&
    nowMs >= s.timestampMs &&
    nowMs - s.timestampMs <= 500 &&
    ["VISUAL_INERTIAL_SLAM", "VISUAL_SLAM"].includes(s.method) &&
    s.status === "TRACKING" &&
    ["POSITION_NO_SCALE", "METRIC_6DOF"].includes(s.confidence) &&
    s.sessionFromCamera !== null &&
    s.sessionFromCamera.scale === 1
  );
}

const pointSchema = resolvedTransformSchema.shape.position;
export const roomAlignmentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  trackingSessionId: spatialId,
  versionChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  semanticFeatureId: spatialId,
  sessionFromScene: resolvedTransformSchema,
  scaleBasis: z.literal("ROOM_POINT_CORRESPONDENCES"),
  trackingScale: z.enum(["RELATIVE", "METRIC"]),
  normalizedResidual: z.number().finite().nonnegative().max(0.025),
});
export type RoomAlignment = z.infer<typeof roomAlignmentSchema>;
type Point = z.infer<typeof pointSchema>;

/** Fit a gravity-aligned similarity from three corresponding room/physical points, usually tabletop corners.
 * No known measurement is required. Relative tracker units are labeled explicitly, never declared metres.
 */
export function alignRoomPoints(input: {
  sample: BrowserTrackingSample;
  nowMs: number;
  versionChecksum: string;
  semanticFeatureId: string;
  points: readonly { scene: Point; tracked: Point }[];
}): RoomAlignment {
  if (!hasLiveWorldPose(input.sample, input.nowMs, input.sample.sessionId))
    throw new Error("PARALLAX_ALIGNMENT_LIVE_WORLD_POSE_REQUIRED");
  if (input.points.length !== 3) throw new Error("PARALLAX_ALIGNMENT_THREE_POINTS_REQUIRED");
  const pairs = input.points.map(({ scene, tracked }) => ({
    scene: pointSchema.parse(scene),
    tracked: pointSchema.parse(tracked),
  }));
  const mean = (key: "scene" | "tracked"): Point => ({
    x: pairs.reduce((v, p) => v + p[key].x, 0) / 3,
    y: pairs.reduce((v, p) => v + p[key].y, 0) / 3,
    z: pairs.reduce((v, p) => v + p[key].z, 0) / 3,
  });
  const a = mean("scene"),
    b = mean("tracked");
  const extent = (key: "scene" | "tracked") =>
    Math.max(
      ...pairs.flatMap((p, i) => pairs.slice(i + 1).map((q) => Math.hypot(p[key].x - q[key].x, p[key].z - q[key].z))),
    );
  const sceneExtent = extent("scene"),
    trackedExtent = extent("tracked");
  const area = (key: "scene" | "tracked") => {
    const [p, q, r] = pairs.map((pair) => pair[key]);
    return (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  };
  if (
    sceneExtent < 0.15 ||
    trackedExtent < 0.01 ||
    Math.abs(area("scene")) / sceneExtent ** 2 < 0.05 ||
    Math.abs(area("tracked")) / trackedExtent ** 2 < 0.05 ||
    area("scene") * area("tracked") <= 0
  )
    throw new Error("PARALLAX_ALIGNMENT_DISTINCT_ORDERED_CORNERS_REQUIRED");
  let dot = 0,
    cross = 0,
    denominator = 0;
  for (const p of pairs) {
    const sx = p.scene.x - a.x,
      sz = p.scene.z - a.z,
      tx = p.tracked.x - b.x,
      tz = p.tracked.z - b.z;
    dot += sx * tx + sz * tz;
    cross += sz * tx - sx * tz;
    denominator += sx * sx + sz * sz;
  }
  const yaw = Math.atan2(cross, dot),
    scale = Math.hypot(dot, cross) / denominator;
  if (scale < 0.01 || scale > 100) throw new Error("PARALLAX_ALIGNMENT_SCALE_OUT_OF_RANGE");
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const sessionFromScene: Transform = {
    position: { x: b.x - scale * (c * a.x + s * a.z), y: b.y - scale * a.y, z: b.z - scale * (-s * a.x + c * a.z) },
    rotation: { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) },
    scale,
  };
  const residual =
    Math.max(
      ...pairs.map(({ scene, tracked }) =>
        Math.hypot(
          sessionFromScene.position.x + scale * (c * scene.x + s * scene.z) - tracked.x,
          sessionFromScene.position.y + scale * scene.y - tracked.y,
          sessionFromScene.position.z + scale * (-s * scene.x + c * scene.z) - tracked.z,
        ),
      ),
    ) / trackedExtent;
  if (residual > 0.025) throw new Error("PARALLAX_ALIGNMENT_CORNERS_DISAGREE");
  return roomAlignmentSchema.parse({
    schemaVersion: 1,
    trackingSessionId: input.sample.sessionId,
    versionChecksum: input.versionChecksum,
    semanticFeatureId: input.semanticFeatureId,
    sessionFromScene,
    scaleBasis: "ROOM_POINT_CORRESPONDENCES",
    trackingScale: input.sample.confidence === "METRIC_6DOF" ? "METRIC" : "RELATIVE",
    normalizedResidual: residual,
  });
}

export function alignmentApplies(
  alignment: RoomAlignment,
  sample: BrowserTrackingSample,
  nowMs: number,
  versionChecksum: string,
): boolean {
  return (
    roomAlignmentSchema.safeParse(alignment).success &&
    alignment.versionChecksum === versionChecksum &&
    alignment.trackingScale === (sample.confidence === "METRIC_6DOF" ? "METRIC" : "RELATIVE") &&
    hasLiveWorldPose(sample, nowMs, alignment.trackingSessionId)
  );
}
