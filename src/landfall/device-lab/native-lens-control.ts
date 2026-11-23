import { Buffer } from "node:buffer";

const labels = {
  OPEN: "Open camera-free Lens",
  START: "Open camera-free Device Lab",
  INSPECT: "Inspect selected object",
  RETURN: "Return to Guided View",
  CLOSE: "Close Chronicle Lens",
  SCENE: "Camera-free 3D scene",
  ERROR: "Camera-free simulation cannot record a real native observation. Your Voyage progress has not changed.",
  VOYAGE: "Synthetic Device Lab Voyage",
  WEBVIEW: "",
} as const;

export type NativeLensControl = keyof typeof labels;
type Attributes = Record<string, string>;
const touches = new Set<NativeLensControl>(["OPEN", "START", "INSPECT", "RETURN", "CLOSE"]);

function decoded(value: string): string {
  const named: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
  return value.replace(/&[^;]*;|&/g, (entity) => {
    if (Object.hasOwn(named, entity)) return named[entity];
    const numeric = /^&#(?:(\d+)|x([0-9a-fA-F]+));$/.exec(entity);
    const point = numeric ? Number.parseInt(numeric[1] ?? numeric[2], numeric[1] ? 10 : 16) : NaN;
    if (
      !Number.isSafeInteger(point) ||
      !([9, 10, 13].includes(point) || (point >= 32 && point <= 0x10ffff)) ||
      (point >= 0xd800 && point <= 0xdfff) ||
      point === 0xfffe ||
      point === 0xffff
    )
      throw new Error("NATIVE_LENS_XML_INVALID");
    return String.fromCodePoint(point);
  });
}

/** Parse only UiAutomator's bounded hierarchy/node grammar. No entities are
 * resolved externally, and decoded text can never introduce another attribute.
 */
function nodes(xml: string): Attributes[] {
  if (typeof xml !== "string" || Buffer.byteLength(xml, "utf8") > 262144)
    throw new Error("NATIVE_LENS_HIERARCHY_TOO_LARGE");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ud800-\udfff\ufffe\uffff]/u.test(xml))
    throw new Error("NATIVE_LENS_XML_INVALID");
  const source = xml.replace(/^\s*<\?xml\s+[^<>?]*\?>/, "");
  const grammar =
    /<\/?(?:hierarchy|node)(?=\s|\/?>)(?:\s+[A-Za-z_][A-Za-z0-9_.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?>/g;
  const tags = [...source.matchAll(grammar)];
  if (source.replace(grammar, "").trim() !== "" || tags.length === 0) throw new Error("NATIVE_LENS_XML_INVALID");
  const stack: string[] = [];
  const result: Attributes[] = [];
  let rootSeen = false;
  for (const [tag] of tags) {
    const name = /^<\/?(hierarchy|node)\b/.exec(tag)![1];
    if (tag.startsWith("</")) {
      if (!/^<\/(hierarchy|node)\s*>$/.test(tag) || stack.pop() !== name) throw new Error("NATIVE_LENS_XML_INVALID");
      continue;
    }
    if (stack.length === 0) {
      if (rootSeen || name !== "hierarchy") throw new Error("NATIVE_LENS_XML_INVALID");
      rootSeen = true;
    } else if (name !== "node") throw new Error("NATIVE_LENS_XML_INVALID");
    const attributes: Attributes = Object.create(null);
    for (const match of tag.matchAll(/([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/g)) {
      if (Object.hasOwn(attributes, match[1])) throw new Error("NATIVE_LENS_XML_INVALID");
      attributes[match[1]] = decoded(match[2] ?? match[3]);
    }
    if (name === "node") result.push(attributes);
    if (!tag.endsWith("/>")) stack.push(name);
  }
  if (!rootSeen || stack.length !== 0) throw new Error("NATIVE_LENS_XML_INVALID");
  return result;
}

/** Coordinates come only from one actual owned UiAutomator target. Test XML
 * exercises this parser; it never proves a device, pixels, tracking or an input.
 */
export function nativeLensControl(xml: string, control: NativeLensControl) {
  if (typeof control !== "string" || !Object.hasOwn(labels, control)) throw new Error("NATIVE_LENS_CONTROL_INVALID");
  const candidates = nodes(xml).filter((node) => {
    if (node.package !== "com.voyagewright.landfall" || node.enabled !== "true" || node["visible-to-user"] === "false")
      return false;
    if (control === "WEBVIEW") return node.class === "android.webkit.WebView";
    if (control === "SCENE") return node["content-desc"] === labels.SCENE;
    if (touches.has(control) && (node.class !== "android.widget.Button" || node.clickable !== "true")) return false;
    return node.text === labels[control] || node["content-desc"] === labels[control];
  });
  if (candidates.length !== 1) throw new Error("NATIVE_LENS_CONTROL_UNOBSERVED_OR_AMBIGUOUS");
  const observed = /^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/.exec(candidates[0].bounds ?? "");
  if (!observed) throw new Error("NATIVE_LENS_BOUNDS_INVALID");
  const [left, top, right, bottom] = observed.slice(1).map(Number);
  if (
    ![left, top, right, bottom].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 4096) ||
    right <= left ||
    bottom <= top
  )
    throw new Error("NATIVE_LENS_BOUNDS_INVALID");
  return { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2), bounds: { left, top, right, bottom } };
}

/** DOM visibility alone cannot prove that the native dialog stopped covering
 * the Player. Observe the actual owned WebView and absence of native controls
 * before accepting the joined Player outcome. No coordinates come from this.
 */
export function nativeLensPlayerVisible(xml: string): boolean {
  const owned = nodes(xml).filter(
    (node) => node.package === "com.voyagewright.landfall" && node["visible-to-user"] !== "false",
  );
  return (
    owned.some((node) => node.class === "android.webkit.WebView") &&
    !owned.some(
      (node) =>
        node["content-desc"] === labels.SCENE ||
        (node.class === "android.widget.Button" &&
          [labels.INSPECT, labels.RETURN, "Select object at center"].some(
            (label) => node.text === label || node["content-desc"] === label,
          )),
    )
  );
}
