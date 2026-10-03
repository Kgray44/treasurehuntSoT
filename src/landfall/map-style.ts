import type { StyleSpecification } from "maplibre-gl";

/** A trusted application provider still has to return bounded, declarative map data. */
export function validateLandfallMapStyle(
  input: unknown,
  policy?: { privacy: "LOCAL" | "FIRST_PARTY" | "THIRD_PARTY"; origin?: string },
): StyleSpecification {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("LANDFALL_MAP_STYLE_INVALID");
  let encoded: string;
  try {
    encoded = JSON.stringify(input);
  } catch {
    throw new Error("LANDFALL_MAP_STYLE_INVALID");
  }
  if (!encoded || encoded.length > 512_000) throw new Error("LANDFALL_MAP_STYLE_INVALID");
  const style = JSON.parse(encoded) as Record<string, unknown>;
  if (
    style.version !== 8 ||
    !Array.isArray(style.layers) ||
    style.layers.length > 128 ||
    !style.sources ||
    typeof style.sources !== "object" ||
    Array.isArray(style.sources)
  )
    throw new Error("LANDFALL_MAP_STYLE_INVALID");
  const sources = style.sources as Record<string, unknown>;
  if (
    Object.keys(sources).length > 32 ||
    Object.keys(sources).some((id) => id.startsWith("landfall-") || id === "landfall")
  )
    throw new Error("LANDFALL_MAP_STYLE_INVALID");
  if (
    style.layers.some(
      (layer) =>
        !layer || typeof layer !== "object" || typeof layer.id !== "string" || layer.id.startsWith("landfall-"),
    )
  )
    throw new Error("LANDFALL_MAP_STYLE_INVALID");
  const checkUrl = (value: string): void => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error("LANDFALL_MAP_STYLE_URL_UNSAFE");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw new Error("LANDFALL_MAP_STYLE_URL_UNSAFE");
    if (policy?.privacy === "LOCAL" || (policy?.privacy === "FIRST_PARTY" && parsed.origin !== policy.origin))
      throw new Error("LANDFALL_MAP_STYLE_PRIVACY_MISMATCH");
  };
  const checkUrls = (value: unknown, depth: number): void => {
    if (depth > 20) throw new Error("LANDFALL_MAP_STYLE_INVALID");
    if (Array.isArray(value)) {
      value.forEach((item) => checkUrls(item, depth + 1));
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (["url", "tiles", "glyphs", "sprite", "data"].includes(key)) {
        if (typeof nested === "string") checkUrl(nested);
        else if (key === "tiles" && Array.isArray(nested))
          nested.forEach((tile) => {
            if (typeof tile !== "string") throw new Error("LANDFALL_MAP_STYLE_URL_UNSAFE");
            checkUrl(tile);
          });
      }
      checkUrls(nested, depth + 1);
    }
  };
  checkUrls(style, 0);
  return style as StyleSpecification;
}
