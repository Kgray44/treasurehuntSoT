import { roomFeatureSchema, type RoomFeature } from "./environment-contracts";

type Part = RoomFeature["parts"][number];
const defaults: Record<RoomFeature["classification"], RoomFeature["dimensions"]> = {
  FLOOR: [4, 0.12, 4],
  WALL: [4, 2.8, 0.12],
  CEILING: [4, 0.08, 4],
  DOOR: [0.9, 2.1, 0.08],
  WINDOW: [1.2, 1.2, 0.08],
  TABLE: [1.4, 0.75, 0.85],
  DESK: [1.3, 0.75, 0.7],
  CHAIR: [0.5, 0.95, 0.55],
  SOFA: [2.2, 0.9, 0.9],
  BED: [1.5, 0.85, 2.1],
  CABINET: [0.9, 1.2, 0.5],
  WARDROBE: [1.2, 2, 0.6],
  SHELF: [1.2, 1.6, 0.35],
  APPLIANCE: [0.65, 1.7, 0.65],
  TREE: [1.1, 2.5, 1.1],
  OTHER: [0.7, 0.7, 0.7],
  EXCLUSION_ZONE: [0.6, 0.5, 0.6],
};

/** Repository-authored generic geometry, shared by manual correction and room reconstruction.
 * Coordinates are dimensionless within the declared box. No model implies physical measurement.
 */
