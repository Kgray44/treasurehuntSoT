import type { BrowserContextPermission } from "@/landfall/browser-context";
import type { ContextualEvidence } from "@/landfall/contextual";
import { NativeLandfallSensorFusion } from "@/landfall/native-sensors";
import { landfallNativeRequest, subscribeNativeLandfallPower } from "@/landfall/native-bridge";

/** Native sensors enter the same ephemeral context engine as browser hints. */
export class NativeContextProvider {
  private generation = 0;
  private running = false;
  private starting: number | null = null;
  private driverTail: Promise<unknown> = Promise.resolve();
  private operate<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.driverTail.then(operation);
    this.driverTail = result.catch(() => undefined);
    return result;
  }
  private cleanup: (() => void) | null = null;
  constructor(private readonly worldspaceId: string) {}
  get active() {
    return this.running;
  }
  async start(
    identity: { sessionId: string; publishedVersionId: string },
    emit: (evidence: ContextualEvidence) => void,
    onState: (state: BrowserContextPermission) => void,
    consent: boolean,
  ) {
    if (this.running || this.starting !== null) return;
    if (!consent) {
      onState("DENIED");
      return;
    }
    if (document.visibilityState === "hidden") {
      onState("UNAVAILABLE");
      return;
    }
    const generation = ++this.generation;
    this.starting = generation;
    const fusion = new NativeLandfallSensorFusion({ ...identity, worldspaceId: this.worldspaceId }, true);
    const receive = (event: Event) => {
      if (!this.running || generation !== this.generation || document.visibilityState === "hidden") return;
      const value = (event as CustomEvent).detail;
      if (value?.type !== "sensor") return;
      const result = fusion.ingest(value.frame, Date.now(), true);
      if (result.state === "CONFLICT" || result.state === "INVALID") {
        this.stop();
        onState("UNAVAILABLE");
        return;
      }
      if (result.state === "READY" && result.evidence) emit(result.evidence);
    };
    try {
      const result = (await this.operate(() =>
        generation === this.generation ? landfallNativeRequest("SENSORS_START") : Promise.resolve({ accepted: false }),
      )) as { accepted?: unknown };
      if (generation !== this.generation) return;
      if (result?.accepted !== true) {
        onState("UNAVAILABLE");
        return;
      }
      this.running = true;
      window.addEventListener("landfall-native-event", receive);
      const unsubscribePower = subscribeNativeLandfallPower((power) => {
        if (power.lowPower || power.thermalPressure || power.state !== "READY") {
          this.stop();
          onState("UNAVAILABLE");
        }
      });
      this.cleanup = () => {
        unsubscribePower();
        window.removeEventListener("landfall-native-event", receive);
        fusion.reset();
      };
      onState("GRANTED");
    } catch {
      if (generation === this.generation) onState("UNAVAILABLE");
    } finally {
      if (this.starting === generation) this.starting = null;
    }
  }
  stop() {
    this.generation++;
    this.starting = null;
    this.running = false;
    this.cleanup?.();
    this.cleanup = null;
    void this.operate(() => landfallNativeRequest("SENSORS_STOP")).catch(() => undefined);
  }
}
