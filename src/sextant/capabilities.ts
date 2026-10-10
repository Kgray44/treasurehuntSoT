import { z } from "zod";
import baseline from "../../Development_Docs/Spatial_Experience/device-capability-registry.json";
import ownership from "../../Development_Docs/Spatial_Experience/spatial-capability-ownership.json";
import type { CapabilityDefinition, ReferenceFrame } from "./contracts";
const vector = z.strictObject({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite() });
const quaternion = z
  .strictObject({ x: z.number().finite(), y: z.number().finite(), z: z.number().finite(), w: z.number().finite() })
  .refine((q) => Math.abs(Math.hypot(q.x, q.y, q.z, q.w) - 1) < 0.00001, "SEXTANT_QUATERNION_NOT_NORMALIZED");
const declaration = z.boolean();
type Spec = [string, string, string, ReferenceFrame[], z.ZodType];
const specs: Spec[] = [
  [
    "position.observation",
    "position",
    "degrees/meters",
    ["WGS84"],
    z.strictObject({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracyMeters: z.number().finite().nonnegative(),
    }),
  ],
  [
    "heading.estimate",
    "heading",
    "degrees",
    ["EARTH_MAGNETIC", "EARTH_TRUE", "LOCAL_ARBITRARY"],
    z.number().finite().min(0).lt(360),
  ],
  ["orientation.relative", "orientation", "quaternion", ["LOCAL_ARBITRARY"], quaternion],
  ["orientation.absolute", "orientation", "quaternion", ["EARTH_MAGNETIC", "EARTH_TRUE"], quaternion],
  [
    "orientation.attitude",
    "fused-pose",
    "quaternion",
    ["GRAVITY_ALIGNED", "LOCAL_ARBITRARY", "EARTH_MAGNETIC", "EARTH_TRUE"],
    quaternion,
  ],
  ["motion.linear-acceleration", "accelerometer", "m/s^2", ["DEVICE"], vector],
  ["motion.angular-velocity", "gyroscope", "rad/s", ["DEVICE"], vector],
  ["motion.stability", "accelerometer", "classification", ["DEVICE"], z.enum(["STABLE", "MOVING", "UNKNOWN"])],
  ["motion.moving", "accelerometer", "boolean", ["DEVICE"], declaration],
  ["gesture.rotation-count", "gyroscope", "count", ["LOCAL_ARBITRARY"], z.number().int().nonnegative()],
  ["magnetic.field", "magnetic-field", "microtesla", ["DEVICE"], vector],
  ["magnetic.anomaly", "magnetic-field", "microtesla", ["DEVICE"], z.number().finite()],
  ["elevation.relative", "relative-pressure-elevation", "meters", ["LOCAL_ARBITRARY"], z.number().finite()],
  ["elevation.absolute-hint", "relative-pressure-elevation", "meters", ["WGS84"], z.number().finite()],
  ["environment.context", "proximity-light-environment", "capability", ["NONE"], declaration],
  ["haptics.basic", "haptics", "capability", ["NONE"], declaration],
  ["haptics.rich", "haptics", "capability", ["NONE"], declaration],
  ["media.camera", "camera", "capability", ["NONE"], declaration],
  ["media.microphone", "microphone", "capability", ["NONE"], declaration],
  ["nearby.ble.scan", "ble", "capability", ["NONE"], declaration],
  ["nearby.ble.connect", "ble", "capability", ["NONE"], declaration],
  ["nearby.uwb.range", "uwb", "meters", ["LOCAL_ARBITRARY"], z.number().finite().nonnegative()],
  ["nearby.nfc.read", "nfc", "capability", ["NONE"], declaration],
  ["output.notifications", "notifications", "capability", ["NONE"], declaration],
  ["lifecycle.background", "background-execution", "capability", ["NONE"], declaration],
  [
    "system.thermal",
    "power-thermal",
    "classification",
    ["NONE"],
    z.enum(["UNKNOWN", "NORMAL", "DEGRADED", "CRITICAL"]),
  ],
  ["system.power", "power-thermal", "fraction", ["NONE"], z.number().finite().min(0).max(1)],
  ["storage.secure-local", "secure-local-storage", "capability", ["NONE"], declaration],
];
/** Hardware IDs, architectural semantic ownership and product IDs are distinct, explicitly linked namespaces. */
export class SextantCapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition>();
  constructor() {
    for (const [suffix, hardwareId, units, frames, valueSchema] of specs) {
      const row = baseline.capabilities.find((e) => e.id === hardwareId);
      if (
        !row ||
        row.owner !== "SEXTANT" ||
        !ownership.capabilities.some((e) => e.id === row.semanticId && e.owner === "SEXTANT")
      )
        throw new Error("SEXTANT_OWNERSHIP_UNRESOLVED");
      const id = `sextant.${suffix}`;
      this.definitions.set(id, {
        id,
        version: 1,
        hardwareId,
        semanticId: row.semanticId,
        owner: "SEXTANT",
        units,
        frames,
        permission: row.permission,
        privacyClass: row.privacyClass,
        fallback: row.defaultFallback,
        valueSchema,
        implementation: "FOUNDATION_ONLY",
      });
    }
  }
  get(id: string): CapabilityDefinition {
    const d = this.definitions.get(id);
    if (!d) throw new Error("SEXTANT_CAPABILITY_UNKNOWN");
    return { ...d, frames: [...d.frames] };
  }
  list() {
    return [...this.definitions.keys()].map((id) => this.get(id));
  }
  /** Drydock consumes semantic definitions; declaration does not assert current hardware support. */
  project() {
    return this.list().map((definition) => {
      const { valueSchema, ...projection } = definition;
      void valueSchema;
      return projection;
    });
  }
  validateRequirement(input: { capabilityId: string; version: number; fallback: string }) {
    const d = this.get(input.capabilityId);
    if (input.version !== d.version || !input.fallback.trim()) throw new Error("SEXTANT_AUTHORING_CONTRACT_INVALID");
    return { ...input, owner: d.owner, implementation: d.implementation };
  }
}
