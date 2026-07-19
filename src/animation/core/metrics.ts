type MetricKey = "rive" | "lottie" | "pageFlip" | "gsap";
const counts: Record<MetricKey, number> = { rive: 0, lottie: 0, pageFlip: 0, gsap: 0 };
const failures = new Set<string>();

export function changeMountedMetric(key: MetricKey, delta: number) {
  counts[key] = Math.max(0, counts[key] + delta);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("forever-animation-metrics"));
}

export function recordAssetFailure(key: string) {
  failures.add(key);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("forever-animation-metrics"));
}

export function resetAnimationMetrics() {
  (Object.keys(counts) as MetricKey[]).forEach((key) => (counts[key] = 0));
  failures.clear();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("forever-animation-metrics"));
}

export function readAnimationMetrics() {
  return { ...counts, failures: [...failures] };
}

export function readAnimationAuthorityMetrics(registry: import("../hosts/scene-host-registry").SceneHostRegistry) {
  const snapshot = registry.snapshot();
  return Object.freeze({
    providerId: snapshot.providerId,
    registeredHostCount: snapshot.registeredHostCount,
    registeredTargetCount: snapshot.registeredTargetCount,
    activeInvocationCount: snapshot.activeInvocationCount,
    externalHandleCount: snapshot.externalHandleCount,
    activeClaimCount: snapshot.activeClaimCount,
  });
}
