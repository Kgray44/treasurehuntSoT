import { createHash } from "node:crypto";

export const DRYDOCK_MAX_CANONICAL_BYTES = 32 * 1024;

export class DrydockCanonicalizationError extends Error {
  constructor(
    public readonly code: "NON_FINITE_NUMBER" | "UNSUPPORTED_VALUE" | "CANONICAL_SIZE_LIMIT",
    message: string,
  ) {
    super(message);
  }
}

export function canonicalizeValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new DrydockCanonicalizationError("NON_FINITE_NUMBER", "Authored numbers must be finite.");
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) return value.map(canonicalizeValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([key, child]) => [key, canonicalizeValue(child)]),
    );
  throw new DrydockCanonicalizationError(
    "UNSUPPORTED_VALUE",
    "Authored values must be JSON-compatible and cannot contain executable or runtime-only values.",
  );
}

export function canonicalJson(value: unknown, maximumBytes = DRYDOCK_MAX_CANONICAL_BYTES): string {
  const serialized = JSON.stringify(canonicalizeValue(value));
  if (Buffer.byteLength(serialized, "utf8") > maximumBytes)
    throw new DrydockCanonicalizationError(
      "CANONICAL_SIZE_LIMIT",
      `Canonical authored content exceeds the ${maximumBytes}-byte limit.`,
    );
  return serialized;
}

export function canonicalChecksum(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value, Number.MAX_SAFE_INTEGER)).digest("hex");
}
