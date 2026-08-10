export const storyMotionPresets = [
  { id: "fade", label: "Fade", description: "A quiet dissolve through the paper grain." },
  { id: "slide", label: "Chart slide", description: "The Passage arrives from the next chart edge." },
  { id: "expand", label: "Expand", description: "The page opens outward from its center." },
  { id: "minimize", label: "Minimize", description: "The previous Passage tucks neatly into the binding." },
  { id: "glide", label: "Glide", description: "The Passage drifts in with a steady sea-wind." },
  { id: "ink-bloom", label: "Ink bloom", description: "Ink spreads across the leaf before the words settle." },
  { id: "lantern-swell", label: "Lantern swell", description: "A lantern glow rises around the new Passage." },
  { id: "compass-spin", label: "Compass spin", description: "The compass turns and finds the next bearing." },
  { id: "tidal-wake", label: "Tidal wake", description: "A soft wake rolls beneath the page." },
  { id: "starlight-fall", label: "Starlight fall", description: "A brief fall of stars reveals the story." },
] as const;

export type StoryMotionId = (typeof storyMotionPresets)[number]["id"];

const storyMotionIds = new Set<string>(storyMotionPresets.map((preset) => preset.id));

export function resolveStoryMotion(value: unknown, fallback: StoryMotionId = "fade"): StoryMotionId {
  return typeof value === "string" && storyMotionIds.has(value) ? (value as StoryMotionId) : fallback;
}

export function readStayStoryMotion(value: unknown): StoryMotionId | null {
  if (typeof value !== "string" || !value.startsWith("shipwright-stay:")) return null;
  const candidate = value.slice("shipwright-stay:".length);
  return storyMotionIds.has(candidate) ? (candidate as StoryMotionId) : null;
}
