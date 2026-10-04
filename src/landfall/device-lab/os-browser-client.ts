import { NativeLocationProvider } from "@/landfall/native-location";
import { importLandfallEd25519PublicKey } from "../ed25519-public-verifier";
import { NativeContextProvider } from "@/landfall/native-context";
import { DeviceLabLocationDiagnostics } from "@/landfall/device-lab/location-diagnostics";
import { reportDeviceLabStartupStage } from "@/landfall/device-lab/startup-diagnostics";
import {
  androidSensorControl,
  matchesAndroidSensorContext,
  type AndroidSensorControl,
} from "@/landfall/device-lab/android-sensors";
import {
  createLandfallNativeDriver,
  subscribeLandfallNativeLifecycle,
  readNativeLandfallPower,
  landfallNativeRequest,
  type NativeLandfallPower,
} from "@/landfall/native-bridge";
import { landfallPowerPolicy } from "@/landfall/device-policy";
import { deviceLabFixtureForScenario } from "./native-fixture";
import { LandfallRuntime, type LandfallOutcome } from "@/landfall/runtime";
import { LandfallProviderRegistry } from "@/landfall/observation";
import { deviceLabActionSchema } from "@/landfall/device-lab/scenario";
import type { LandfallObservation } from "@/landfall/observation";
import { queueLandfallEvidence, pendingLandfallEvidence, clearLandfallEvidence } from "@/landfall/offline-web";
import { LandfallOutboxReconciler, type LandfallReconciliationTransport } from "@/landfall/offline-reconcile";
import type { PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";
import { offlineLease, rememberOfflineLease } from "@/landfall/offline-store";
import { restoreNativeLandfallLeases } from "@/landfall/native-private-store";
import { NativeLandfallInstallationProvider, type InstallationResult } from "@/landfall/native-installation";
import type { LandfallInstallationScope } from "@/landfall/installation-token";

/** Test-only local origin entrypoint, bundled by the Device Lab, never shipped in the release app. */
async function main() {
  reportDeviceLabStartupStage("ENTRY");
  const identity = { sessionId: "session-1", publishedVersionId: "version-1" };
  reportDeviceLabStartupStage("RESTORE_LEASE");
  await restoreNativeLandfallLeases();
  reportDeviceLabStartupStage("LEASE_RESTORED");
  const restarted = !["/player", "/player/"].includes(location.pathname);
  const lease = restarted ? offlineLease(identity.sessionId) : null;
  if (restarted && (!lease || lease.versionId !== identity.publishedVersionId))
    throw new Error("NATIVE_RESTART_LEASE_UNAVAILABLE");
  const csrf = lease?.csrfToken ?? "synthetic-native-lab-csrf";
  if (!navigator.serviceWorker) throw new Error("NATIVE_OFFLINE_SHELL_UNSUPPORTED");
  reportDeviceLabStartupStage("REGISTER_WORKER");
  await navigator.serviceWorker.register("/landfall-offline-sw.js", { scope: "/player/" });
  reportDeviceLabStartupStage("WAITING_WORKER");
  let shellTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_resolve, reject) => {
        shellTimer = setTimeout(() => reject(new Error("NATIVE_OFFLINE_SHELL_TIMEOUT")), 20000);
      }),
    ]);
  } finally {
    clearTimeout(shellTimer);
  }
  reportDeviceLabStartupStage("WAITING_CONTROL");
  if (!navigator.serviceWorker.controller)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        navigator.serviceWorker.removeEventListener("controllerchange", changed);
        reject(new Error("NATIVE_OFFLINE_SHELL_TIMEOUT"));
      }, 20000);
      const changed = () => {
        if (navigator.serviceWorker.controller) {
          clearTimeout(timer);
          navigator.serviceWorker.removeEventListener("controllerchange", changed);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener("controllerchange", changed);
      changed();
    });
  reportDeviceLabStartupStage("WORKER_CONTROLLED");
  const scenario = await (await fetch("/lab/scenario", { cache: "no-store" })).json();
  const definition = deviceLabFixtureForScenario(scenario.scenarioId);
  reportDeviceLabStartupStage("SCENARIO_RECEIVED");
  if (!["PHYSICAL", "VIRTUAL"].includes(scenario.worldspace)) throw new Error("NATIVE_WORLDSPACE_UNAVAILABLE");
  const world = definition.worldspaces.find((world) => world.kind === scenario.worldspace)!;
  definition.worldspaces = [world];
  definition.waypoints = definition.waypoints.filter((waypoint) => waypoint.worldspaceId === world.id);
  definition.maps = definition.maps.filter((map) => map.worldspaceId === world.id);
  definition.routes = definition.routes.filter((route) => route.worldspaceId === world.id);
  definition.transitions = [];
  if (world.kind === "PHYSICAL") {
    world.observationPolicy.allowedSources.push("NATIVE_LOCATION");
    definition.waypoints.forEach((waypoint) => waypoint.evidenceProfile.acceptedSources.push("NATIVE_LOCATION"));
  } else definition.waypoints[0].visibility.hiddenUntilRevealed = false;
  const driver = createLandfallNativeDriver();
  if (!driver) throw new Error("NATIVE_BRIDGE_UNAVAILABLE");
  if (!driver.readPermission) throw new Error("NATIVE_PASSIVE_PERMISSION_UNSUPPORTED");
  reportDeviceLabStartupStage("PASSIVE_PERMISSION");
  let foregroundPermission = world.kind === "PHYSICAL" ? await driver.readPermission() : ("GRANTED" as const);
  reportDeviceLabStartupStage("PERMISSION_READ");
  const registry = new LandfallProviderRegistry();
  registry.register({
    id: driver.platform === "IOS" ? "ios-core-location" : "android-location",
    source: "NATIVE_LOCATION",
    state: "AVAILABLE",
    worldspaceKinds: ["PHYSICAL"],
  });
  registry.register({
    id: "manual-virtual",
    source: "PLAYER_CONFIRMATION",
    state: "AVAILABLE",
    worldspaceKinds: ["VIRTUAL"],
  });
  const runtime = new LandfallRuntime(definition, identity, registry);
  runtime.setActiveWaypoint(definition.waypoints[0].id);
  runtime.setPermission(["GRANTED", "APPROXIMATE", "LIMITED"].includes(foregroundPermission) ? "GRANTED" : "DENIED");
  runtime.resume();
  const provider = world.kind === "PHYSICAL" ? new NativeLocationProvider(driver, world) : null;
  const nativeContext = world.kind === "PHYSICAL" ? new NativeContextProvider(world.id) : null;
  const sensorFrames = new Map<string, unknown>();
  let sensorState = "UNAVAILABLE";
  let expectedSensor: AndroidSensorControl | null = null;
  let waitingSensor: (() => void) | null = null;
  let failSensor: ((error: Error) => void) | null = null;
  let sensorReadySent = false;
  const receiveSensor = (event: Event) => {
    const value = (event as CustomEvent).detail;
    if (value?.type !== "sensor" || typeof value.frame?.id !== "string") return;
    sensorFrames.set(value.frame.id, value.frame);
    while (sensorFrames.size > 64) sensorFrames.delete(sensorFrames.keys().next().value!);
  };
  window.addEventListener("landfall-native-event", receiveSensor);
  let physicalAcquisitionStarts = 0;
  let outcome: LandfallOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
  let latest: LandfallObservation | null = null;
  let count = 0;
  let requests = (await pendingLandfallEvidence(identity.sessionId, identity.publishedVersionId, csrf)) ? 1 : 0;
  let samples: LandfallObservation[] = [];
  let queued = Promise.resolve();
  let network = (await (await fetch("/lab/connectivity", { cache: "no-store" })).json()).state as "ONLINE" | "OFFLINE";
  runtime.setOffline(network === "ONLINE" ? "ONLINE" : "OFFLINE_READY");
  let canonicalCount = 0;
  let serverConfirmed = false;
  let powerProfile = "SUSPENDED";
  let tokenState = "NONE";
  let backgroundResult = "NONE";
  let geofenceHandle: string | null = null;
  const receiveWake = (event: Event) => {
    const value = (event as CustomEvent).detail;
    if (
      value?.type !== "lifecycle" ||
      value.state !== "FOREGROUND" ||
      !geofenceHandle ||
      !Array.isArray(value.pendingHints) ||
      value.pendingHints.length > 32
    )
      return;
    const now = Date.now();
    if (
      value.pendingHints.some(
        (hint: Record<string, unknown>) =>
          hint.returnHandle === geofenceHandle &&
          hint.event === "ENTER" &&
          typeof hint.id === "string" &&
          /^[a-f0-9-]{36}$/i.test(hint.id) &&
          typeof hint.receivedAt === "number" &&
          Number.isInteger(hint.receivedAt) &&
          hint.receivedAt <= now &&
          now - hint.receivedAt < 300000,
      )
    )
      backgroundResult = "NEARBY_HINT";
  };
  window.addEventListener("landfall-native-event", receiveWake);
  let waiting: ((observation: LandfallObservation) => void) | null = null;
  const ingest = (observation: LandfallObservation) => {
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
            method: world.kind === "PHYSICAL" ? "FOREGROUND_LOCATION" : "PLAYER_FALLBACK",
            ...(world.kind === "PHYSICAL" ? { observations: [...samples] } : {}),
          } as PlayerLandfallEvidence);
      } catch {}
    }
    waiting?.(observation);
  };
  const start = async () => {
    if (!provider) return;
    const active = provider.active;
    await provider.start(identity, { userAction: true, intervalMs: 1000, precise: true }, ingest, (state) => {
      foregroundPermission = state;
      runtime.setPermission(["GRANTED", "APPROXIMATE", "LIMITED"].includes(state) ? "GRANTED" : "DENIED");
    });
    if (!active && provider.active) physicalAcquisitionStarts++;
  };
  const projectPower = (power: NativeLandfallPower | null) =>
    landfallPowerPolicy({
      lifecycle: "FOREGROUND",
      connectivity: network,
      foregroundConsent: true,
      backgroundConsent: false,
      foregroundPermission,
      backgroundPermission: "DENIED",
      lowPower: power?.state !== "READY" || power.lowPower,
      thermalPressure: power?.thermalPressure ?? false,
      precisionRequested: true,
    }).profile;
  powerProfile = projectPower(await readNativeLandfallPower());
  const unsubscribeLifecycle = subscribeLandfallNativeLifecycle((state) => {
    if (state === "BACKGROUND") {
      runtime.pause();
      samples = [];
      latest = null;
      void provider?.stop();
      nativeContext?.stop();
      sensorFrames.clear();
      sensorState = "UNAVAILABLE";
    }
  });
  reportDeviceLabStartupStage("READY_POST");
  await fetch("/lab/ready", {
    method: "POST",
    body: JSON.stringify({
      platform: driver.platform,
      permission: world.kind === "PHYSICAL" ? foregroundPermission : "NOT_REQUIRED",
      restarted,
      leaseRestored: lease !== null,
      publicShellControlled: navigator.serviceWorker.controller !== null,
    }),
  });
  while (true) {
    const response = await fetch("/lab/next", { cache: "no-store" });
    if (response.status === 204) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      continue;
    }
    const step = await response.json();
    if (step.stop) {
      if (geofenceHandle) await landfallNativeRequest("GEOFENCE_CLEAR");
      window.removeEventListener("landfall-native-event", receiveWake);
      await provider?.stop();
      nativeContext?.stop();
      window.removeEventListener("landfall-native-event", receiveSensor);
      sensorFrames.clear();
      unsubscribeLifecycle();
      break;
    }
    const action = deviceLabActionSchema.parse(step.action);
    let state: "PASS" | "FAIL" | "UNSUPPORTED" = "PASS";
    let reason: string | undefined;
    let locationDiagnostic: ReturnType<DeviceLabLocationDiagnostics["snapshot"]> | undefined;
    let stopDiagnostic: () => Promise<void> = async () => {};
    let cameraStage: "NOT_STARTED" | "PUBLIC_KEY_IMPORT" | "SCANNER_START" | "NATIVE_RESULT" | "VERIFIED" =
      "NOT_STARTED";
    let cameraResult: InstallationResult["state"] | "NOT_RECEIVED" = "NOT_RECEIVED";
    try {
      if (action.type === "LOCATION") {
        if (world.kind === "VIRTUAL" && action.coordinate.type !== "WGS84") {
          ingest({
            schemaVersion: 1,
            id: crypto.randomUUID(),
            ...identity,
            worldspaceId: world.id,
            providerId: "manual-virtual",
            source: "PLAYER_CONFIRMATION",
            kind: "VIRTUAL_POSITION",
            observedAt: new Date(Date.now() - action.ageMs).toISOString(),
            coordinate: action.coordinate,
            uncertaintyUnits: action.accuracy,
            confidence: 0.9,
          });
        } else if (
          world.kind !== "PHYSICAL" ||
          action.coordinate.type !== "WGS84" ||
          action.ageMs !== 0 ||
          action.duplicate ||
          action.provider === "BROWSER" ||
          action.accuracy !== 8
        ) {
          state = "UNSUPPORTED";
          reason = "OS_CANNOT_INJECT_REQUESTED_OBSERVATION";
        } else {
          foregroundPermission = await driver.readPermission();
          if (!["GRANTED", "APPROXIMATE", "LIMITED"].includes(foregroundPermission)) {
            runtime.setPermission("DENIED");
            await provider?.stop();
            let rejected = false;
            try {
              await driver.start({ background: false, intervalMs: 1000, precise: true });
            } catch {
              rejected = true;
            }
            if (!rejected) {
              await driver.stop();
              throw new Error("NATIVE_DENIED_ACQUISITION_ACCEPTED");
            }
            if (provider?.active) throw new Error("NATIVE_REVOKED_PROVIDER_ACTIVE");
            // Negative acquisition is verified by the real native operation, not
            // by inventing a fix after the OS grant has disappeared.
            reason = "OS_PERMISSION_PREVENTED_ACQUISITION";
          } else {
            const diagnostics = new DeviceLabLocationDiagnostics(action);
            const observationsBefore = count;
            const unsubscribeDiagnostic = driver.subscribe((event) => {
              if (event.type === "fix") diagnostics.observe(event.fix);
            });
            // Keep the snapshot categorical even when acquisition times out.
            stopDiagnostic = async () => {
              unsubscribeDiagnostic();
              if (driver.readAcquisition)
                diagnostics.observeAcquisition(await driver.readAcquisition().catch(() => null));
              locationDiagnostic = diagnostics.snapshot(count - observationsBefore);
            };
            await start();
            if (driver.readAcquisition) diagnostics.observeAcquisition(await driver.readAcquisition());
            const before = count;
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(() => {
                waiting = null;
                reject(new Error("OS_LOCATION_TIMEOUT"));
              }, 120000);
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
              // The host injects through the OS only after acquisition and this
              // listener are ready. Cold native startup is not a GPS observation.
              void fetch("/lab/location-ready", { method: "POST", body: JSON.stringify({ index: step.index }) }).catch(
                () => {
                  clearTimeout(timer);
                  waiting = null;
                  reject(new Error("OS_LOCATION_HANDSHAKE_FAILED"));
                },
              );
            });
          }
        }
      } else if (action.type === "ASSERT") {
        const observed: Record<string, unknown> = {
          confidence: outcome.confidence,
          rejection: outcome.rejection ?? null,
          completionRequests: requests,
          serverConfirmed,
          clientConfirmed: serverConfirmed,
          canonicalProgressionEvents: canonicalCount,
          physicalAcquisitionStarts,
          powerProfile,
          sensorState,
          tokenState,
          backgroundResult,
        };
        if (!(action.field in observed)) {
          state = "UNSUPPORTED";
          reason = "OS_ASSERTION_NOT_IMPLEMENTED";
        } else if (observed[action.field] !== action.value) throw new Error(`ASSERT_FAILED:${action.field}`);
      } else if (action.type === "NATIVE_GEOFENCE") {
        if (world.kind !== "PHYSICAL" || action.operation === "ENTER") {
          state = "UNSUPPORTED";
          reason = "NATIVE_GEOFENCE_OS_CONTROL_REQUIRED";
        } else if (action.operation === "REGISTER") {
          geofenceHandle = crypto.randomUUID().replaceAll("-", "");
          const reply = (await landfallNativeRequest("GEOFENCE_REGISTER", {
            returnHandle: geofenceHandle,
            latitude: 44,
            longitude: -72,
            radiusMeters: 500,
            expiresAt: Date.now() + 3600000,
            notifications: true,
          })) as { state?: string };
          if (reply?.state !== "GRANTED") {
            const category = ["UNAVAILABLE", "PERMISSION_REQUIRED", "DENIED", "UNSUPPORTED"].includes(
              reply?.state ?? "",
            )
              ? reply.state
              : "UNKNOWN";
            throw new Error(`NATIVE_GEOFENCE_REGISTRATION_${category}`);
          }
          backgroundResult = "REGISTERED";
        } else {
          const reply = (await landfallNativeRequest("GEOFENCE_CLEAR")) as { accepted?: boolean };
          if (reply?.accepted !== true) throw new Error("NATIVE_GEOFENCE_CLEAR_FAILED");
          geofenceHandle = null;
          backgroundResult = "NONE";
        }
      } else if (action.type === "INSTALLATION_TOKEN") {
        if (action.medium !== "QR" || action.fixture !== "VALID" || driver.platform !== "ANDROID") {
          state = "UNSUPPORTED";
          reason = "NATIVE_CAMERA_FIXTURE_REQUIRED";
        } else {
          const response = await fetch("/lab/camera-installation", { cache: "no-store" });
          if (!response.ok) throw new Error("NATIVE_CAMERA_FIXTURE_UNAVAILABLE");
          const fixture = (await response.json()) as {
            keyId: string;
            publicKey: JsonWebKey;
            scope: LandfallInstallationScope;
          };
          cameraStage = "PUBLIC_KEY_IMPORT";
          const key = await importLandfallEd25519PublicKey(fixture.publicKey);
          const scanner = new NativeLandfallInstallationProvider({
            scope: fixture.scope,
            installations: [{ id: fixture.scope.id, medium: "QR" }],
            keys: new Map([[fixture.keyId, key]]),
          });
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            cameraStage = "SCANNER_START";
            const result = await new Promise<InstallationResult>((resolve, reject) => {
              timer = setTimeout(() => reject(new Error("NATIVE_CAMERA_ACQUISITION_TIMEOUT")), 35000);
              void scanner.scan("QR", resolve).then((reply) => {
                if (reply === "GRANTED") void fetch("/lab/camera-started", { method: "POST", body: "{}" });
                if (reply !== "GRANTED" && reply !== "COMPLETED") reject(new Error("NATIVE_CAMERA_START_FAILED"));
              }, reject);
            });
            cameraStage = "NATIVE_RESULT";
            cameraResult = result.state;
            if (result.state !== "VERIFIED" || result.canComplete || result.physicalPresence !== "NOT_PROVEN")
              throw new Error("NATIVE_CAMERA_IDENTITY_NOT_VERIFIED");
            tokenState = "NEW";
            cameraStage = "VERIFIED";
          } finally {
            clearTimeout(timer);
            await scanner.clear();
          }
        }
      } else if (action.type === "SENSOR") {
        expectedSensor = androidSensorControl(action);
        if (driver.platform !== "ANDROID" || !nativeContext || !expectedSensor) {
          state = "UNSUPPORTED";
          reason = "NATIVE_SENSOR_CONTROL_UNSUPPORTED";
        } else {
          sensorReadySent = false;
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              waitingSensor = null;
              failSensor = null;
              reject(new Error("NATIVE_SENSOR_FRAME_TIMEOUT"));
            }, 15000);
            failSensor = (error) => {
              clearTimeout(timer);
              waitingSensor = null;
              failSensor = null;
              reject(error);
            };
            waitingSensor = () => {
              clearTimeout(timer);
              waitingSensor = null;
              failSensor = null;
              resolve();
            };
            void nativeContext
              .start(
                identity,
                (evidence) => {
                  runtime.ingestContext(evidence, Date.now());
                  if (
                    sensorReadySent &&
                    expectedSensor &&
                    matchesAndroidSensorContext(expectedSensor, sensorFrames.get(evidence.id), evidence)
                  ) {
                    sensorState = "READY";
                    waitingSensor?.();
                  }
                },
                (permission) => {
                  if (permission !== "GRANTED") {
                    sensorState = "UNAVAILABLE";
                    failSensor?.(new Error("NATIVE_SENSOR_ADAPTER_UNAVAILABLE"));
                  }
                },
                true,
              )
              .then(async () => {
                await fetch("/lab/sensor-ready", { method: "POST", body: JSON.stringify({ index: step.index }) });
                sensorReadySent = true;
              })
              .catch((error) => {
                clearTimeout(timer);
                waitingSensor = null;
                reject(error);
              });
          });
        }
      } else if (action.type === "PERMISSION") {
        if (world.kind !== "PHYSICAL" || action.permission !== "FOREGROUND_LOCATION") {
          state = "UNSUPPORTED";
          reason = "NATIVE_PERMISSION_TRANSLATION_UNAVAILABLE";
        } else {
          const expected = ["REVOKED", "DENIED", "DENIED_PERMANENTLY"].includes(action.state) ? "DENIED" : action.state;
          const deadline = Date.now() + 5000;
          foregroundPermission = await driver.readPermission();
          while (foregroundPermission !== expected && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 100));
            foregroundPermission = await driver.readPermission();
          }
          if (foregroundPermission !== expected) throw new Error("NATIVE_PERMISSION_STATE_MISMATCH");
          runtime.setPermission(
            ["GRANTED", "APPROXIMATE", "LIMITED"].includes(foregroundPermission) ? "GRANTED" : "DENIED",
          );
          if (foregroundPermission === "DENIED") {
            await provider?.stop();
            samples = [];
            latest = null;
          }
          powerProfile = projectPower(await readNativeLandfallPower());
        }
      } else if (action.type === "POWER") {
        const deadline = Date.now() + 5000;
        let power = await readNativeLandfallPower();
        const expected = action.saver || action.batteryPercent <= 15;
        while ((!power || power.lowPower !== expected) && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          power = await readNativeLandfallPower();
        }
        if (!power || power.state !== "READY" || power.lowPower !== expected)
          throw new Error("NATIVE_POWER_STATE_MISMATCH");
        powerProfile = projectPower(power);
      } else if (action.type === "NETWORK") {
        if (action.latencyMs !== 0 || !["ONLINE", "OFFLINE"].includes(action.state)) {
          state = "UNSUPPORTED";
          reason = "NATIVE_NETWORK_PROFILE_UNSUPPORTED";
        } else {
          network = action.state === "OFFLINE" ? "OFFLINE" : "ONLINE";
          runtime.setOffline(network === "ONLINE" ? "ONLINE" : "OFFLINE_READY");
          if (network === "OFFLINE") {
            const stored = await rememberOfflineLease({
              sessionId: identity.sessionId,
              versionId: identity.publishedVersionId,
              csrfToken: csrf,
            });
            if (stored !== "NATIVE_PREPARED") throw new Error("NATIVE_RESTART_LEASE_STORAGE_UNAVAILABLE");
          }
        }
      } else if (action.type === "RECONCILE") {
        if (!["ACCEPT", "DUPLICATE", "LOST_RESPONSE"].includes(action.outcome)) {
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
              authorize: async (evidence) =>
                (await (
                  await fetch(`/lab/authority?receiptEvidenceId=${encodeURIComponent(evidence.evidenceId)}`, {
                    cache: "no-store",
                  })
                ).json()) as Awaited<ReturnType<LandfallReconciliationTransport["authorize"]>>,
              submit: async (evidence) => {
                const response = await fetch("/lab/commit", { method: "POST", body: JSON.stringify(evidence) });
                if (!response.ok) return response.status >= 500 ? "UNAVAILABLE" : "CONFLICT";
                const result = await response.json();
                if (action.outcome === "LOST_RESPONSE") return "UNAVAILABLE";
                serverConfirmed = true;
                return result.duplicate ? "DUPLICATE" : "ACCEPTED";
              },
            },
          );
          const [first, second] = await Promise.all([reconciler.reconcile(), reconciler.reconcile()]);
          const expected =
            action.outcome === "LOST_RESPONSE" ? "RETRY" : action.outcome === "DUPLICATE" ? "DUPLICATE" : "ACCEPTED";
          if (first !== expected || second !== expected) throw new Error("NATIVE_RECONCILIATION_FAILED");
          if (first === "ACCEPTED" || first === "DUPLICATE") serverConfirmed = true;
          canonicalCount = (await (await fetch("/lab/counts", { cache: "no-store" })).json())
            .canonicalProgressionEvents;
        }
      } else if (action.type === "LIFECYCLE") {
        if (action.state === "FOREGROUND" || action.state === "RELAUNCH") {
          runtime.resume();
        } else {
          runtime.pause();
          await provider?.stop();
        }
      } else {
        state = "UNSUPPORTED";
        reason = "OS_ACTION_NOT_IMPLEMENTED";
      }
    } catch (error) {
      state = "FAIL";
      if (action.type === "INSTALLATION_TOKEN") {
        const failure =
          error instanceof Error &&
          ["NotSupportedError", "SecurityError", "DataError", "OperationError", "AbortError", "TypeError"].includes(
            error.name,
          )
            ? error.name
            : "OTHER";
        await fetch("/lab/camera-diagnostic", {
          method: "POST",
          body: JSON.stringify({
            stage: cameraStage,
            result: cameraResult,
            failure,
            cryptoAvailable: !!globalThis.crypto?.subtle,
            nativeBridgeAvailable: !!window.LandfallNative,
          }),
        });
      }
      reason =
        error instanceof Error && /^[A-Z_:a-z]{1,128}$/.test(error.message) ? error.message : "OS_SCENARIO_FAILED";
    } finally {
      await stopDiagnostic();
    }
    // Only categorical counters/outcomes leave the virtual device. No raw fix or coordinate trace.
    await queued;
    await fetch("/lab/result", {
      method: "POST",
      body: JSON.stringify({
        index: step.index,
        action: action.type,
        state,
        reason,
        completionRequests: requests,
        locationDiagnostic,
      }),
    });
  }
}
main().catch((error: unknown) => {
  const reason =
    error instanceof Error && /^[A-Z_]{1,128}$/.test(error.message) ? error.message : "NATIVE_CLIENT_FAILED";
  void fetch("/lab/error", { method: "POST", body: JSON.stringify({ reason }) });
});
