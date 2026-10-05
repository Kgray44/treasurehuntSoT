import { describe, expect, it, vi } from "vitest";
import {
  LandfallNearbyPairBroker,
  nearbyPairOfferSchema,
  nearbyPairRequestSchema,
} from "@/landfall/nearby-pairing-server";
import type { NativeJourneyScope } from "@/landfall/background-navigation";

const scope: NativeJourneyScope = {
  playerProfileId: "player-1",
  sessionId: "session-1",
  publishedVersionId: "version-1",
  worldspaceId: "town",
  waypointId: "arrival",
  expectedSequence: 4,
};
const owner = { platform: "ANDROID" as const, address: "AQI=", channel: 9 as const, preamble: 9 };
const peer = { platform: "ANDROID" as const, address: "AwQ=" };

describe("first-party companion pairing", () => {
  it("reports remaining server duration without renewing the absolute exchange expiry", () => {
    let now = 1000;
    const broker = new LandfallNearbyPairBroker(() => now),
      created = broker.create(scope, owner);
    expect(created.remainingMs).toBe(45000);
    now = 6000;
    expect(broker.read(scope, created.handle)).toMatchObject({ expiresAt: 46000, remainingMs: 40000 });
    now = 16000;
    expect(broker.join(scope, created.code, peer)).toMatchObject({ expiresAt: 46000, remainingMs: 30000 });
    expect(broker.read(scope, created.handle)).toMatchObject({ expiresAt: 46000, remainingMs: 30000 });
    now = 46000;
    expect(() => broker.read(scope, created.handle)).toThrow("UNAVAILABLE");
  });
  it("exchanges matching protected Android session parameters and remains incapable of completion", () => {
    const broker = new LandfallNearbyPairBroker(() => 1000);
    const created = broker.create(scope, owner);
    expect(broker.read(scope, created.handle)).toMatchObject({
      state: "WAITING",
      canComplete: false,
      peerVerified: false,
    });
    const joined = broker.join(scope, created.code, peer);
    const result = broker.read(scope, created.handle);
    expect(result.state).toBe("READY");
    expect(joined.state).toBe("READY");
    if (
      result.state !== "READY" ||
      result.platform !== "ANDROID" ||
      joined.state !== "READY" ||
      joined.platform !== "ANDROID"
    )
      throw new Error("expected Android session");
    expect(result.configuration).toMatchObject({
      peerAddress: peer.address,
      expiresAt: 46000,
      security: "PROVISIONED_STS",
    });
    expect(joined.configuration).toMatchObject({
      peerAddress: owner.address,
      expiresAt: 46000,
      security: "PROVISIONED_STS",
    });
    expect(result.configuration.sessionKey).toBe(joined.configuration.sessionKey);
    expect(Buffer.from(result.configuration.sessionKey, "base64")).toHaveLength(16);
    expect(result.configuration.sessionId).toBe(joined.configuration.sessionId);
    expect(result.configuration.peerId).not.toBe(joined.configuration.peerId);
    expect(result).toMatchObject({ canComplete: false, peerVerified: false });
    expect(() => broker.join(scope, created.code, peer)).toThrow("UNAVAILABLE");
  });
  it("never lets possession of a code or handle bypass actor, pin, sequence, waypoint or worldspace", () => {
    const broker = new LandfallNearbyPairBroker(() => 1000),
      created = broker.create(scope, owner);
    for (const change of [
      { playerProfileId: "outsider" },
      { sessionId: "other" },
      { publishedVersionId: "other" },
      { worldspaceId: "virtual" },
      { waypointId: "future" },
      { expectedSequence: 5 },
    ]) {
      const other = { ...scope, ...change };
      expect(() => broker.join(other, created.code, peer)).toThrow("UNAVAILABLE");
      expect(() => broker.read(other, created.handle)).toThrow("UNAVAILABLE");
      broker.stop(other, created.handle);
      expect(broker.read(scope, created.handle).state).toBe("WAITING");
    }
    expect(broker.join(scope, created.code, peer).state).toBe("READY");
  });
  it("invalidates both handles on either peer's stop and rejects an expired or restarted exchange", () => {
    let now = 1000;
    const broker = new LandfallNearbyPairBroker(() => now);
    const created = broker.create(scope, owner),
      joined = broker.join(scope, created.code, peer);
    broker.stop(scope, joined.handle);
    expect(() => broker.read(scope, created.handle)).toThrow("UNAVAILABLE");
    expect(() => broker.read(scope, joined.handle)).toThrow("UNAVAILABLE");
    const next = broker.create(scope, owner);
    now = next.expiresAt;
    expect(() => broker.join(scope, next.code, peer)).toThrow("UNAVAILABLE");
    expect(() => broker.read(scope, next.handle)).toThrow("UNAVAILABLE");
    expect(() => new LandfallNearbyPairBroker(() => now).read(scope, next.handle)).toThrow("UNAVAILABLE");
  });
  it("fails closed on clock rollback and discards exchanges", () => {
    let now = 1000;
    const broker = new LandfallNearbyPairBroker(() => now),
      created = broker.create(scope, owner);
    now = 999;
    expect(() => broker.read(scope, created.handle)).toThrow("CLOCK_INVALID");
    now = 1000;
    expect(() => broker.read(scope, created.handle)).toThrow("UNAVAILABLE");
  });
  it("expires secret state during an idle server interval", () => {
    vi.useFakeTimers();
    try {
      const broker = new LandfallNearbyPairBroker(() => 1000),
        created = broker.create(scope, owner);
      broker.join(scope, created.code, peer);
      vi.advanceTimersByTime(45000);
      expect(() => broker.read(scope, created.handle)).toThrow("UNAVAILABLE");
    } finally {
      vi.useRealTimers();
    }
  });
  it("rejects reflected peers, incompatible channels and cross-platform sessions without consuming a valid code", () => {
    const broker = new LandfallNearbyPairBroker(() => 1000),
      created = broker.create(scope, owner);
    for (const offer of [
      owner,
      { ...peer, channel: 5 as const },
      { ...peer, preamble: 10 },
      { platform: "IOS" as const, discoveryToken: "AQI=" },
    ])
      expect(() => broker.join(scope, created.code, offer)).toThrow();
    expect(broker.join(scope, created.code, peer).state).toBe("READY");
  });
  it("exchanges bounded opaque Apple discovery tokens without claiming protected STS or identity", () => {
    const broker = new LandfallNearbyPairBroker(() => 1000),
      created = broker.create(scope, { platform: "IOS", discoveryToken: "AQI=" });
    const joined = broker.join(scope, created.code, { platform: "IOS", discoveryToken: "AwQ=" });
    expect(joined).toMatchObject({
      state: "READY",
      platform: "IOS",
      configuration: { discoveryToken: "AQI=" },
      peerVerified: false,
      canComplete: false,
    });
    expect(broker.read(scope, created.handle)).toMatchObject({ configuration: { discoveryToken: "AwQ=" } });
    expect(JSON.stringify(joined)).not.toContain("sessionKey");
  });
  it("bounds outstanding private state per actor and releases capacity on expiry", () => {
    let now = 1000;
    const broker = new LandfallNearbyPairBroker(() => now);
    for (let index = 0; index < 4; index++) broker.create(scope, owner);
    expect(() => broker.create(scope, owner)).toThrow("CAPACITY");
    expect(() => broker.create({ ...scope, playerProfileId: "player-2" }, owner)).not.toThrow();
    now = 46000;
    expect(() => broker.create(scope, owner)).not.toThrow();
  });
  it("rejects noncanonical bytes, coercion, unbounded archives and hidden authority claims", () => {
    for (const value of [
      { ...owner, address: "AQJ=" },
      { ...owner, channel: "9" },
      { ...owner, canComplete: true },
      { platform: "IOS", discoveryToken: Buffer.alloc(4097).toString("base64") },
      { platform: "IOS", discoveryToken: "AQI=\n" },
    ])
      expect(nearbyPairOfferSchema.safeParse(value).success).toBe(false);
    expect(
      nearbyPairRequestSchema.safeParse({ operation: "JOIN", code: "a".repeat(43), offer: peer, scope }).success,
    ).toBe(false);
  });
});
