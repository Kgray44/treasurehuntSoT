import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import { MagneticFieldContext, RelativeElevationContext, PedometerContext } from "./field-context";
import {
  magneticObservation,
  pressureObservation,
  phase3Fixture,
  nearbyPurpose,
  mediaPurpose,
  peerContract,
  blePolicy,
  requirementFixture,
} from "./phase3-fixtures";
import { SecureRangingSession, WebBleCapability, WebNfcCapability, ndefEnvelopeSchema } from "./nearby";
import { sextantAuthoringSchema, simulateSextantRequirement } from "./requirements";
export const phase3ScenarioTiers = {
  "magnetic-baseline-trend": "D0",
  "magnetic-disturbance": "D0",
  "pressure-relative-climb": "D0",
  "pressure-weather-drift": "D0",
  "pedometer-pause-restart": "D0",
  "nearby-peer-replay": "D0",
  "field-privacy-threats": "D0",
  "capability-authored-fallback": "D0",
  "web-ble-denied": "D1",
  "web-ble-disconnect": "D1",
  "web-nfc-strict-read": "D1",
  "web-nfc-malformed": "D1",
  "media-denied-busy": "D1",
  "media-shared-cleanup": "D1",
  "media-source-generation": "D1",
  "web-nearby-background": "D1",
} as const;
function check(value: boolean) {
  if (!value) throw new Error("SEXTANT_PHASE3_LAB_ASSERTION_FAILED");
}
/** D0 semantic models and D1 browser API doubles. No D2/D4 hardware tier can be selected for these adapters. */
export function createSextantPhase3ScenarioPacks(packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry())) {
  packs.register({
    owner: "SEXTANT",
    scenarios: Object.entries(phase3ScenarioTiers).map(([suffix, tier]) => ({
      definition: {
        scenarioId: `sextant.${suffix}`,
        version: 1,
        owner: "SEXTANT",
        description: `Phase 3 ${tier}: ${suffix}`,
        tiers: [tier],
        preferredProfiles: [tier === "D0" ? "synthetic" : "browser-api-emulation"],
        fixtures: ["sextant-phase3-v1"],
        protectedContracts: [`sextant.phase3.${suffix}`],
        expectedArtifacts: [],
        timeoutMs: 5000,
        soundingLineTests: ["src/sextant/phase3-scenarios.test.ts"],
        requiredFutureGates: [
          "D4_REAL_DEVICE_REQUIRED_FOR_PHYSICAL_CLAIMS",
          "D5_FIELD_REQUIRED_FOR_FIELD_CLAIMS",
          "OWNER_ACCEPTANCE_REQUIRED",
        ],
      },
      createAdapter: () => {
        const f = phase3Fixture();
        return {
          async execute({ signal }: { signal: AbortSignal }) {
            if (signal.aborted) throw new Error("SEXTANT_PHASE3_ABORTED");
            if (suffix.startsWith("magnetic-")) {
              const m = new MagneticFieldContext();
              for (let at = 0; at <= 800; at += 200) m.accept(magneticObservation(50, at), at);
              if (suffix === "magnetic-disturbance")
                check(m.accept(magneticObservation(800, 1000), 1000).state === "UNUSABLE");
              else {
                let result;
                for (let at = 1000; at <= 1400; at += 200)
                  result = m.accept(magneticObservation(50 + (at - 800) / 50, at), at);
                check(result?.trend === "APPROACHING" && result.deltaMicrotesla === 12);
              }
            } else if (suffix.startsWith("pressure-")) {
              const p = new RelativeElevationContext();
              for (let at = 0; at <= 800; at += 200) p.accept(pressureObservation(1013.25, at), at);
              if (suffix === "pressure-relative-climb")
                check(
                  p.accept(pressureObservation(1013.25 * Math.pow(1 - 6 / 44330, 1 / 0.1903), 1000), 1000)
                    .deltaMeters === 6,
                );
              else {
                for (let at = 1000; at <= 120000; at += 1000) p.accept(pressureObservation(1013.25, at), at);
                check(p.accept(pressureObservation(1012, 121000), 121000).state === "REVALIDATE");
              }
            } else if (suffix === "pedometer-pause-restart") {
              const p = new PedometerContext(),
                i = { count: 100, at: 0, generation: "one", method: "OS_PEDOMETER" as const };
              p.accept(i, 0);
              check(p.accept({ ...i, count: 102, at: 1000 }, 1000)?.stepDelta === 2);
              p.reset();
              check(p.accept({ ...i, count: 120, at: 2000 }, 2000)?.stepDelta === 0);
            } else if (suffix === "nearby-peer-replay") {
              const lease = f.sessions.begin(nearbyPurpose),
                r = new SecureRangingSession(peerContract(), f.sessions, lease, () => true);
              const o = {
                peerSessionId: peerContract().peerSessionId,
                sequence: 0,
                generation: lease.generation,
                timestampMonotonic: 0,
                distanceMeters: 1,
                uncertaintyMeters: 0.2,
                technologyClass: "UWB",
                referenceFrame: "LOCAL_ARBITRARY",
                lifecycle: "FOREGROUND_ONLY",
                securityMode: "PLATFORM_SECURE_RANGING",
              };
              check(!r.accept(o).presenceProof);
              let rejected = false;
              try {
                r.accept(o);
              } catch {
                rejected = true;
              }
              check(rejected && f.sessions.diagnostics().activeSessions === 0);
            } else if (suffix === "field-privacy-threats") {
              check(!sextantAuthoringSchema.safeParse({ ...requirementFixture, rawMedia: "forbidden" }).success);
              check(
                !ndefEnvelopeSchema.safeParse({
                  version: 1,
                  records: [{ recordType: "url", data: new Uint8Array([1]) }],
                }).success,
              );
              check(!JSON.stringify(f.sessions.diagnostics()).match(/nonce|peer|serial|data|purpose/i));
            } else if (suffix === "capability-authored-fallback") {
              for (const outcome of ["UNAVAILABLE", "DENIED", "DEGRADED", "ACCESSIBLE_ALTERNATIVE"] as const) {
                const r = simulateSextantRequirement(requirementFixture, "sextant.magnetic.context", outcome);
                check(r.state === "FALLBACK" && !r.canonicalProgression && r.fallbacks.length === 1);
              }
            } else if (suffix.startsWith("web-ble")) {
              const api =
                suffix === "web-ble-denied"
                  ? {
                      requestDevice: async () => {
                        throw new Error("Denied");
                      },
                    }
                  : f.bluetooth;
              const result = await new WebBleCapability(api, true, f.sessions).connect(nearbyPurpose, blePolicy);
              if (suffix === "web-ble-denied") check(result.state === "FALLBACK");
              else {
                check(result.state === "CONNECTED");
                f.disconnect();
                check(f.sessions.diagnostics().activeSessions === 0 && f.stats().deviceListeners === 0);
              }
            } else if (suffix.startsWith("web-nfc")) {
              let received = false,
                rejected = false;
              await new WebNfcCapability(() => f.reader, true, f.sessions, "sextant-phase3-nfc-emulation-v1").read(
                nearbyPurpose,
                ndefEnvelopeSchema,
                (_, p) => {
                  received = p.syntheticFlag;
                },
                () => {
                  rejected = true;
                },
              );
              f.nfc(suffix === "web-nfc-malformed" ? "url" : "text");
              check(suffix === "web-nfc-malformed" ? rejected && !received : received && !rejected);
              check(f.stats().radioListeners === 0);
            } else if (suffix === "web-nearby-background") {
              await new WebBleCapability(f.bluetooth, true, f.sessions).connect(nearbyPurpose, blePolicy);
              f.sessions.setForeground(false);
              check(f.sessions.diagnostics().activeSessions === 0 && f.stats().disconnected > 0);
            } else {
              let invalidated = false;
              const make = async () => ({
                resource: f.resource,
                geometry: { width: 640, height: 480, facing: "REAR" as const, mirrored: false },
              });
              const first = await f.media.acquire("CAMERA", { ...mediaPurpose, shareKey: "vision" }, make, () => {
                invalidated = true;
              });
              if (suffix === "media-shared-cleanup") {
                const second = await f.media.acquire(
                  "CAMERA",
                  { ...mediaPurpose, shareKey: "vision", consumerId: "other" },
                  make,
                  () => {},
                );
                first.release();
                check(f.stats().stops === 0);
                second.release();
                check(f.stats().stops === 1);
              } else if (suffix === "media-source-generation") {
                f.media.invalidate("CAMERA", "SOURCE_CHANGED");
                check(invalidated && f.media.snapshot("CAMERA").generation > first.generation && f.stats().stops === 1);
              } else {
                let busy = false;
                try {
                  await f.media.acquire("CAMERA", mediaPurpose, make, () => {});
                } catch {
                  busy = true;
                }
                check(busy);
                f.media.setPermission("CAMERA", "DENIED");
                check(invalidated && f.stats().stops === 1 && f.media.snapshot("MICROPHONE").permission === "PROMPT");
              }
            }
            return {
              assertions: [{ id: `sextant.phase3.${suffix}`, state: "PASS" as const }],
              unsupportedCapabilities: [],
              artifacts: [],
            };
          },
          async cleanup() {
            f.media.dispose();
            f.sessions.dispose();
            const s = f.stats(),
              d = f.sessions.diagnostics();
            const remaining = [
              ...(f.media.diagnostics().cleanupFailures ? ["failed-media-cleanup"] : []),
              ...(f.media.diagnostics().activeResources ? ["media"] : []),
              ...(d.activeSessions ? ["nearby"] : []),
              ...(d.cleanupFailures ? ["failed-radio-cleanup"] : []),
              ...(s.trackListeners || s.radioListeners || s.deviceListeners ? ["listeners"] : []),
            ];
            return {
              result: remaining.length ? ("FAIL" as const) : ("PASS" as const),
              ownedResources: ["synthetic-media-resources", "emulated-radio-listeners", "bounded-nearby-timers"],
              remainingResources: remaining,
            };
          },
        };
      },
    })),
  });
  return packs;
}
