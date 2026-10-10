import {
  unknownState,
  type CapabilityState,
  type ProviderSample,
  type SextantProvider,
  type UpdateClass,
} from "./contracts";
import { SextantCapabilityRegistry } from "./capabilities";
/** Deterministic push provider; never requests permission, polls hardware or disguises simulation as native. */
export class SyntheticSextantProvider implements SextantProvider {
  readonly definition: SextantProvider["definition"];
  private context: Parameters<SextantProvider["start"]>[0] | undefined;
  starts = 0;
  stops = 0;
  updateClass: UpdateClass = "PASSIVE";
  constructor(
    readonly simulationIdentity: string,
    registry: SextantCapabilityRegistry,
    capabilities: string[],
    providerId = "synthetic.sextant",
    private readonly state: Partial<CapabilityState> = {},
  ) {
    if (!simulationIdentity.trim()) throw new Error("SEXTANT_SIMULATION_IDENTITY_REQUIRED");
    const definitions = capabilities.map((id) => registry.get(id));
    this.definition = {
      providerId,
      providerVersion: 1,
      platformFamily: "SYNTHETIC",
      capabilities: [...capabilities],
      discoveryMethod: "EXPLICIT",
      permissionRequirements: [...new Set(definitions.map((c) => c.permission))],
      lifecycleConstraints: "FOREGROUND_ONLY",
      qualityMetadata: "PER_OBSERVATION",
      referenceFrames: [...new Set(definitions.flatMap((c) => c.frames))],
      samplingBounds: { minimumIntervalMs: 16, maximumIntervalMs: 5000 },
      powerClass: "LOW",
      privacyClass: "LOCAL_EPHEMERAL",
      simulationSupport: true,
    };
  }
  discover(id: string): CapabilityState {
    return {
      ...unknownState(),
      support: this.definition.capabilities.includes(id) ? "SUPPORTED" : "UNSUPPORTED",
      availability: "AVAILABLE",
      quality: "HIGH",
      calibration: "GOOD",
      ...this.state,
    };
  }
  async start(context: Parameters<SextantProvider["start"]>[0]) {
    this.starts++;
    this.context = context;
    this.updateClass = context.updateClass;
  }
  setUpdateClass(updateClass: UpdateClass) {
    this.updateClass = updateClass;
  }
  async stop() {
    this.stops++;
    this.context = undefined;
  }
  push(sample: ProviderSample) {
    if (!this.context?.signal.aborted) this.context?.emit(structuredClone(sample));
  }
  fail() {
    this.context?.fail();
  }
}
