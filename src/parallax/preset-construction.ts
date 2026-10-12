import { roomEnvironmentSchema, type RoomEnvironment, type RoomFeature } from "./environment-contracts";
import { createGenericRoomFeature } from "./room-feature-construction";
import { trailElevation } from "./terrain";

type PresetInput = { id?: string; name?: string; width: number; depth: number; vertical: boolean };
type Part = RoomFeature["parts"][number];

/** Fixed reference layouts, expressed in metres in the same editable format as photo rooms.
 * No randomized placement, renderer-only furniture or generator validation claims.
 */
export function createPresetConstruction(input: PresetInput): RoomEnvironment {
  const kind = input.id ?? "bedroom",
    w = input.width,
    d = input.depth,
    height = 2.8;
  const outdoor = kind === "trail" || kind === "plaza";
  const features: RoomFeature[] = [];
  const relationships: NonNullable<RoomEnvironment["construction"]>["relationships"] = [];
  const f = (
    id: string,
    classification: RoomFeature["classification"],
    dimensions: RoomFeature["dimensions"],
    x: number,
    z: number,
    bottom = 0,
    yawDegrees = 0,
    name = id.replaceAll("-", " "),
  ) => {
    const feature = createGenericRoomFeature({
      id,
      name,
      classification,
      dimensions,
      position: { x, y: bottom + dimensions[1] / 2, z },
      yawDegrees,
      provenance: { basis: "SIMULATED", confidence: 1, sourceMediaIds: [] },
    });
    // Stable support IDs preserve existing clue bindings and semantic placement.
    const support = feature.parts.find((p) => p.surface !== null);
    if (support) support.id = id;
    features.push(feature);
    return feature;
  };
  const custom = (
    id: string,
    classification: RoomFeature["classification"],
    dimensions: RoomFeature["dimensions"],
    x: number,
    y: number,
    z: number,
    parts: Part[],
  ) => {
    const feature: RoomFeature = {
      id,
      name: id.replaceAll("-", " "),
      classification,
      dimensions,
      position: { x, y, z },
      yawDegrees: 0,
      parts,
      provenance: { basis: "SIMULATED", confidence: 1, sourceMediaIds: [] },
    };
    features.push(feature);
    return feature;
  };
  const part = (
    id: string,
    size: Part["size"],
    position: Part["position"],
    color: number,
    shape: Part["shape"] = "BOX",
    surface: Part["surface"] = null,
  ): Part => ({
    id,
    size,
    position,
    color,
    shape,
    surface,
    face: "TOP",
    context: surface ? ["FURNITURE"] : [],
  });
  const support = (featureId: string, targetFeatureId: string) =>
    relationships.push({ featureId, targetFeatureId, type: "SUPPORTED_BY" });
  const mount = (featureId: string, targetFeatureId = "wall-window") =>
    relationships.push({ featureId, targetFeatureId, type: "MOUNTED_ON" });
  const desk = (
    id: string,
    x: number,
    z: number,
    width = 1.3,
    depth = 0.7,
    top = 0.75,
    classification: "DESK" | "TABLE" = "DESK",
  ) => f(id, classification, [width, top, depth], x, z);
  const chair = (id: string, x: number, z: number, yaw = 0) => {
    const feature = f(id, "CHAIR", [0.46, 0.9, 0.48], x, z, 0, yaw);
    feature.parts.find((p) => p.surface !== null)!.id = `${id}-seat`;
  };
  const monitor = (id: string, x: number, z: number, target: string, base = 0.75, width = 0.55, h = 0.5) => {
    custom(id, "APPLIANCE", [width, h, 0.22], x, base + h / 2, z, [
      part(`${id}-base`, [0.55, 0.04, 1], [0, -0.48, 0], 0x303e4e, "ROUNDED_BOX"),
      part(`${id}-stand`, [0.1, 0.3, 0.15], [0, -0.31, 0], 0x485664, "CYLINDER"),
      part(`${id}-monitor`, [1, 0.72, 0.17], [0, 0.14, -0.2], 0x202b38, "ROUNDED_BOX"),
      part(`${id}-screen`, [0.9, 0.62, 0.03], [0, 0.14, -0.1], 0x557b98),
    ]);
    support(id, target);
  };
  const wallArt = (id: string, x: number, y: number, width: number, h: number, color: number) => {
    custom(id, "OTHER", [width, h, 0.07], x, y, -d / 2 + 0.099, [
      part(`${id}-frame`, [1, 1, 1], [0, 0, 0], 0x8a755c, "ROUNDED_BOX"),
      part(id, [0.88, 0.89, 0.12], [0, 0, 0.44], color, id === "whiteboard" ? "BOX" : "PICTURE"),
    ]);
    mount(id);
  };
  const floor = f("floor-furniture", "FLOOR", [w, 0.16, d], 0, 0, -0.16);
  floor.parts[0].color = outdoor ? (kind === "trail" ? 0x68805a : 0xb5b2a5) : kind === "gallery" ? 0xc9c3b6 : 0xa99a84;
  if (kind === "trail") floor.parts[0].shape = "TERRAIN";
  if (!outdoor && input.vertical) {
    for (const [id, length, x, z, yaw] of [
      ["wall-window", w, 0, -d / 2, 0],
      ["wall-front", w, 0, d / 2, 180],
      ["wall-left", d, -w / 2, 0, 90],
      ["wall-right", d, w / 2, 0, -90],
    ] as const)
      f(id, "WALL", [length, height, 0.16], x, z, 0, yaw);
    f("ceiling", "CEILING", [w, 0.12, d], 0, 0, height);
    // Empty is an architectural fixture without furnishings or openings.
    if (kind !== "empty") f("entry-door", "DOOR", [0.82, 2.1, 0.16], Math.min(w / 2 - 0.55, w * 0.23), d / 2, 0, 180);
  }
  if (["bedroom", "living-room", "dorm", "office"].includes(kind)) {
    const width = kind === "dorm" ? 0.65 : kind === "office" ? 1.4 : 1.15;
    const x = kind === "living-room" ? -w * 0.3 : kind === "dorm" ? -0.45 : 0;
    f("window", "WINDOW", [width, kind === "dorm" ? 0.75 : 1.1, 0.16], x, -d / 2, 1.25);
  }
  if (kind === "bedroom") {
    desk("reference-desk", w * 0.16, -d * 0.33, 1.3, 0.9);
    desk("table-left", -w * 0.3, d * 0.38, 1.1, 0.9, 0.55, "TABLE");
    const bed = f("bed", "BED", [1.3, 0.85, 2.05], -w * 0.29, -0.05);
    bed.parts.find((p) => p.id === "bed")!.id = "bed";
    f("wardrobe", "WARDROBE", [1, 1.9, 0.6], w * 0.4, -d * 0.31, 0, -90);
    chair("desk-chair", w * 0.16, -d * 0.33 + 0.7);
    custom("bedside-lamp", "OTHER", [0.18, 0.34, 0.18], -w * 0.3 - 0.4, 0.72, d * 0.38 + 0.3, [
      part("bedside-lamp-base", [0.7, 0.08, 0.7], [0, -0.46, 0], 0x75674f, "CYLINDER"),
      part("bedside-lamp-stem", [0.12, 0.6, 0.12], [0, -0.14, 0], 0xb5a074, "CYLINDER"),
      part("bedside-lamp-shade", [1, 0.36, 1], [0, 0.32, 0], 0xe6d6af, "CYLINDER"),
    ]);
    support("bedside-lamp", "table-left");
  } else if (kind === "living-room") {
    f("sofa", "SOFA", [2.3, 0.9, 0.9], -w * 0.31, 0, 0, 90);
    desk("table-left", -0.05, 0.1, 1.25, 0.8, 0.43, "TABLE");
    desk("reference-desk", 0, -d * 0.4, 1.8, 0.45, 0.65, "TABLE");
    monitor("television", 0, -d * 0.4, "reference-desk", 0.65, 1.35, 0.9);
    const rug = f("rug", "OTHER", [2.8, 0.008, 2], 0, 0.2);
    rug.parts[0].color = 0xb9a682;
    chair("armchair", w * 0.28, d * 0.21, -90);
    f("houseplant", "TREE", [0.65, 1.5, 0.65], w * 0.39, -d * 0.38);
  } else if (kind === "dorm") {
    f("dorm-bed", "BED", [0.85, 0.8, 1.95], -w * 0.29, 0.1);
    desk("reference-desk", w * 0.27, -d * 0.34, 0.75, 0.7);
    chair("study-chair", w * 0.27, -d * 0.34 + 0.7);
    f("shelf-entry", "SHELF", [0.7, 0.7, 0.22], w * 0.27, -d / 2 + 0.174, 1.1);
    mount("shelf-entry");
    for (let i = 0; i < 5; i++) {
      const book = f(`textbook-${i}`, "OTHER", [0.06, 0.22, 0.16], w * 0.27 - 0.2 + i * 0.085, -d / 2 + 0.174, 1.8);
      book.parts[0].color = [0x9b5e54, 0x587993, 0xc7ae74][i % 3];
      support(book.id, "shelf-entry");
    }
    f("laundry-basket", "OTHER", [0.36, 0.4, 0.4], w * 0.3, d * 0.3).parts[0].shape = "CYLINDER";
  } else if (kind === "office") {
    for (const x of [-w * 0.27, w * 0.27])
      for (const z of [-d * 0.28, d * 0.18]) {
        const id =
          x < 0 && z < 0 ? "reference-desk" : `workstation-${x < 0 ? "left" : "right"}-${z < 0 ? "back" : "front"}`;
        desk(id, x, z, 1.5, 0.85);
        chair(`${id}-chair`, x, z + 0.66);
        monitor(id + "-display", x, z - 0.22, id);
      }
    f("filing-cabinet", "CABINET", [0.55, 1.2, 0.5], 0, -d * 0.4);
  } else if (kind === "classroom") {
    desk("reference-desk", -w * 0.25, -d * 0.35, 1.5, 0.9);
    wallArt("whiteboard", 0.2, 1.6, w * 0.55, 1.15, 0xe5eadd);
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const x = (col - 1) * w * 0.23,
          z = -d * 0.12 + row * d * 0.24;
        desk(row === 0 && col === 0 ? "table-left" : `student-desk-${row}-${col}`, x, z, 1.15, 0.6, 0.7);
        chair(`student-chair-${row}-${col}`, x, z + 0.55);
      }
    const clock = f("classroom-clock", "OTHER", [0.4, 0.4, 0.05], -w * 0.4, -d / 2 + 0.089, 2);
    clock.parts[0].color = 0xdaca9b;
    clock.parts[0].shape = "CLOCK";
    mount(clock.id);
  } else if (kind === "gallery") {
    for (let i = 0; i < 3; i++) {
      const x = (i - 1) * w * 0.27;
      wallArt(`artwork-${i}`, x, 1.6, 1.35, 1.65, [0xa66d60, 0x658b9b, 0xbba26c][i]);
      f(`display-plinth-${i}`, "TABLE", [0.75, 0.9, 0.75], x, -d * 0.12).parts = [
        part(`display-plinth-${i}`, [1, 1, 1], [0, 0, 0], 0xe0dbcf, "BOX", "TABLE"),
      ];
      const sculpture = f(`sculpture-${i}`, "OTHER", [0.32 + i * 0.07, 0.65, 0.32], x, -d * 0.12, 0.9);
      sculpture.parts[0].shape = i === 1 ? "CYLINDER" : "ELLIPSOID";
      sculpture.parts[0].color = 0x899a96;
      support(sculpture.id, `display-plinth-${i}`);
    }
    desk("gallery-bench", 0, d * 0.23, 2.1, 0.5, 0.48, "TABLE");
  } else if (kind === "trail") {
    // Continuous centre strip, with deterministic rolling banks outside it.
    const path = f("trail-path", "OTHER", [1.1, 0.008, d], 0, 0);
    path.parts[0].shape = "PATH";
    path.parts[0].color = 0xb6a180;
    for (let i = 0; i < 7; i++) {
      const z = -d / 2 + 0.8 + (i * (d - 1.6)) / 6;
      f(
        `trail-tree-left-${i}`,
        "TREE",
        [0.65, 2.4 + (i % 3) * 0.15, 0.65],
        -w * 0.36,
        z,
        trailElevation(-w * 0.36, z, w, d),
      );
      f(
        `trail-tree-right-${i}`,
        "TREE",
        [0.65, 2.6, 0.65],
        w * 0.36,
        z + 0.12,
        trailElevation(w * 0.36, z + 0.12, w, d),
      );
      const stone = f(
        `trail-stone-${i}`,
        "OTHER",
        [0.24, 0.14, 0.26],
        -w * 0.25,
        z + 0.3,
        trailElevation(-w * 0.25, z + 0.3, w, d),
      );
      stone.parts[0].shape = "ELLIPSOID";
      stone.parts[0].color = 0x888d7f;
    }
    custom(
      "trail-sign",
      "OTHER",
      [0.6, 1.32, 0.09],
      w * 0.29,
      0.66 + trailElevation(w * 0.29, d * 0.22, w, d),
      d * 0.22,
      [
        part("trail-sign-post", [0.15, 1, 1], [0, 0, 0], 0x796146, "CYLINDER"),
        part("trail-sign", [1, 0.27, 0.65], [0, 0.3, 0], 0xb59a70, "ROUNDED_BOX"),
      ],
    );
  } else if (kind === "plaza") {
    for (const x of [-w * 0.32, w * 0.32])
      for (const z of [-d * 0.3, d * 0.3]) {
        const id = `plaza-bench-${x < 0 ? "left" : "right"}-${z < 0 ? "back" : "front"}`;
        const bench = desk(id, x, z, 1.9, 0.55, 0.5, "TABLE");
        bench.parts.push(part(`${id}-back`, [1, 0.9, 0.1], [0, 0.65, -0.45], 0x87775d, "ROUNDED_BOX"));
        // A single semantic planted assembly; trunk emerges from the modeled soil.
        custom(`planted-tree-${x}-${z}`, "TREE", [0.8, 2.7, 0.8], x, 1.35, z + 1, [
          part(`planter-${x}-${z}`, [1, 0.18, 1], [0, -0.41, 0], 0xa69d89, "CYLINDER"),
          part(`plaza-tree-${x}-${z}`, [0.9, 0.82, 0.9], [0, 0.09, 0], 0x527451, "TREE"),
        ]);
      }
    custom("fountain", "OTHER", [2, 1.4, 2], 0, 0.7, 0, [
      part("fountain-base", [1, 0.2, 1], [0, -0.4, 0], 0x9eaaa8, "CYLINDER"),
      part("fountain-water", [0.87, 0.015, 0.87], [0, -0.2925, 0], 0x7faaba, "CYLINDER"),
      part("fountain-center", [0.18, 0.8, 0.18], [0, 0.1, 0], 0xb8beb4, "CYLINDER"),
    ]);
    for (const x of [-w * 0.44, w * 0.44]) {
      custom(`light-post-${x}`, "OTHER", [0.3, 2.5, 0.3], x, 1.25, 0, [
        part(`light-post-${x}:stem`, [0.22, 0.92, 0.22], [0, -0.04, 0], 0x53616a, "CYLINDER"),
        part(`light-post-${x}:lamp`, [1, 0.08, 1], [0, 0.46, 0], 0xd4d0ae, "ELLIPSOID"),
      ]);
    }
  } else if (kind === "cluttered") {
    desk("reference-desk", w * 0.23, -d * 0.31, 0.72, 0.6);
    // Three actual towers, each with three independently editable boxes.
    for (let tower = 0; tower < 3; tower++)
      for (let level = 0; level < 3; level++) {
        const id = `stacked-box-${tower * 3 + level}`,
          h = 0.23 + level * 0.035;
        const bottom = level === 0 ? 0 : level === 1 ? 0.23 : 0.23 + 0.265;
        const box = f(
          id,
          "OTHER",
          [0.4 - level * 0.025, h, 0.38 - level * 0.02],
          -w * 0.32 + (tower === 2 ? 0.48 : 0),
          -0.35 + tower * 0.48,
          bottom,
        );
        box.parts[0].surface = "TABLE";
        box.parts[0].context = ["FURNITURE", "OBSTACLE"];
        box.parts[0].color = 0x9e8260;
        if (level) support(id, `stacked-box-${tower * 3 + level - 1}`);
      }
    desk("packing-table", w * 0.27, d * 0.29, 0.62, 0.5, 0.55, "TABLE");
  }
  return roomEnvironmentSchema.parse({
    schemaVersion: 1,
    id: `editable-${kind}`,
    name: input.name ?? kind,
    width: w,
    depth: d,
    height,
    origin: "PRESET",
    features,
    construction: {
      revision: 1,
      kind: outdoor ? "OUTDOOR" : "INDOOR",
      relationships,
      ...(kind === "trail"
        ? {
            navigation: {
              widthMeters: 0.8,
              points: [
                { x: 0, y: 0, z: -d / 2 },
                { x: 0, y: 0, z: d / 2 },
              ],
            },
          }
        : {}),
    },
  });
}
