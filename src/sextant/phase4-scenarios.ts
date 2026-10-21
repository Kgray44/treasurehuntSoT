import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import {
  coordinatedSensorBaseline,
  coordinatedSensorSeries,
  type CoordinatedSensorFrame,
  type SensorFaultKind,
} from "@/device-lab/coordinated-sensors";
import { MagneticFieldContext, MagneticHunt } from "./field-context";
import { fieldObservation } from "./phase3-fixtures";
import { NearbySessions, SecureRangingSession } from "./nearby";
import { projectCapabilities } from "@/crossdeck/contracts";
import { unknownState } from "./contracts";
import {
  phase4ConsumerScenarioIds,
  exercisePhase4ConsumerScenario,
  type Phase4ConsumerScenario,
} from "./phase4-consumer-lab";

export const phase4ScenarioIds = [
  "coordinated-rotation-field",
  "coordinated-trajectory-pressure",
  "coordinated-magnetic-prop",
  "coordinated-stale-fallback",
  "coordinated-clock-fallback",
  "coordinated-interference-fallback",
  "coordinated-calibration-fallback",
  "coordinated-order-reset",
  "coordinated-lifecycle-reset",
  "coordinated-cadence-reset",
  "coordinated-magnetic-receding",
  "coordinated-magnetic-hysteresis",
  "coordinated-magnetic-spike",
  "coordinated-magnetic-background",
  "coordinated-magnetic-recovery",
  "coordinated-nearby-reconnect",
  "coordinated-crossdeck-negotiation",
  ...phase4ConsumerScenarioIds,
] as const;
const check = (condition: boolean) => {
  if (!condition) throw new Error("SEXTANT_PHASE4_ORACLE_FAILED");
};
const rejects = (operation: () => unknown) => {
  try {
    operation();
  } catch {
    return true;
  }
  return false;
};
const huntConfiguration = {
  version: 1,
  thresholdMicrotesla: 10,
  dwellMs: 800,
  timeoutMs: 8000,
  fallback: "Continue with the accessible screen control",
  safeProp: "WEAK_ENCLOSED_DISTANT",
  safetyAcknowledged: true,
};
function magneticOracle(suffix: string) {
  const context = new MagneticFieldContext(),
    hunt = new MagneticHunt(huntConfiguration);
  const magnitudes = suffix.endsWith("receding")
    ? [50, 50, 50, 50, 50, 75, 70, 65, 60, 55, 50]
    : suffix.endsWith("hysteresis")
      ? [50, 50, 50, 50, 50, 61, 59, 61, 59, 61, 59, 61]
      : suffix.endsWith("spike")
        ? [50, 50, 50, 50, 50, 80, 50, 50, 50, 50, 50]
        : suffix.endsWith("background")
          ? Array.from({ length: 16 }, () => 90)
          : [50, 50, 50, 50, 50, 90, 50, 50, 50, 50, 50, 50, 50, 50, 65, 65, 65, 65, 65, 65];
  let reached = false,
    fallback = false,
    receded = false;
  for (let index = 0; index < magnitudes.length; index++) {
    const at = index * 200,
      input = fieldObservation("sextant.magnetic.field", { x: 0, y: magnitudes[index], z: 0 }, at, {
        provenanceRoot: suffix.endsWith("recovery") && index >= 6 ? "synthetic.restarted" : "synthetic.initial",
        sequence: index,
        simulationIdentity: "sextant-phase4-coordinated-v1",
        ...(suffix.endsWith("recovery") && index === 5
          ? { lifecycleState: "SUSPENDED" as const, qualityClass: "LOW" as const }
          : {}),
      });
    const field = context.accept(input, at),
      result = hunt.accept(input, at);
    receded ||= field.trend === "RECEDING";
    reached ||= result.state === "REFERENCE_REACHED";
    fallback ||= result.state === "FALLBACK";
    if (suffix.endsWith("background") && at >= 800) check(field.deltaMicrotesla === 0);
    if (suffix.endsWith("recovery") && index < 18) check(result.state !== "REFERENCE_REACHED");
  }
  if (suffix.endsWith("recovery")) check(reached && fallback);
  else {
    check(!reached && !fallback);
    if (suffix.endsWith("receding")) check(receded);
  }
}
function nearbyOracle() {
  let clock = 1000,
    stopped = 0;
  const devices = [new NearbySessions(() => clock), new NearbySessions(() => clock)];
  const begin = (device: NearbySessions, nonce: string) => {
    const purpose = {
      consumerId: "crossdeck-fixture",
      surfaceId: "synthetic-phone",
      purpose: "Optional relative ranging",
      consent: true,
      userInitiated: true,
      expiresAt: clock + 10000,
    };
    const lease = device.begin(purpose),
      peer = {
        version: 1,
        peerSessionId: "synthetic-peer",
        owner: "CROSSDECK",
        consumerId: purpose.consumerId,
        surfaceId: purpose.surfaceId,
        purpose: purpose.purpose,
        expiresAt: purpose.expiresAt,
        nonce,
        outOfBand: "AUTHENTICATED_NETWORK",
        securityMode: "APPLICATION_AUTHENTICATED",
      };
    device.own(lease.token, () => stopped++);
    return { lease, ranging: new SecureRangingSession(peer, device, lease, () => true) };
  };
  try {
    const a = begin(devices[0], "synthetic-nonce-a"),
      b = begin(devices[1], "synthetic-nonce-b");
    const sample = (generation: number, sequence: number, distance: number) => ({
      peerSessionId: "synthetic-peer",
      generation,
      sequence,
      timestampMonotonic: clock,
      distanceMeters: distance,
      uncertaintyMeters: 0.2,
      technologyClass: "UWB",
      referenceFrame: "LOCAL_ARBITRARY",
      lifecycle: "FOREGROUND_ONLY",
      securityMode: "APPLICATION_AUTHENTICATED",
    });
    check(a.ranging.accept(sample(a.lease.generation, 1, 5))?.distanceMeters === 5);
    check(b.ranging.accept(sample(b.lease.generation, 1, 5))?.distanceMeters === 5);
    clock += 200;
    check(a.ranging.accept(sample(a.lease.generation, 2, 2))?.distanceMeters === 2);
    devices[0].setForeground(false);
    check(rejects(() => a.ranging.accept(sample(a.lease.generation, 3, 1))));
    check(stopped === 1 && devices[1].diagnostics().activeSessions === 1);
    clock += 1000;
    devices[0].setForeground(true);
    const restored = begin(devices[0], "synthetic-nonce-restored");
    check(rejects(() => restored.ranging.accept(sample(a.lease.generation, 4, 1))));
    // A stale generation fails closed, requiring a new authenticated attempt.
    restored.lease.release();
    clock += 1000;
    const fresh = begin(devices[0], "synthetic-nonce-fresh");
    check(fresh.ranging.accept(sample(fresh.lease.generation, 1, 1))?.distanceMeters === 1);
  } finally {
    for (const device of devices) device.dispose();
  }
  check(
    devices.every((device) => device.diagnostics().activeSessions === 0 && device.diagnostics().cleanupFailures === 0),
  );
}
function observation(f: CoordinatedSensorFrame, discontinuity = false) {
  return fieldObservation("sextant.magnetic.field", f.magneticDeviceMicrotesla, Math.max(0, f.captureAt), {
    simulationIdentity: "sextant-phase4-coordinated-v1",
    provenanceRoot: `synthetic.coordinated-v1@${f.generation}`,
    sequence: f.sequence,
    calibrationState: f.calibration,
    qualityClass: f.calibration === "GOOD" ? "MEDIUM" : "LOW",
    discontinuity,
    lifecycleState: f.lifecycle === "FOREGROUND" && f.permission === "GRANTED" ? "FOREGROUND_ONLY" : "SUSPENDED",
  });
}
/** Registers on the existing shared runner. All trajectories and faults remain
 * D0 synthetic evidence, including physically coherent input; no tier promotion. */
