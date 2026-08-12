import { sanitizeAdministrativeMetadata } from "./audit";

export const ADMIRALTY_DATA_CLASSES = ["PUBLIC", "ACCOUNT_PRIVATE", "OPERATIONAL_SENSITIVE"] as const;
export type AdmiraltyDataClass = (typeof ADMIRALTY_DATA_CLASSES)[number];

export const ADMIRALTY_OPERATIONAL_STATES = [
  "IMPLEMENTED",
  "CONFIGURED",
  "NOT_CONFIGURED",
  "LIVE_VALIDATED",
  "NOT_LIVE_VALIDATED",
  "HEALTHY",
  "DEGRADED",
  "UNAVAILABLE",
  "STALE",
  "EXTERNAL_PENDING",
  "UNKNOWN",
] as const;
export type AdmiraltyOperationalState = (typeof ADMIRALTY_OPERATIONAL_STATES)[number];

export type AdmiraltyEvidence = Readonly<{
  source: string;
  observedAt: string;
  freshness: "LIVE" | "RECENT" | "STALE" | "NEVER_FETCHED" | "NOT_APPLICABLE";
  lastSuccessfulRefresh: string | null;
  environment: string;
  safeError: string | null;
  dataClass: AdmiraltyDataClass;
}>;

export type AdmiraltyProjection<T> = Readonly<{
  state: AdmiraltyOperationalState;
  evidence: AdmiraltyEvidence;
  data: T | null;
}>;

export const environmentLabel = () => process.env.VOYAGEWRIGHT_ENVIRONMENT ?? process.env.NODE_ENV ?? "unknown";

export function projection<T>(
  source: string,
  data: T,
  options: {
    state?: AdmiraltyOperationalState;
    dataClass?: AdmiraltyDataClass;
    observedAt?: Date;
    freshness?: AdmiraltyEvidence["freshness"];
  } = {},
): AdmiraltyProjection<T> {
  const observedAt = (options.observedAt ?? new Date()).toISOString();
  return {
    state: options.state ?? "HEALTHY",
    evidence: {
      source,
      observedAt,
      freshness: options.freshness ?? "LIVE",
      lastSuccessfulRefresh: observedAt,
      environment: environmentLabel(),
      safeError: null,
      dataClass: options.dataClass ?? "OPERATIONAL_SENSITIVE",
    },
    data,
  };
}

export function unavailableProjection<T>(
  source: string,
  safeError: string,
  options: {
    state?: AdmiraltyOperationalState;
    dataClass?: AdmiraltyDataClass;
    freshness?: AdmiraltyEvidence["freshness"];
  } = {},
): AdmiraltyProjection<T> {
  return {
    state: options.state ?? "UNAVAILABLE",
    evidence: {
      source,
      observedAt: new Date().toISOString(),
      freshness: options.freshness ?? "NEVER_FETCHED",
      lastSuccessfulRefresh: null,
      environment: environmentLabel(),
      safeError,
      dataClass: options.dataClass ?? "OPERATIONAL_SENSITIVE",
    },
    data: null,
  };
}

export function boundedQuery(value: string | string[] | undefined, minimum = 2, maximum = 96) {
  const query = (Array.isArray(value) ? value[0] : value)?.trim().slice(0, maximum) ?? "";
  return query.length >= minimum ? query : "";
}

export function boundedPage(value: string | string[] | undefined, maximum = 50) {
  const parsed = Number.parseInt(Array.isArray(value) ? (value[0] ?? "") : (value ?? ""), 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(maximum, parsed)) : 1;
}

export function abbreviatedId(value: string, length = 12) {
  return value.length <= length ? value : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function safeMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? sanitizeAdministrativeMetadata(parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
