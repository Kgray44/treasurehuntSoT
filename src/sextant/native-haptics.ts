import { z } from "zod";
import type { SemanticHapticAdapter } from "./haptics";
import type { SextantNativeTransport } from "./native-provider";
const result = z.strictObject({
  accepted: z.boolean(),
  tier: z.enum(["NONE", "BASIC", "RICH"]),
  physicalOutputConfirmed: z.literal(false),
});
/** Transport acceptance only; never a tactile or energy qualification. */
export class NativeHapticAdapter implements SemanticHapticAdapter {
  tier: "NONE" | "BASIC" | "RICH" = "NONE";
  cleanupFailed = false;
  private owner: string | null = null;
  private epoch = 0;
  constructor(private readonly transport: SextantNativeTransport) {}
  async refresh() {
    const state = await this.transport.request("SEXTANT_STATE");
    this.tier = z.enum(["NONE", "BASIC", "RICH"]).parse((state as { hapticTier?: unknown })?.hapticTier ?? "NONE");
  }
  execute() {
    return false;
  }
  async executeAsync(pattern: readonly number[]) {
    const leaseId = crypto.randomUUID(),
      epoch = this.epoch;
    this.owner = leaseId;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const pending = this.transport
      .request("SEXTANT_HAPTIC", { leaseId, pattern: [...pattern], enabled: true, reducedSensory: false })
      .then((reply) => {
        const response = result.parse(reply);
        this.tier = response.tier;
        if (epoch !== this.epoch) {
          void this.stop(leaseId);
          return false;
        }
        return response.accepted;
      });
    try {
      return await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("SEXTANT_NATIVE_HAPTIC_TIMEOUT")), 5000);
        }),
      ]);
    } catch (error) {
      this.cancel();
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
  private async stop(leaseId: string) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const reply = await Promise.race([
        this.transport.request("SEXTANT_HAPTIC_STOP", { leaseId }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("SEXTANT_NATIVE_OUTPUT_CLEANUP_TIMEOUT")), 5000);
        }),
      ]);
      if ((reply as { accepted?: unknown })?.accepted !== true) this.cleanupFailed = true;
    } catch {
      this.cleanupFailed = true;
    } finally {
      clearTimeout(timer);
    }
  }
  cancel() {
    this.epoch++;
    const leaseId = this.owner;
    this.owner = null;
    if (leaseId) void this.stop(leaseId);
  }
}
