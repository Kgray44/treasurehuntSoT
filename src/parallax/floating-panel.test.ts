import { describe, expect, it } from "vitest";
import { adjustFloatingPanel, fitFloatingPanel, floatingEdges } from "./floating-panel";

const bounds = { x: 8, y: 100, width: 1200, height: 900 };
const panel = { x: 300, y: 250, width: 500, height: 600 };
describe("floating assistance geometry", () => {
  it("keeps the complete window reachable when moving or shrinking the viewport", () => {
    expect(adjustFloatingPanel(panel, "move", -1000, 2000, bounds)).toEqual({ ...panel, x: 8, y: 400 });
    expect(fitFloatingPanel(panel, { x: 8, y: 80, width: 280, height: 210 })).toEqual({
      x: 8,
      y: 80,
      width: 280,
      height: 210,
    });
  });
  it.each(floatingEdges)("resizes %s while holding the opposite edges stationary", (edge) => {
    const resized = adjustFloatingPanel(panel, edge, 30, 40, bounds);
    expect(resized.x).toBe(panel.x + (edge.includes("w") ? 30 : 0));
    expect(resized.y).toBe(panel.y + (edge.includes("n") ? 40 : 0));
    expect(resized.x + resized.width).toBe(panel.x + panel.width + (edge.includes("e") ? 30 : 0));
    expect(resized.y + resized.height).toBe(panel.y + panel.height + (edge.includes("s") ? 40 : 0));
  });
  it("limits minimum size and outward resizing without moving the fixed corner", () => {
    expect(adjustFloatingPanel(panel, "nw", 900, 900, bounds)).toEqual({ x: 480, y: 430, width: 320, height: 420 });
    expect(adjustFloatingPanel(panel, "se", 900, 900, bounds)).toEqual({ ...panel, width: 908, height: 750 });
  });
});