export function createSextantPhase4ScenarioPacks(packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry())) {
  packs.register({
    owner: "SEXTANT",
    scenarios: phase4ScenarioIds.map((suffix) => ({
      definition: {
        scenarioId: `sextant.${suffix}`,
        version: 1,
        owner: "SEXTANT",
        description: `Phase 4 D0 coordinated sensor oracle: ${suffix}`,
        tiers: ["D0"],
        preferredProfiles: ["synthetic"],
        fixtures: ["sextant-phase4-coordinated-v1"],
        protectedContracts: [`sextant.phase4.${suffix}`],
        expectedArtifacts: [],
        timeoutMs: 5000,
        soundingLineTests: ["src/sextant/phase4-scenarios.test.ts"],
        requiredFutureGates: [
          "D4_CORE_NATIVE_BRINGUP_REQUIRED",
          "D4_REAL_DEVICE_REQUIRED_FOR_PHYSICAL_CLAIMS",
          "D5_FIELD_REQUIRED_FOR_FIELD_CLAIMS",
          "OWNER_ACCEPTANCE_REQUIRED",
        ],
      },
      createAdapter: () => ({
        async execute({ signal }: { signal: AbortSignal }) {
          if (signal.aborted) throw new Error("SEXTANT_PHASE4_ABORTED");
          if (phase4ConsumerScenarioIds.includes(suffix as Phase4ConsumerScenario))
            await exercisePhase4ConsumerScenario(suffix as Phase4ConsumerScenario);
          else if (suffix === "coordinated-nearby-reconnect") nearbyOracle();
          else if (suffix === "coordinated-crossdeck-negotiation") {
            const phone = projectCapabilities(
              { formFactor: "PHONE", viewportClass: "COMPACT", reducedMotion: false },
              () => ({ ...unknownState(), support: "SUPPORTED", availability: "AVAILABLE", permission: "PROMPT" }),
            );
            const limited = projectCapabilities(
              { formFactor: "TABLET", viewportClass: "MEDIUM", reducedMotion: true },
              () => ({ ...unknownState(), support: "UNSUPPORTED" }),
            );
            check(
              Object.values(phone.sextant).every(
                (state) => state.support === "SUPPORTED" && state.permission === "PROMPT",
              ),
            );
            check(Object.values(limited.sextant).every((state) => state.support === "UNSUPPORTED"));
            check(!JSON.stringify(phone).includes("peerSessionId") && !JSON.stringify(phone).includes("position"));
          } else if (
            [
              "coordinated-magnetic-receding",
              "coordinated-magnetic-hysteresis",
              "coordinated-magnetic-spike",
              "coordinated-magnetic-background",
              "coordinated-magnetic-recovery",
            ].includes(suffix)
          )
            magneticOracle(suffix);
          else if (suffix === "coordinated-trajectory-pressure") {
            const series = coordinatedSensorSeries({
                ...coordinatedSensorBaseline,
                accelerationWorld: { x: 2, y: 0, z: 0 },
                initialVelocityWorld: { x: 0, y: 0, z: 1.5 },
              }),
              last = series.at(-1)!;
            check(
              Math.abs(last.positionWorldMeters.x - 16) < 1e-8 &&
                Math.abs(last.velocityWorldMetersPerSecond.x - 8) < 1e-8 &&
                Math.abs(last.positionWorldMeters.z - 6) < 1e-8,
            );
            // Independent standard-atmosphere reference, not a copy of the fixture formula.
            check(Math.abs(last.pressureHpa - 1012.52945) < 0.0001);
            for (const f of series)
              check(Math.abs(f.accelerationIncludingGravityDevice.z - f.linearAccelerationDevice.z - 9.80665) < 1e-8);
          } else if (suffix === "coordinated-rotation-field") {
            const context = new MagneticFieldContext(),
              series = coordinatedSensorSeries({ ...coordinatedSensorBaseline, yawRateRadPerSecond: Math.PI / 2 });
            for (const f of series) {
              const result = context.accept(observation(f), f.at);
              if (f.at >= 800) check(result.state === "READY" && Math.abs(result.deltaMicrotesla ?? Infinity) < 1e-8);
            }
            const quarter = series.find((f) => f.at === 1000)!;
            check(
              Math.abs(quarter.magneticDeviceMicrotesla.y + 20) < 1e-8 &&
                Math.abs(quarter.magneticDeviceMicrotesla.x) < 1e-8,
            );
          } else {
            const hunt = new MagneticHunt({
              version: 1,
              thresholdMicrotesla: 10,
              dwellMs: 800,
              timeoutMs: 8000,
              fallback: "Continue with the accessible screen control",
              safeProp: "WEAK_ENCLOSED_DISTANT",
              safetyAcknowledged: true,
            });
            const fault: Partial<Record<typeof suffix, SensorFaultKind>> = {
              "coordinated-magnetic-prop": "BIAS_DRIFT",
              "coordinated-stale-fallback": "STALE",
              "coordinated-clock-fallback": "CLOCK_JUMP",
              "coordinated-interference-fallback": "INTERFERENCE",
              "coordinated-calibration-fallback": "CALIBRATION",
              "coordinated-order-reset": "OUT_OF_ORDER",
              "coordinated-lifecycle-reset": "BACKGROUND",
              "coordinated-cadence-reset": "CADENCE",
            };
            const kind = fault[suffix]!;
            const series = coordinatedSensorSeries(
              {
                ...coordinatedSensorBaseline,
                durationMs: 6000,
                intervalMs: suffix === "coordinated-cadence-reset" ? 1000 : 200,
              },
              [
                {
                  kind,
                  startMs: 1000,
                  endMs: 6001,
                  magnitude: kind === "INTERFERENCE" ? 1000 : kind === "BIAS_DRIFT" ? 15 : 1,
                },
              ],
            );
            let completed = false,
              fallback = false;
            for (const f of series) {
              const result = hunt.accept(observation(f), f.at);
              completed ||= result.state === "REFERENCE_REACHED";
              fallback ||= result.state === "FALLBACK";
            }
            if (suffix === "coordinated-magnetic-prop") check(completed && !fallback);
            else {
              check(!completed);
              if (["STALE", "CLOCK_JUMP", "INTERFERENCE", "CALIBRATION", "BACKGROUND"].includes(kind)) check(fallback);
            }
            hunt.reset();
          }
          return {
            assertions: [{ id: `sextant.phase4.${suffix}`, state: "PASS" as const }],
            unsupportedCapabilities: [],
            artifacts: [],
          };
        },
        async cleanup() {
          return {
            result: "PASS" as const,
            ownedResources: ["bounded-synthetic-series", "ephemeral-field-model"],
            remainingResources: [],
          };
        },
      }),
    })),
  });
  return packs;
}
