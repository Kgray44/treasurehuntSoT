import { SextantCapabilityRegistry } from "./capabilities";
import { SextantProviderRegistry } from "./providers";
import { SextantPermissionBroker } from "./permissions";
import { SextantLeaseBroker, type LeaseEvent } from "./leases";
import { SyntheticSextantProvider } from "./synthetic";
import { SextantGestureSession } from "./web-runtime";
import { gestureAcquisition } from "./gesture-acquisition";
import { MotionClassifier, type GestureConfig } from "./gestures";
import { orientationQuaternion, inverseQuaternion, rotateVector, type Quaternion, type Vector3 } from "./attitude";
import { coordinatedSensorBaseline, coordinatedSensorSeries } from "@/device-lab/coordinated-sensors";
import { NearbySessions, SecureRangingSession } from "./nearby";
import { peerContract } from "./phase3-fixtures";
import type { CapabilityState, Observation } from "./contracts";

export const phase4ConsumerScenarioIds = [
  "consumer-pitch-roll",
  "consumer-noise-conflict",
  "consumer-dropout-recovery",
  "consumer-capability-restoration",
  "consumer-process-restoration",
  "consumer-offline-reconnect",
] as const;
export type Phase4ConsumerScenario = (typeof phase4ConsumerScenarioIds)[number];
const check = (condition: unknown) => {
  if (!condition) throw new Error("SEXTANT_CONSUMER_LAB_ORACLE_FAILED");
};
const common = { fallback: "Continue with the accessible screen control", timeoutMs: 20000, dwellMs: 300 };
const zero: Vector3 = { x: 0, y: 0, z: 0 };

/** The real registry, permission broker, lease broker and gesture consumer are
 * exercised together. Only the explicit provider boundary is synthetic. */
function consumer(config: GestureConfig) {
  let clock = 10000;
  const capabilities = new SextantCapabilityRegistry(),
    providers = new SextantProviderRegistry(capabilities, "DEVICE_LAB");
  const permissions = new SextantPermissionBroker(async () => "GRANTED");
  const policy = gestureAcquisition(config),
    state: Partial<CapabilityState> = {};
  const provider = new SyntheticSextantProvider(
    "sextant-phase4-consumer-v1",
    capabilities,
    policy.channels.map((c) => c.capabilityId),
    "synthetic.phase4-consumer",
    state,
  );
  providers.register(provider);
  const broker = new SextantLeaseBroker(capabilities, providers, permissions, () => clock);
  const session = new SextantGestureSession(config, () => clock),
    motion = new MotionClassifier();
  const results: { state: string; at: number }[] = [],
    observations: Observation[] = [],
    events: LeaseEvent[] = [];
  const start = async (consent = true) => {
    for (const channel of policy.channels)
      await broker.acquire(
        {
          ...channel,
          consumerId: "phase4-lab",
          surfaceId: "synthetic",
          purpose: "Optional local gesture with screen fallback",
          consent,
          userInitiated: true,
          updateClass: "INTERACTIVE",
          minimumQuality: "MEDIUM",
          maxAgeMs: 500,
          expiresAt: clock + 30000,
          retentionClass: "EPHEMERAL",
          foregroundRequirement: true,
        },
        (event) => {
          events.push(event);
          if (event.type === "OBSERVATION") observations.push(event.observation);
          const result = session.accept(event);
          if (result) results.push({ state: result.state, at: clock });
          else if (event.type !== "OBSERVATION") results.push({ state: "UNAVAILABLE", at: clock });
        },
      );
  };
  const tick = (
    offset: number,
    input: {
      attitude?: Quaternion;
      linear?: Vector3;
      angular?: Vector3;
      stability?: "STABLE" | "MOVING" | "UNKNOWN";
    } = {},
  ) => {
    clock = 10000 + offset;
    const attitude = input.attitude ?? orientationQuaternion(0, 0, 0),
      linear = input.linear ?? zero,
      angular = input.angular ?? zero;
    const gravity = rotateVector(inverseQuaternion(attitude), { x: 0, y: 0, z: 9.80665 });
    const values: Record<string, unknown> = {
      "sextant.orientation.attitude": attitude,
      "sextant.motion.gravity": gravity,
      "sextant.motion.linear-acceleration": linear,
      "sextant.motion.angular-velocity": angular,
      "sextant.motion.stability": input.stability ?? motion.update(clock, linear, angular),
    };
    for (const channel of policy.channels) {
      const definition = capabilities.get(channel.capabilityId);
      provider.push({
        capabilityId: channel.capabilityId,
        value: values[channel.capabilityId],
        units: definition.units,
        referenceFrame: channel.frames[0],
        timestampMonotonic: clock,
        confidence: 0.8,
        qualityClass: "HIGH",
        calibrationState: "GOOD",
        warnings: [],
      });
    }
  };
  return {
    broker,
    provider,
    session,
    state,
    results,
    observations,
    events,
    start,
    tick,
    advance(offset: number) {
      clock = 10000 + offset;
    },
    now: () => clock,
    completed: () => results.some((r) => r.state === "COMPLETED"),
    async close() {
      await broker.dispose();
      check(broker.diagnostics().activeLeases === 0 && broker.diagnostics().activeProviders === 0);
    },
  };
}

