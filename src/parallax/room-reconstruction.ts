import { roomObservationSchema, type RoomObservation } from "@/watchglass/room-observation";
import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { createGenericRoomFeature } from "./parametric-room";
import { syntheticRoomGeometry } from "./room-geometry";
import { verifyConstructedEnvironment } from "./construction-verification";

export class RoomReconstructionError extends Error {}
const shell = new Set<RoomFeature["classification"]>(["FLOOR", "WALL", "CEILING"]);
const fail = (message: string): never => {
  throw new RoomReconstructionError(message);
};

/** Deterministic Parallax mapping of bounded Watchglass evidence into ordinary editable room data.
 * The caller must authorize each opaque source before perception. No image/URL enters this mapper.
 * Returning a proposal never writes the current scene or overrides Creator-confirmed corrections.
 */
export function reconstructRoomFromObservation(input: {
  observation: RoomObservation;
  roomId: string;
  sourceMediaIds: string[];
  existing?: RoomEnvironment;
  sharedFeatureId?: string;
}): { status: "PROPOSED"; room: RoomEnvironment; warnings: string[] } | { status: "CLARIFICATION"; message: string } {
  const observation = roomObservationSchema.parse(input.observation);
  if (observation.status !== "OBSERVED")
    return { status: "CLARIFICATION", message: observation.clarification ?? observation.explanation };
  if (!input.sourceMediaIds.length || input.sourceMediaIds.length > 8)
    fail("Room perception needs one to eight authorized image references.");
  const existing = input.existing ? roomEnvironmentSchema.parse(input.existing) : undefined;
  if (existing) {
    if (existing.id !== input.roomId) fail("Refinement must use the same owned room identity.");
    if (
      observation.alignment !== "EXISTING_ROOM_FRAME" ||
      !input.sharedFeatureId ||
      observation.sharedFeatureId !== input.sharedFeatureId ||
      !existing.features.some((feature) => feature.id === input.sharedFeatureId) ||
      !observation.features.some(
        (feature) => feature.matchedFeatureId === input.sharedFeatureId && feature.confidence >= 0.6,
      )
    )
      return {
        status: "CLARIFICATION",
        message: "Identify a shared room feature and its relationship to this view before combining the images.",
      };
  } else if (observation.alignment !== "INITIAL_ROOM" || observation.sharedFeatureId !== null)
    fail("The first image must establish an initial approximate room frame.");
  const warnings = [
    ...observation.uncertainties,
    "Dimensions and hidden geometry are estimates. Correct one known measurement before relying on scale.",
  ];
  // An additional view refines feature evidence; it never silently rescales an already edited room.
  const [width, height, depth] = existing
    ? [existing.width, existing.height, existing.depth]
    : observation.roomDimensions;
  const features = existing ? structuredClone(existing.features) : [];
  const matched = new Set<string>();
  const base = input.roomId.slice(0, 64);
  const evidence = (basis: RoomFeature["provenance"]["basis"], confidence: number): RoomFeature["provenance"] => ({
    basis,
    confidence,
    sourceMediaIds: input.sourceMediaIds,
  });
  if (!existing) {
    // The complete shell is inferred, even when a photograph shows only two faces.
    const shellParts: {
      suffix: string;
      classification: RoomFeature["classification"];
      dimensions: RoomFeature["dimensions"];
      position: RoomFeature["position"];
      yawDegrees?: number;
    }[] = [
      {
        suffix: "floor",
        classification: "FLOOR",
        dimensions: [width, 0.12, depth],
        position: { x: 0, y: -0.06, z: 0 },
      },
      {
        suffix: "back-wall",
        classification: "WALL",
        dimensions: [width, height, 0.12],
        position: { x: 0, y: height / 2, z: -depth / 2 },
      },
      {
        suffix: "front-wall",
        classification: "WALL",
        dimensions: [width, height, 0.12],
        position: { x: 0, y: height / 2, z: depth / 2 },
        yawDegrees: 180,
      },
      {
        suffix: "left-wall",
        classification: "WALL",
        dimensions: [depth, height, 0.12],
        position: { x: -width / 2, y: height / 2, z: 0 },
        yawDegrees: 90,
      },
      {
        suffix: "right-wall",
        classification: "WALL",
        dimensions: [depth, height, 0.12],
        position: { x: width / 2, y: height / 2, z: 0 },
        yawDegrees: -90,
      },
      {
        suffix: "ceiling",
        classification: "CEILING",
        dimensions: [width, 0.08, depth],
        position: { x: 0, y: height + 0.04, z: 0 },
      },
    ];
    features.push(
      ...shellParts.map((part) =>
        createGenericRoomFeature({
          ...part,
          id: `${base}:${part.suffix}`,
          name: part.suffix.replaceAll("-", " "),
          provenance: evidence("INFERRED", 0.4),
        }),
      ),
    );
  }
  observation.features.forEach((observationFeature, index) => {
    // Shell construction is canonical rather than arbitrary model-supplied fragments.
    if (shell.has(observationFeature.classification)) return;
    const old = observationFeature.matchedFeatureId
      ? features.find((f) => f.id === observationFeature.matchedFeatureId)
      : undefined;
    if (observationFeature.matchedFeatureId && (!existing || !old || matched.has(old.id)))
      fail("The additional image has an unknown or repeated feature match. Clarify its room relationship.");
    if (old) matched.add(old.id);
    if (old && (old.provenance.basis === "CREATOR_CONFIRMED" || old.id === existing?.scaleReference?.featureId)) {
      warnings.push(`Kept your confirmed ${old.name}; image estimates do not overwrite it.`);
      return;
    }
    if (old && old.classification !== observationFeature.classification)
      fail("A matched feature has a different type. Correct its classification manually before refinement.");
    const { x, y, z } = observationFeature.position;
    const yaw = (observationFeature.yawDegrees * Math.PI) / 180;
    const [w, h, d] = observationFeature.dimensions;
    const halfX = (Math.abs(Math.cos(yaw)) * w + Math.abs(Math.sin(yaw)) * d) / 2;
    const halfZ = (Math.abs(Math.sin(yaw)) * w + Math.abs(Math.cos(yaw)) * d) / 2;
    const attachedOpening = ["DOOR", "WINDOW"].includes(observationFeature.classification);
    if (
      !attachedOpening &&
      (Math.abs(x) + halfX > width / 2 + 0.01 ||
        Math.abs(z) + halfZ > depth / 2 + 0.01 ||
        y - h / 2 < -0.01 ||
        y + h / 2 > height + 0.01)
    )
      fail("An estimated furnishing falls outside the room. Clarify dimensions or the image alignment.");
    if (
      attachedOpening &&
      (Math.abs(x) + halfX > width / 2 + 0.15 ||
        Math.abs(z) + halfZ > depth / 2 + 0.15 ||
        y - h / 2 < -0.01 ||
        y + h / 2 > height + 0.01)
    )
      fail("An estimated opening falls outside the room. Clarify its wall and dimensions.");
    const provenance = evidence(observationFeature.basis, observationFeature.confidence);
    if (old) {
      // Keep geometry/support identities so clues follow updated existing support frames.
      Object.assign(old, {
        position: observationFeature.position,
        dimensions: observationFeature.dimensions,
        yawDegrees: observationFeature.yawDegrees,
        provenance: {
          ...provenance,
          sourceMediaIds: [...new Set([...old.provenance.sourceMediaIds, ...input.sourceMediaIds])].slice(-8),
        },
      });
    } else
      features.push(
        createGenericRoomFeature({
          ...observationFeature,
          id: `${base}:observed-${index}-${input.sourceMediaIds[0].slice(-16)}`,
          provenance,
        }),
      );
  });
  if (!existing && !observation.features.some((feature) => !shell.has(feature.classification)))
    warnings.push("Only an inferred room shell was usable. Add missing furniture through the Room feature editor.");
  const room = roomEnvironmentSchema.parse({
    ...(existing ?? {}),
    schemaVersion: 1,
    id: input.roomId,
    name: existing?.name ?? "Reconstructed room",
    width,
    height,
    depth,
    origin: "PHOTO_RECONSTRUCTION",
    features,
  });
  const verification = verifyConstructedEnvironment(
    room,
    syntheticRoomGeometry({ ...room, horizontal: true, vertical: true }),
  );
  const errors = verification.findings.filter((finding) => finding.severity === "ERROR");
  if (errors.length)
    return {
      status: "CLARIFICATION",
      message: `The proposed room needs geometric correction: ${errors
        .slice(0, 3)
        .map((finding) => finding.message)
        .join(" ")} Review the feature dimensions or provide a clearer aligned view.`,
    };
  warnings.push(...verification.findings.map((finding) => finding.message));
  return { status: "PROPOSED", room, warnings: [...new Set(warnings)].slice(0, 24) };
}
