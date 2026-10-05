import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { nativeJourneyScopeSchema, type NativeJourneyScope } from "@/landfall/background-navigation";
import { nativeUwbConfigurationSchema } from "@/landfall/native-uwb";
import { nativeNearbyInteractionConfigurationSchema } from "@/landfall/native-nearby-interaction";

const shortAddress = z
  .string()
  .regex(/^[A-Za-z0-9+/]{3}=$/)
  .refine((value) => Buffer.from(value, "base64").toString("base64") === value);
const discoveryToken = z
  .string()
  .min(4)
  .max(5464)
  .regex(/^[A-Za-z0-9+/]+={0,2}$/)
  .refine((value) => {
    const bytes = Buffer.from(value, "base64");
    return bytes.length > 0 && bytes.length <= 4096 && bytes.toString("base64") === value;
  });
export const nearbyPairOfferSchema = z.discriminatedUnion("platform", [
  z.strictObject({
    platform: z.literal("ANDROID"),
    address: shortAddress,
    channel: z.union([z.literal(5), z.literal(9)]),
    preamble: z.number().int().min(9).max(12),
  }),
  z.strictObject({ platform: z.literal("IOS"), discoveryToken }),
]);
export type NearbyPairOffer = z.infer<typeof nearbyPairOfferSchema>;
export const nearbyPairJoinOfferSchema = z.discriminatedUnion("platform", [
  z.strictObject({ platform: z.literal("ANDROID"), address: shortAddress }),
  z.strictObject({ platform: z.literal("IOS"), discoveryToken }),
]);
export type NearbyPairJoinOffer = z.infer<typeof nearbyPairJoinOfferSchema>;
const secret = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const nearbyPairRequestSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("STATUS") }),
  z.strictObject({ operation: z.literal("CREATE"), offer: nearbyPairOfferSchema }),
  z.strictObject({ operation: z.literal("JOIN"), code: secret, offer: nearbyPairJoinOfferSchema }),
  z.strictObject({ operation: z.literal("READ"), handle: secret }),
  z.strictObject({ operation: z.literal("STOP"), handle: secret }),
]);
type Entry = {
  id: string;
  scope: NativeJourneyScope;
  expiresAt: number;
  owner: NearbyPairOffer;
  peer: NearbyPairJoinOffer | null;
  ownerHandle: string;
  peerHandle: string | null;
  key: Buffer | null;
  timer: ReturnType<typeof setTimeout> | null;
};
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const sameScope = (a: NativeJourneyScope, b: NativeJourneyScope) =>
  Object.entries(a).every(([key, value]) => b[key as keyof NativeJourneyScope] === value);

