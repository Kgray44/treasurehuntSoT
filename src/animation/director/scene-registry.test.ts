import { describe, expect, it } from "vitest";
import { sceneNames } from "../core/animation-types";
import { sceneRegistry } from "./scene-registry";

describe("scene registry", () => {
  it("contains one typed definition for every public scene name", () => {
    expect(Object.keys(sceneRegistry).sort()).toEqual([...sceneNames].sort());
  });

  it("gives every scene real opening and success timeline builders", () => {
    for (const definition of Object.values(sceneRegistry)) {
      expect(definition.name).toBeTruthy();
      expect(definition.buildOpening).toBeTypeOf("function");
      expect(definition.buildSuccess).toBeTypeOf("function");
    }
  });
});
