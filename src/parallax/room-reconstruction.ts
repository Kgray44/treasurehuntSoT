import { roomObservationSchema, type RoomObservation } from "@/watchglass/room-observation";
import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { createGenericRoomFeature } from "./parametric-room";
import { syntheticRoomGeometry } from "./room-geometry";
import { verifyConstructedEnvironment } from "./construction-verification";

export class RoomReconstructionError extends Error {}
const shell = new Set<RoomFeature["classification"]>(["FLOOR", "WALL", "CEILING"]);
/** A chair can face any part of a tabletop, not just its center. Test the
 * observed forward ray against the furnishing's oriented floor footprint. */
function facesFootprint(chair: RoomFeature, target: RoomFeature): boolean {
  const targetYaw = (target.yawDegrees * Math.PI) / 180;
  const relativeYaw = ((chair.yawDegrees - target.yawDegrees) * Math.PI) / 180;
  const dx = chair.position.x - target.position.x,
    dz = chair.position.z - target.position.z;
  const origin = [
    Math.cos(targetYaw) * dx - Math.sin(targetYaw) * dz,
    Math.sin(targetYaw) * dx + Math.cos(targetYaw) * dz,
  ];
  const direction = [Math.sin(relativeYaw), Math.cos(relativeYaw)];
  const half = [target.dimensions[0] / 2, target.dimensions[2] / 2];
  let near = 0,
    far = Infinity;
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(direction[axis]) < 1e-8) {
      if (Math.abs(origin[axis]) > half[axis]) return false;
      continue;
    }
    const a = (-half[axis] - origin[axis]) / direction[axis];
    const b = (half[axis] - origin[axis]) / direction[axis];
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (far < near) return false;
  }
  return far > 0;
}
function fail(message: string): never {
  throw new RoomReconstructionError(message);
}

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
    "Dimensions and hidden geometry are estimates. Adjust relative scale or optionally use a known measurement for better accuracy.",
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
  const relationships = structuredClone(existing?.construction?.relationships ?? []);
  const attachments: {
    featureId: string;
    attachment: NonNullable<RoomObservation["features"][number]["attachment"]>;
    targetIndex?: number | null;
    wallFace?: RoomObservation["features"][number]["wallFace"];
  }[] = [];
  const observedIds = new Map<number, string>();
  const facing: { featureId: string; targetIndex: number }[] = [];
  observation.features.forEach((observationFeature, index) => {
    // Shell construction is canonical rather than arbitrary model-supplied fragments.
    if (shell.has(observationFeature.classification)) return;
    const old = observationFeature.matchedFeatureId
      ? features.find((f) => f.id === observationFeature.matchedFeatureId)
      : undefined;
    if (observationFeature.matchedFeatureId && (!existing || !old || matched.has(old.id)))
      fail("The additional image has an unknown or repeated feature match. Clarify its room relationship.");
    if (old) matched.add(old.id);
    const featureId = old?.id ?? `${base}:observed-${index}-${input.sourceMediaIds[0].slice(-16)}`;
    observedIds.set(index, featureId);
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
    const mountedEstimate = ["WALL", "CEILING"].includes(observationFeature.attachment ?? "");
    if (
      !attachedOpening &&
      !mountedEstimate &&
      (Math.abs(x) + halfX > width / 2 + 0.01 ||
        Math.abs(z) + halfZ > depth / 2 + 0.01 ||
        y - h / 2 < -0.01 ||
        y + h / 2 > height + 0.01)
    )
      fail(
        `${observationFeature.name} falls outside the room estimate. Clarify its dimensions, orientation or image alignment.`,
      );
    if (
      attachedOpening &&
      (Math.abs(x) + halfX > width / 2 + 0.15 ||
        Math.abs(z) + halfZ > depth / 2 + 0.15 ||
        y - h / 2 < -0.01 ||
        y + h / 2 > height + 0.01)
    )
      fail("An estimated opening falls outside the room. Clarify its wall and dimensions.");
    const provenance = evidence(observationFeature.basis, observationFeature.confidence);
    if (["TABLE", "DESK"].includes(observationFeature.classification)) {
      const views = observationFeature.orientationEvidence ?? [];
      if (
        new Set(views.map((view) => view.imageIndex)).size !== views.length ||
        views.some((view) => view.imageIndex >= input.sourceMediaIds.length)
      )
        fail("Table orientation evidence must refer to distinct supplied photographs.");
      const axisYaw = Math.abs(((observationFeature.yawDegrees % 180) + 180) % 180);
      const parallel = Math.min(axisYaw, 180 - axisYaw) <= 15;
      const perpendicular = Math.abs(axisYaw - 90) <= 15;
      for (const view of views) {
        if (
          view.confidence >= 0.7 &&
          ((view.widthAxisRelation === "PARALLEL_BACK_WALL" && !parallel) ||
            (view.widthAxisRelation === "PERPENDICULAR_BACK_WALL" && !perpendicular) ||
            (view.widthAxisRelation === "OBLIQUE" && (parallel || perpendicular)))
        )
          fail(
            `${observationFeature.name} has conflicting edge evidence and rotation. Review its orientation before reconstruction.`,
          );
        warnings.push(`${observationFeature.name}, photo ${view.imageIndex + 1}: ${view.cues}`);
      }
      // A clear second view can resolve a cropped first view. Unsupported views do not
      // increase confidence, and every confident contradictory view was rejected above.
      const supportedViews = views.filter(
        (view) =>
          (view.widthAxisRelation === "PARALLEL_BACK_WALL" && parallel) ||
          (view.widthAxisRelation === "PERPENDICULAR_BACK_WALL" && perpendicular) ||
          (view.widthAxisRelation === "OBLIQUE" && !parallel && !perpendicular),
      );
      // UNRESOLVED is not support for a rotation, however confident the model is
      // that the view is ambiguous. Keep its best guess editable, but never let
      // missing/unsupported edge evidence promote that guess to high confidence.
      const orientationConfidence = supportedViews.length
        ? Math.max(...supportedViews.map((view) => view.confidence))
        : Math.min(0.6, ...(views.length ? views.map((view) => view.confidence) : [0.6]));
      provenance.confidence = Math.min(provenance.confidence, orientationConfidence);
      if (!supportedViews.length || orientationConfidence < 0.7)
        warnings.push(`${observationFeature.name}: orientation is uncertain; review its rotation in the proposal.`);
    }
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
      if (observationFeature.applianceShape || observationFeature.openingState) {
        const rebuilt = createGenericRoomFeature({
          ...old,
          applianceShape: observationFeature.applianceShape,
          openingState: observationFeature.openingState,
        });
        old.parts = rebuilt.parts;
        if (rebuilt.applianceShape) old.applianceShape = rebuilt.applianceShape;
        if (rebuilt.openingState) old.openingState = rebuilt.openingState;
      }
    } else {
      const feature = createGenericRoomFeature({
        ...observationFeature,
        id: `${base}:observed-${index}-${input.sourceMediaIds[0].slice(-16)}`,
        provenance,
      });
      features.push(feature);
    }
    if (observationFeature.attachment)
      attachments.push({
        featureId,
        attachment: observationFeature.attachment,
        targetIndex: observationFeature.attachmentTargetIndex,
        wallFace: observationFeature.wallFace,
      });
    if (observationFeature.facesFeatureIndex != null)
      facing.push({ featureId, targetIndex: observationFeature.facesFeatureIndex });
  });
  for (const { featureId, targetIndex } of facing) {
    const feature = features.find((part) => part.id === featureId)!;
    const target = features.find((part) => part.id === observedIds.get(targetIndex));
    if (
      feature.classification !== "CHAIR" ||
      !target ||
      target.id === featureId ||
      !["TABLE", "DESK"].includes(target.classification)
    )
      fail(`${feature.name} has an invalid observed facing relationship.`);
    const dx = target.position.x - feature.position.x,
      dz = target.position.z - feature.position.z;
    if (Math.hypot(dx, dz) < 0.1) fail(`${feature.name} needs a distinct furnishing to face.`);
    // Preserve an observed heading that already faces the furnishing. Aiming
    // every chair at its center can wrongly swivel an off-center side chair
    // into a wall or neighbor. Only resolve a heading that actually misses it.
    if (facesFootprint(feature, target))
      warnings.push(`Kept the observed heading of ${feature.name} toward ${target.name}; pose remains estimated.`);
    else {
      feature.yawDegrees = (Math.atan2(dx, dz) * 180) / Math.PI;
      warnings.push(`Oriented ${feature.name} toward its observed ${target.name}; pose remains estimated.`);
    }
  }
  // Resolve declared supports only after every observed furnishing exists, independent of model output order.
  const attached = new Set<string>(),
    resolving = new Set<string>();
  const attach = ({ featureId, attachment, targetIndex, wallFace }: (typeof attachments)[number]) => {
    if (attached.has(featureId)) return;
    if (resolving.has(featureId)) fail("Observed attachment relationships contain a cycle. Clarify their supports.");
    resolving.add(featureId);
    const feature = features.find((part) => part.id === featureId)!;
    const targetId = targetIndex == null ? undefined : observedIds.get(targetIndex);
    if (targetIndex != null && (!targetId || targetId === featureId))
      fail(`${feature.name} names an invalid observed attachment target.`);
    const target = targetId ? features.find((part) => part.id === targetId) : undefined;
    if (target && attachment !== "WALL" && attachment !== "FURNITURE")
      fail(`${feature.name} uses an attachment target for an unsupported attachment type.`);
    const targetAttachment = attachments.find((item) => item.featureId === targetId);
    if (targetAttachment) attach(targetAttachment);
    const attachedOpening = ["DOOR", "WINDOW"].includes(feature.classification);
    const prior = relationships.findIndex((relation) => relation.featureId === featureId);
    if (prior >= 0) relationships.splice(prior, 1);
    if (attachment === "WALL") {
      if (target) {
        if (wallFace && targetAttachment?.wallFace && wallFace !== targetAttachment.wallFace)
          fail(`${feature.name} and its layered support are assigned to different observed walls.`);
        if (
          attachedOpening ||
          targetAttachment?.attachment !== "WALL" ||
          target.dimensions[2] > 0.25 ||
          feature.dimensions[2] > 0.25
        )
          fail(`${feature.name} needs a thin, explicitly wall-mounted attachment target.`);
        const angle = (target.yawDegrees * Math.PI) / 180;
        const normalDistance =
          Math.sin(angle) * (feature.position.x - target.position.x) +
          Math.cos(angle) * (feature.position.z - target.position.z);
        const offset = (target.dimensions[2] + feature.dimensions[2]) / 2;
        if (Math.abs(normalDistance - offset) > 0.25)
          fail(`${feature.name} is too far from its observed wall attachment target.`);
        feature.position.x += (offset - normalDistance) * Math.sin(angle);
        feature.position.z += (offset - normalDistance) * Math.cos(angle);
        feature.yawDegrees = target.yawDegrees;
        relationships.push({ featureId, targetFeatureId: target.id, type: "MOUNTED_ON" });
        warnings.push(
          `Aligned ${feature.name} in front of its explicitly observed ${target.name} support; position remains estimated.`,
        );
      } else {
        const walls = features.filter((part) => {
          if (part.classification !== "WALL") return false;
          if (!wallFace) return true;
          const boundary = wallFace === "LEFT" || wallFace === "RIGHT" ? width / 2 : depth / 2;
          const coordinate = wallFace === "LEFT" || wallFace === "RIGHT" ? part.position.x : part.position.z;
          return Math.abs(coordinate - (wallFace === "BACK" || wallFace === "LEFT" ? -boundary : boundary)) < 0.01;
        });
        const distance = (wall: RoomFeature) =>
          Math.abs(
            Math.sin((wall.yawDegrees * Math.PI) / 180) * (feature.position.x - wall.position.x) +
              Math.cos((wall.yawDegrees * Math.PI) / 180) * (feature.position.z - wall.position.z),
          );
        const wall = walls.sort((a, b) => distance(a) - distance(b))[0];
        if (!wall || distance(wall) > 0.25)
          fail(`${feature.name} is marked wall-mounted but is too far from a modeled wall.`);
        const angle = (wall.yawDegrees * Math.PI) / 180;
        // The initial observation is an estimate. Canonical construction makes its declared attachment coplanar.
        const offset = attachedOpening ? 0 : (wall.dimensions[2] + feature.dimensions[2]) / 2;
        const normalDistance =
          Math.sin(angle) * (feature.position.x - wall.position.x) +
          Math.cos(angle) * (feature.position.z - wall.position.z);
        feature.position.x += (offset - normalDistance) * Math.sin(angle);
        feature.position.z += (offset - normalDistance) * Math.cos(angle);
        feature.yawDegrees = wall.yawDegrees;
        if (!attachedOpening)
          relationships.push({ featureId: feature.id, targetFeatureId: wall.id, type: "MOUNTED_ON" });
        warnings.push(`Aligned ${feature.name} to its declared wall attachment; position remains estimated.`);
      }
    } else if (attachment === "CEILING") {
      const ceiling = features.find((part) => part.classification === "CEILING");
      if (!ceiling || Math.abs(feature.position.y + feature.dimensions[1] / 2 - height) > 0.25)
        fail(`${feature.name} is marked ceiling-mounted but its assembly does not reach the ceiling.`);
      feature.position.y = height - feature.dimensions[1] / 2;
      relationships.push({ featureId: feature.id, targetFeatureId: ceiling.id, type: "MOUNTED_ON" });
    } else if (attachment === "FURNITURE") {
      const support = features
        .filter(
          (part) =>
            ["TABLE", "DESK", "CABINET", "SHELF"].includes(part.classification) && (!target || part.id === target.id),
        )
        .find(
          (part) =>
            (() => {
              const yaw = (part.yawDegrees * Math.PI) / 180,
                delta = ((feature.yawDegrees - part.yawDegrees) * Math.PI) / 180;
              const dx = feature.position.x - part.position.x,
                dz = feature.position.z - part.position.z;
              const localX = Math.cos(yaw) * dx - Math.sin(yaw) * dz,
                localZ = Math.sin(yaw) * dx + Math.cos(yaw) * dz;
              const halfX =
                (Math.abs(Math.cos(delta)) * feature.dimensions[0] +
                  Math.abs(Math.sin(delta)) * feature.dimensions[2]) /
                2;
              const halfZ =
                (Math.abs(Math.sin(delta)) * feature.dimensions[0] +
                  Math.abs(Math.cos(delta)) * feature.dimensions[2]) /
                2;
              return (
                Math.abs(localX) + halfX <= part.dimensions[0] / 2 + 0.03 &&
                Math.abs(localZ) + halfZ <= part.dimensions[2] / 2 + 0.03
              );
            })() &&
            Math.abs(feature.position.y - feature.dimensions[1] / 2 - (part.position.y + part.dimensions[1] / 2)) <=
              0.15,
        );
      if (!support) fail(`${feature.name} has no matching observed furniture support.`);
      feature.position.y = support.position.y + support.dimensions[1] / 2 + feature.dimensions[1] / 2;
      relationships.push({ featureId: feature.id, targetFeatureId: support.id, type: "SUPPORTED_BY" });
    }
    resolving.delete(featureId);
    attached.add(featureId);
  };
  attachments.forEach(attach);

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
    construction: { revision: 1, kind: "INDOOR", relationships },
    features,
  });
  let verification = verifyConstructedEnvironment(
    room,
    syntheticRoomGeometry({ ...room, horizontal: true, vertical: true }),
  );
  // Initial photo poses are estimates. Resolve only small chair/table solid contacts along an observed
  // facing relationship; do not invent furnishings, resize them, relax verification or alter edited rooms.
  if (!existing) {
    for (const { featureId, targetIndex } of facing) {
      const chair = room.features.find((feature) => feature.id === featureId)!;
      const table = room.features.find((feature) => feature.id === observedIds.get(targetIndex))!;
      const contact = verification.findings.some(
        (finding) =>
          finding.severity === "ERROR" &&
          finding.code === "FEATURE_INTERPENETRATION" &&
          finding.featureIds.includes(chair.id) &&
          finding.featureIds.includes(table.id),
      );
      if (!contact) continue;
      const origin = { ...chair.position },
        dx = origin.x - table.position.x,
        dz = origin.z - table.position.z;
      const distance = Math.hypot(dx, dz),
        maximumShift = Math.min(0.15, Math.min(chair.dimensions[0], chair.dimensions[2]) * 0.2);
      let fitted = false;
      for (let shift = 0.025; shift <= maximumShift + 1e-9; shift += 0.025) {
        chair.position = { ...origin, x: origin.x + (dx / distance) * shift, z: origin.z + (dz / distance) * shift };
        const candidate = verifyConstructedEnvironment(
          room,
          syntheticRoomGeometry({ ...room, horizontal: true, vertical: true }),
        );
        if (candidate.findings.some((finding) => finding.severity === "ERROR" && finding.featureIds.includes(chair.id)))
          continue;
        chair.provenance.basis = "INFERRED";
        chair.provenance.confidence = Math.min(chair.provenance.confidence, 0.6);
        warnings.push(
          `Moved estimated ${chair.name} ${shift.toFixed(3)} m away from its observed ${table.name} to clear constructed solids. Review this fitted placement.`,
        );
        verification = candidate;
        fitted = true;
        break;
      }
      if (!fitted) chair.position = origin;
    }
  }
  const errors = verification.findings.filter((finding) => finding.severity === "ERROR");
  if (errors.length)
    return {
      status: "CLARIFICATION",
      message: `The proposed room needs geometric correction: ${errors
        .slice(0, 3)
        .map(
          (finding) =>
            `${finding.featureIds.map((id) => features.find((feature) => feature.id === id)?.name ?? "Room feature").join(" and ")}: ${finding.message}`,
        )
        .join(" ")} Review the feature dimensions or provide a clearer aligned view.`,
    };
  warnings.push(
    ...verification.findings.map(
      (finding) =>
        `${finding.featureIds.map((id) => features.find((feature) => feature.id === id)?.name ?? "Room feature").join(" and ")}: ${finding.message}`,
    ),
  );
  return { status: "PROPOSED", room, warnings: [...new Set(warnings)].slice(0, 24) };
}
