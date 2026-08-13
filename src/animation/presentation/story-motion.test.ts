import { describe, expect, it } from "vitest";
import { readStayStoryMotion, resolveStoryMotion, storyMotionPresets } from "./story-motion";

describe("Shipwright story motion presets", () => {
  it("offers the finite ten-preset vocabulary and safely resolves persisted values", () => {
    expect(storyMotionPresets.map((preset) => preset.id)).toEqual([
      "fade",
      "slide",
      "expand",
      "minimize",
      "glide",
      "ink-bloom",
      "lantern-swell",
      "compass-spin",
      "tidal-wake",
      "starlight-fall",
    ]);
    expect(resolveStoryMotion("tidal-wake")).toBe("tidal-wake");
    expect(resolveStoryMotion("unbounded-custom-motion")).toBe("fade");
    expect(readStayStoryMotion("shipwright-stay:lantern-swell")).toBe("lantern-swell");
    expect(readStayStoryMotion("unrelated-scene")).toBeNull();
  });
});
