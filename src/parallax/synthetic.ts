import { composeTransform } from "./transforms";
import { identityTransform, type Anchor, type Transform } from "./contracts";
import type { SpatialRuntimeAdapter, SpatialRuntimeEvent } from "./runtime";

/** Device Lab only. A deterministic pose never becomes native-device evidence. */
export class SyntheticSpatialAdapter implements SpatialRuntimeAdapter {
  readonly providerId = "parallax.synthetic.v1";
  readonly mode = "SIMULATED" as const;
  readonly worldTracking = true;
  readonly planePlacement = true;
  active = false;
  renders = 0;
  private emit: ((event: SpatialRuntimeEvent) => void) | undefined;
  constructor(private readonly surface: Transform | null = identityTransform()) {}
  async start(c: { signal: AbortSignal; emit: (event: SpatialRuntimeEvent) => void }) {
    if (c.signal.aborted) throw new Error("ABORTED");
    this.active = true;
    this.emit = c.emit;
  }
  async resolve(a: Anchor) {
    return a.kind === "SURFACE_RELATIVE" ? this.surface && composeTransform(this.surface, a.transform) : a.transform;
  }
  async place() {
    return this.surface;
  }
  async render() {
    if (!this.active) throw new Error("PARALLAX_SYNTHETIC_NOT_ACTIVE");
    this.renders++;
  }
  push(e: SpatialRuntimeEvent) {
    if (this.active) this.emit?.(e);
  }
  async stop() {
    this.active = false;
    this.emit = undefined;
  }
}
