import type { DrydockFaultFamily } from "@/drydock/simulation/model";

export const DRYDOCK_FAULT_CATALOG_VERSION = "drydock-fault-catalog-v1";

export type DrydockFaultEffect =
  | "AUDIT_ONLY"
  | "PAUSE"
  | "CANCEL"
  | "INCOMPLETE_PROOF"
  | "PRESENTATION_FALLBACK"
  | "VERIFICATION_UNCERTAIN";

export type DrydockFaultDefinition = Readonly<{
  family: DrydockFaultFamily;
  code: string;
  effect: DrydockFaultEffect;
  safeEventType: string;
}>;

const definitions: readonly DrydockFaultDefinition[] = [
  { family: "NETWORK", code: "OFFLINE", effect: "PAUSE", safeEventType: "networkUnavailable" },
  { family: "NETWORK", code: "LATENCY", effect: "AUDIT_ONLY", safeEventType: "networkLatencyInjected" },
  { family: "ASSET", code: "UNAVAILABLE", effect: "PRESENTATION_FALLBACK", safeEventType: "assetUnavailable" },
  { family: "ASSET", code: "DECODE_FAILED", effect: "PRESENTATION_FALLBACK", safeEventType: "assetDecodeFailed" },
  { family: "PROVIDER", code: "UNAVAILABLE", effect: "VERIFICATION_UNCERTAIN", safeEventType: "providerUnavailable" },
  { family: "PROVIDER", code: "STALE", effect: "VERIFICATION_UNCERTAIN", safeEventType: "providerStale" },
  { family: "PROVIDER", code: "DUPLICATE", effect: "VERIFICATION_UNCERTAIN", safeEventType: "providerDuplicate" },
  { family: "RUNTIME", code: "CANCEL", effect: "CANCEL", safeEventType: "runtimeCancelled" },
  { family: "RUNTIME", code: "RESTART", effect: "PAUSE", safeEventType: "runtimeRestarted" },
  { family: "PRESENTATION", code: "INTERRUPTED", effect: "PRESENTATION_FALLBACK", safeEventType: "presentationInterrupted" },
  { family: "PRESENTATION", code: "FAILED", effect: "PRESENTATION_FALLBACK", safeEventType: "presentationFailed" },
  { family: "DEVICE", code: "INPUT_UNAVAILABLE", effect: "PAUSE", safeEventType: "deviceInputUnavailable" },
  { family: "ACCESSIBILITY", code: "REDUCED_MOTION", effect: "AUDIT_ONLY", safeEventType: "reducedMotionApplied" },
  { family: "ACCESSIBILITY", code: "SCREEN_READER", effect: "AUDIT_ONLY", safeEventType: "screenReaderModeApplied" },
  { family: "TIME", code: "CLOCK_LIMIT", effect: "INCOMPLETE_PROOF", safeEventType: "virtualClockLimitReached" },
];

export const DRYDOCK_FAULT_CATALOG = Object.freeze(definitions.map((definition) => Object.freeze({ ...definition })));

const byIdentity = new Map(DRYDOCK_FAULT_CATALOG.map((definition) => [`${definition.family}:${definition.code}`, definition]));

export function drydockFaultDefinition(family: DrydockFaultFamily, code: string) {
  return byIdentity.get(`${family}:${code}`) ?? null;
}
