import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import { orientationQuaternion, rotateVector, radians } from "./attitude";
import { DeviceGestureRecognizer } from "./gestures";
import { SextantHaptics } from "./haptics";
import { WebSextantRuntime } from "./web-runtime";
import { emulatedWebSensors } from "./web-fixture";
import type { LeaseEvent, LeaseRequest } from "./leases";
export const phase2ScenarioTiers = {
  "frame-normalization": "D0",
  "deliberate-turns": "D0",
  "walking-spin-rejection": "D0",
  "bounded-haptics": "D0",
  "web-relative-fallback": "D1",
  "web-heading-wrap": "D1",
  "web-gravity-separation": "D1",
  "web-permission-pause": "D1",
  "web-sharing-lifecycle": "D1",
  "web-screen-rotation": "D1",
  "web-accessible-fallback": "D1",
} as const;
function check(condition: boolean) {
  if (!condition) throw new Error("SEXTANT_PHASE2_LAB_ASSERTION_FAILED");
}
/** D1 exercises emulated browser event acquisition; observations explicitly retain simulation identity. */
export function createSextantPhase2ScenarioPacks(packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry())) {
  packs.register({
    owner: "SEXTANT",
    scenarios: Object.entries(phase2ScenarioTiers).map(([suffix, tier]) => ({
      definition: {
        scenarioId: `sextant.${suffix}`,
        version: 1,
        owner: "SEXTANT",
        description: `Phase 2 ${tier === "D0" ? "deterministic semantic" : "browser/device API emulation"}: ${suffix}`,
        tiers: [tier],
        preferredProfiles: [tier === "D0" ? "synthetic" : "browser-api-emulation"],
        fixtures: ["sextant-phase2-emulated-v1"],
        protectedContracts: [`sextant.phase2.${suffix}`],
        expectedArtifacts: [],
        timeoutMs: 5000,
        soundingLineTests: ["src/sextant/phase2-scenarios.test.ts"],
        requiredFutureGates: ["D4_REAL_DEVICE_REQUIRED_FOR_PHYSICAL_CLAIMS", "D5_FIELD_REQUIRED_FOR_FIELD_CLAIMS"],
      },
      createAdapter: () => {
        const f = emulatedWebSensors();
        const runtime = new WebSextantRuntime(f.target, null, f.now, {
          emulationIdentity: "sextant-phase2-browser-api-v1",
        });
        const events: LeaseEvent[] = [];
        let haptics: SextantHaptics | undefined;
        const purpose = {
          consumerId: "lab",
          surfaceId: "emulated",
          purpose: "Device lab: screen controls remain available",
          consent: true,
          userInitiated: true,
        };
        const request = (capabilityId: string): LeaseRequest => ({
          ...purpose,
          capabilityId,
          updateClass: "INTERACTIVE",
          minimumQuality: "LOW",
          maxAgeMs: 500,
          expiresAt: 20000,
          frames: capabilityId.includes("orientation")
            ? ["LOCAL_ARBITRARY"]
            : capabilityId.includes("heading")
              ? ["EARTH_MAGNETIC"]
              : ["DEVICE"],
          retentionClass: "EPHEMERAL",
          foregroundRequirement: true,
        });
        return {
          async execute({ signal }) {
            if (signal.aborted) throw new Error("SEXTANT_PHASE2_LAB_ABORTED");
            if (suffix === "frame-normalization") {
              const v = rotateVector(orientationQuaternion(90, 0, 0), { x: 0, y: 1, z: 0 });
              check(Math.abs(v.x + 1) < 1e-8 && Math.abs(v.y) < 1e-8);
            } else if (suffix === "deliberate-turns" || suffix === "walking-spin-rejection") {
              const g = new DeviceGestureRecognizer({
                kind: "ROTATION_COUNT",
                count: 3,
                direction: "CLOCKWISE",
                reversalToleranceDegrees: 15,
                timeoutMs: 20000,
                dwellMs: 200,
                fallback: "Use screen controls",
              });
              let result;
              for (let at = 0; at <= 12400; at += 100)
                result = g.update({
                  at,
                  qualified: true,
                  angular: { x: 0, y: 0, z: -radians(90) },
                  linear: { x: suffix === "walking-spin-rejection" ? 2 : 0, y: 0, z: 0 },
                  gravity: { x: 0, y: 0, z: 9.81 },
                  stability: "STABLE",
                });
              check(
                suffix === "deliberate-turns"
                  ? result?.state === "COMPLETED" && result.count === 3
                  : result?.state === "RESET",
              );
            } else if (suffix === "bounded-haptics") {
              let calls = 0,
                cancelled = 0;
              haptics = new SextantHaptics(
                {
                  tier: "BASIC",
                  execute: () => {
                    calls++;
                    return true;
                  },
                  cancel: () => {
                    cancelled++;
                  },
                },
                f.now,
              );
              const cue = {
                consumerId: "lab",
                purpose: "Found artifact",
                cue: "CONFIRM" as const,
                fallback: "Text and visual confirmation",
              };
              check(haptics.request(cue).state === "REQUESTED");
              check(haptics.request(cue).state === "FALLBACK");
              haptics.setForeground(false);
              check(calls === 1 && cancelled === 1);
            } else if (suffix === "web-permission-pause") {
              let resolve!: (s: string) => void;
              f.target.DeviceOrientationEvent = {
                requestPermission: () =>
                  new Promise((r) => {
                    resolve = r;
                  }),
              };
              const pending = runtime.enable(purpose);
              await runtime.pause();
              resolve("granted");
              check((await pending) === "DENIED");
              check(runtime.status("sextant.orientation.relative").paused);
              check(f.count("deviceorientation") === 0);
            } else if (suffix === "web-accessible-fallback") {
              f.target.DeviceMotionEvent = undefined;
              f.target.DeviceOrientationEvent = undefined;
              check(runtime.status("sextant.orientation.relative").support === "UNSUPPORTED");
              check(
                runtime.haptics.request({ cue: "TICK", consumerId: "lab", purpose: "Clue", fallback: "Show clue text" })
                  .state === "FALLBACK",
              );
            } else {
              await runtime.enable(purpose);
              if (suffix === "web-sharing-lifecycle") {
                const first = await runtime.acquire(request("sextant.orientation.relative"), (event) =>
                  events.push(event),
                );
                await runtime.acquire({ ...request("sextant.orientation.relative"), consumerId: "other" }, (event) =>
                  events.push(event),
                );
                check(f.count("deviceorientation") === 1);
                await first.release();
                check(f.count("deviceorientation") === 1);
                f.background();
                await runtime.leases.idle();
                check(f.count("deviceorientation") === 0);
                f.foreground();
                check(runtime.leases.diagnostics().activeLeases === 0);
              } else if (suffix === "web-gravity-separation") {
                await runtime.acquire(request("sextant.motion.linear-acceleration"), (e) => events.push(e));
                await runtime.acquire(request("sextant.motion.gravity"), (e) => events.push(e));
                f.motion();
                check(events.filter((e) => e.type === "OBSERVATION").length === 2);
                const before = events.length;
                f.setTime(200);
                f.motion({ acceleration: null });
                check(events.length === before);
              } else if (suffix === "web-heading-wrap") {
                await runtime.acquire(request("sextant.heading.estimate"), (e) => events.push(e));
                f.orientation({ webkitCompassHeading: 359, webkitCompassAccuracy: 10 });
                f.setTime(200);
                f.orientation({ webkitCompassHeading: 1, webkitCompassAccuracy: 10 });
                check(
                  events
                    .filter((e) => e.type === "OBSERVATION")
                    .map((e) => e.observation.value)
                    .join(",") === "359,1",
                );
              } else {
                await runtime.acquire(request("sextant.orientation.relative"), (e) => events.push(e));
                await runtime.acquire(request("sextant.orientation.absolute"), (e) => events.push(e));
                f.orientation();
                f.setTime(200);
                if (suffix === "web-screen-rotation") f.target.screen!.orientation!.angle = 90;
                f.orientation();
                const readings = events.filter((e) => e.type === "OBSERVATION");
                check(
                  readings.length === 2 &&
                    readings.every(
                      (e) => e.observation.referenceFrame === "LOCAL_ARBITRARY" && e.observation.syntheticFlag,
                    ),
                );
                check(JSON.stringify(readings[0].observation.value) === JSON.stringify(readings[1].observation.value));
              }
              for (const e of events)
                if (e.type === "OBSERVATION")
                  check(e.observation.syntheticFlag && e.observation.sourceClass === "SIMULATED");
            }
            return {
              assertions: [{ id: `sextant.phase2.${suffix}`, state: "PASS" as const }],
              unsupportedCapabilities: [],
              artifacts: [],
            };
          },
          async cleanup() {
            haptics?.dispose();
            await runtime.dispose();
            const remaining = [
              "deviceorientation",
              "deviceorientationabsolute",
              "devicemotion",
              "pagehide",
              "pageshow",
            ].filter((type) => f.count(type) !== 0);
            return {
              result: remaining.length ? ("FAIL" as const) : ("PASS" as const),
              ownedResources: ["emulated-browser-event-listeners", "ephemeral-leases", "owned-haptic-output"],
              remainingResources: remaining,
            };
          },
        };
      },
    })),
  });
  return packs;
}
