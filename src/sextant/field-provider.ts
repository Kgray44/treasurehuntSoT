import { SextantCapabilityRegistry } from "./capabilities";
import { unknownState, type ProviderSample, type SextantProvider, type UpdateClass } from "./contracts";
import { MagneticFieldContext, RelativeElevationContext, PedometerContext } from "./field-context";
import { normalizeObservation } from "./observations";

export type MagneticSensor = {
  x: number | null;
  y: number | null;
  z: number | null;
  start(): void;
  stop(): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};
/** Optional Generic Sensor adapter. Browser API existence does not assert calibration or physical hardware. */
export class WebMagneticFieldProvider implements SextantProvider {
  readonly simulationIdentity?: string;
  readonly definition: SextantProvider["definition"];
  private cleanup: (() => void) | null = null;
  private updateClass: UpdateClass = "LOW_RATE";
  constructor(
    private readonly sensorConstructor: (new (options: { frequency: number }) => MagneticSensor) | null,
    private readonly secureContext: boolean,
    private readonly now: () => number = () => performance.now(),
    emulationIdentity?: string,
  ) {
    this.simulationIdentity = emulationIdentity;
    this.definition = {
      providerId: "web.magnetic-field",
      providerVersion: 1,
      platformFamily: emulationIdentity ? "SYNTHETIC" : "WEB",
      capabilities: ["sextant.magnetic.field"],
      discoveryMethod: "EXPLICIT",
      permissionRequirements: ["PLATFORM_DEPENDENT"],
      lifecycleConstraints: "FOREGROUND_ONLY",
      qualityMetadata: "PER_OBSERVATION",
      referenceFrames: ["DEVICE"],
      samplingBounds: { minimumIntervalMs: 100, maximumIntervalMs: 5000 },
      powerClass: "VARIABLE",
      privacyClass: "LOCAL_EPHEMERAL",
      simulationSupport: true,
    };
  }
  discover() {
    return {
      ...unknownState(),
      support: this.secureContext && this.sensorConstructor ? ("SUPPORTED" as const) : ("UNSUPPORTED" as const),
      calibration: "UNKNOWN" as const,
    };
  }
  async start(context: Parameters<SextantProvider["start"]>[0]) {
    if (!this.sensorConstructor || !this.secureContext || context.signal.aborted)
      throw new Error("SEXTANT_MAGNETIC_UNSUPPORTED");
    await this.stop();
    this.updateClass = context.updateClass;
    const sensor = new this.sensorConstructor({ frequency: 10 });
    let last = -Infinity;
    const reading: EventListener = () => {
      const at = this.now(),
        interval = this.updateClass === "PASSIVE" ? 5000 : this.updateClass === "LOW_RATE" ? 1000 : 100;
      if (context.signal.aborted || at - last < interval) return;
      const values = [sensor.x, sensor.y, sensor.z];
      if (values.some((v) => typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 2000)) return;
      last = at;
      context.emit({
        capabilityId: "sextant.magnetic.field",
        value: { x: sensor.x, y: sensor.y, z: sensor.z },
        units: "microtesla",
        referenceFrame: "DEVICE",
        timestampMonotonic: at,
        confidence: null,
        calibrationState: "UNKNOWN",
        qualityClass: "LOW",
        warnings: ["BROWSER_CALIBRATION_UNKNOWN", "MONOTONIC_RECEIPT_TIME_NOT_CAPTURE_TIME"],
      });
    };
    const error: EventListener = () => context.fail();
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      sensor.removeEventListener("reading", reading);
      sensor.removeEventListener("error", error);
      context.signal.removeEventListener("abort", stop);
      sensor.stop();
    };
    this.cleanup = stop;
    context.signal.addEventListener("abort", stop, { once: true });
    sensor.addEventListener("reading", reading);
    sensor.addEventListener("error", error);
    try {
      sensor.start();
    } catch {
      this.stop();
      throw new Error("SEXTANT_MAGNETIC_PERMISSION_OR_POLICY_FAILED");
    }
  }
  setUpdateClass(value: UpdateClass) {
    this.updateClass = value;
  }
  async stop() {
    const c = this.cleanup;
    this.cleanup = null;
    c?.();
  }
}
/** Adapter helper for governed native/accessory providers. It supplies semantics, not a native hardware implementation. */
export class SextantFieldDerivations {
  private magnetic = new MagneticFieldContext();
  private elevation = new RelativeElevationContext();
  private steps = new PedometerContext();
  private readonly capabilities = new SextantCapabilityRegistry();
  private sequence = 0;
  derive(provider: SextantProvider, sample: ProviderSample, now: number): ProviderSample | null {
    const o = normalizeObservation(this.capabilities, provider, sample, {
      now,
      sequence: this.sequence++,
      discontinuity: sample.discontinuity === true,
    });
    if (o.capabilityId === "sextant.magnetic.field")
      return {
        ...sample,
        capabilityId: "sextant.magnetic.context",
        value: this.magnetic.accept(o, now),
        units: "context",
        confidence: null,
      };
    if (o.capabilityId === "sextant.pressure.observation")
      return {
        ...sample,
        capabilityId: "sextant.elevation.context",
        value: this.elevation.accept(o, now),
        units: "context",
        referenceFrame: "LOCAL_ARBITRARY",
        confidence: null,
      };
    return null;
  }
  pedometer(input: Parameters<PedometerContext["accept"]>[0], now: number) {
    return this.steps.accept(input, now);
  }
  reset() {
    this.magnetic.reset();
    this.elevation.reset();
    this.steps.reset();
    this.sequence = 0;
  }
}
