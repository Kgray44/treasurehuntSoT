import { z } from "zod";
import {
  landfallNativeHost,
  landfallNativeRequest,
  subscribeLandfallNativeLifecycle,
  subscribeNativeLandfallPower,
} from "@/landfall/native-bridge";
import {
  readInstallationEnvelope,
  verifyInstallationToken,
  LandfallInstallationReplayGuard,
  type LandfallInstallationScope,
  type LandfallInstallationClaim,
} from "@/landfall/installation-token";

const eventSchema = z.strictObject({
  type: z.literal("interaction"),
  medium: z.enum(["QR", "NFC"]),
  scanId: z.string().uuid(),
  token: z.string().min(32).max(2048),
});
const endedSchema = z.strictObject({
  type: z.literal("interaction-ended"),
  medium: z.enum(["QR", "NFC"]),
  scanId: z.string().uuid(),
});
const replySchema = z.object({
  state: z.enum(["GRANTED", "PROMPTABLE", "DENIED", "DENIED_PERMANENTLY", "UNAVAILABLE", "UNSUPPORTED"]),
});
export type InstallationResult = {
  state: "VERIFIED" | "DUPLICATE" | "INVALID" | "STOPPED" | "EXPIRED";
  installationId?: string;
  physicalPresence: "NOT_PROVEN";
  canComplete: false;
};
async function bounded<T>(promise: Promise<T>, timeout = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LANDFALL_SCANNER_TIMEOUT")), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
/** Deliberate, one-shot foreground scan. Signature identity has no location/progression authority. */
export class NativeLandfallInstallationProvider {
  private generation = 0;
  private teardown: (() => void) | null = null;
  private readonly replay = new LandfallInstallationReplayGuard();
  private stopTail: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly input: {
      scope: Omit<LandfallInstallationScope, "medium" | "id">;
      installations: readonly Pick<LandfallInstallationClaim, "id" | "medium">[];
      keys: ReadonlyMap<string, CryptoKey>;
      now?: () => number;
    },
  ) {}
  async verify(token: string, medium: "QR" | "NFC"): Promise<InstallationResult> {
    try {
      const envelope = readInstallationEnvelope(token);
      if (!this.input.installations.some((item) => item.id === envelope.claim.id && item.medium === medium))
        throw new Error();
      const claim = await verifyInstallationToken(token, {
        scope: { ...this.input.scope, id: envelope.claim.id, medium },
        keys: this.input.keys,
        now: (this.input.now ?? Date.now)(),
      });
      const replay = this.replay.accept(claim);
      return {
        state: replay === "NEW" ? "VERIFIED" : replay === "DUPLICATE" ? "DUPLICATE" : "INVALID",
        installationId: claim.id,
        physicalPresence: "NOT_PROVEN",
        canComplete: false,
      };
    } catch {
      return { state: "INVALID", physicalPresence: "NOT_PROVEN", canComplete: false };
    }
  }
  async scan(medium: "QR" | "NFC", onResult: (result: InstallationResult) => void) {
    const stopping = this.stop(),
      boundary = this.generation;
    await stopping;
    if (boundary !== this.generation) return "UNAVAILABLE";
    if (!landfallNativeHost() || !this.input.installations.some((item) => item.medium === medium) || document.hidden)
      return "UNAVAILABLE";
    const attempt = ++this.generation,
      scanId = crypto.randomUUID();
    let completed = false;
    const finish = (result: InstallationResult) => {
      if (attempt !== this.generation || completed) return;
      completed = true;
      void this.stop();
      onResult(result);
    };
    const receive = async (event: Event) => {
      const ended = endedSchema.safeParse((event as CustomEvent).detail);
      if (ended.success && ended.data.medium === medium && ended.data.scanId === scanId) {
        finish({ state: "STOPPED", physicalPresence: "NOT_PROVEN", canComplete: false });
        return;
      }
      const value = eventSchema.safeParse((event as CustomEvent).detail);
      if (
        !value.success ||
        value.data.medium !== medium ||
        value.data.scanId !== scanId ||
        attempt !== this.generation ||
        completed
      )
        return;
      // End camera/radio acquisition before asynchronous verification, and ignore later callbacks.
      completed = true;
      const stoppedGeneration = this.generation + 1;
      await this.stop();
      if (stoppedGeneration !== this.generation || document.hidden) return;
      const result = await this.verify(value.data.token, medium);
      if (stoppedGeneration === this.generation && !document.hidden) onResult(result);
    };
    const expired = setTimeout(
      () => finish({ state: "EXPIRED", physicalPresence: "NOT_PROVEN", canComplete: false }),
      30000,
    );
    const hidden = () => {
      if (document.hidden) finish({ state: "STOPPED", physicalPresence: "NOT_PROVEN", canComplete: false });
    };
    const lifecycle = subscribeLandfallNativeLifecycle((state) => {
      if (state === "BACKGROUND") finish({ state: "STOPPED", physicalPresence: "NOT_PROVEN", canComplete: false });
    });
    const power = subscribeNativeLandfallPower((state) => {
      if (state.lowPower || state.thermalPressure || state.critical)
        finish({ state: "STOPPED", physicalPresence: "NOT_PROVEN", canComplete: false });
    });
    window.addEventListener("landfall-native-event", receive);
    document.addEventListener("visibilitychange", hidden);
    this.teardown = () => {
      clearTimeout(expired);
      window.removeEventListener("landfall-native-event", receive);
      document.removeEventListener("visibilitychange", hidden);
      lifecycle();
      power();
    };
    try {
      const reply = replySchema.parse(
        await bounded(landfallNativeRequest(medium === "QR" ? "QR_SCAN" : "NFC_READ", { scanId })),
      );
      if (attempt !== this.generation) return "UNAVAILABLE";
      if (reply.state !== "GRANTED") await this.stop();
      return reply.state;
    } catch {
      await this.stop();
      return "UNAVAILABLE";
    }
  }
  async stop() {
    this.generation++;
    this.teardown?.();
    this.teardown = null;
    this.stopTail = this.stopTail
      .catch(() => undefined)
      .then(async () => {
        if (landfallNativeHost()) await bounded(landfallNativeRequest("INTERACTION_STOP")).catch(() => undefined);
      });
    await this.stopTail;
  }
  async clear() {
    await this.stop();
    this.replay.clear();
  }
}
