import { identityTransform, type Anchor, type SpatialVersion, type Transform } from "./contracts";
import type { Candidate, EnvironmentEvidence } from "./adaptive";
import type { RoomFeature } from "./environment-contracts";
import { discoverRoomSurfaces, syntheticRoomGeometry } from "./room-geometry";
import { surfaceFrameRotation } from "./runtime-placement";

type PreviewRoom = {
  id: string;
  width: number;
  depth: number;
  horizontal: boolean;
  vertical: boolean;
  features?: RoomFeature[];
  evidence?: EnvironmentEvidence;
};

function referenceSurfaceFrame(anchor: Anchor, room: PreviewRoom, surfaces?: readonly Candidate[]): Transform {
  if (anchor.kind !== "SURFACE_RELATIVE") return identityTransform();
  const planes =
    surfaces ??
    room.evidence?.candidates ??
    discoverRoomSurfaces(syntheticRoomGeometry(room), { tracking: true, clutter: 0 });
  const available = room.evidence ? planes.filter((candidate) => candidate.safe && !candidate.occluded) : planes;
  const chosen = room.evidence
    ? anchor.alignment === "VERTICAL"
      ? available.find((candidate) => candidate.surface === "WALL" && Math.abs(candidate.normal.y) < 0.2)
      : (available.find(
          (candidate) => ["TABLE", "DESK", "SHELF"].includes(candidate.surface) && candidate.normal.y > 0.9,
        ) ?? available.find((candidate) => candidate.surface === "FLOOR" && candidate.normal.y > 0.9))
    : anchor.alignment === "VERTICAL"
      ? planes.find((candidate) => candidate.id === "wall-window")
      : (planes.find((candidate) => candidate.id === "reference-desk") ??
        planes.find((candidate) => candidate.safe && ["TABLE", "DESK", "SHELF"].includes(candidate.surface)) ??
        planes.find((candidate) => candidate.surface === "FLOOR"));
  if (room.evidence && !chosen)
    throw new Error(
      "The pinned Environment has no usable support for this surface-relative object. Review its surfaces before opening the Scene.",
    );
  return {
    ...identityTransform(),
    position: chosen?.position ?? { x: 0, y: 1.4, z: -room.depth / 2 + 0.06 },
    rotation:
      (chosen ? surfaceFrameRotation(chosen) : undefined) ??
      (anchor.alignment === "HORIZONTAL"
        ? { x: -Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 }
        : identityTransform().rotation),
  };
}

/** Consumer-only frame resolution keeps the native Lens bundle clear of authoring and Library services. */
export function browserReferenceFrame(
  content: Pick<SpatialVersion, "studio">,
  anchor: Anchor,
  environmentId: string,
  room: PreviewRoom,
): Transform {
  const frame = content.studio?.surfacePreviewFrames?.find(
    (item) => item.anchorId === anchor.id && item.environmentId === environmentId,
  );
  if (frame && (room.features || room.evidence)) {
    const surface = (
      room.evidence?.candidates ?? discoverRoomSurfaces(syntheticRoomGeometry(room), { tracking: true, clutter: 0 })
    ).find((candidate) => candidate.id === frame.surfaceId);
    if (
      room.evidence &&
      (!surface ||
        !surface.safe ||
        surface.occluded ||
        ["OPEN_SPACE", "DEVICE"].includes(surface.surface) ||
        (anchor.kind === "SURFACE_RELATIVE" && anchor.alignment === "VERTICAL"
          ? Math.abs(surface.normal.y) >= 0.2
          : surface.normal.y <= 0.9))
    )
      throw new Error(
        "The pinned Environment no longer has this object's usable support. Review its surface attachment before opening the Scene.",
      );
    if (surface) return { position: surface.position, rotation: surfaceFrameRotation(surface), scale: 1 };
  }
  return frame ? { position: frame.position, rotation: frame.rotation, scale: 1 } : referenceSurfaceFrame(anchor, room);
}
