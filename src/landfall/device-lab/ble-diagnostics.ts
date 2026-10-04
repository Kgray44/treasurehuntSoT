import { nativeBleObservationSchema } from "../native-ble";

const fields = ["type", "family", "protocol", "authenticated", "scanId", "peerId", "observedAt", "rssi"] as const;
type Field = (typeof fields)[number] | "UNRECOGNIZED_FIELD";
export type DeviceLabBleDiagnostic = {
  received: number;
  validShape: number;
  invalidShape: number;
  stale: number;
  future: number;
  hidden: number;
  invalidFields: Field[];
};
/** Diagnostic-only categorical counters; never retain identity, RSSI or event payloads. */
export class DeviceLabBleDiagnostics {
  private readonly value: DeviceLabBleDiagnostic = {
    received: 0,
    validShape: 0,
    invalidShape: 0,
    stale: 0,
    future: 0,
    hidden: 0,
    invalidFields: [],
  };
  observe(input: unknown, now: number, hidden: boolean) {
    const increment = (field: Exclude<keyof DeviceLabBleDiagnostic, "invalidFields">) =>
      (this.value[field] = Math.min(100000, this.value[field] + 1));
    increment("received");
    if (hidden) increment("hidden");
    const parsed = nativeBleObservationSchema.safeParse(input);
    if (!parsed.success) {
      increment("invalidShape");
      for (const issue of parsed.error.issues) {
        const field = fields.find((field) => field === issue.path[0]) ?? "UNRECOGNIZED_FIELD";
        if (!this.value.invalidFields.includes(field)) this.value.invalidFields.push(field);
      }
      return;
    }
    increment("validShape");
    if (!Number.isFinite(now) || parsed.data.observedAt > now + 1000) increment("future");
    else if (now - parsed.data.observedAt > 5000) increment("stale");
  }
  snapshot(): DeviceLabBleDiagnostic {
    return { ...this.value, invalidFields: [...this.value.invalidFields].sort() };
  }
}
