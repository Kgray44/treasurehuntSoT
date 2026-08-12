import { describe, expect, it } from "vitest";
import { createDrydockSeededRandom, drawDrydockRandom } from "@/drydock/simulation/random";

describe("Drydock seeded randomness", () => {
  it("replays the identical draw sequence from the same explicit seed", () => {
    const drawSequence = (seed: string) => {
      let random = createDrydockSeededRandom(seed);
      return Array.from({ length: 4 }, () => {
        const result = drawDrydockRandom(random);
        random = result.next;
        return result.value;
      });
    };

    expect(drawSequence("sea-trial-seed")).toEqual(drawSequence("sea-trial-seed"));
    expect(drawSequence("sea-trial-seed")).not.toEqual(drawSequence("other-seed"));
  });
});
