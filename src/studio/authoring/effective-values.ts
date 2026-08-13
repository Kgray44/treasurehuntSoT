import type { JsonObject } from "@/chronicle/types";

export type EffectiveValueState = "CONFIGURED" | "CANONICAL_DEFAULT" | "UNAVAILABLE" | "LEGACY";

export type EffectiveValue = {
  configured: unknown;
  effective: unknown;
  state: EffectiveValueState;
};

export function readAuthoringPath(source: JsonObject | undefined, path: string): unknown {
  if (!source) return undefined;
  return path.split(".").reduce<unknown>((value, segment) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    return (value as JsonObject)[segment];
  }, source);
}

export function hasAuthoringPath(source: JsonObject | undefined, path: string): boolean {
  if (!source) return false;
  return path.split(".").every((segment, index, segments) => {
    const parent = segments.slice(0, index).reduce<unknown>((value, part) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
      return (value as JsonObject)[part];
    }, source);
    return Boolean(parent && typeof parent === "object" && !Array.isArray(parent) && Object.hasOwn(parent, segment));
  });
}

export function effectiveValue(
  configuredSource: JsonObject | undefined,
  defaultSource: JsonObject | undefined,
  path: string,
  legacy = false,
): EffectiveValue {
  const configured = readAuthoringPath(configuredSource, path);
  if (hasAuthoringPath(configuredSource, path))
    return { configured, effective: configured, state: legacy ? "LEGACY" : "CONFIGURED" };
  const fallback = readAuthoringPath(defaultSource, path);
  if (fallback !== undefined) return { configured: undefined, effective: fallback, state: "CANONICAL_DEFAULT" };
  return { configured: undefined, effective: undefined, state: "UNAVAILABLE" };
}

export function effectiveValueLabel(value: EffectiveValue): string {
  if (value.state === "CONFIGURED") return "Configured";
  if (value.state === "CANONICAL_DEFAULT") return "Canonical default";
  if (value.state === "LEGACY") return "Legacy value";
  return "Not required";
}
