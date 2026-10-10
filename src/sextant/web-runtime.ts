import { SextantCapabilityRegistry } from "./capabilities";
import { SextantProviderRegistry } from "./providers";
import { SextantPermissionBroker, type PermissionPurpose } from "./permissions";
import { SextantLeaseBroker, type LeaseRequest, type LeaseEvent } from "./leases";
import { SextantHaptics, webHapticAdapter } from "./haptics";
import { WebDeviceSensorProvider, type WebSensorOptions, type WebSensorTarget } from "./web-provider";
import { DeviceGestureRecognizer, type GestureConfig, type GestureInput, type GestureResult } from "./gestures";
import type { Observation, PermissionState } from "./contracts";
import type { Quaternion, Vector3 } from "./attitude";
import { gestureAcquisition, assertGestureCadence } from "./gesture-acquisition";
const motionKey = "MOTION_PERMISSION_PLATFORM_DEPENDENT",
  headingKey = "MOTION_OR_LOCATION_PLATFORM_DEPENDENT";
const runtimes = new WeakMap<object, WebSextantRuntime>();
/** Share this surface runtime with Crossdeck/Parallax; ownership stays local and explicit. */
export class WebSextantRuntime {
  readonly capabilities = new SextantCapabilityRegistry();
  readonly providers: SextantProviderRegistry;
  readonly permissions: SextantPermissionBroker;
  readonly leases: SextantLeaseBroker;
  readonly haptics: SextantHaptics;
  private disposed = false;
  private hapticsEnabled = true;
  private reducedSensory = false;
  private readonly detach: () => void;
  private readonly listeners = new Set<() => void>();
  private readonly detachPermission: () => void;
  constructor(
    private readonly target: WebSensorTarget | null,
    navigator: Pick<Navigator, "vibrate"> | null = null,
    private readonly now: () => number = () => performance.now(),
    options: WebSensorOptions = {},
  ) {
    this.providers = new SextantProviderRegistry(
      this.capabilities,
      options.emulationIdentity ? "DEVICE_LAB" : "PRODUCTION",
    );
    // Calling both APIs synchronously here preserves transient activation. No prompts at construction/discovery.
    let pending: Promise<PermissionState> | null = null;
    const requester = () => {
      if (target?.isSecureContext === false || !target || target.document?.visibilityState === "hidden")
        return Promise.resolve("RESTRICTED" as const);
      if (pending) return pending;
      try {
        const calls = [target.DeviceOrientationEvent, target.DeviceMotionEvent].filter((api) => api !== undefined);
        if (!calls.length) return Promise.resolve("RESTRICTED" as const);
        pending = Promise.all(
          calls.map((api) => (api?.requestPermission ? api.requestPermission() : Promise.resolve("granted"))),
        )
          .then((results): PermissionState => (results.every((r) => r === "granted") ? "GRANTED" : "DENIED"))
          .catch((): PermissionState => "RESTRICTED")
          .finally(() => {
            pending = null;
          });
        return pending;
      } catch {
        return Promise.resolve("RESTRICTED" as const);
      }
    };
    this.permissions = new SextantPermissionBroker((key) =>
      [motionKey, headingKey].includes(key) ? requester() : Promise.resolve("RESTRICTED"),
    );
    this.providers.register(new WebDeviceSensorProvider(target, "ORIENTATION", now, options));
    this.providers.register(new WebDeviceSensorProvider(target, "MOTION", now, options));
    this.leases = new SextantLeaseBroker(this.capabilities, this.providers, this.permissions, now);
    this.haptics = new SextantHaptics(webHapticAdapter(navigator), now);
    const visibility: EventListener = () => {
      const visible = target?.document?.visibilityState !== "hidden";
      this.haptics.setForeground(visible);
      void this.leases.setForeground(visible).finally(() => this.notify());
    };
    const pagehide: EventListener = () => {
      this.haptics.setForeground(false);
      void this.leases.setForeground(false).finally(() => this.notify());
    };
    const pageshow: EventListener = () => {
      visibility(new Event("visibilitychange"));
    };
    target?.document?.addEventListener("visibilitychange", visibility);
    target?.addEventListener("pagehide", pagehide);
    target?.addEventListener("pageshow", pageshow);
    this.detach = () => {
      target?.document?.removeEventListener("visibilitychange", visibility);
      target?.removeEventListener("pagehide", pagehide);
      target?.removeEventListener("pageshow", pageshow);
    };
    this.detachPermission = this.permissions.onChange(() => this.notify());
    if (target?.document?.visibilityState === "hidden") visibility(new Event("visibilitychange"));
  }
  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* Isolate status views. */
      }
    }
  }
  onStatusChange(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  async enable(purpose: PermissionPurpose) {
    if (this.disposed) throw new Error("SEXTANT_RUNTIME_DISPOSED");
    // Both purpose records share one in-flight platform request, while consent remains per purpose.
    const decisions = await Promise.all([motionKey, headingKey].map((key) => this.permissions.authorize(key, purpose)));
    this.notify();
    return decisions.every((d) => d === "GRANTED") ? ("GRANTED" as const) : ("DENIED" as const);
  }
  async acquire(request: LeaseRequest, callback: (event: LeaseEvent) => void) {
    if (this.disposed) throw new Error("SEXTANT_RUNTIME_DISPOSED");
    if ([motionKey, headingKey].includes(this.capabilities.get(request.capabilityId).permission))
      await this.enable(request);
    const lease = await this.leases.acquire(request, (event) => {
      callback(event);
      this.notify();
    });
    this.notify();
    return lease;
  }
  async beginGesture(
    config: GestureConfig,
    request: Omit<LeaseRequest, "capabilityId" | "frames">,
    onResult: (result: GestureResult) => void,
    options: { signal?: AbortSignal } = {},
  ) {
    const session = new SextantGestureSession(config, this.now);
    assertGestureCadence(session.recognizer.config, request.updateClass, request.expiresAt - this.now());
    const policy = gestureAcquisition(session.recognizer.config);
    const leases: Awaited<ReturnType<WebSextantRuntime["acquire"]>>[] = [];
    let reportedCompletion = false;
    let acquiring = true,
      ended = false;
    const release = async () => {
      ended = true;
      options.signal?.removeEventListener("abort", abort);
      const results = await Promise.allSettled(leases.map((lease) => lease.release()));
      session.reset();
      if (results.some((r) => r.status === "rejected")) throw new Error("SEXTANT_GESTURE_CLEANUP_FAILED");
    };
    const abort = () => {
      void release().catch(() => {});
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      for (const channel of policy.channels) {
        if (ended || options.signal?.aborted) throw new Error("SEXTANT_GESTURE_ABORTED");
        const lease = await this.acquire(
          {
            ...request,
            ...channel,
            maxAgeMs: Math.min(request.maxAgeMs, policy.maxAgeMs),
          },
          (event) => {
            if (ended) return;
            if (event.type === "ENDED") {
              abort();
              onResult({ state: "UNAVAILABLE", count: 0, coverageDegrees: 0, fallback: config.fallback });
              return;
            }
            if (acquiring) return;
            const result = session.accept(event);
            if (result && !(result.state === "COMPLETED" && reportedCompletion)) {
              reportedCompletion ||= result.state === "COMPLETED";
              onResult(result);
            } else if (event.type !== "OBSERVATION")
              onResult({ state: "UNAVAILABLE", count: 0, coverageDegrees: 0, fallback: config.fallback });
          },
        );
        leases.push(lease);
        if (ended || options.signal?.aborted) throw new Error("SEXTANT_GESTURE_ABORTED");
      }
      acquiring = false;
    } catch (error) {
      await release();
      throw error;
    }
    return {
      release,
      fallback: session.recognizer.config.fallback,
    };
  }
  async pause() {
    for (const key of [motionKey, headingKey]) this.permissions.pause(key);
    this.haptics.setPreferences(false, this.reducedSensory);
    await this.leases.idle();
    this.notify();
  }
  resume(userInitiated: boolean) {
    for (const key of [motionKey, headingKey]) this.permissions.resume(key, userInitiated);
    this.haptics.setPreferences(this.hapticsEnabled, this.reducedSensory);
    this.notify();
  }
  setHapticPreferences(enabled: boolean, reducedSensory = false) {
    this.hapticsEnabled = enabled;
    this.reducedSensory = reducedSensory;
    this.haptics.setPreferences(enabled && this.permissions.state(motionKey).enabled, reducedSensory);
    this.notify();
  }
  async revoke() {
    for (const key of [motionKey, headingKey]) this.permissions.set(key, "DENIED");
    this.haptics.cancel();
    await this.leases.idle();
    this.notify();
  }
  status(capabilityId: string, maxAgeMs = 500) {
    if (["sextant.haptics.basic", "sextant.haptics.rich"].includes(capabilityId)) {
      const output = this.haptics.status();
      const supported = capabilityId.endsWith("rich") ? output.tier === "RICH" : output.tier !== "NONE";
      const paused = !output.enabled || output.reducedSensory;
      return {
        support: supported ? ("SUPPORTED" as const) : ("UNSUPPORTED" as const),
        availability:
          supported && !paused && output.foreground && !output.cleanupFailed
            ? ("AVAILABLE" as const)
            : ("TEMPORARILY_UNAVAILABLE" as const),
        permission: "NOT_REQUIRED" as const,
        calibration: "NOT_APPLICABLE" as const,
        quality: "UNKNOWN" as const,
        freshness: "UNKNOWN" as const,
        lifecycle: output.foreground ? ("FOREGROUND_ONLY" as const) : ("SUSPENDED" as const),
        paused,
        reason: this.disposed
          ? "SESSION_ENDED"
          : output.cleanupFailed
            ? "OUTPUT_CLEANUP_FAILED"
            : paused
              ? "PAUSED_BY_USER"
              : supported
                ? "OUTPUT_PHYSICAL_RESPONSE_UNCONFIRMED"
                : "DEVICE_BROWSER_UNSUPPORTED",
        screenOrientationDegrees: this.target?.screen?.orientation?.angle ?? null,
        canPause: !this.disposed,
        canResume: paused && !this.disposed,
      };
    }
    const state = this.leases.snapshot(capabilityId, maxAgeMs);
    const paused = !this.permissions.state(this.capabilities.get(capabilityId).permission).enabled;
    return {
      ...state,
      paused,
      reason: this.disposed
        ? "SESSION_ENDED"
        : paused
          ? "PAUSED_BY_USER"
          : state.support === "UNSUPPORTED"
            ? "DEVICE_BROWSER_UNSUPPORTED"
            : state.permission === "DENIED"
              ? "PERMISSION_DENIED_USE_ALTERNATIVE"
              : state.freshness === "STALE"
                ? "READING_STALE"
                : state.freshness === "UNKNOWN"
                  ? "WAITING_FOR_QUALIFIED_READING"
                  : "ACTIVE",
      screenOrientationDegrees: this.target?.screen?.orientation?.angle ?? null,
      canPause: !this.disposed,
      canResume: paused && !this.disposed,
    };
  }
  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.detach();
    this.detachPermission();
    this.haptics.dispose();
    await this.leases.dispose();
    this.notify();
    this.listeners.clear();
    if (this.target && runtimes.get(this.target) === this) runtimes.delete(this.target);
  }
}
export function webSextantRuntime(target: WebSensorTarget, navigator: Pick<Navigator, "vibrate"> | null = null) {
  let runtime = runtimes.get(target);
  if (!runtime) {
    runtime = new WebSextantRuntime(target, navigator);
    runtimes.set(target, runtime);
  }
  return runtime;
}
/** Consumes only qualified envelopes. Group channels by their observation timestamp, never reuse stale gyro or gravity. */
export class SextantGestureSession {
  readonly recognizer: DeviceGestureRecognizer;
  private readonly latest = new Map<string, Observation>();
  private lastRecognized = -Infinity;
  constructor(
    config: GestureConfig,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.recognizer = new DeviceGestureRecognizer(config);
  }
  accept(event: LeaseEvent): GestureResult | null {
    if (event.type !== "OBSERVATION") {
      this.reset();
      return null;
    }
    const o = event.observation;
    const policy = gestureAcquisition(this.recognizer.config);
    const channel = policy.channels.find((c) => c.capabilityId === o.capabilityId);
    if (!channel) return null;
    const previous = this.latest.get(o.capabilityId);
    const age = this.now() - o.timestampMonotonic;
    if (
      o.discontinuity ||
      o.lifecycleState === "SUSPENDED" ||
      (previous &&
        (previous.providerIdDiagnostic !== o.providerIdDiagnostic ||
          previous.provenanceRoot !== o.provenanceRoot ||
          previous.referenceFrame !== o.referenceFrame ||
          o.timestampMonotonic - previous.timestampMonotonic > policy.maxGapMs)) ||
      o.calibrationState === "DISTURBED" ||
      o.qualityClass === "UNKNOWN" ||
      o.qualityClass === "LOW" ||
      age < 0 ||
      age > policy.maxAgeMs ||
      !channel.frames.includes(o.referenceFrame)
    ) {
      this.reset();
    }
    if (
      age < 0 ||
      age > policy.maxAgeMs ||
      !channel.frames.includes(o.referenceFrame) ||
      o.calibrationState === "DISTURBED" ||
      o.qualityClass === "UNKNOWN" ||
      o.qualityClass === "LOW" ||
      o.lifecycleState === "SUSPENDED"
    )
      return { state: "UNAVAILABLE", count: 0, coverageDegrees: 0, fallback: this.recognizer.config.fallback };
    this.latest.set(o.capabilityId, structuredClone(o));
    // Each required channel must be present from the same sample frame, preventing cross-generation fusion.
    if (o.capabilityId !== "sextant.motion.stability") return null;
    const c = this.recognizer.config;
    const get = (suffix: string) => this.latest.get(`sextant.${suffix}`);
    if (
      policy.channels.some(
        ({ capabilityId }) =>
          !this.latest.get(capabilityId) ||
          this.now() - this.latest.get(capabilityId)!.timestampMonotonic > policy.maxAgeMs ||
          Math.abs(this.latest.get(capabilityId)!.timestampMonotonic - o.timestampMonotonic) > policy.maxSkewMs,
      )
    ) {
      this.reset();
      return { state: "UNAVAILABLE", count: 0, coverageDegrees: 0, fallback: c.fallback };
    }
    const heading = get("heading.estimate");
    if (
      c.kind === "TURN_TO_BEARING" &&
      (!heading || heading.uncertainty === undefined || heading.uncertainty > c.toleranceDegrees)
    ) {
      this.reset();
      return { state: "UNAVAILABLE", count: 0, coverageDegrees: 0, fallback: c.fallback };
    }
    const input: GestureInput = {
      at: o.timestampMonotonic,
      qualified: true,
      attitude: get("orientation.attitude")?.value as Quaternion | undefined,
      gravity: get("motion.gravity")?.value as Vector3 | undefined,
      linear: get("motion.linear-acceleration")?.value as Vector3 | undefined,
      angular: get("motion.angular-velocity")?.value as Vector3 | undefined,
      stability: get("motion.stability")?.value as GestureInput["stability"],
      heading: heading
        ? {
            degrees: heading.value as number,
            northReference:
              heading.referenceFrame === "EARTH_TRUE"
                ? "TRUE"
                : heading.referenceFrame === "EARTH_MAGNETIC"
                  ? "MAGNETIC"
                  : "UNKNOWN",
          }
        : undefined,
    };
    if (input.at <= this.lastRecognized) return null;
    this.lastRecognized = input.at;
    return this.recognizer.update(input);
  }
  reset() {
    this.latest.clear();
    this.lastRecognized = -Infinity;
    this.recognizer.reset();
  }
}
