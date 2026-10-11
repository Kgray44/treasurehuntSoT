import type { DiscoveryPolicy } from "./adaptive-contracts";

export type SearchActivity = {
  foreground: boolean;
  unlocked: boolean;
  tracking: boolean;
  permission: boolean;
  lensOpen: boolean;
  storyReading: boolean;
  inSearchRegion: boolean;
};
export type DiscoveryState = {
  meaningfulSeconds: number;
  stage: number;
  message: string;
  exactRevealAvailable: boolean;
  systemFailure: boolean;
  recovery: "NONE" | "GUIDED";
};
/** Entirely transient coverage and timer state; no scan trajectory or room image is retained. */
export class DiscoveryAssistance {
  private elapsedMs = 0;
  private lastAt: number | null = null;
  private activity: SearchActivity = {
    foreground: false,
    unlocked: true,
    tracking: false,
    permission: false,
    lensOpen: false,
    storyReading: false,
    inSearchRegion: false,
  };
  private confidence = 1;
  private sectors = new Set<number>();
  private nearMisses = 0;
  constructor(readonly policy: DiscoveryPolicy) {}
  updateActivity(activity: Partial<SearchActivity>, atMs: number) {
    this.tick(atMs);
    this.activity = { ...this.activity, ...activity };
  }
  setConfidence(confidence: number) {
    this.confidence = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
  }
  observeSector(sector: number, nearMiss = false) {
    if (Number.isInteger(sector) && sector >= 0 && sector < 8) this.sectors.add(sector);
    if (nearMiss) this.nearMisses = Math.min(10, this.nearMisses + 1);
  }
  private active() {
    const a = this.activity;
    return (
      a.foreground && a.unlocked && a.tracking && a.permission && a.lensOpen && !a.storyReading && a.inSearchRegion
    );
  }
  tick(atMs: number) {
    if (!Number.isFinite(atMs)) throw new Error("PARALLAX_DISCOVERY_CLOCK_INVALID");
    if (this.lastAt !== null && this.active()) this.elapsedMs += Math.max(0, Math.min(5000, atMs - this.lastAt));
    this.lastAt = atMs;
    this.elapsedMs = Math.min(this.elapsedMs, this.policy.maximumUnguidedSeconds * 1000);
    return this.read();
  }
  read(): DiscoveryState {
    const meaningfulSeconds = Math.floor(this.elapsedMs / 1000);
    const stages = this.policy.stages.filter((s) => meaningfulSeconds >= s.afterSeconds);
    const systemFailure = this.confidence < 0.7 && meaningfulSeconds >= this.policy.expectedSearchSeconds;
    const recovery = systemFailure || meaningfulSeconds >= this.policy.maximumUnguidedSeconds ? "GUIDED" : "NONE";
    const smart =
      stages.length > 0 && this.sectors.size >= 5 && this.sectors.size < 8
        ? " Try a direction you have not looked toward yet."
        : this.nearMisses >= 3
          ? " You have passed close by; Show me can help."
          : "";
    return {
      meaningfulSeconds,
      stage: stages.length,
      message: systemFailure
        ? "The Lens may not have found a reliable place. Open Guided View to recover the clue."
        : recovery === "GUIDED"
          ? "The clue is ready in Guided View. You can continue through the passage's normal controls."
          : (stages.at(-1)?.message ?? "Take your time exploring this space.") + smart,
      exactRevealAvailable: true,
      systemFailure,
      recovery,
    };
  }
}
