import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { NativeLandfallSensorFusion } from "@/landfall/native-sensors";
import { LandfallNearbyProvider } from "@/landfall/nearby-provider";
import {
  LandfallOfflinePackageRepository,
  offlineManifestPayload,
  type OfflinePackageBinding,
  type OfflinePackageEnvelope,
  type EncryptedOfflinePackageRecord,
  type LandfallPackageStorage,
} from "@/landfall/offline-package";
import { projectPlayerLandfallBootstrap } from "@/landfall/player-bootstrap";
import { LandfallOfflineRepository, type LandfallOfflineStorage } from "@/landfall/offline-store";
import { LandfallOutboxReconciler } from "@/landfall/offline-reconcile";
import type { LandfallObservation } from "@/landfall/observation";
import type { PlayerLandfallEvidence } from "@/landfall/player-evidence-contract";
import {
  landfallInteractionPayload,
  verifyLandfallInteractionToken,
  LandfallInteractionReplayGuard,
  type LandfallInteractionClaim,
} from "@/landfall/interaction-token";
import { landfallFixture } from "@/landfall/fixtures";
import { LandfallRuntime, type LandfallOutcome } from "@/landfall/runtime";
import { LandfallProviderRegistry } from "@/landfall/observation";
import { NativeLocationProvider, type NativeLocationDriver } from "@/landfall/native-location";
import { landfallPowerPolicy, type LandfallLifecycle } from "@/landfall/device-policy";
import {
  LandfallProviderHealthRegistry,
  type PermissionState,
  type ConnectivityState,
} from "@/landfall/provider-policy";
import { landfallSimulationCatalog } from "@/landfall/provider-catalog";
import {
  LandfallBackgroundNavigation,
  resolveLandfallNotificationReturn,
  type BackgroundHintStorage,
  type NativeJourneyScope,
} from "@/landfall/background-navigation";
import {
  deviceLabScenarioSchema,
  type DeviceLabAction,
  type DeviceLabStepResult,
  type DeviceLabScenario,
} from "@/landfall/device-lab/scenario";

const epoch = Date.parse("2026-10-03T12:00:00.000Z");
const fixtureIdentity = { sessionId: "session-1", publishedVersionId: "version-1" };

