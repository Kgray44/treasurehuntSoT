import { NativeLocationProvider } from "@/landfall/native-location";
import { createLandfallNativeDriver } from "@/landfall/native-bridge";
import { landfallFixture } from "@/landfall/fixtures";
import { LandfallRuntime, type LandfallOutcome } from "@/landfall/runtime";
import { LandfallProviderRegistry } from "@/landfall/observation";
import { deviceLabActionSchema } from "@/landfall/device-lab/scenario";
import type { LandfallObservation } from "@/landfall/observation";
import { queueLandfallEvidence, pendingLandfallEvidence, clearLandfallEvidence } from "@/landfall/offline-web";
import { LandfallOutboxReconciler, type LandfallReconciliationTransport } from "@/landfall/offline-reconcile";
import type { PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";

/** Test-only local origin entrypoint, bundled by the Device Lab, never shipped in the release app. */
async function main() {
  const identity = { sessionId: "session-1", publishedVersionId: "version-1" };
  const definition = structuredClone(landfallFixture);
  const world = definition.worldspaces.find((world) => world.kind === "PHYSICAL")!;
  definition.worldspaces = [world];
  definition.waypoints = definition.waypoints.filter((waypoint) => waypoint.worldspaceId === world.id);
  definition.maps = definition.maps.filter((map) => map.worldspaceId === world.id);
  definition.routes = definition.routes.filter((route) => route.worldspaceId === world.id);
  definition.transitions = [];
  world.observationPolicy.allowedSources.push("NATIVE_LOCATION");
  definition.waypoints.forEach((waypoint) => waypoint.evidenceProfile.acceptedSources.push("NATIVE_LOCATION"));
  const driver = createLandfallNativeDriver();
  if (!driver) throw new Error("NATIVE_BRIDGE_UNAVAILABLE");
  const registry = new LandfallProviderRegistry();
  registry.register({
    id: driver.platform === "IOS" ? "ios-core-location" : "android-location",
    source: "NATIVE_LOCATION",
    state: "AVAILABLE",
    worldspaceKinds: ["PHYSICAL"],
  });
  const runtime = new LandfallRuntime(definition, identity, registry);
  runtime.setActiveWaypoint(definition.waypoints[0].id);
  runtime.setPermission("GRANTED");
  runtime.resume();
  const provider = new NativeLocationProvider(driver, world);
  let outcome: LandfallOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
  let latest: LandfallObservation | null = null;
  let count = 0;
  let requests = 0;
  let samples: LandfallObservation[] = [];
  let queued = Promise.resolve();
  let network = "ONLINE";
  let canonicalCount = 0;
  let serverConfirmed = false;
  const csrf = "synthetic-native-lab-csrf";
  let waiting: ((observation: LandfallObservation) => void) | null = null;
  const start = () =>
    provider.start(
      identity,
      { userAction: true, intervalMs: 1000, precise: true },
      (observation) => {
        latest = observation;
        count++;
        outcome = runtime.ingest(observation, Date.now());
        if (!outcome.rejection) samples = [...samples, observation].slice(-20);
        if (outcome.confidence === "CONFIRMED" && !outcome.rejection && requests === 0) {
          try {
            const request = runtime.completionRequest(observation.id, 0, "os-lab-request", Date.now());
            requests = 1;
            if (network === "OFFLINE")
              queued = queueLandfallEvidence(identity.sessionId, identity.publishedVersionId, csrf, {
                schemaVersion: 1,
                ...identity,
                worldspaceId: request.worldspaceId,
                waypointId: request.waypointId,
                evidenceId: request.evidenceId,
                expectedSequence: request.expectedSequence,
                idempotencyKey: request.idempotencyKey,
                method: "FOREGROUND_LOCATION",
                observations: [...samples],
              } as PlayerLandfallEvidence);
          } catch {}
        }
        waiting?.(observation);
      },
      (state) => {
        runtime.setPermission(["GRANTED", "APPROXIMATE", "LIMITED"].includes(state) ? "GRANTED" : "DENIED");
      },
    );
  await start();
  await fetch("/lab/ready", {
    method: "POST",
    body: JSON.stringify({ platform: driver.platform, permission: provider.permissionState }),
  });
  while (true) {
    const response = await fetch("/lab/next", { cache: "no-store" });
    if (response.status === 204) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    const step = await response.json();
    if (step.stop) {
      await provider.stop();
      break;
    }
    const action = deviceLabActionSchema.parse(step.action);
    let state: "PASS" | "FAIL" | "UNSUPPORTED" = "PASS";
    let reason: string | undefined;
    try {
      if (action.type === "LOCATION") {
        if (
          action.coordinate.type !== "WGS84" ||
          action.ageMs !== 0 ||
          action.duplicate ||
          action.provider === "BROWSER" ||
          action.accuracy !== 8
        ) {
          state = "UNSUPPORTED";
          reason = "OS_CANNOT_INJECT_REQUESTED_OBSERVATION";
        } else {
          await start();
          const before = count;
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              waiting = null;
              reject(new Error("OS_LOCATION_TIMEOUT"));
            }, 20000);
            const accept = (sample: LandfallObservation) => {
              if (
                sample.kind === "PHYSICAL_POSITION" &&
                sample.coordinate.type === "WGS84" &&
                action.coordinate.type === "WGS84" &&
                Math.abs(sample.coordinate.latitude - action.coordinate.latitude) < 0.00001 &&
                Math.abs(sample.coordinate.longitude - action.coordinate.longitude) < 0.00001 &&
                sample.accuracyMeters <= action.accuracy
              ) {
                clearTimeout(timer);
                waiting = null;
                resolve();
              }
            };
            waiting = accept;
            if (count > before && latest) accept(latest);
          });
        }
      } else if (action.type === "ASSERT") {
        const observed: Record<string, unknown> = {
          confidence: outcome.confidence,
          rejection: outcome.rejection ?? null,
          completionRequests: requests,
          serverConfirmed,
          canonicalProgressionEvents: canonicalCount,
        };
        if (!(action.field in observed)) {
          state = "UNSUPPORTED";
          reason = "OS_ASSERTION_NOT_IMPLEMENTED";
        } else if (observed[action.field] !== action.value) throw new Error(`ASSERT_FAILED:${action.field}`);
      } else if (action.type === "NETWORK") {
        if (action.latencyMs !== 0 || !["ONLINE", "OFFLINE"].includes(action.state)) {
          state = "UNSUPPORTED";
          reason = "NATIVE_NETWORK_PROFILE_UNSUPPORTED";
        } else {
          network = action.state;
          runtime.setOffline(network === "ONLINE" ? "ONLINE" : "OFFLINE_READY");
        }
      } else if (action.type === "RECONCILE") {
        if (action.outcome !== "ACCEPT") {
          state = "UNSUPPORTED";
          reason = "NATIVE_AUTHORITY_FAULT_UNSUPPORTED";
        } else {
          await queued;
          const reconciler = new LandfallOutboxReconciler(
            {
              pending: () => pendingLandfallEvidence(identity.sessionId, identity.publishedVersionId, csrf),
              clearEvidence: () => clearLandfallEvidence(identity.sessionId, identity.publishedVersionId, csrf),
              revoke: () => clearLandfallEvidence(identity.sessionId, identity.publishedVersionId, csrf),
            },
            {
              authorize: async () =>
                (await (await fetch("/lab/authority", { cache: "no-store" })).json()) as Awaited<
                  ReturnType<LandfallReconciliationTransport["authorize"]>
                >,
              submit: async (evidence) => {
                const response = await fetch("/lab/commit", { method: "POST", body: JSON.stringify(evidence) });
                if (!response.ok) return response.status >= 500 ? "UNAVAILABLE" : "CONFLICT";
                const result = await response.json();
                serverConfirmed = true;
                return result.duplicate ? "DUPLICATE" : "ACCEPTED";
              },
            },
          );
          const [first, second] = await Promise.all([reconciler.reconcile(), reconciler.reconcile()]);
          if (first !== "ACCEPTED" || second !== "ACCEPTED") throw new Error("NATIVE_RECONCILIATION_FAILED");
          canonicalCount = (await (await fetch("/lab/counts", { cache: "no-store" })).json())
            .canonicalProgressionEvents;
        }
      } else if (action.type === "LIFECYCLE") {
        if (action.state === "FOREGROUND") {
          runtime.resume();
          await start();
        } else {
          runtime.pause();
          await provider.stop();
        }
      } else {
        state = "UNSUPPORTED";
        reason = "OS_ACTION_NOT_IMPLEMENTED";
      }
    } catch (error) {
      state = "FAIL";
      reason =
        error instanceof Error && /^[A-Z_:a-z]{1,128}$/.test(error.message) ? error.message : "OS_SCENARIO_FAILED";
    }
    // Only categorical counters/outcomes leave the virtual device. No raw fix or coordinate trace.
    await fetch("/lab/result", {
      method: "POST",
      body: JSON.stringify({ index: step.index, action: action.type, state, reason }),
    });
  }
}
main().catch(() => {
  void fetch("/lab/error", { method: "POST", body: "NATIVE_CLIENT_FAILED" });
});
