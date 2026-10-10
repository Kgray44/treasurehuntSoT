import { BrowserGeolocationProvider, type ForegroundPermission } from "@/landfall/browser-geolocation";
import { observationSchema as landfallObservationSchema, type LandfallObservation } from "@/landfall/observation";
import type { LandfallWorldspace } from "@/landfall/schema";
import {
  BrowserContextProvider,
  type BrowserContextTarget,
  type BrowserContextPermission,
} from "@/landfall/browser-context";
import { contextualEvidenceSchema, type ContextualEvidence } from "@/landfall/contextual";
import { SextantCapabilityRegistry } from "./capabilities";
import { normalizeObservation } from "./observations";
import { unknownState, type SextantProvider, type ProviderSample } from "./contracts";

/** Phase 1 wraps accepted acquisition without changing hint thresholds, consent or receipt identity.
 * The returned original evidence remains the Landfall path; normalized metadata is a separate ephemeral projection.
 * It must not be run alongside another owner of the same target's foreground listeners. */
export class LandfallForegroundCompatibilityAdapter {
  private readonly provider: BrowserContextProvider;
  private sequence = 0;
  constructor(
    target: BrowserContextTarget | null,
    worldspaceId: string,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.provider = new BrowserContextProvider(target, worldspaceId);
  }
  get active() {
    return this.provider.active;
  }
  get permissionState() {
    return this.provider.permissionState;
  }
  start(
    identity: Parameters<BrowserContextProvider["start"]>[0],
    emit: (evidence: ContextualEvidence, projection: ReturnType<typeof projectLandfallContextHint> | null) => void,
    onState: (state: BrowserContextPermission) => void,
    consent: boolean,
  ) {
    return this.provider.start(
      identity,
      (evidence) => {
        let projection: ReturnType<typeof projectLandfallContextHint> | null = null;
        try {
          projection = projectLandfallContextHint(evidence, this.now(), this.sequence++);
        } catch {
          /* Legacy behavior survives an unqualified projection. */
        }
        emit(evidence, projection);
      },
      onState,
      consent,
    );
  }
  stop() {
    this.provider.stop();
  }
}
const registry = new SextantCapabilityRegistry();
/** Pure conversion only: it never claims pressure-derived relative elevation or true north from legacy hints. */
export function projectLandfallContextHint(input: ContextualEvidence, receivedAtMonotonic: number, sequence = 0) {
  const hint = contextualEvidenceSchema.parse(input);
  let sample: ProviderSample;
  const common = {
    timestampMonotonic: receivedAtMonotonic,
    confidence: null,
    calibrationState: "UNKNOWN" as const,
    qualityClass: "UNKNOWN" as const,
    warnings: ["LEGACY_HINT_QUALITY_UNQUALIFIED", "RECEIPT_TIME_NOT_SENSOR_TIME"],
  };
  if (hint.kind === "HEADING")
    sample = {
      ...common,
      capabilityId: "sextant.heading.estimate",
      value: hint.degrees % 360,
      units: "degrees",
      referenceFrame: "LOCAL_ARBITRARY",
      uncertainty: hint.accuracyDegrees,
    };
  else if (hint.kind === "MOTION")
    sample = {
      ...common,
      capabilityId: "sextant.motion.moving",
      value: hint.moving,
      units: "boolean",
      referenceFrame: "DEVICE",
    };
  else if (hint.kind === "ELEVATION")
    sample = {
      ...common,
      capabilityId: "sextant.elevation.absolute-hint",
      value: hint.meters,
      units: "meters",
      referenceFrame: "WGS84",
      uncertainty: hint.accuracyMeters,
    };
  else return null;
  const definition = registry.get(sample.capabilityId);
  const provider: SextantProvider = {
    definition: {
      providerId: "compatibility.landfall-foreground",
      providerVersion: 1,
      platformFamily: "COMPATIBILITY",
      capabilities: [definition.id],
      discoveryMethod: "EXPLICIT",
      permissionRequirements: [definition.permission],
      lifecycleConstraints: "FOREGROUND_ONLY",
      qualityMetadata: "PER_OBSERVATION",
      referenceFrames: definition.frames,
      samplingBounds: { minimumIntervalMs: 1000, maximumIntervalMs: 5000 },
      powerClass: "LOW",
      privacyClass: "LOCAL_EPHEMERAL",
      simulationSupport: false,
    },
    discover: () => unknownState(),
    start: async () => {},
    setUpdateClass: () => {},
    stop: async () => {},
  };
  return normalizeObservation(registry, provider, sample, {
    now: receivedAtMonotonic,
    sequence,
    discontinuity: sequence === 0,
  });
}

