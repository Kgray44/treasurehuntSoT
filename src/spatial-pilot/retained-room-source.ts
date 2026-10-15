import type { RoomObservation } from "@/watchglass/room-observation";

/** Preserve the observation's zero-based photograph indices as opaque retained
 * source references. This binds metadata; it neither reads photographs nor
 * upgrades estimated reconstruction to accepted physical geometry. */
export function retainedRoomSourceIds(observation: RoomObservation, digest: string) {
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("Retained room source digest is invalid.");
  const indices = observation.features.flatMap((feature) =>
    [
      ...(feature.orientationEvidence ?? []),
      ...(feature.facingEvidence ?? []),
      ...(feature.chairSideEvidence ?? []),
    ].map((evidence) => evidence.imageIndex),
  );
  if (indices.some((index) => !Number.isInteger(index) || index < 0 || index > 1))
    throw new Error("Retained room source view index is invalid.");
  const count = Math.max(1, ...indices.map((index) => index + 1));
  return Array.from({ length: count }, (_, index) => `reviewed-room-observation-${digest.slice(0, 24)}-view-${index}`);
}
