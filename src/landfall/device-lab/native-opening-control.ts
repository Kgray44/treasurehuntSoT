import { z } from "zod";

type OpeningDom = {
  box: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number; scale: number };
};
const geometrySchema = z.strictObject({
  version: z.literal(1),
  packageName: z.literal("com.voyagewright.landfall"),
  shown: z.literal(true),
  attached: z.literal(true),
  focused: z.literal(true),
  left: z.number().int().min(0).max(4096),
  top: z.number().int().min(0).max(4096),
  right: z.number().int().min(0).max(4096),
  bottom: z.number().int().min(0).max(4096),
});

/** Only the public synthetic Journal entry control can become an OS touch target. */
export function nativeJournalOpeningTouch(xml: string, observedDom?: OpeningDom) {
  if (xml.length > 262144) throw new Error("NATIVE_OPENING_HIERARCHY_TOO_LARGE");
  const candidates = [...xml.matchAll(/<node\b([^>]+)>/g)].filter((match) => {
    const attr = (key: string) => new RegExp(`(?:^|\\s)${key}="([^"]*)"`).exec(match[1])?.[1] ?? "";
    return (
      attr("package") === "com.voyagewright.landfall" &&
      attr("class") === "android.widget.Button" &&
      attr("clickable") === "true" &&
      attr("enabled") === "true" &&
      [attr("text"), attr("content-desc")].some((copy) => copy.length <= 160 && copy.includes("Open the journal"))
    );
  });
  let target = candidates[0];
  if (candidates.length === 0 && observedDom) {
    const webviews = [...xml.matchAll(/<node\b([^>]+)>/g)].filter(
      (match) =>
        /(?:^|\s)package="com\.voyagewright\.landfall"/.test(match[1]) &&
        /(?:^|\s)class="android\.webkit\.WebView"/.test(match[1]) &&
        /(?:^|\s)enabled="true"/.test(match[1]),
    );
    if (webviews.length !== 1) throw new Error("NATIVE_OPENING_WEBVIEW_UNOBSERVED_OR_AMBIGUOUS");
    target = webviews[0];
  } else if (candidates.length !== 1) throw new Error("NATIVE_OPENING_CONTROL_UNOBSERVED_OR_AMBIGUOUS");
  const bounds = /(?:^|\s)bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(target[1]);
  if (!bounds) throw new Error("NATIVE_OPENING_BOUNDS_UNOBSERVED");
  const [left, top, right, bottom] = bounds.slice(1).map(Number);
  if (right <= left || bottom <= top || right > 4096 || bottom > 4096) throw new Error("NATIVE_OPENING_BOUNDS_INVALID");
  if (candidates.length === 1) return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) };
  return nativeJournalOpeningGeometryTouch(
    {
      version: 1,
      packageName: "com.voyagewright.landfall",
      shown: true,
      attached: true,
      focused: true,
      left,
      top,
      right,
      bottom,
    },
    observedDom!,
  );
}

/** Actual native attached WebView measurements; no synthetic accessibility XML. */
export function nativeJournalOpeningGeometryTouch(nativeGeometry: unknown, observedDom: OpeningDom) {
  const { left, top, right, bottom } = geometrySchema.parse(nativeGeometry);
  if (right <= left || bottom <= top) throw new Error("NATIVE_OPENING_BOUNDS_INVALID");
  const { box, viewport } = observedDom;
  if (
    ![box.x, box.y, box.width, box.height, viewport.width, viewport.height, viewport.scale].every(Number.isFinite) ||
    viewport.scale !== 1 ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    viewport.width > 4096 ||
    viewport.height > 4096 ||
    box.x < 0 ||
    box.y < 0 ||
    box.width <= 0 ||
    box.height <= 0 ||
    box.x + box.width > viewport.width ||
    box.y + box.height > viewport.height
  )
    throw new Error("NATIVE_OPENING_DOM_GEOMETRY_INVALID");
  const scaleX = (right - left) / viewport.width,
    scaleY = (bottom - top) / viewport.height;
  if (Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY) > 0.03)
    throw new Error("NATIVE_OPENING_VIEWPORT_MAPPING_UNSAFE");
  return {
    x: Math.floor(left + (box.x + box.width / 2) * scaleX),
    y: Math.floor(top + (box.y + box.height / 2) * scaleY),
  };
}
