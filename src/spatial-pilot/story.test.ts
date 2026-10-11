// @sounding-line-registration owner=spatial-pilot suite=unit.spatial-pilot contracts=spatial-pilot.experience
import { it, expect } from "vitest";
import { parseDrydockBlock } from "@/drydock/contracts/parser";
import { pilotChapters, pilotLandfall } from "./story";
it("uses accepted Story Block contracts and one entirely fictional virtual Worldspace", () => {
  const id = "synthetic-spatial-pilot-tale";
  const definition = pilotLandfall(id);
  expect(definition.worldspaces.map((w) => w.kind)).toEqual(["VIRTUAL"]);
  expect(definition.waypoints).toHaveLength(4);
  expect(definition.waypoints.filter((w) => w.visibility.hiddenUntilRevealed)).toHaveLength(1);
  for (const block of pilotChapters(id)[0].blocks) {
    const result = parseDrydockBlock({ ...block, schemaVersion: block.schemaVersion ?? 1 });
    expect(result.success, JSON.stringify(result)).toBe(true);
  }
});