/** Accepted foreground position seam. Call start from the existing explicit Player action. */
export class LandfallPositionCompatibilityAdapter {
  private readonly provider: BrowserGeolocationProvider;
  private sequence = 0;
  constructor(
    geolocation: Pick<Geolocation, "watchPosition" | "clearWatch"> | null,
    worldspace: LandfallWorldspace,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.provider = new BrowserGeolocationProvider(geolocation, worldspace);
  }
  get active() {
    return this.provider.active;
  }
  get permissionState() {
    return this.provider.permissionState;
  }
  start(
    identity: Parameters<BrowserGeolocationProvider["start"]>[0],
    emit: (observation: LandfallObservation, projection: ReturnType<typeof projectLandfallPosition> | null) => void,
    onState: (state: ForegroundPermission) => void,
  ) {
    this.provider.start(
      identity,
      (observation) => {
        let projection: ReturnType<typeof projectLandfallPosition> | null = null;
        try {
          projection = projectLandfallPosition(observation, this.now(), this.sequence++);
        } catch {
          /* Preserve accepted observation delivery even if normalization rejects metadata. */
        }
        emit(observation, projection);
      },
      onState,
    );
  }
  stop() {
    this.provider.stop();
  }
}
export function projectLandfallPosition(input: LandfallObservation, receivedAtMonotonic: number, sequence = 0) {
  const position = landfallObservationSchema.parse(input);
  if (
    position.kind !== "PHYSICAL_POSITION" ||
    position.coordinate.type !== "WGS84" ||
    position.source !== "BROWSER_GEOLOCATION"
  )
    return null;
  const definition = registry.get("sextant.position.observation");
  const provider: SextantProvider = {
    definition: {
      providerId: "compatibility.landfall-position",
      providerVersion: 1,
      platformFamily: "COMPATIBILITY",
      capabilities: [definition.id],
      discoveryMethod: "EXPLICIT",
      permissionRequirements: [definition.permission],
      lifecycleConstraints: "FOREGROUND_ONLY",
      qualityMetadata: "PER_OBSERVATION",
      referenceFrames: definition.frames,
      samplingBounds: { minimumIntervalMs: 1000, maximumIntervalMs: 5000 },
      powerClass: "VARIABLE",
      privacyClass: "LOCAL_EPHEMERAL",
      simulationSupport: false,
    },
    discover: () => unknownState(),
    start: async () => {},
    setUpdateClass: () => {},
    stop: async () => {},
  };
  const observation = normalizeObservation(
    registry,
    provider,
    {
      capabilityId: definition.id,
      value: {
        latitude: position.coordinate.latitude,
        longitude: position.coordinate.longitude,
        accuracyMeters: position.accuracyMeters,
      },
      units: definition.units,
      referenceFrame: "WGS84",
      timestampMonotonic: receivedAtMonotonic,
      confidence: null,
      uncertainty: position.accuracyMeters,
      calibrationState: "NOT_APPLICABLE",
      qualityClass: "UNKNOWN",
      warnings: ["LEGACY_HINT_QUALITY_UNQUALIFIED", "RECEIPT_TIME_NOT_SENSOR_TIME"],
    },
    { now: receivedAtMonotonic, sequence, discontinuity: sequence === 0 },
  );
  return { ...observation, timestampWallOptional: position.observedAt };
}