/** Authenticated same-Player companion exchange. No hardware identity or progression authority. */
export class LandfallNearbyPairBroker {
  private lastClock = -1;
  private readonly entries = new Map<string, Entry>();
  private readonly codes = new Map<string, string>();
  private readonly handles = new Map<string, { id: string; owner: boolean }>();
  constructor(private readonly now = Date.now) {}
  private sweep() {
    const now = this.now();
    if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - 45000)
      throw new Error("LANDFALL_PAIR_CLOCK_INVALID");
    if (now < this.lastClock) {
      for (const entry of this.entries.values()) this.remove(entry);
      throw new Error("LANDFALL_PAIR_CLOCK_INVALID");
    }
    this.lastClock = now;
    for (const entry of this.entries.values()) if (entry.expiresAt <= now) this.remove(entry);
  }
  private remove(entry: Entry) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    entry.key?.fill(0);
    entry.key = null;
    this.entries.delete(entry.id);
    this.handles.delete(entry.ownerHandle);
    if (entry.peerHandle) this.handles.delete(entry.peerHandle);
    for (const [code, id] of this.codes) if (id === entry.id) this.codes.delete(code);
  }
  create(inputScope: NativeJourneyScope, input: NearbyPairOffer) {
    this.sweep();
    const scope = nativeJourneyScopeSchema.parse(inputScope),
      offer = nearbyPairOfferSchema.parse(input);
    if (
      this.entries.size >= 128 ||
      [...this.entries.values()].filter((entry) => entry.scope.playerProfileId === scope.playerProfileId).length >= 4
    )
      throw new Error("LANDFALL_PAIR_CAPACITY");
    const code = token(),
      handle = token(),
      id = randomUUID();
    const entry: Entry = {
      id,
      scope,
      expiresAt: this.now() + 45000,
      owner: offer,
      peer: null,
      ownerHandle: hash(handle),
      peerHandle: null,
      key: null,
      timer: null,
    };
    entry.timer = setTimeout(() => this.remove(entry), 45000);
    entry.timer.unref();
    this.entries.set(id, entry);
    this.codes.set(hash(code), id);
    this.handles.set(entry.ownerHandle, { id, owner: true });
    return {
      state: "WAITING" as const,
      code,
      handle,
      expiresAt: entry.expiresAt,
      remainingMs: this.remaining(entry),
      peerVerified: false as const,
      canComplete: false as const,
    };
  }
  join(inputScope: NativeJourneyScope, rawCode: string, input: NearbyPairJoinOffer) {
    this.sweep();
    const scope = nativeJourneyScopeSchema.parse(inputScope),
      code = secret.parse(rawCode),
      offer = nearbyPairJoinOfferSchema.parse(input);
    const entry = this.entries.get(this.codes.get(hash(code)) ?? "");
    if (!entry || entry.peer || !sameScope(entry.scope, scope) || entry.owner.platform !== offer.platform)
      throw new Error("LANDFALL_PAIR_UNAVAILABLE");
    if (offer.platform === "ANDROID" && entry.owner.platform === "ANDROID" && offer.address === entry.owner.address)
      throw new Error("LANDFALL_PAIR_PARAMETERS_MISMATCH");
    if (
      offer.platform === "IOS" &&
      entry.owner.platform === "IOS" &&
      offer.discoveryToken === entry.owner.discoveryToken
    )
      throw new Error("LANDFALL_PAIR_PARAMETERS_MISMATCH");
    const handle = token();
    entry.peer = offer;
    entry.peerHandle = hash(handle);
    entry.key = offer.platform === "ANDROID" ? randomBytes(16) : null;
    this.codes.delete(hash(code));
    this.handles.set(entry.peerHandle, { id: entry.id, owner: false });
    return { ...this.project(entry, false), handle };
  }
  read(inputScope: NativeJourneyScope, rawHandle: string) {
    this.sweep();
    const scope = nativeJourneyScopeSchema.parse(inputScope),
      handle = secret.parse(rawHandle);
    const owner = this.handles.get(hash(handle)),
      entry = this.entries.get(owner?.id ?? "");
    if (!entry || !owner || !sameScope(entry.scope, scope)) throw new Error("LANDFALL_PAIR_UNAVAILABLE");
    return this.project(entry, owner.owner);
  }
  stop(inputScope: NativeJourneyScope, rawHandle: string) {
    this.sweep();
    const scope = nativeJourneyScopeSchema.parse(inputScope),
      handle = secret.parse(rawHandle);
    const owner = this.handles.get(hash(handle)),
      entry = this.entries.get(owner?.id ?? "");
    if (entry && sameScope(entry.scope, scope)) this.remove(entry);
    return { state: "STOPPED" as const, peerVerified: false as const, canComplete: false as const };
  }
  private project(entry: Entry, owner: boolean) {
    const base = {
      expiresAt: entry.expiresAt,
      remainingMs: this.remaining(entry),
      peerVerified: false as const,
      canComplete: false as const,
    };
    if (!entry.peer) return { ...base, state: "WAITING" as const };
    const peer = owner ? entry.peer : entry.owner;
    const peerId = `companion:${entry.id}:${owner ? "peer" : "owner"}`;
    if (peer.platform === "ANDROID") {
      if (!entry.key || entry.owner.platform !== "ANDROID") throw new Error("LANDFALL_PAIR_UNAVAILABLE");
      return {
        ...base,
        state: "READY" as const,
        platform: "ANDROID" as const,
        configuration: nativeUwbConfigurationSchema.parse({
          peerId,
          sessionId: (parseInt(createHash("sha256").update(entry.id).digest("hex").slice(0, 8), 16) % 2147483647) + 1,
          security: "PROVISIONED_STS",
          sessionKey: entry.key.toString("base64"),
          peerAddress: peer.address,
          channel: entry.owner.channel,
          preamble: entry.owner.preamble,
          expiresAt: entry.expiresAt,
        }),
      };
    }
    return {
      ...base,
      state: "READY" as const,
      platform: "IOS" as const,
      configuration: nativeNearbyInteractionConfigurationSchema.parse({
        peerId,
        discoveryToken: peer.discoveryToken,
        expiresAt: entry.expiresAt,
      }),
    };
  }
  private remaining(entry: Entry) {
    const remaining = entry.expiresAt - this.now();
    if (!Number.isSafeInteger(remaining) || remaining <= 0 || remaining > 45000)
      throw new Error("LANDFALL_PAIR_UNAVAILABLE");
    return remaining;
  }
}
