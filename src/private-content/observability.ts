import { redactPrivate } from "./core";

export type PrivateMetric = { name: string; value: number; labels: Record<string, string> };
export type PrivateAlert = {
  code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  occurredAt: string;
  labels: Record<string, string>;
};
const safeLabel = /^[A-Z0-9_.:-]{1,80}$/;
function labels(input: Record<string, unknown>) {
  const forbidden = /passphrase|password|secret|token|credential|key|payload|private|path|url/i;
  return Object.fromEntries(
    Object.entries(redactPrivate(input) as Record<string, unknown>).flatMap(([key, value]) =>
      !forbidden.test(key) &&
      safeLabel.test(key.toUpperCase()) &&
      (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
        ? [[key, String(value).slice(0, 80)]]
        : [],
    ),
  );
}
/** In-memory sink for local validation; external dispatch is deliberately separate. */
export class DeterministicPrivateAlertSink {
  readonly alerts: PrivateAlert[] = [];
  emit(code: string, severity: PrivateAlert["severity"], input: Record<string, unknown> = {}) {
    const alert = {
      code: code.replace(/[^A-Z0-9_]/g, "_").slice(0, 80),
      severity,
      occurredAt: new Date().toISOString(),
      labels: labels(input),
    };
    this.alerts.push(alert);
    return alert;
  }
}
export class PrivateOperationalMetrics {
  private readonly values = new Map<string, PrivateMetric>();
  set(name: string, value: number, input: Record<string, unknown> = {}) {
    if (!Number.isFinite(value) || !/^[a-z0-9_:]+$/i.test(name)) return;
    const metric = { name, value, labels: labels(input) };
    this.values.set(`${name}:${JSON.stringify(metric.labels)}`, metric);
  }
  increment(name: string, input: Record<string, unknown> = {}) {
    const key = `${name}:${JSON.stringify(labels(input))}`;
    this.set(name, (this.values.get(key)?.value ?? 0) + 1, input);
  }
  snapshot() {
    return [...this.values.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