async function pitchRoll() {
  for (const axis of ["X", "Y"] as const) {
    const f = consumer({ ...common, kind: "TILT_BAND", axis, minimumDegrees: 20, maximumDegrees: 40 });
    try {
      await f.start();
      // Held poses have zero angular rate and appropriately rotated gravity.
      // An out-of-band pose must never accumulate valid dwell on either axis.
      for (let at = 0; at <= 1500; at += 100)
        f.tick(at, { attitude: orientationQuaternion(0, axis === "X" ? 5 : 0, axis === "Y" ? 5 : 0) });
      check(!f.completed());
      for (let at = 1600; at <= 3200; at += 100)
        f.tick(at, { attitude: orientationQuaternion(0, axis === "X" ? 30 : 0, axis === "Y" ? 30 : 0) });
      check(f.completed() && f.observations.every((o) => o.syntheticFlag && o.sourceClass === "SIMULATED"));
    } finally {
      await f.close();
    }
  }
}

async function noiseConflict() {
  const f = consumer({ ...common, kind: "RELATIVE_TURN", angleDegrees: 90, toleranceDegrees: 15 });
  try {
    await f.start();
    const series = coordinatedSensorSeries({
      ...coordinatedSensorBaseline,
      intervalMs: 100,
      durationMs: 2000,
      noiseBound: 0.02,
    });
    for (const frame of series)
      f.tick(frame.at, { linear: frame.linearAccelerationDevice, angular: frame.angularVelocityDevice });
    check(!f.completed());
    // A falsely stable label cannot override contradictory motion evidence.
    for (let at = 2100; at <= 4100; at += 100)
      f.tick(at, { linear: { x: 2, y: 0, z: 0 }, angular: { x: 0, y: 0, z: -Math.PI / 2 }, stability: "STABLE" });
    check(!f.completed());
    f.session.reset();
    for (let at = 4200; at <= 7000; at += 100)
      f.tick(at, { angular: { x: 0, y: 0, z: at >= 4800 && at < 5800 ? -Math.PI / 2 : 0 } });
    check(f.completed());
  } finally {
    await f.close();
  }
}

async function dropoutRecovery() {
  const f = consumer({ ...common, kind: "HOLD_STEADY", dwellMs: 1000 });
  try {
    await f.start();
    for (let at = 0; at <= 900; at += 100) f.tick(at);
    check(!f.completed());
    const before = f.observations.length;
    f.advance(5000);
    check(
      f.broker.snapshot("sextant.motion.stability", 500).freshness === "STALE" &&
        f.observations.length === before &&
        !f.completed(),
    );
    for (let at = 5000; at <= 5900; at += 100) f.tick(at);
    check(!f.completed());
    for (let at = 6000; at <= 7000; at += 100) f.tick(at);
    check(f.completed() && f.results.filter((r) => r.state === "COMPLETED").every((r) => r.at >= 16000));
  } finally {
    await f.close();
  }
}

async function capabilityRestoration() {
  const f = consumer({ ...common, kind: "HOLD_STEADY", dwellMs: 1000 });
  try {
    await f.start();
    for (let at = 0; at <= 800; at += 100) f.tick(at);
    f.state.support = "UNSUPPORTED";
    f.state.availability = "TEMPORARILY_UNAVAILABLE";
    const before = f.observations.length;
    f.tick(900);
    check(f.observations.length === before);
    // Revalidation is the same path used after a real native state event.
    await f.broker.revalidateCapabilities();
    check(f.broker.diagnostics().activeLeases === 0 && f.results.some((r) => r.state === "UNAVAILABLE"));
    for (let at = 1000; at <= 2400; at += 100) f.tick(at);
    check(!f.completed());
    f.state.support = "SUPPORTED";
    f.state.availability = "AVAILABLE";
    f.tick(2500);
    check(f.broker.diagnostics().activeLeases === 0);
    await f.start();
    for (let at = 2600; at <= 4500; at += 100) f.tick(at);
    check(f.completed());
  } finally {
    await f.close();
  }
}

