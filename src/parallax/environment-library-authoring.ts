import { roomEnvironmentSchema, type RoomEnvironment } from "./environment-contracts";
import { createRoomEnvironment } from "./environment-authoring";

/** An editable shell without preset furniture; this is authored geometry, not a reconstruction. */
export function createEmptyEnvironment(id: string): RoomEnvironment {
  const shell = createRoomEnvironment({
    id: "bedroom",
    name: "Empty environment",
    width: 4,
    depth: 4,
    horizontal: true,
    vertical: true,
    tracking: true,
    clutter: 0,
    light: "NORMAL",
  });
  return roomEnvironmentSchema.parse({
    ...shell,
    id,
    name: "Empty environment",
    origin: "MANUAL",
    features: shell.features.filter((feature) => ["FLOOR", "WALL", "CEILING"].includes(feature.classification)),
    construction: { revision: 1, kind: "INDOOR", relationships: [] },
  });
}

/** References inside the room remain local; source geometry and provenance are never mutated. */
export function duplicateEnvironment(room: RoomEnvironment, id: string): RoomEnvironment {
  return roomEnvironmentSchema.parse({ ...structuredClone(room), id, name: `${room.name.slice(0, 115)} copy` });
}
