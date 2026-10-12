export type FloatingPanel = { x: number; y: number; width: number; height: number };
export type FloatingBounds = { x: number; y: number; width: number; height: number };
export const floatingEdges = ["n", "e", "s", "w", "ne", "nw", "se", "sw"] as const;
export type FloatingGesture = "move" | (typeof floatingEdges)[number];
const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, value)));

/** Presentation only: keep the whole window reachable without changing the scene. */
export function fitFloatingPanel(panel: FloatingPanel, bounds: FloatingBounds): FloatingPanel {
  const width = clamp(panel.width, Math.min(320, bounds.width), bounds.width);
  const height = clamp(panel.height, Math.min(420, bounds.height), bounds.height);
  return {
    x: clamp(panel.x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(panel.y, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  };
}

export function adjustFloatingPanel(
  panel: FloatingPanel,
  gesture: FloatingGesture,
  dx: number,
  dy: number,
  bounds: FloatingBounds,
): FloatingPanel {
  const start = fitFloatingPanel(panel, bounds);
  if (gesture === "move") return fitFloatingPanel({ ...start, x: start.x + dx, y: start.y + dy }, bounds);
  let left = start.x,
    right = start.x + start.width,
    top = start.y,
    bottom = start.y + start.height;
  const minWidth = Math.min(320, bounds.width),
    minHeight = Math.min(420, bounds.height);
  if (gesture.includes("w")) left = clamp(left + dx, bounds.x, right - minWidth);
  if (gesture.includes("e")) right = clamp(right + dx, left + minWidth, bounds.x + bounds.width);
  if (gesture.includes("n")) top = clamp(top + dy, bounds.y, bottom - minHeight);
  if (gesture.includes("s")) bottom = clamp(bottom + dy, top + minHeight, bounds.y + bounds.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