async function processRestoration() {
  const first = consumer({ ...common, kind: "HOLD_STEADY", dwellMs: 1000 });
  try {
    await first.start();
    for (let at = 0; at <= 800; at += 100) first.tick(at);
    await first.broker.setForeground(false);
    check(first.broker.diagnostics().activeLeases === 0 && !first.completed());
    await first.broker.setForeground(true);
    first.tick(2000);
    check(!first.completed());
  } finally {
    await first.close();
  }
  const restored = consumer({ ...common, kind: "HOLD_STEADY", dwellMs: 1000 });
  try {
    let refused = false;
    try {
      await restored.start(false);
    } catch {
      refused = true;
    }
    check(refused && restored.broker.diagnostics().activeLeases === 0);
    await restored.start();
    // This case proves new consent and new dwell after dispose/recreate.
    // Actual old native lease/generation delivery is checked separately by
    // native-runtime.test.ts; a detached synthetic provider cannot prove it.
    for (let at = 0; at <= 900; at += 100) restored.tick(at);
    check(!restored.completed());
    for (let at = 1000; at <= 2400; at += 100) restored.tick(at);
    check(restored.completed());
  } finally {
    await restored.close();
  }
}

async function offlineReconnect() {
  const f = consumer({ ...common, kind: "HOLD_STEADY" }),
    nearby = new NearbySessions(f.now);
  const begin = (nonce: string) => {
    const purpose = {
      consumerId: "crossdeck-lab",
      surfaceId: "synthetic-peer",
      purpose: "Optional authenticated nearby participation",
      consent: true,
      userInitiated: true,
      expiresAt: f.now() + 10000,
    };
    const lease = nearby.begin(purpose),
      peer = peerContract({
        consumerId: purpose.consumerId,
        surfaceId: purpose.surfaceId,
        purpose: purpose.purpose,
        expiresAt: purpose.expiresAt,
        nonce,
        peerSessionId: "phase4-peer",
        outOfBand: "AUTHENTICATED_NETWORK",
        securityMode: "APPLICATION_AUTHENTICATED",
      });
    return { lease, ranging: new SecureRangingSession(peer, nearby, lease, () => true) };
  };
  try {
    await f.start();
    const first = begin("phase4-original-nonce");
    // Crossdeck owns transport connectivity. Its authenticated scope ends on
    // simulated transport loss; local sensing has no network authority.
    first.lease.release();
    check(nearby.diagnostics().activeSessions === 0 && f.broker.diagnostics().activeLeases === 1);
    for (let at = 0; at <= 2000; at += 100) f.tick(at);
    check(f.completed());
    const restored = begin("phase4-reconnected-nonce");
    const sample = (generation: number) => ({
      peerSessionId: "phase4-peer",
      generation,
      sequence: 1,
      timestampMonotonic: f.now(),
      distanceMeters: 1,
      uncertaintyMeters: 0.2,
      technologyClass: "UWB",
      referenceFrame: "LOCAL_ARBITRARY",
      lifecycle: "FOREGROUND_ONLY",
      securityMode: "APPLICATION_AUTHENTICATED",
    });
    let refused = false;
    try {
      restored.ranging.accept(sample(first.lease.generation));
    } catch {
      refused = true;
    }
    check(refused);
    restored.lease.release();
    f.advance(3000);
    const fresh = begin("phase4-fresh-nonce");
    check(fresh.ranging.accept(sample(fresh.lease.generation))?.distanceMeters === 1);
  } finally {
    nearby.dispose();
    await f.close();
    check(nearby.diagnostics().activeSessions === 0);
  }
}

export async function exercisePhase4ConsumerScenario(id: Phase4ConsumerScenario) {
  const scenarios = {
    "consumer-pitch-roll": pitchRoll,
    "consumer-noise-conflict": noiseConflict,
    "consumer-dropout-recovery": dropoutRecovery,
    "consumer-capability-restoration": capabilityRestoration,
    "consumer-process-restoration": processRestoration,
    "consumer-offline-reconnect": offlineReconnect,
  };
  await scenarios[id]();
}