export function createGenericRoomFeature(input: {
  id: string;
  classification: RoomFeature["classification"];
  name?: string;
  dimensions?: RoomFeature["dimensions"];
  position?: RoomFeature["position"];
  yawDegrees?: number;
  applianceShape?: RoomFeature["applianceShape"] | null;
  openingState?: RoomFeature["openingState"] | null;
  provenance?: RoomFeature["provenance"];
  exclusion?: RoomFeature["exclusion"];
}): RoomFeature {
  const { id, classification } = input;
  const dimensions = input.dimensions ?? defaults[classification];
  const parts: Part[] = [];
  const add = (
    slot: string,
    size: Part["size"],
    position: Part["position"],
    color: number,
    surface: Part["surface"] = null,
    context: Part["context"] = [],
    shape: Part["shape"] = "BOX",
  ) =>
    parts.push({
      id: `${id}:${slot}`,
      size,
      position,
      color,
      surface,
      context,
      shape,
      face: "TOP",
    });
  const legs = (top = 0.4) => {
    for (const x of [-0.42, 0.42])
      for (const z of [-0.4, 0.4]) add(`leg-${x}-${z}`, [0.035, top + 0.5, 0.045], [x, (top - 0.5) / 2, z], 0x48596a);
  };
  if (classification === "EXCLUSION_ZONE") {
    add("zone", [1, 1, 1], [0, 0, 0], 0x7fb7ef, null, ["OBSTACLE"]);
  } else if (classification === "TABLE" || classification === "DESK") {
    add("top", [1, 0.08, 1], [0, 0.46, 0], 0xa38a68, classification, ["FURNITURE"]);
    legs(0.42);
    if (classification === "DESK") {
      add("drawer", [0.35, 0.17, 0.65], [0.26, 0.29, 0], 0x8c7458);
      add("handle", [0.14, 0.025, 0.025], [0.26, 0.29, 0.338], 0xccbea0);
    }
  } else if (classification === "CHAIR") {
    add("seat", [1, 0.08, 1], [0, -0.04, 0], 0x6487a0, "TABLE", ["FURNITURE"]);
    add("back", [1, 0.48, 0.1], [0, 0.26, -0.45], 0x52748b);
    legs(-0.08);
  } else if (classification === "SOFA") {
    add("base", [1, 0.15, 1], [0, -0.3, 0], 0x475d71);
    add("seat", [0.84, 0.23, 0.82], [0, -0.11, 0.08], 0x7995a8, "TABLE", ["FURNITURE"]);
    add("back", [1, 0.75, 0.18], [0, 0.125, -0.41], 0x587a93);
    for (const x of [-0.46, 0.46]) add(`arm-${x}`, [0.08, 0.5, 1], [x, 0, 0], 0x587a93);
    for (const x of [-0.4, 0.4])
      for (const z of [-0.37, 0.37]) add(`foot-${x}-${z}`, [0.04, 0.125, 0.07], [x, -0.4375, z], 0x4e4943);
  } else if (classification === "BED") {
    add("base", [1, 0.26, 1], [0, -0.32, 0], 0x856e56);
    add("mattress", [0.96, 0.23, 0.93], [0, -0.075, 0.025], 0x90acc1, "TABLE", ["FURNITURE", "OBSTACLE"]);
    add("headboard", [1, 1, 0.05], [0, 0, -0.475], 0x725e4c);
    add("pillow", [0.65, 0.12, 0.17], [0, 0.1, -0.3], 0xe4e2d9);
    for (const x of [-0.42, 0.42])
      for (const z of [-0.4, 0.4]) add(`foot-${x}-${z}`, [0.05, 0.05, 0.05], [x, -0.475, z], 0x615342);
  } else if (classification === "APPLIANCE" && input.applianceShape === "PROJECTOR") {
    add("mounting-pole", [0.08, 0.68, 0.08], [0, 0.16, 0], 0x343f4b, null, [], "CYLINDER");
    add("projector", [1, 0.32, 1], [0, -0.34, 0], 0xd8dce0);
    add("lens", [0.22, 0.16, 0.035], [0.26, -0.34, 0.4825], 0x263d57);
  } else if (classification === "APPLIANCE" && input.applianceShape === "WALL_PANEL") {
    add("panel", [1, 1, 0.12], [0, 0, -0.44], 0x343b82);
    add("control-box", [0.34, 0.48, 0.6], [-0.18, 0.1, -0.08], 0xb9c1c5);
    add("display", [0.26, 0.15, 0.18], [0.23, 0, -0.28], 0x202c38);
  } else if (classification === "APPLIANCE" && input.applianceShape === "EQUIPMENT") {
    add("bench", [1, 0.12, 1], [0, -0.44, 0], 0x343b42);
    for (const x of [-0.3, 0, 0.3]) {
      add(`instrument-${x}`, [0.28, 0.88, 0.68], [x, 0.06, 0], 0xc3c7c4, "SHELF", ["FURNITURE"]);
      add(`display-${x}`, [0.17, 0.24, 0.035], [x, -0.1, 0.3575], 0x28343f);
    }
  } else if (classification === "APPLIANCE" && input.applianceShape === "GENERIC_BOX") {
    add("equipment", [1, 1, 1], [0, 0, 0], 0xa8b4be, "SHELF", ["FURNITURE"]);
  } else if (classification === "CABINET" || classification === "WARDROBE" || classification === "APPLIANCE") {
    const color = classification === "APPLIANCE" ? 0xc0cbd2 : 0x9e876e;
    add("body", [1, 1, 0.94], [0, 0, -0.03], color, "SHELF", ["FURNITURE", "OBSTACLE"]);
    for (const x of [-0.24, 0.24]) {
      add(`door-${x}`, [0.47, 0.92, 0.018], [x, 0, 0.48], color + 0x090909);
      add(`handle-${x}`, [0.018, 0.14, 0.025], [x < 0 ? -0.07 : 0.07, 0.02, 0.4875], 0x475564);
    }
  } else if (classification === "SHELF") {
    add("left", [0.035, 1, 1], [-0.4825, 0, 0], 0x8d775c);
    add("right", [0.035, 1, 1], [0.4825, 0, 0], 0x8d775c);
    add("back", [0.93, 1, 0.06], [0, 0, -0.47], 0x8d775c);
    for (const y of [-0.48, -0.16, 0.16, 0.48])
      add(`shelf-${y}`, [0.93, 0.04, 0.94], [0, y, 0.03], 0xad9372, "SHELF", ["FURNITURE"]);
  } else if (classification === "WINDOW") {
    add("window", [1, 1, 1], [0, 0, 0], 0xaed4ec, null, ["WINDOW"], "WINDOW");
  } else if (classification === "DOOR") {
    if (input.openingState !== "OPEN") add("panel", [0.94, 0.97, 0.6], [0, -0.015, 0], 0x9b805e, null, ["ENTRANCE"]);
    for (const x of [-0.485, 0.485]) add(`jamb-${x}`, [0.03, 1, 1], [x, 0, 0], 0xd2c6b7);
    add("lintel", [0.94, 0.03, 1], [0, 0.485, 0], 0xd2c6b7);
    if (input.openingState !== "OPEN") add("handle", [0.05, 0.025, 0.1], [0.34, -0.04, 0.35], 0xc8b785);
    for (const y of [-0.34, 0.34]) add(`hinge-${y}`, [0.035, 0.055, 0.2], [-0.445, y, 0.34], 0xb3a78f);
  } else if (classification === "TREE") {
    add("tree", [1, 1, 1], [0, 0, 0], 0x4a7658, null, [], "TREE");
  } else {
    add(
      "body",
      [1, 1, 1],
      [0, 0, 0],
      classification === "FLOOR" ? 0xab9981 : 0xc1cbd7,
      classification === "FLOOR" || classification === "WALL" ? classification : null,
      [],
    );
    if (classification === "WALL") {
      parts[0].face = "FRONT";
      parts[0].size[2] = 0.9;
      parts[0].position[2] = -0.05;
      add("skirting", [1, 0.04, 0.2], [0, -0.48, 0.4], 0xa4acaa);
      parts[1].face = "FRONT";
    }
  }
  // Curved reusable furnishings keep architecture and planar supports exact.
  for (const part of parts) {
    if (/:(leg|foot|handle|hinge)-?/.test(part.id)) part.shape = "CYLINDER";
    else if (
      part.shape === "BOX" &&
      part.surface === null &&
      !["FLOOR", "WALL", "CEILING", "DOOR"].includes(classification)
    )
      part.shape = "ROUNDED_BOX";
  }
  return roomFeatureSchema.parse({
    id,
    name: input.name ?? `New ${classification.toLowerCase().replaceAll("_", " ")}`,
    classification,
    ...(classification === "EXCLUSION_ZONE" ? { exclusion: input.exclusion ?? {} } : {}),
    dimensions,
    yawDegrees: input.yawDegrees ?? 0,
    ...(classification === "APPLIANCE" && input.applianceShape ? { applianceShape: input.applianceShape } : {}),
    ...(classification === "DOOR" && input.openingState ? { openingState: input.openingState } : {}),
    position: input.position ?? { x: 0, y: dimensions[1] / 2, z: 0 },
    parts,
    provenance: input.provenance ?? { basis: "PLACEHOLDER", confidence: 0, sourceMediaIds: [] },
  });
}
