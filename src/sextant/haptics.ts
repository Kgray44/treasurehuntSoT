import { z } from "zod";
export const hapticRequestSchema = z.strictObject({
  cue: z.enum([
    "TICK",
    "CONFIRM",
    "WARNING",
    "DISCOVERY",
    "DIRECTIONAL_PULSE",
    "PROXIMITY_RAMP",
    "HEARTBEAT",
    "CUSTOM",
  ]),
  consumerId: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  fallback: z.string().trim().min(1),
  pattern: z.array(z.number().int().min(0).max(200)).min(1).max(15).optional(),
});
export type HapticRequest = z.infer<typeof hapticRequestSchema>;
export type HapticResult = {
  state: "REQUESTED" | "FALLBACK";
  reason: string;
  fallback: string;
  tier: "BASIC" | "RICH" | "NONE";
};
/** Native providers implement this same bounded contract. A successful call does not prove physical sensation. */
export interface SemanticHapticAdapter {
  tier: "BASIC" | "RICH";
  execute(pattern: readonly number[]): boolean;
  cancel(): void;
}
const patterns: Record<HapticRequest["cue"], number[]> = {
  TICK: [15],
  CONFIRM: [25, 40, 25],
  WARNING: [60, 80, 60],
  DISCOVERY: [30, 50, 70],
  DIRECTIONAL_PULSE: [30],
  PROXIMITY_RAMP: [20, 60, 40],
  HEARTBEAT: [30, 80, 40],
  CUSTOM: [],
};
export class SextantHaptics {
  private enabled = true;
  private reducedSensory = false;
  private foreground = true;
  private disposed = false;
  private cleanupFailed = false;
  private owner: string | null = null;
  private last = -Infinity;
  private windowStart = -Infinity;
  private totalOnMs = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly adapter: SemanticHapticAdapter | null,
    private readonly now: () => number = () => performance.now(),
  ) {}
  request(input: HapticRequest): HapticResult {
    const request = hapticRequestSchema.parse(input);
    const fallback = (reason: string): HapticResult => ({
      state: "FALLBACK",
      reason,
      fallback: request.fallback,
      tier: this.adapter?.tier ?? "NONE",
    });
    if (this.cleanupFailed) return fallback("OUTPUT_CLEANUP_FAILED");
    if (this.disposed || !this.foreground || !this.enabled || this.reducedSensory)
      return fallback("OUTPUT_PAUSED_OR_DISABLED");
    if (!this.adapter) return fallback("OUTPUT_UNSUPPORTED");
    const pattern = request.cue === "CUSTOM" ? request.pattern : patterns[request.cue];
    if (!pattern || !pattern.length || (request.cue !== "CUSTOM" && request.pattern))
      return fallback("PATTERN_INVALID");
    const duration = pattern.reduce((a, b) => a + b, 0),
      onMs = pattern.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0),
      at = this.now();
    if (duration > 1500 || onMs > 600 || onMs === 0) return fallback("PATTERN_BUDGET_EXCEEDED");
    if (!Number.isFinite(at) || at < this.last || at - this.last < 500 || this.owner)
      return fallback("OUTPUT_RATE_LIMITED_OR_BUSY");
    if (at - this.windowStart >= 60000) {
      this.windowStart = at;
      this.totalOnMs = 0;
    }
    if (this.totalOnMs + onMs > 3000) return fallback("OUTPUT_FATIGUE_LIMIT");
    try {
      if (!this.adapter.execute([...pattern])) return fallback("PLATFORM_REJECTED_OR_DISABLED");
    } catch {
      this.cancel();
      return fallback("PLATFORM_FAILED");
    }
    this.last = at;
    this.totalOnMs += onMs;
    this.owner = request.consumerId;
    this.timer = setTimeout(() => this.cancel(), duration);
    return {
      state: "REQUESTED",
      reason: "PHYSICAL_OUTPUT_UNCONFIRMED",
      fallback: request.fallback,
      tier: this.adapter.tier,
    };
  }
  cancelConsumer(consumerId: string) {
    if (this.owner === consumerId) this.cancel();
  }
  cancel() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.owner) {
      try {
        this.adapter?.cancel();
        this.owner = null;
      } catch {
        this.cleanupFailed = true;
      }
    }
  }
  setPreferences(enabled: boolean, reducedSensory = false) {
    this.enabled = enabled;
    this.reducedSensory = reducedSensory;
    if (!enabled || reducedSensory) this.cancel();
  }
  setForeground(visible: boolean) {
    this.foreground = visible;
    if (!visible) this.cancel();
  }
  dispose() {
    this.disposed = true;
    this.cancel();
  }
  status() {
    return {
      enabled: this.enabled,
      reducedSensory: this.reducedSensory,
      foreground: this.foreground,
      tier: this.adapter?.tier ?? "NONE",
      active: this.owner !== null,
      cleanupFailed: this.cleanupFailed,
    };
  }
}
export function webHapticAdapter(navigator: Pick<Navigator, "vibrate"> | null): SemanticHapticAdapter | null {
  return typeof navigator?.vibrate === "function"
    ? {
        tier: "BASIC",
        execute: (pattern) => navigator.vibrate([...pattern]),
        cancel: () => {
          navigator.vibrate(0);
        },
      }
    : null;
}
