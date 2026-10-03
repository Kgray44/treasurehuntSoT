import type { BrowserContextPermission } from "@/landfall/browser-context";
import type { ContextualEvidence } from "@/landfall/contextual";
import { NativeLandfallSensorFusion } from "@/landfall/native-sensors";
import { landfallNativeRequest } from "@/landfall/native-bridge";

/** Native sensors enter the same ephemeral context engine as browser hints. */
export class NativeContextProvider {
  private generation = 0;
  private running = false;
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
    if (this.running) return;
    if (!consent) {
      onState("DENIED");
      return;
    }
    if (document.visibilityState === "hidden") {
      onState("UNAVAILABLE");
      return;
    }
    const generation = ++this.generation;
    const fusion = new NativeLandfallSensorFusion({ ...identity, worldspaceId: this.worldspaceId }, true);
    const receive = (event: Event) => {
      if (!this.running || generation !== this.generation || document.visibilityState === "hidden") return;
      const value = (event as CustomEvent).detail;
      if (value?.type !== "sensor") return;
      const result = fusion.ingest(value.frame, Date.now(), true);
      if (result.state === "READY" && result.evidence) emit(result.evidence);
    };
    try {
      const result = (await landfallNativeRequest("SENSORS_START")) as { accepted?: unknown };
      if (generation !== this.generation) return;
      if (result?.accepted !== true) {
        onState("UNAVAILABLE");
        return;
      }
      this.running = true;
      window.addEventListener("landfall-native-event", receive);
      this.cleanup = () => {
        window.removeEventListener("landfall-native-event", receive);
        fusion.reset();
      };
      onState("GRANTED");
    } catch {
      if (generation === this.generation) onState("UNAVAILABLE");
    }
  }
  stop() {
    this.generation++;
    this.running = false;
    this.cleanup?.();
    this.cleanup = null;
    void landfallNativeRequest("SENSORS_STOP").catch(() => undefined);
  }
}
