import { webSensorHub } from "./web-provider";
import type { ContextualEvidence } from "@/landfall/contextual";

export type BrowserContextPermission = "PROMPT" | "GRANTED" | "DENIED" | "UNAVAILABLE";
export type BrowserContextTarget = {
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
  document?: {
    visibilityState: string;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  };
  DeviceOrientationEvent?: { requestPermission?: () => Promise<string> };
  DeviceMotionEvent?: { requestPermission?: () => Promise<string> };
};

/** Explicitly consented hints, owned by the same foreground lifecycle as location. No raw stream is retained. */
export class BrowserContextProvider {
  private running = false;
  private generation = 0;
  private starting = false;
  private permission: BrowserContextPermission;
  private cleanup: (() => void) | null = null;
  constructor(
    private readonly target: BrowserContextTarget | null,
    private readonly worldspaceId: string,
  ) {
    this.permission = target ? "PROMPT" : "UNAVAILABLE";
  }
  get active(): boolean {
    return this.running;
  }
  get permissionState(): BrowserContextPermission {
    return this.permission;
  }
  async start(
    identity: { sessionId: string; publishedVersionId: string },
    emit: (evidence: ContextualEvidence) => void,
    onState: (state: BrowserContextPermission) => void,
    consent: boolean,
  ): Promise<void> {
    if (this.running || this.starting) return;
    if (!consent) {
      this.permission = "DENIED";
      onState(this.permission);
      return;
    }
    const target = this.target;
    if (
      !target ||
      (!target.DeviceOrientationEvent && !target.DeviceMotionEvent) ||
      target.document?.visibilityState === "hidden"
    ) {
      this.permission = "UNAVAILABLE";
      onState(this.permission);
      return;
    }
    const generation = ++this.generation;
    this.starting = true;
    try {
      const decisions = await Promise.all(
        [target.DeviceOrientationEvent, target.DeviceMotionEvent].map((capability) =>
          capability?.requestPermission ? capability.requestPermission() : "granted",
        ),
      );
      if (generation !== this.generation) return;
      if (decisions.some((decision) => decision !== "granted")) {
        this.permission = "DENIED";
        onState(this.permission);
        return;
      }
    } catch {
      if (generation === this.generation) {
        this.permission = "UNAVAILABLE";
        onState(this.permission);
      }
      return;
    } finally {
      if (generation === this.generation) this.starting = false;
    }
    if (generation !== this.generation || target.document?.visibilityState === "hidden") return;
    let headingAt = -Infinity,
      motionAt = -Infinity;
    const common = () => ({
      id: crypto.randomUUID(),
      ...identity,
      worldspaceId: this.worldspaceId,
      observedAt: new Date().toISOString(),
    });
    const orientation: EventListener = (event) => {
      if (!this.running || target.document?.visibilityState === "hidden") return;
      const hint = event as DeviceOrientationEvent & { webkitCompassHeading?: number; webkitCompassAccuracy?: number };
      // Relative alpha does not establish compass heading; keep its absence honest.
      const degrees =
        typeof hint.webkitCompassHeading === "number"
          ? hint.webkitCompassHeading
          : hint.absolute && hint.alpha !== null
            ? (360 - hint.alpha) % 360
            : null;
      if (degrees === null || !Number.isFinite(degrees) || Date.now() - headingAt < 1000) return;
      headingAt = Date.now();
      emit({
        ...common(),
        kind: "HEADING",
        degrees: ((degrees % 360) + 360) % 360,
        accuracyDegrees: Math.min(180, Math.max(0, hint.webkitCompassAccuracy ?? 45)),
      });
    };
    const motion: EventListener = (event) => {
      if (!this.running || target.document?.visibilityState === "hidden") return;
      const acceleration = (event as DeviceMotionEvent).acceleration;
      if (
        !acceleration ||
        acceleration.x === null ||
        acceleration.y === null ||
        acceleration.z === null ||
        ![acceleration.x, acceleration.y, acceleration.z].every(Number.isFinite) ||
        Date.now() - motionAt < 1000
      )
        return;
      motionAt = Date.now();
      emit({ ...common(), kind: "MOTION", moving: Math.hypot(acceleration.x, acceleration.y, acceleration.z) > 0.8 });
    };
    const visibility: EventListener = () => {
      if (target.document?.visibilityState === "hidden") {
        this.stop();
        this.permission = "UNAVAILABLE";
        onState(this.permission);
      }
    };
    const detachSensors: (() => void)[] = [];
    try {
      this.running = true;
      this.cleanup = () => {
        for (const detach of detachSensors) detach();
        target.document?.removeEventListener("visibilitychange", visibility);
      };
      if (target.DeviceOrientationEvent)
        detachSensors.push(webSensorHub(target).subscribe("deviceorientation", orientation));
      if (target.DeviceMotionEvent) detachSensors.push(webSensorHub(target).subscribe("devicemotion", motion));
      target.document?.addEventListener("visibilitychange", visibility);
      this.permission = "GRANTED";
      onState(this.permission);
    } catch {
      this.stop();
      this.permission = "UNAVAILABLE";
      onState(this.permission);
    }
  }
  stop(): void {
    this.generation++;
    this.starting = false;
    this.running = false;
    this.cleanup?.();
    this.cleanup = null;
  }
}
