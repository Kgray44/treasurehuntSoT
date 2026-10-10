import { SextantCapabilityRegistry } from "./capabilities";
import { SextantProviderRegistry } from "./providers";
import { SextantPermissionBroker } from "./permissions";
import { SextantLeaseBroker, type LeaseEvent, type LeaseRequest } from "./leases";
import { SyntheticSextantProvider } from "./synthetic";
import { DeviceLabScenarioPacks } from "@/device-lab/scenario-pack";
import { loadDeviceLabRegistry } from "@/device-lab/registry";
import type { ProviderSample } from "./contracts";
export const phase1ScenarioIds = [
  "capability-supported",
  "capability-unavailable",
  "permission-denied",
  "permission-revoked",
  "provider-switch",
  "stale-observation",
  "low-quality-observation",
  "consumer-lease-sharing",
  "simulation-identity",
] as const;
export function sextantD0Fixture() {
  let time = 100;
  const capabilities = new SextantCapabilityRegistry(),
    providers = new SextantProviderRegistry(capabilities, "DEVICE_LAB");
  const permissions = new SextantPermissionBroker(async () => "GRANTED");
  const provider = new SyntheticSextantProvider("sextant-phase1-d0-v1", capabilities, ["sextant.heading.estimate"]);
  providers.register(provider);
  const broker = new SextantLeaseBroker(capabilities, providers, permissions, () => time);
  const request: LeaseRequest = {
    capabilityId: "sextant.heading.estimate",
    consumerId: "lab",
    surfaceId: "synthetic",
    purpose: "NAVIGATION_HEADING",
    consent: true,
    userInitiated: true,
    updateClass: "LOW_RATE",
    minimumQuality: "MEDIUM",
    maxAgeMs: 1000,
    expiresAt: 100000,
    frames: ["EARTH_MAGNETIC"],
    retentionClass: "EPHEMERAL",
    foregroundRequirement: true,
  };
  const sample: ProviderSample = {
    capabilityId: request.capabilityId,
    value: 270,
    units: "degrees",
    referenceFrame: "EARTH_MAGNETIC",
    timestampMonotonic: 100,
    confidence: 0.8,
    calibrationState: "GOOD",
    qualityClass: "HIGH",
    warnings: [],
  };
  return {
    capabilities,
    providers,
    permissions,
    provider,
    broker,
    request,
    sample,
    setTime: (next: number) => {
      time = next;
    },
  };
}
function check(condition: boolean) {
  if (!condition) throw new Error("SEXTANT_D0_ASSERTION_FAILED");
}
/** Executable platform contracts. No magnetic/gesture/physical qualification is claimed by Phase 1. */
export function createSextantPhase1ScenarioPacks() {
  const packs = new DeviceLabScenarioPacks(loadDeviceLabRegistry());
  packs.register({
    owner: "SEXTANT",
    scenarios: phase1ScenarioIds.map((suffix) => ({
      definition: {
        scenarioId: `sextant.${suffix}`,
        version: 1,
        owner: "SEXTANT",
        description: `Phase 1 deterministic ${suffix} contract`,
        tiers: ["D0"],
        preferredProfiles: ["synthetic"],
        fixtures: ["sextant-phase1-d0-v1"],
        protectedContracts: [`sextant.phase1.${suffix}`],
        expectedArtifacts: [],
        timeoutMs: 5000,
        soundingLineTests: ["src/sextant/foundation-scenarios.test.ts"],
        requiredFutureGates: ["D4_REAL_DEVICE_REQUIRED_FOR_PHYSICAL_CLAIMS", "D5_FIELD_REQUIRED_FOR_FIELD_CLAIMS"],
      },
      createAdapter: () => {
        const f = sextantD0Fixture();
        const events: LeaseEvent[] = [];
        return {
          async execute({ signal }) {
            if (signal.aborted) throw new Error("SEXTANT_D0_ABORTED");
            const permissionKey = f.capabilities.get(f.request.capabilityId).permission;
            if (suffix === "capability-unavailable") {
              const empty = new SextantProviderRegistry(f.capabilities, "DEVICE_LAB");
              const b = new SextantLeaseBroker(f.capabilities, empty, f.permissions, () => 100);
              try {
                await b.acquire(f.request, () => {});
                check(false);
              } catch (e) {
                check(e instanceof Error && e.message === "SEXTANT_PROVIDER_UNAVAILABLE");
              } finally {
                await b.dispose();
              }
            } else if (suffix === "permission-denied") {
              f.permissions.set(permissionKey, "DENIED");
              try {
                await f.broker.acquire(f.request, () => {});
                check(false);
              } catch (e) {
                check(e instanceof Error && e.message === "SEXTANT_PERMISSION_UNAVAILABLE");
              }
              check(f.provider.starts === 0);
            } else {
              const lease = await f.broker.acquire(f.request, (e) => events.push(e));
              if (suffix === "capability-supported")
                check(f.broker.snapshot(f.request.capabilityId).support === "SUPPORTED" && f.provider.starts === 1);
              if (suffix === "permission-revoked") {
                f.permissions.set(permissionKey, "DENIED");
                await f.broker.idle();
                check(
                  f.broker.diagnostics().activeLeases === 0 &&
                    f.provider.stops === 1 &&
                    events.some((e) => e.type === "ENDED"),
                );
              }
              if (suffix === "provider-switch") {
                const second = new SyntheticSextantProvider(
                  "sextant-phase1-second-v1",
                  f.capabilities,
                  [f.request.capabilityId],
                  "synthetic.secondary",
                );
                f.providers.register(second);
                f.provider.push(f.sample);
                await f.broker.switchProvider(lease.leaseId);
                f.setTime(200);
                second.push({ ...f.sample, timestampMonotonic: 200 });
                const readings = events.filter((e) => e.type === "OBSERVATION");
                check(
                  readings.length === 2 &&
                    readings[1].observation.discontinuity &&
                    readings[1].observation.providerIdDiagnostic === "synthetic.secondary" &&
                    f.provider.stops === 1,
                );
              }
              if (suffix === "stale-observation") {
                f.setTime(2000);
                f.provider.push(f.sample);
                check(events.length === 1 && events[0].type === "DEGRADED" && events[0].reason === "STALE");
              }
              if (suffix === "low-quality-observation") {
                f.provider.push({ ...f.sample, qualityClass: "LOW" });
                check(events.length === 1 && events[0].type === "DEGRADED");
              }
              if (suffix === "consumer-lease-sharing") {
                const second = await f.broker.acquire(
                  { ...f.request, consumerId: "second", updateClass: "INTERACTIVE" },
                  (e) => events.push(e),
                );
                check(f.provider.starts === 1 && f.provider.updateClass === "INTERACTIVE");
                await second.release();
                check(f.provider.stops === 0 && (f.provider.updateClass as string) === "LOW_RATE");
                await lease.release();
                check(f.provider.stops === 1);
              }
              if (suffix === "simulation-identity") {
                f.provider.push(f.sample);
                const event = events[0];
                check(
                  event.type === "OBSERVATION" &&
                    event.observation.syntheticFlag &&
                    event.observation.sourceClass === "SIMULATED" &&
                    event.observation.simulationIdentity === f.provider.simulationIdentity,
                );
                const production = new SextantProviderRegistry(f.capabilities);
                try {
                  production.register(f.provider);
                  check(false);
                } catch (e) {
                  check(e instanceof Error && e.message === "SEXTANT_SIMULATION_FORBIDDEN");
                }
              }
            }
            return {
              assertions: [{ id: `sextant.phase1.${suffix}`, state: "PASS" as const }],
              unsupportedCapabilities: [],
              artifacts: [],
            };
          },
          async cleanup() {
            await f.broker.dispose();
            const d = f.broker.diagnostics();
            return {
              result: d.activeLeases === 0 && d.activeProviders === 0 ? ("PASS" as const) : ("FAIL" as const),
              ownedResources: ["synthetic-provider"],
              remainingResources: d.activeProviders ? ["synthetic-provider"] : [],
            };
          },
        };
      },
    })),
  });
  return packs;
}