/** Real production policies/adapters under logical time, with synthetic inputs and no canonical writer. */
export class LandfallProviderScenarioExecutor {
  private now = epoch;
  private sequence = 0;
  private runtime!: LandfallRuntime;
  private native!: NativeLocationProvider;
  private nativeListener: Parameters<NativeLocationDriver["subscribe"]>[0] = () => undefined;
  private permission: PermissionState = "GRANTED";
  private backgroundPermission: PermissionState = "GRANTED";
  private lifecycle: LandfallLifecycle = "FOREGROUND";
  private connectivity: ConnectivityState = "ONLINE";
  private lowPower = false;
  private thermal = false;
  private nativeStopped = true;
  private outcome: LandfallOutcome = { confidence: "UNAVAILABLE", sync: null, retryable: true };
  private readonly requests = new Set<string>();
  private samples: LandfallObservation[] = [];
  private reconciliationState = "NONE";
  private queued: Promise<void> = Promise.resolve();
  private readonly deliveryRecords = new Map<string, Awaited<ReturnType<LandfallOfflineStorage["all"]>>[number]>();
  private readonly deliveryStorage: LandfallOfflineStorage = {
    all: async () => structuredClone([...this.deliveryRecords.values()]),
    put: async (record) => {
      this.deliveryRecords.set(record.key, structuredClone(record));
    },
    delete: async (key) => {
      this.deliveryRecords.delete(key);
    },
    clear: async () => {
      this.deliveryRecords.clear();
    },
  };
  private readonly deliveryBinding = {
    ...fixtureIdentity,
    versionId: fixtureIdentity.publishedVersionId,
    csrfToken: "synthetic-lab-csrf",
  };
  private readonly health = new LandfallProviderHealthRegistry(landfallSimulationCatalog());
  private journal: unknown = null;
  private readonly backgroundStorage: BackgroundHintStorage = {
    read: async () => structuredClone(this.journal),
    write: async (journal) => {
      this.journal = structuredClone(journal);
    },
    clear: async () => {
      this.journal = null;
    },
  };
  private readonly background = new LandfallBackgroundNavigation(this.backgroundStorage, () => this.now);
  private backgroundResult = "NONE";
  private notificationState = "NONE";
  private sensorState = "NONE";
  private nearbyState = "NONE";
  private tokenState = "NONE";
  private sensors!: NativeLandfallSensorFusion;
  private readonly nearby = {
    BLE: new LandfallNearbyProvider("BLE", new Set(["lab-peer"])),
    UWB: new LandfallNearbyProvider("UWB", new Set(["lab-peer"])),
  };
  private readonly tokenReplay = new LandfallInteractionReplayGuard();
  private packageState = "NOT_AVAILABLE";
  private packageCapacity = 16 * 1024 * 1024;
  private readonly packageRecords = new Map<string, EncryptedOfflinePackageRecord>();
  private packageFixture: Promise<{
    repository: LandfallOfflinePackageRepository;
    binding: OfflinePackageBinding;
    envelope: OfflinePackageEnvelope;
    resources: Uint8Array[];
  }> | null = null;
  private scope: NativeJourneyScope = {
    ...fixtureIdentity,
    playerProfileId: "lab-player",
    worldspaceId: "town",
    waypointId: "town-arrival",
    expectedSequence: 0,
  };
  private readonly definition = structuredClone(landfallFixture);
  private canonicalCount: number | null = null;
  constructor(
    private readonly scenario: DeviceLabScenario,
    private readonly authority?: {
      submit(evidence: PlayerLandfallEvidence): Promise<unknown>;
      counts(): Promise<{ canonicalProgressionEvents: number }>;
    },
  ) {
    deviceLabScenarioSchema.parse(scenario);
    const world = this.definition.worldspaces.find((item) => item.kind === scenario.worldspace)!;
    this.definition.worldspaces = [world];
    this.definition.waypoints = this.definition.waypoints.filter((item) => item.worldspaceId === world.id);
    this.definition.routes = this.definition.routes.filter((item) => item.worldspaceId === world.id);
    this.definition.maps = this.definition.maps.filter((item) => item.worldspaceId === world.id);
    this.definition.transitions = [];
    if (world.kind === "PHYSICAL") {
      world.observationPolicy.allowedSources.push("NATIVE_LOCATION");
      this.definition.waypoints.forEach((waypoint) => waypoint.evidenceProfile.acceptedSources.push("NATIVE_LOCATION"));
    } else this.definition.waypoints[0].visibility.hiddenUntilRevealed = false;
    this.scope = { ...this.scope, worldspaceId: world.id, waypointId: this.definition.waypoints[0].id };
    for (const provider of this.health.catalog()) {
      this.health.configure(provider.id, { enabled: true, credentialAvailable: false });
      this.health.record(provider.id, "READY", this.now);
    }
    this.initializeRuntime();
  }
  fixtureHash() {
    return createHash("sha256").update(JSON.stringify(this.definition)).digest("hex");
  }
  async run(): Promise<{
    steps: DeviceLabStepResult[];
    cleanup: { result: "PASS" | "FAIL"; ownedResources: string[]; remainingResources: string[] };
    canonicalProgressionEvents: number | null;
  }> {
    const steps: DeviceLabStepResult[] = [];
    try {
      for (const [index, step] of this.scenario.timeline.entries()) {
        this.now = epoch + step.atMs;
        try {
          const supported = await this.action(step.action);
          steps.push({
            index,
            action: step.action.type,
            state: supported ? "PASS" : "UNSUPPORTED",
            ...(!supported ? { reason: "ADAPTER_NOT_IMPLEMENTED" } : {}),
          });
        } catch (error) {
          const safeReason =
            error instanceof Error && /^[A-Z0-9_:.-]{1,128}$/.test(error.message)
              ? error.message
              : "SCENARIO_ASSERTION_FAILED";
          steps.push({ index, action: step.action.type, state: "FAIL", reason: safeReason });
        }
      }
    } finally {
      await this.native?.stop();
      await this.background.clear();
      this.sensors.reset();
      this.nearby.BLE.reset();
      this.nearby.UWB.reset();
      this.tokenReplay.clear();
      if (this.packageFixture) await (await this.packageFixture).repository.revoke();
      await this.queued;
      this.deliveryRecords.clear();
    }
    return {
      steps,
      canonicalProgressionEvents: this.canonicalCount,
      cleanup: {
        result: this.nativeStopped && this.journal === null ? "PASS" : "FAIL",
        ownedResources: ["logical-native-listener", "synthetic-background-storage"],
        remainingResources: this.nativeStopped && this.journal === null ? [] : ["synthetic-provider-state"],
      },
    };
  }
  private initializeRuntime() {
    const registry = new LandfallProviderRegistry();
    for (const [id, source] of [
      ["browser-geolocation", "BROWSER_GEOLOCATION"],
      ["ios-core-location", "NATIVE_LOCATION"],
      ["android-location", "NATIVE_LOCATION"],
    ] as const)
      registry.register({ id, source, state: "AVAILABLE", worldspaceKinds: ["PHYSICAL"] });
    registry.register({
      id: "manual-virtual",
      source: "PLAYER_CONFIRMATION",
      state: "AVAILABLE",
      worldspaceKinds: ["VIRTUAL"],
    });
    this.runtime = new LandfallRuntime(this.definition, fixtureIdentity, registry);
    this.runtime.setActiveWaypoint(this.scope.waypointId);
    this.runtime.setPermission("GRANTED");
    this.runtime.resume();
    this.sensors = new NativeLandfallSensorFusion(
      { ...fixtureIdentity, worldspaceId: this.scope.worldspaceId },
      this.scenario.worldspace === "PHYSICAL",
    );
    const driver: NativeLocationDriver = {
      platform: "ANDROID",
      permission: async () => this.permission,
      start: async () => {
        this.nativeStopped = false;
      },
      stop: async () => {
        this.nativeStopped = true;
      },
      subscribe: (listener) => {
        this.nativeListener = listener;
        return () => {
          this.nativeListener = () => undefined;
        };
      },
    };
    if (this.scenario.worldspace === "PHYSICAL")
      this.native = new NativeLocationProvider(driver, this.definition.worldspaces[0], () => this.now);
  }
  private async action(action: DeviceLabAction): Promise<boolean> {
    if (action.type === "LOCATION") {
      const id = `${this.scenario.id}-${this.scenario.seed}-${action.duplicate ? this.sequence : ++this.sequence}`;
      if (this.lifecycle !== "FOREGROUND") {
        this.outcome = { confidence: "UNAVAILABLE", rejection: "PAUSED", sync: null, retryable: true };
        return true;
      }
      if (action.coordinate.type === "WGS84" && action.provider !== "BROWSER") {
        if (!this.native) return false;
        await this.native.start(
          fixtureIdentity,
          { userAction: true, intervalMs: 1000, precise: true },
          (observation) => {
            this.outcome = this.runtime.ingest(observation, this.now);
            if (!this.outcome.rejection) this.samples = [...this.samples, observation].slice(-20);
            this.requestIfQualified(observation.id);
          },
          () => undefined,
        );
        this.nativeListener({
          type: "fix",
          fix: {
            id,
            timestamp: this.now - action.ageMs,
            latitude: action.coordinate.latitude,
            longitude: action.coordinate.longitude,
            accuracyMeters: action.accuracy,
          },
        });
      } else {
        const physical = this.scenario.worldspace === "PHYSICAL";
        const observation: LandfallObservation = {
          schemaVersion: 1,
          id,
          ...fixtureIdentity,
          worldspaceId: this.scope.worldspaceId,
          providerId: physical ? "browser-geolocation" : "manual-virtual",
          source: physical ? "BROWSER_GEOLOCATION" : "PLAYER_CONFIRMATION",
          kind: physical ? "PHYSICAL_POSITION" : "VIRTUAL_POSITION",
          coordinate: action.coordinate,
          observedAt: new Date(this.now - action.ageMs).toISOString(),
          ...(physical ? { accuracyMeters: action.accuracy } : { uncertaintyUnits: action.accuracy, confidence: 0.9 }),
        } as LandfallObservation;
        this.outcome = this.runtime.ingest(observation, this.now);
        if (!this.outcome.rejection) this.samples = [...this.samples, observation].slice(-20);
        this.requestIfQualified(id);
      }
      return true;
    }
    if (action.type === "LIFECYCLE") {
      await this.queued;
      await this.native?.stop();
      if (action.state === "RELAUNCH") {
        this.lifecycle = "FOREGROUND";
        this.initializeRuntime();
      } else {
        this.lifecycle = action.state;
        if (action.state === "FOREGROUND") this.runtime.resume();
        else this.runtime.pause();
      }
      return true;
    }
    if (action.type === "RECONCILE") {
      await this.queued;
      // New repository models process restart; ciphertext survives, ephemeral runtime does not.
      const repository = new LandfallOfflineRepository(this.deliveryStorage, () => this.now);
      let submissions = 0;
      const reconciler = new LandfallOutboxReconciler(
        {
          pending: () => repository.pending(this.deliveryBinding),
          clearEvidence: () => repository.clearEvidence(this.deliveryBinding),
          revoke: () => repository.clear(),
        },
        {
          authorize: async () =>
            action.outcome === "REVOKED"
              ? { state: "REVOKED" }
              : action.outcome === "UNAVAILABLE"
                ? { state: "UNAVAILABLE" }
                : {
                    state: "AUTHORIZED",
                    ...fixtureIdentity,
                    currentSequence: action.outcome === "CONFLICT" ? 1 : 0,
                    replayOnly: false,
                  },
          submit: async (evidence) => {
            submissions++;
            if (this.scenario.canonicalAuthority === "ONE_VOYAGE") {
              if (!this.authority) throw new Error("LANDFALL_LAB_AUTHORITY_NOT_CONFIGURED");
              // Logical fixtures have synthetic timestamps. Replay their relative age
              // against the real writer clock; this remains provider simulation evidence.
              const observations = evidence.observations ?? [];
              const offset = Date.now() - Date.parse(observations.at(-1)?.observedAt ?? "") - 1000;
              const replay = {
                ...evidence,
                observations: observations.map((sample) => ({
                  ...sample,
                  observedAt: new Date(Date.parse(sample.observedAt) + offset).toISOString(),
                })),
              };
              await this.authority.submit(replay);
              this.canonicalCount = (await this.authority.counts()).canonicalProgressionEvents;
            }
            return action.outcome === "DUPLICATE" ? "DUPLICATE" : "ACCEPTED";
          },
        },
      );
      const [first, second] = await Promise.all([reconciler.reconcile(), reconciler.reconcile()]);
      const expected = {
        ACCEPT: "ACCEPTED",
        DUPLICATE: "DUPLICATE",
        CONFLICT: "CONFLICT",
        REVOKED: "REVOKED",
        UNAVAILABLE: "RETRY",
      }[action.outcome];
      if (
        first !== expected ||
        second !== expected ||
        submissions !== (["ACCEPT", "DUPLICATE"].includes(action.outcome) ? 1 : 0)
      )
        throw new Error("ASSERT_FAILED:RECONCILIATION");
      if (Boolean(await repository.pending(this.deliveryBinding)) !== (action.outcome === "UNAVAILABLE"))
        throw new Error("ASSERT_FAILED:OUTBOX_RETENTION");
      this.reconciliationState = first;
      return true;
    }
    if (action.type === "PERMISSION") {
      if (action.permission === "BACKGROUND_LOCATION") this.backgroundPermission = action.state;
      else if (action.permission === "FOREGROUND_LOCATION") {
        this.permission = action.state;
        this.runtime.setPermission(["GRANTED", "APPROXIMATE"].includes(action.state) ? "GRANTED" : "DENIED");
        this.nativeListener({ type: "permission", state: action.state });
      } else return false;
      return true;
    }
    if (action.type === "NETWORK") {
      this.connectivity = action.state;
      this.runtime.setOffline(action.state === "ONLINE" ? "ONLINE" : "OFFLINE_READY");
      return true;
    }
    if (action.type === "POWER") {
      this.lowPower = action.saver || action.batteryPercent <= 15 || action.doze;
      this.thermal = action.thermal;
      return true;
    }
    if (action.type === "PROVIDER") {
      this.health.record(`synthetic-${action.family.toLowerCase().replaceAll("_", "-")}`, action.health, this.now);
      return true;
    }
    if (action.type === "GEOFENCE") {
      const hint = {
        version: 1,
        id: `${this.scenario.id}-hint-${action.duplicate ? this.sequence : ++this.sequence}`,
        scope: this.scope,
        event: action.event,
        observedAt: this.now - action.ageMs,
        receivedAt: this.now,
      };
      this.backgroundResult = (
        await this.background.ingest(hint, this.scope, {
          physical: this.scenario.worldspace === "PHYSICAL",
          backgroundConsent: true,
          permissionGranted: this.backgroundPermission === "GRANTED",
        })
      ).result;
      return true;
    }
    if (action.type === "NOTIFICATION") {
      const current = {
        signedIn: true,
        membershipActive: action.operation !== "REVOKE_SESSION",
        sessionId: this.scope.sessionId,
        publishedVersionId: this.scope.publishedVersionId,
        status: action.operation === "COMPLETE_SESSION" ? ("COMPLETED" as const) : ("ACTIVE" as const),
      };
      const notification = {
        version: 1,
        id: "lab-notification",
        returnHandle: "synthetic-return-handle-".repeat(3),
        issuedAt: epoch,
        expiresAt: action.operation === "EXPIRE" ? this.now : epoch + 86400000,
      };
      this.notificationState = (
        await resolveLandfallNotificationReturn(notification, async () => current, this.now)
      ).state;
      return true;
    }
    if (action.type === "SENSOR") {
      if (action.kind === "MISSING") {
        this.sensors.reset();
        this.sensorState = "UNAVAILABLE";
        return true;
      }
      const kind =
        action.kind === "BAROMETER"
          ? "PRESSURE"
          : action.kind === "STATIONARY"
            ? "MOTION"
            : action.kind === "CONFLICT"
              ? "HEADING"
              : action.kind;
      const frame = {
        id: `${this.scenario.id}-sensor-${++this.sequence}`,
        observedAt: this.now,
        kind,
        values: action.values.length ? action.values : [0],
        accuracy: action.kind === "HEADING" ? (action.values[1] ?? 90) : 1,
      };
      let result = this.sensors.ingest(frame, this.now, this.lifecycle === "FOREGROUND");
      if (action.kind === "CONFLICT")
        result = this.sensors.ingest(
          { ...frame, id: `${frame.id}-conflict`, observedAt: this.now + 300, values: [180] },
          this.now + 300,
          true,
        );
      this.sensorState = result.state;
      if (result.evidence) this.runtime.ingestContext(result.evidence, this.now);
      if (action.kind === "CONFLICT" && result.state !== "CONFLICT") throw new Error("ASSERT_FAILED:SENSOR_CONFLICT");
      return true;
    }
    if (action.type === "NEARBY") {
      const lost = ["DISCONNECT", "PEER_LOST", "DISABLED"].includes(action.state);
      const signal =
        action.family === "BLE"
          ? {
              family: "BLE",
              id: `lab-ble-${++this.sequence}`,
              peerId: "lab-peer",
              observedAt: this.now,
              rssi: action.state === "WEAK" ? -85 : -50,
              authenticated: true,
            }
          : {
              family: "UWB",
              id: `lab-uwb-${++this.sequence}`,
              peerId: "lab-peer",
              observedAt: this.now,
              distanceMeters: action.state === "RETREAT" ? 20 : (action.distance ?? 2),
              uncertaintyMeters: action.uncertainty || 1,
              authenticated: true,
            };
      const projection = this.nearby[action.family].ingest(
        signal,
        {
          physical: this.scenario.worldspace === "PHYSICAL",
          supported: action.state !== "UNSUPPORTED",
          permission: true,
          enabled: !lost,
        },
        this.now,
      );
      this.nearbyState = projection.state;
      if (projection.canComplete !== false) throw new Error("ASSERT_FAILED:NEARBY_AUTHORITY");
      return true;
    }
    if (action.type === "TOKEN") {
      const seed = createHash("sha256").update(`SYNTHETIC-LANDFALL-LAB-ONLY:${this.scenario.seed}`).digest();
      const key = createPrivateKey({
        key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
        format: "der",
        type: "pkcs8",
      });
      const publicKey = await crypto.subtle.importKey(
        "jwk",
        createPublicKey(key).export({ format: "jwk" }) as JsonWebKey,
        "Ed25519",
        false,
        ["verify"],
      );
      const claim: LandfallInteractionClaim = {
        version: 1,
        id: "lab-token",
        keyId: "synthetic-lab-key",
        medium: action.medium,
        scope: { ...this.scope },
        taleId: "fixture-tale",
        issuedAt: this.now - 10000,
        expiresAt: this.now + 10000,
      };
      if (action.fixture === "WRONG_CHRONICLE") claim.taleId = "wrong-tale";
      if (action.fixture === "WRONG_VERSION") claim.scope.publishedVersionId = "wrong-edition";
      if (action.fixture === "EXPIRED") claim.expiresAt = this.now - 1;
      if (action.fixture === "REPLAY") claim.scope.expectedSequence++;
      const encoded = landfallInteractionPayload(claim);
      let token = `${encoded}.${sign(null, Buffer.from(encoded), key).toString("base64url")}`;
      if (action.fixture === "TAMPERED")
        token = `${landfallInteractionPayload({ ...claim, id: "tampered-token" })}.${token.split(".")[1]}`;
      if (action.fixture === "UNSIGNED") token = encoded;
      if (["MALFORMED", "UNRELATED"].includes(action.fixture)) token = "javascript:untrusted-scan";
      try {
        const verified = await verifyLandfallInteractionToken(token, {
          scope: this.scope,
          taleId: "fixture-tale",
          medium: action.medium,
          now: this.now,
          keys: new Map([["synthetic-lab-key", publicKey]]),
        });
        this.tokenState = this.tokenReplay.accept(verified, this.now);
        if (action.fixture === "DUPLICATE") this.tokenState = this.tokenReplay.accept(verified, this.now);
        if (!["VALID", "DUPLICATE"].includes(action.fixture)) throw new Error("ASSERT_FAILED:TOKEN_REJECT");
      } catch (error) {
        if (["VALID", "DUPLICATE"].includes(action.fixture)) throw error;
        if (!(error instanceof Error) || !error.message.startsWith("LANDFALL_TOKEN_")) throw error;
        this.tokenState = "REJECTED";
      }
      return true;
    }
    if (action.type === "PACKAGE") {
      const { repository, binding, envelope, resources } = await this.package();
      if (action.operation === "DELETE") {
        await repository.remove(envelope.manifest.id, binding);
        this.packageState = (await repository.status(envelope.manifest.id, binding)).state;
        return true;
      }
      if (action.operation === "STORAGE_LOW") this.packageCapacity = 1;
      const installed = await repository.install(envelope, binding, async (resource) => {
        if (action.operation === "INTERRUPT" && resource.id === "lab-package-resource-1")
          throw new Error("SYNTHETIC_NETWORK_LOST");
        const bytes = resources[Number(resource.id.at(-1))];
        return action.operation === "CORRUPT" ? new Uint8Array(bytes.length).fill(0) : bytes;
      });
      this.packageState = installed;
      if (action.operation === "STALE")
        this.packageState = (
          await repository.status(envelope.manifest.id, binding, envelope.manifest.revealedSequence + 1)
        ).state;
      if (action.operation === "EXPIRE") {
        this.now = envelope.manifest.expiresAt + 1;
        this.packageState = (await repository.status(envelope.manifest.id, binding)).state;
      }
      const expected = {
        DOWNLOAD: "READY",
        INTERRUPT: "PARTIAL",
        CORRUPT: "CORRUPT",
        STORAGE_LOW: "FAILED",
        STALE: "STALE",
        EXPIRE: "EXPIRED",
      }[action.operation];
      if (this.packageState !== expected) throw new Error("ASSERT_FAILED:PACKAGE_STATE");
      return true;
    }
    if (action.type === "ASSERT") {
      const observed: Record<string, unknown> = {
        confidence: this.outcome.confidence,
        rejection: this.outcome.rejection ?? null,
        completionRequests: this.requests.size,
        serverConfirmed: (this.canonicalCount ?? 0) > 0,
        backgroundResult: this.backgroundResult,
        notificationState: this.notificationState,
        canonicalProgressionEvents: this.canonicalCount,
        sensorState: this.sensorState,
        nearbyState: this.nearbyState,
        tokenState: this.tokenState,
        packageState: this.packageState,
        reconciliationState: this.reconciliationState,
        powerProfile: landfallPowerPolicy({
          lifecycle: this.lifecycle,
          connectivity: this.connectivity,
          foregroundConsent: true,
          backgroundConsent: true,
          foregroundPermission: this.permission,
          backgroundPermission: this.backgroundPermission,
          lowPower: this.lowPower,
          thermalPressure: this.thermal,
          precisionRequested: true,
        }).profile,
        providerState: this.health
          .snapshot()
          .find((status) => status.id === `synthetic-${this.scenario.providers[0].toLowerCase().replaceAll("_", "-")}`)
          ?.health,
      };
      if (!(action.field in observed)) return false;
      if (observed[action.field] !== action.value) throw new Error(`ASSERT_FAILED:${action.field.toUpperCase()}`);
      return true;
    }
    return false;
  }
  private requestIfQualified(id: string) {
    if (this.outcome.confidence !== "CONFIRMED" || this.outcome.rejection) return;
    try {
      const request = this.runtime.completionRequest(id, 0, `${this.scenario.id}-request`, this.now);
      if (this.connectivity !== "ONLINE" && this.requests.size === 0) {
        const evidence = {
          schemaVersion: 1 as const,
          ...fixtureIdentity,
          worldspaceId: request.worldspaceId,
          waypointId: request.waypointId,
          evidenceId: request.evidenceId,
          expectedSequence: 0,
          idempotencyKey: request.idempotencyKey,
          method: "FOREGROUND_LOCATION" as const,
          observations: structuredClone(this.samples),
        };
        this.queued = new LandfallOfflineRepository(this.deliveryStorage, () => this.now).enqueue(
          this.deliveryBinding,
          evidence,
        );
      }
      this.requests.add(
        `${this.scope.sessionId}:${this.scope.publishedVersionId}:${this.scope.waypointId}:${this.scope.expectedSequence}`,
      );
    } catch {
      /* An expired or incomplete local qualification cannot become a completion request. */
    }
  }
  private package() {
    return (this.packageFixture ??= (async () => {
      const seed = createHash("sha256").update(`SYNTHETIC-PACKAGE-LAB-ONLY:${this.scenario.seed}`).digest();
      const signing = createPrivateKey({
        key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
        format: "der",
        type: "pkcs8",
      });
      const verification = await crypto.subtle.importKey(
        "jwk",
        createPublicKey(signing).export({ format: "jwk" }) as JsonWebKey,
        "Ed25519",
        false,
        ["verify"],
      );
      const encryptionKey = await crypto.subtle.importKey("raw", seed, "AES-GCM", false, ["encrypt", "decrypt"]);
      const binding: OfflinePackageBinding = {
        scope: {
          playerProfileId: this.scope.playerProfileId,
          sessionId: this.scope.sessionId,
          taleId: "fixture-tale",
          publishedVersionId: this.scope.publishedVersionId,
          worldspaceId: this.scope.worldspaceId,
        },
        encryptionKey,
        leaseExpiresAt: this.now + 86400000,
      };
      const bootstrap = projectPlayerLandfallBootstrap(
        { ...fixtureIdentity, taleId: "fixture-tale", currentSequence: 0, definition: this.definition },
        { chapterId: null, blockId: null, releasedAssets: [] },
      );
      const resources = [
        new TextEncoder().encode(JSON.stringify(bootstrap)),
        new TextEncoder().encode(JSON.stringify(bootstrap.runtimeDefinition.routes)),
      ];
      const manifest = {
        version: 1 as const,
        id: "lab-package",
        keyId: "synthetic-lab-package-key",
        scope: binding.scope,
        worldspaceKind: this.scenario.worldspace,
        revealedSequence: 0,
        issuedAt: this.now,
        expiresAt: this.now + 3600000,
        resources: resources.map((bytes, index) => ({
          id: `lab-package-resource-${index}`,
          kind: index === 0 ? ("CHART" as const) : ("ROUTE" as const),
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          mime: "application/json" as const,
          attribution: "Synthetic authored data",
          license: "Synthetic fixture",
          offlineRights: "ALLOWED" as const,
        })),
        totalBytes: resources.reduce((total, bytes) => total + bytes.length, 0),
      };
      const envelope = {
        manifest,
        signature: sign(null, Buffer.from(offlineManifestPayload(manifest)), signing).toString("base64url"),
      };
      const storage: LandfallPackageStorage = {
        get: async (key) => this.packageRecords.get(key) ?? null,
        put: async (record) => {
          this.packageRecords.set(record.key, record);
        },
        remove: async (key) => {
          this.packageRecords.delete(key);
        },
        records: async () => [...this.packageRecords.values()],
        capacityBytes: async () => this.packageCapacity,
      };
      const repository = new LandfallOfflinePackageRepository(
        storage,
        new Map([[manifest.keyId, verification]]),
        () => this.now,
      );
      return { repository, binding, envelope, resources };
    })());
  }
}
