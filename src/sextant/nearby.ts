import { z } from "zod";
import type { PermissionPurpose } from "./permissions";

const id = z.string().regex(/^[a-zA-Z0-9-]{8,100}$/);
const finite = z.number().finite();
export const securePeerSchema = z.strictObject({
  version: z.literal(1),
  peerSessionId: id,
  owner: z.enum(["CROSSDECK", "LANDFALL", "PARALLAX", "APPROVED_ACCESSORY"]),
  consumerId: z.string().trim().min(1).max(100),
  surfaceId: z.string().trim().min(1).max(100),
  purpose: z.string().trim().min(1).max(500),
  nonce: id,
  expiresAt: finite.nonnegative(),
  outOfBand: z.enum(["AUTHENTICATED_BLE", "AUTHENTICATED_NETWORK", "AUTHENTICATED_NFC"]),
  securityMode: z.enum(["APPLICATION_AUTHENTICATED", "PLATFORM_SECURE_RANGING"]),
});
export type SecurePeer = z.infer<typeof securePeerSchema>;
export const rangingObservationSchema = z.strictObject({
  peerSessionId: id,
  sequence: z.number().int().nonnegative(),
  generation: z.number().int().positive(),
  timestampMonotonic: finite.nonnegative(),
  distanceMeters: finite.nonnegative().max(1000),
  uncertaintyMeters: finite.nonnegative().max(1000),
  direction: z
    .strictObject({ x: finite.min(-1).max(1), y: finite.min(-1).max(1), z: finite.min(-1).max(1) })
    .refine((v) => Math.abs(Math.hypot(v.x, v.y, v.z) - 1) < 0.00001)
    .optional(),
  technologyClass: z.enum(["UWB", "QUALIFIED_ACCESSORY"]),
  referenceFrame: z.literal("LOCAL_ARBITRARY"),
  lifecycle: z.literal("FOREGROUND_ONLY"),
  securityMode: securePeerSchema.shape.securityMode,
});
const requestSchema = z.strictObject({
  consumerId: z.string().trim().min(1).max(100),
  surfaceId: z.string().trim().min(1).max(100),
  purpose: z.string().trim().min(1).max(500),
  consent: z.literal(true),
  userInitiated: z.literal(true),
  retry: z.boolean().optional(),
  expiresAt: finite.nonnegative(),
});
type Session = {
  token: string;
  generation: number;
  consumerId: string;
  surfaceId: string;
  purpose: string;
  expiry: number;
  operations: number;
  cleanup: Set<() => void>;
  timer: ReturnType<typeof setTimeout>;
};
/** Foreground-only ephemeral sessions, bounded concurrency and acquisition. No hardware IDs/inventory in projections. */
export class NearbySessions {
  private sessions = new Map<string, Session>();
  private generation = 0;
  private foreground = true;
  private disposed = false;
  private lastRequest = -Infinity;
  private cleanupFailures = 0;
  private nonces = new Map<string, number>();
  constructor(readonly now: () => number = () => performance.now()) {}
  begin(input: PermissionPurpose & { expiresAt: number }) {
    const r = requestSchema.parse(input),
      now = this.now();
    if (
      !this.foreground ||
      this.disposed ||
      r.expiresAt <= now ||
      r.expiresAt - now > 60000 ||
      this.sessions.size >= 2 ||
      now - this.lastRequest < 1000
    )
      throw new Error("SEXTANT_NEARBY_UNAVAILABLE");
    this.lastRequest = now;
    const token = crypto.randomUUID();
    const s: Session = {
      token,
      generation: ++this.generation,
      consumerId: r.consumerId,
      surfaceId: r.surfaceId,
      purpose: r.purpose,
      expiry: r.expiresAt,
      operations: 0,
      cleanup: new Set(),
      timer: setTimeout(() => this.end(token), r.expiresAt - now),
    };
    this.sessions.set(token, s);
    return { token, generation: s.generation, release: () => this.end(token) };
  }
  active(token: string) {
    const s = this.sessions.get(token);
    return Boolean(s && this.foreground && !this.disposed && this.now() < s.expiry);
  }
  bindPeer(token: string, generation: number, peer: SecurePeer) {
    const s = this.sessions.get(token);
    for (const [nonce, expiry] of this.nonces) if (expiry <= this.now()) this.nonces.delete(nonce);
    if (
      !s ||
      !this.active(token) ||
      generation !== s.generation ||
      peer.consumerId !== s.consumerId ||
      peer.surfaceId !== s.surfaceId ||
      peer.purpose !== s.purpose ||
      peer.expiresAt > s.expiry ||
      this.nonces.has(peer.nonce) ||
      this.nonces.size >= 128
    )
      throw new Error("SEXTANT_PEER_BINDING_INVALID");
    this.nonces.set(peer.nonce, peer.expiresAt);
  }
  own(token: string, cleanup: () => void) {
    const s = this.sessions.get(token);
    if (!s || !this.active(token)) {
      cleanup();
      throw new Error("SEXTANT_NEARBY_EXPIRED");
    }
    s.cleanup.add(cleanup);
  }
  async acquire<T>(token: string, operation: () => Promise<T>, cleanup: (value: T) => void): Promise<T> {
    if (!this.active(token)) throw new Error("SEXTANT_NEARBY_EXPIRED");
    const s = this.sessions.get(token)!;
    if (++s.operations > 64) {
      this.end(token);
      throw new Error("SEXTANT_NEARBY_OPERATION_LIMIT");
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Invoke before awaiting: Web Bluetooth/NFC require transient user activation.
      const pending = operation().then((value) => {
        if (!this.active(token)) {
          cleanup(value);
          throw new Error("SEXTANT_NEARBY_EXPIRED");
        }
        this.own(token, () => cleanup(value));
        return value;
      });
      return await Promise.race([
        pending,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            this.end(token);
            reject(new Error("SEXTANT_NEARBY_TIMEOUT"));
          }, 10000);
        }),
      ]);
    } catch {
      this.end(token);
      throw new Error("SEXTANT_NEARBY_OPERATION_FAILED");
    } finally {
      clearTimeout(timer);
    }
  }
  end(token: string) {
    const s = this.sessions.get(token);
    if (!s) return;
    this.sessions.delete(token);
    clearTimeout(s.timer);
    for (const c of s.cleanup) {
      try {
        c();
      } catch {
        this.cleanupFailures++;
      }
    }
    s.cleanup.clear();
  }
  cancelConsumer(id: string) {
    for (const s of [...this.sessions.values()]) if (s.consumerId === id) this.end(s.token);
  }
  setForeground(value: boolean) {
    this.foreground = value;
    if (!value) for (const token of [...this.sessions.keys()]) this.end(token);
  }
  dispose() {
    this.disposed = true;
    this.setForeground(false);
  }
  diagnostics() {
    return {
      activeSessions: this.sessions.size,
      foreground: this.foreground,
      disposed: this.disposed,
      cleanupFailures: this.cleanupFailures,
    };
  }
}
/** The owner authenticates who/why. Sextant binds freshness/replay, without treating a client assertion as identity proof. */
export class SecureRangingSession {
  private lastSequence = -1;
  private lastTimestamp = -Infinity;
  private failed = false;
  readonly peer: SecurePeer;
  private readonly serialized: string;
  constructor(
    peer: unknown,
    private readonly sessions: NearbySessions,
    private readonly lease: { token: string; generation: number },
    private readonly authenticatedOwner: (peer: Readonly<SecurePeer>) => boolean,
  ) {
    this.peer = Object.freeze(securePeerSchema.parse(peer));
    this.serialized = JSON.stringify(this.peer);
    if (
      this.peer.expiresAt <= sessions.now() ||
      this.peer.expiresAt - sessions.now() > 60000 ||
      !authenticatedOwner(this.peer)
    )
      throw new Error("SEXTANT_PEER_UNAUTHENTICATED");
    sessions.bindPeer(lease.token, lease.generation, this.peer);
  }
  accept(input: unknown) {
    if (
      this.failed ||
      !this.sessions.active(this.lease.token) ||
      this.sessions.now() >= this.peer.expiresAt ||
      !this.authenticatedOwner(this.peer) ||
      JSON.stringify(this.peer) !== this.serialized
    )
      throw new Error("SEXTANT_RANGING_SESSION_FAILED");
    const parsed = rangingObservationSchema.safeParse(input);
    if (!parsed.success) {
      this.dropout();
      throw new Error("SEXTANT_RANGING_VALUE_INVALID");
    }
    const o = parsed.data,
      age = this.sessions.now() - o.timestampMonotonic;
    if (
      o.peerSessionId !== this.peer.peerSessionId ||
      o.generation !== this.lease.generation ||
      o.securityMode !== this.peer.securityMode ||
      o.sequence <= this.lastSequence ||
      o.timestampMonotonic <= this.lastTimestamp ||
      age < 0 ||
      age > 1000 ||
      (this.lastTimestamp !== -Infinity && o.timestampMonotonic - this.lastTimestamp > 1500)
    ) {
      this.dropout();
      throw new Error("SEXTANT_RANGING_REPLAY_OR_DROPOUT");
    }
    this.lastSequence = o.sequence;
    this.lastTimestamp = o.timestampMonotonic;
    return { ...o, presenceProof: false as const, globalPosition: false as const };
  }
  dropout() {
    this.failed = true;
    this.sessions.end(this.lease.token);
  }
}
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const blePolicySchema = z.strictObject({
  services: z.array(uuid).min(1).max(8),
  applicationSecurity: z.enum(["PUBLIC_DATA_ONLY", "APPLICATION_AUTHENTICATED"]),
  fallback: z.string().trim().min(1).max(500),
});
export type GattCharacteristic = { readValue(): Promise<DataView>; writeValue?(value: Uint8Array): Promise<void> };
export type BleDevice = {
  gatt?: {
    connected: boolean;
    connect(): Promise<{
      getPrimaryService(id: string): Promise<{ getCharacteristic(id: string): Promise<GattCharacteristic> }>;
    }>;
    disconnect(): void;
  };
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};
export type WebBluetooth = { requestDevice(options: { filters: { services: string[] }[] }): Promise<BleDevice> };
export class WebBleCapability {
  constructor(
    private readonly api: WebBluetooth | null,
    private readonly secureContext: boolean,
    private readonly sessions: NearbySessions,
  ) {}
  discover() {
    return {
      support: this.secureContext && Boolean(this.api) ? ("SUPPORTED" as const) : ("UNSUPPORTED" as const),
      scan: "USER_CHOOSER_ONLY" as const,
      advertising: "UNSUPPORTED" as const,
      rssiDistance: "UNQUALIFIED" as const,
    };
  }
  async connect(
    input: PermissionPurpose & { expiresAt: number },
    policyInput: unknown,
    authenticatedOwner?: () => boolean,
  ) {
    const policy = blePolicySchema.parse(policyInput);
    if (!this.api || !this.secureContext)
      return { state: "FALLBACK" as const, reason: "CAPABILITY_UNSUPPORTED", fallback: policy.fallback };
    const lease = this.sessions.begin(input);
    try {
      const device = await this.sessions.acquire(
        lease.token,
        () => this.api!.requestDevice({ filters: [{ services: policy.services }] }),
        (d) => d.gatt?.disconnect(),
      );
      if (!device.gatt) throw new Error("GATT_UNAVAILABLE");
      const disconnected: EventListener = () => lease.release();
      device.addEventListener("gattserverdisconnected", disconnected);
      this.sessions.own(lease.token, () => device.removeEventListener("gattserverdisconnected", disconnected));
      const server = await this.sessions.acquire(
        lease.token,
        () => device.gatt!.connect(),
        () => device.gatt!.disconnect(),
      );
      return {
        state: "CONNECTED" as const,
        sessionId: lease.token,
        release: lease.release,
        characteristic: async (serviceId: string, characteristicId: string) => {
          if (!this.sessions.active(lease.token) || !policy.services.includes(uuid.parse(serviceId)))
            throw new Error("SEXTANT_BLE_SERVICE_FORBIDDEN");
          const service = await this.sessions.acquire(
              lease.token,
              () => server.getPrimaryService(serviceId),
              () => {},
            ),
            c = await this.sessions.acquire(
              lease.token,
              () => service.getCharacteristic(uuid.parse(characteristicId)),
              () => {},
            );
          if (!this.sessions.active(lease.token)) throw new Error("SEXTANT_BLE_EXPIRED");
          return {
            read: async () => {
              if (!this.sessions.active(lease.token)) throw new Error("SEXTANT_BLE_EXPIRED");
              const v = await this.sessions.acquire(
                lease.token,
                () => c.readValue(),
                () => {},
              );
              if (!this.sessions.active(lease.token) || v.byteLength > 4096)
                throw new Error("SEXTANT_BLE_PAYLOAD_REJECTED");
              return new Uint8Array(v.buffer, v.byteOffset, v.byteLength).slice();
            },
            write: async (value: Uint8Array) => {
              if (
                !this.sessions.active(lease.token) ||
                value.length > 4096 ||
                policy.applicationSecurity !== "APPLICATION_AUTHENTICATED" ||
                !c.writeValue ||
                !authenticatedOwner?.()
              )
                throw new Error("SEXTANT_BLE_WRITE_FORBIDDEN");
              await this.sessions.acquire(
                lease.token,
                () => c.writeValue!(value.slice()),
                () => {},
              );
            },
          };
        },
      };
    } catch {
      lease.release();
      return {
        state: "FALLBACK" as const,
        reason: "PERMISSION_DENIED_OR_ACCESSORY_DISCONNECTED",
        fallback: policy.fallback,
      };
    }
  }
}
export const ndefEnvelopeSchema = z
  .strictObject({
    version: z.literal(1),
    records: z
      .array(
        z.strictObject({
          recordType: z.enum(["text", "mime"]),
          mediaType: z.string().max(100).optional(),
          language: z.string().max(20).optional(),
          data: z.instanceof(Uint8Array).refine((v) => v.byteLength <= 2048),
        }),
      )
      .min(1)
      .max(8),
  })
  .refine((v) => v.records.reduce((n, r) => n + r.data.byteLength, 0) <= 4096);
