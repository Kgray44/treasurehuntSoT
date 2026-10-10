import { SextantCapabilityRegistry } from "./capabilities";
import {
  unknownState,
  updateInterval,
  type CapabilityState,
  type ProviderSample,
  type SextantProvider,
  type UpdateClass,
} from "./contracts";
import {
  finiteVector,
  inverseQuaternion,
  multiplyQuaternion,
  orientationQuaternion,
  radians,
  wrapDegrees,
  headingFromAttitude,
  type Quaternion,
} from "./attitude";
import { MotionClassifier } from "./gestures";
export type WebSensorTarget = {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
  document?: {
    visibilityState: string;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
  };
  isSecureContext?: boolean;
  DeviceOrientationEvent?: { requestPermission?: (absolute?: boolean) => Promise<string> };
  DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
  screen?: { orientation?: { angle: number } };
};
export type WebSensorOptions = {
  /** Only a qualified provider/platform policy can assert the north reference of absolute event alpha. */
  absoluteNorthReference?: "MAGNETIC" | "TRUE" | "UNKNOWN";
  emulationIdentity?: string;
};
export const webMotionCapabilities = [
  "sextant.motion.linear-acceleration",
  "sextant.motion.acceleration-including-gravity",
  "sextant.motion.gravity",
  "sextant.motion.angular-velocity",
  "sextant.motion.stability",
  "sextant.motion.moving",
];
export const webOrientationCapabilities = [
  "sextant.orientation.relative",
  "sextant.orientation.absolute",
  "sextant.orientation.attitude",
  "sextant.heading.estimate",
];
/** A singleton acquisition hub per target. Both semantic and accepted legacy consumers share owned event listeners. */
const hubs = new WeakMap<object, WebSensorHub>();
export class WebSensorHub {
  private readonly subscribers = new Map<string, Set<EventListener>>();
  private readonly dispatchers = new Map<string, EventListener>();
  constructor(private readonly target: WebSensorTarget) {}
  subscribe(type: string, listener: EventListener) {
    let set = this.subscribers.get(type);
    if (!set) {
      set = new Set();
      this.subscribers.set(type, set);
      const dispatch: EventListener = (event) => {
        for (const callback of [...(this.subscribers.get(type) ?? [])]) {
          try {
            callback(event);
          } catch {
            /* Consumer isolation. */
          }
        }
      };
      try {
        this.target.addEventListener(type, dispatch);
        this.dispatchers.set(type, dispatch);
      } catch (error) {
        this.subscribers.delete(type);
        throw error;
      }
    }
    set.add(listener);
    return () => {
      const current = this.subscribers.get(type);
      current?.delete(listener);
      if (!current?.size) {
        const dispatcher = this.dispatchers.get(type);
        if (dispatcher) this.target.removeEventListener(type, dispatcher);
        this.subscribers.delete(type);
        this.dispatchers.delete(type);
      }
    };
  }
  diagnostics() {
    return { ownedListeners: this.dispatchers.size };
  }
}
export function webSensorHub(target: WebSensorTarget) {
  let hub = hubs.get(target);
  if (!hub) {
    hub = new WebSensorHub(target);
    hubs.set(target, hub);
  }
  return hub;
}
/** Event-family provider; discovery is API support, never a claim that a physical sensor produced valid data. */
export class WebDeviceSensorProvider implements SextantProvider {
  readonly definition: SextantProvider["definition"];
  readonly simulationIdentity?: string;
  private emit: ((sample: ProviderSample) => void) | null = null;
  private cleanups: (() => void)[] = [];
  private interval = 100;
  private last = -Infinity;
  private clock = -Infinity;
  private reference: Quaternion | null = null;
  private referenceKind: string | null = null;
  private classifier = new MotionClassifier();
  private discontinuity = false;
  private readonly registry = new SextantCapabilityRegistry();
  constructor(
    private readonly target: WebSensorTarget | null,
    private readonly family: "ORIENTATION" | "MOTION",
    private readonly now: () => number = () => performance.now(),
    private readonly options: WebSensorOptions = {},
  ) {
    const capabilities = family === "ORIENTATION" ? webOrientationCapabilities : webMotionCapabilities;
    this.simulationIdentity = options.emulationIdentity;
    this.definition = {
      providerId: `web.device-${family.toLowerCase()}`,
      providerVersion: 1,
      platformFamily: options.emulationIdentity ? "SYNTHETIC" : "WEB",
      capabilities: [...capabilities],
      discoveryMethod: "EXPLICIT",
      permissionRequirements: [...new Set(capabilities.map((id) => this.registry.get(id).permission))],
      lifecycleConstraints: "FOREGROUND_ONLY",
      qualityMetadata: "PER_OBSERVATION",
      referenceFrames: ["DEVICE", "LOCAL_ARBITRARY", "EARTH_MAGNETIC", "EARTH_TRUE", "GRAVITY_ALIGNED"],
      samplingBounds: { minimumIntervalMs: 16, maximumIntervalMs: 5000 },
      powerClass: "VARIABLE",
      privacyClass: "LOCAL_EPHEMERAL",
      simulationSupport: Boolean(options.emulationIdentity),
    };
  }
  discover(id: string): CapabilityState {
    const supported =
      this.definition.capabilities.includes(id) &&
      this.target?.isSecureContext !== false &&
      Boolean(this.family === "ORIENTATION" ? this.target?.DeviceOrientationEvent : this.target?.DeviceMotionEvent);
    return {
      ...unknownState(),
      support: supported ? "SUPPORTED" : "UNSUPPORTED",
      availability: supported ? "AVAILABLE" : "TEMPORARILY_UNAVAILABLE",
      calibration: "UNKNOWN",
      freshness: "UNKNOWN",
    };
  }
  setUpdateClass(value: UpdateClass) {
    this.interval = updateInterval[value];
  }
  async start(context: Parameters<SextantProvider["start"]>[0]) {
    await this.stop();
    if (
      !this.target ||
      this.target.document?.visibilityState === "hidden" ||
      context.signal.aborted ||
      this.discover(this.definition.capabilities[0]).support !== "SUPPORTED"
    )
      throw new Error("SEXTANT_WEB_SENSOR_UNAVAILABLE");
    this.setUpdateClass(context.updateClass);
    this.emit = context.emit;
    const stop = () => {
      void this.stop();
    };
    const visibility: EventListener = () => {
      if (this.target?.document?.visibilityState === "hidden") {
        stop();
        context.fail();
      }
    };
    const listener: EventListener = (event) => {
      if (!this.options.emulationIdentity && !event.isTrusted) return;
      if (!this.emit || context.signal.aborted || this.target?.document?.visibilityState === "hidden") return;
      const at = this.now();
      if (!Number.isFinite(at) || at < 0 || at <= this.clock) return;
      if (this.clock !== -Infinity && at - this.clock > 500) {
        this.reference = null;
        this.referenceKind = null;
        this.classifier.reset();
        this.discontinuity = true;
      }
      this.clock = at;
      // Stable classification needs short continuous samples; never integrate over gaps between passive updates.
      if (this.family === "ORIENTATION") {
        if (at - this.last < this.interval) return;
        this.orientation(event as DeviceOrientationEvent, at);
      } else this.motion(event as DeviceMotionEvent, at, at - this.last >= this.interval);
      if (at - this.last >= this.interval) {
        this.last = at;
        this.discontinuity = false;
      }
    };
    try {
      this.cleanups.push(
        webSensorHub(this.target).subscribe(
          this.family === "ORIENTATION" ? "deviceorientation" : "devicemotion",
          listener,
        ),
      );
      if (this.family === "ORIENTATION")
        this.cleanups.push(webSensorHub(this.target).subscribe("deviceorientationabsolute", listener));
      this.target.document?.addEventListener("visibilitychange", visibility);
      this.cleanups.push(() => this.target?.document?.removeEventListener("visibilitychange", visibility));
      context.signal.addEventListener("abort", stop, { once: true });
      this.cleanups.push(() => context.signal.removeEventListener("abort", stop));
    } catch (error) {
      await this.stop();
      throw error;
    }
  }
  private sample(
    id: string,
    value: unknown,
    at: number,
    referenceFrame: ProviderSample["referenceFrame"],
    warnings: string[] = [],
    uncertainty?: number,
  ) {
    const c = this.registry.get(id);
    this.emit?.({
      capabilityId: id,
      value,
      discontinuity: this.discontinuity,
      units: c.units,
      referenceFrame,
      timestampMonotonic: at,
      confidence: null,
      calibrationState: "UNKNOWN",
      qualityClass: warnings.some((warning) =>
        ["HEADING_ACCURACY_UNKNOWN", "GRAVITY_NOT_SEPARATED", "MOTION_CLASSIFICATION_UNAVAILABLE"].includes(warning),
      )
        ? "LOW"
        : "MEDIUM",
      warnings: ["PLATFORM_ACCURACY_UNQUALIFIED", "RECEIPT_TIME_NOT_SENSOR_CAPTURE_TIME", ...warnings],
      ...(uncertainty === undefined ? {} : { uncertainty }),
    });
  }
  private orientation(
    event: DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number },
    at: number,
  ) {
    if ([event.alpha, event.beta, event.gamma].some((n) => typeof n !== "number" || !Number.isFinite(n))) return;
    let q: Quaternion;
    try {
      q = orientationQuaternion(event.alpha!, event.beta!, event.gamma!);
    } catch {
      return;
    }
    const north = this.options.absoluteNorthReference ?? "UNKNOWN";
    const absolute = event.absolute === true && north !== "UNKNOWN";
    const kind = absolute ? north : event.absolute ? "EARTH_UNQUALIFIED" : "LOCAL";
    if (this.referenceKind !== null && this.referenceKind !== kind) {
      this.reference = null;
      this.discontinuity = true;
    }
    this.referenceKind = kind;
    this.reference ??= q;
    this.sample(
      "sextant.orientation.relative",
      multiplyQuaternion(inverseQuaternion(this.reference), q),
      at,
      "LOCAL_ARBITRARY",
    );
    this.sample(
      "sextant.orientation.attitude",
      q,
      at,
      absolute ? (north === "TRUE" ? "EARTH_TRUE" : "EARTH_MAGNETIC") : "LOCAL_ARBITRARY",
      absolute ? [] : ["ABSOLUTE_REFERENCE_UNAVAILABLE"],
    );
    if (absolute)
      this.sample("sextant.orientation.absolute", q, at, north === "TRUE" ? "EARTH_TRUE" : "EARTH_MAGNETIC");
    const compass = event.webkitCompassHeading,
      accuracy = event.webkitCompassAccuracy;
    if (typeof compass === "number" && Number.isFinite(compass)) {
      // Negative accuracy is the vendor's unusable/calibration signal; never turn it into zero error.
      if (typeof accuracy === "number" && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 180)) return;
      this.sample(
        "sextant.heading.estimate",
        wrapDegrees(compass),
        at,
        "EARTH_MAGNETIC",
        accuracy === undefined ? ["HEADING_ACCURACY_UNKNOWN"] : [],
        accuracy,
      );
    } else if (absolute) {
      const heading = headingFromAttitude(q);
      if (heading !== null)
        this.sample("sextant.heading.estimate", heading, at, north === "TRUE" ? "EARTH_TRUE" : "EARTH_MAGNETIC", [
          "HEADING_ACCURACY_UNKNOWN",
        ]);
    }
  }
  private motion(event: DeviceMotionEvent, at: number, deliver: boolean) {
    const linear = finiteVector(event.acceleration),
      including = finiteVector(event.accelerationIncludingGravity);
    const r = event.rotationRate;
    const angular =
      r && [r.alpha, r.beta, r.gamma].every((v) => typeof v === "number" && Number.isFinite(v))
        ? { x: radians(r.beta!), y: radians(r.gamma!), z: radians(r.alpha!) }
        : null;
    const state = this.classifier.update(at, linear, angular);
    if (!deliver) return;
    if (linear) this.sample("sextant.motion.linear-acceleration", linear, at, "DEVICE");
    if (including)
      this.sample(
        "sextant.motion.acceleration-including-gravity",
        including,
        at,
        "DEVICE",
        linear ? [] : ["GRAVITY_NOT_SEPARATED"],
      );
    if (linear && including)
      this.sample(
        "sextant.motion.gravity",
        { x: including.x - linear.x, y: including.y - linear.y, z: including.z - linear.z },
        at,
        "DEVICE",
      );
    if (angular) this.sample("sextant.motion.angular-velocity", angular, at, "DEVICE");
    this.sample(
      "sextant.motion.stability",
      state,
      at,
      "DEVICE",
      state === "UNKNOWN" ? ["MOTION_CLASSIFICATION_UNAVAILABLE"] : [],
    );
    if (state !== "UNKNOWN") this.sample("sextant.motion.moving", state === "MOVING", at, "DEVICE");
  }
  async stop() {
    this.emit = null;
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
    this.reference = null;
    this.referenceKind = null;
    this.last = -Infinity;
    this.clock = -Infinity;
    this.classifier.reset();
    this.discontinuity = false;
  }
}