export type NfcReader = {
  scan(options: { signal: AbortSignal }): Promise<void>;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};
export class WebNfcCapability {
  constructor(
    private readonly makeReader: (() => NfcReader) | null,
    private readonly secureContext: boolean,
    private readonly sessions: NearbySessions,
    private readonly emulationIdentity?: string,
  ) {}
  discover() {
    return {
      support: this.secureContext && Boolean(this.makeReader) ? ("SUPPORTED" as const) : ("UNSUPPORTED" as const),
      write: "UNSUPPORTED" as const,
    };
  }
  async read(
    input: PermissionPurpose & { expiresAt: number },
    consumerSchema: z.ZodType,
    onPayload: (payload: unknown, provenance: { syntheticFlag: boolean; simulationIdentity?: string }) => void,
    onFallback: (reason: string) => void,
  ) {
    if (!this.makeReader || !this.secureContext) {
      onFallback("CAPABILITY_UNSUPPORTED");
      return { release: () => {} };
    }
    const lease = this.sessions.begin(input),
      controller = new AbortController();
    this.sessions.own(lease.token, () => controller.abort());
    try {
      const reader = this.makeReader();
      const reading: EventListener = (event) => {
        if (!this.sessions.active(lease.token) || (!event.isTrusted && !this.emulationIdentity)) return;
        try {
          // Discard serial number, IDs, URLs and raw tag inventory. Consumer parses strict bytes only.
          const message = (
            event as Event & {
              message: { records: { recordType: string; mediaType?: string; lang?: string; data: DataView }[] };
            }
          ).message;
          if (
            !Array.isArray(message.records) ||
            message.records.length > 8 ||
            message.records.some((r) => !r.data || r.data.byteLength > 2048)
          )
            throw new Error("NDEF_SIZE_REJECTED");
          const envelope = ndefEnvelopeSchema.parse({
            version: 1,
            records: message.records.map((r) => ({
              recordType: r.recordType,
              ...(r.mediaType ? { mediaType: r.mediaType } : {}),
              ...(r.lang ? { language: r.lang } : {}),
              data: new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength).slice(),
            })),
          });
          const payload = consumerSchema.parse(envelope);
          onPayload(payload, {
            syntheticFlag: Boolean(this.emulationIdentity),
            ...(this.emulationIdentity ? { simulationIdentity: this.emulationIdentity } : {}),
          });
          lease.release();
        } catch {
          onFallback("NFC_PAYLOAD_REJECTED");
          lease.release();
        }
      };
      const error: EventListener = () => {
        onFallback("NFC_READ_FAILED");
        lease.release();
      };
      reader.addEventListener("reading", reading);
      reader.addEventListener("readingerror", error);
      this.sessions.own(lease.token, () => {
        reader.removeEventListener("reading", reading);
        reader.removeEventListener("readingerror", error);
      });
      await this.sessions.acquire(
        lease.token,
        () => reader.scan({ signal: controller.signal }),
        () => controller.abort(),
      );
      return { release: lease.release };
    } catch {
      lease.release();
      onFallback("PERMISSION_DENIED_OR_NFC_READ_FAILED");
      return { release: lease.release };
    }
  }
}
