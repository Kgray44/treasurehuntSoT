import { createHash, createPrivateKey, createPublicKey, sign, webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  landfallInteractionPayload,
  verifyLandfallInteractionToken,
  LandfallInteractionReplayGuard,
  type LandfallInteractionClaim,
} from "@/landfall/interaction-token";
import { NativeLandfallSensorFusion } from "@/landfall/native-sensors";
import { LandfallNearbyProvider } from "@/landfall/nearby-provider";

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
describe("signed deliberate interactions", () => {
  it("verifies trusted signatures and exact actor/session/edition scope, rejects arbitrary payloads and fails closed at replay capacity", async () => {
    const privateKey = createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        createHash("sha256").update("SYNTHETIC-TOKEN-TEST-ONLY").digest(),
      ]),
      format: "der",
      type: "pkcs8",
    });
    const key = await crypto.subtle.importKey(
      "jwk",
      createPublicKey(privateKey).export({ format: "jwk" }) as JsonWebKey,
      "Ed25519",
      false,
      ["verify"],
    );
    const scope = {
      playerProfileId: "player",
      sessionId: "voyage",
      publishedVersionId: "edition",
      worldspaceId: "town",
      waypointId: "door",
      expectedSequence: 1,
    };
    const claim: LandfallInteractionClaim = {
      version: 1,
      id: "token-1",
      keyId: "synthetic-key",
      medium: "NFC",
      scope,
      taleId: "chronicle",
      issuedAt: 1000,
      expiresAt: 10000,
    };
    const payload = landfallInteractionPayload(claim);
    const token = `${payload}.${sign(null, Buffer.from(payload), privateKey).toString("base64url")}`;
    const input = {
      scope,
      taleId: "chronicle",
      medium: "NFC" as const,
      now: 2000,
      keys: new Map([[claim.keyId, key]]),
    };
    expect(await verifyLandfallInteractionToken(token, input)).toEqual(claim);
    await expect(
      verifyLandfallInteractionToken(token, { ...input, scope: { ...scope, playerProfileId: "other" } }),
    ).rejects.toThrow("SCOPE_MISMATCH");
    await expect(verifyLandfallInteractionToken(token, { ...input, now: 10000 })).rejects.toThrow("EXPIRED");
    await expect(verifyLandfallInteractionToken("https://untrusted.example/run-script", input)).rejects.toThrow(
      "MALFORMED",
    );
    await expect(verifyLandfallInteractionToken(token, { ...input, keys: new Map() })).rejects.toThrow(
      "SIGNATURE_INVALID",
    );
    const guard = new LandfallInteractionReplayGuard();
    expect(guard.accept(claim, 2000)).toBe("NEW");
    for (let index = 2; index <= 128; index++)
      expect(guard.accept({ ...claim, id: `token-${index}` }, 2000)).toBe("NEW");
    expect(guard.accept({ ...claim, id: "token-129" }, 2000)).toBe("CAPACITY");
    expect(guard.accept(claim, 2000)).toBe("DUPLICATE");
  });
});
describe("optional sensor and ranging honesty", () => {
  it("keeps weak/spoofed/missing/replayed nearby signals distinct and never grants completion", () => {
    const provider = new LandfallNearbyProvider("BLE", new Set(["configured-peer"]));
    const caps = { physical: true, supported: true, permission: true, enabled: true };
    const signal = {
      family: "BLE",
      id: "sample",
      peerId: "configured-peer",
      observedAt: 1000,
      rssi: -85,
      authenticated: true,
    };
    expect(provider.ingest(signal, caps, 1000)).toMatchObject({
      state: "POSSIBLE",
      canComplete: false,
      precision: "PROXIMITY_ONLY",
    });
    expect(provider.ingest(signal, caps, 1000).state).toBe("DUPLICATE");
    expect(provider.ingest({ ...signal, id: "spoofed", peerId: "unknown-peer" }, caps, 1000).state).toBe("UNTRUSTED");
    expect(provider.ingest({ ...signal, id: "new" }, { ...caps, permission: false }, 1000).state).toBe(
      "PERMISSION_DENIED",
    );
    expect(provider.ingest(signal, { ...caps, physical: false }, 1000).state).toBe("UNSUPPORTED_DEVICE");
    expect(provider.snapshot(12000).state).toBe("STALE");
    const uwb = new LandfallNearbyProvider("UWB", new Set(["configured-peer"]));
    expect(
      uwb.ingest(
        {
          family: "UWB",
          id: "range",
          peerId: "configured-peer",
          observedAt: 1000,
          distanceMeters: 1,
          uncertaintyMeters: 5,
          authenticated: true,
        },
        caps,
        1000,
      ),
    ).toMatchObject({ state: "POSSIBLE", canComplete: false });
  });
  it("models barometric drift without floor confirmation, suspends hidden sensors and rejects heading disagreement", () => {
    const fusion = new NativeLandfallSensorFusion(
      { sessionId: "voyage", publishedVersionId: "edition", worldspaceId: "town" },
      true,
    );
    const frame = { id: "pressure-1", observedAt: 1000, kind: "PRESSURE", values: [1013], accuracy: 0.1 };
    const first = fusion.ingest(frame, 1000, true);
    const second = fusion.ingest({ ...frame, id: "pressure-2", observedAt: 2000, values: [1012] }, 2000, true);
    expect(first.floorConfirmed).toBe(false);
    expect(second.evidence).toMatchObject({ kind: "ELEVATION" });
    expect(second.driftBoundMeters!).toBeGreaterThan(first.driftBoundMeters!);
    expect(fusion.ingest({ ...frame, observedAt: 3000 }, 3000, false).state).toBe("UNAVAILABLE");
    expect(
      fusion.ingest({ id: "heading-1", observedAt: 4000, kind: "HEADING", values: [0], accuracy: 10 }, 4000, true)
        .state,
    ).toBe("READY");
    expect(
      fusion.ingest({ id: "heading-2", observedAt: 4300, kind: "HEADING", values: [180], accuracy: 10 }, 4300, true)
        .state,
    ).toBe("CONFLICT");
    const virtual = new NativeLandfallSensorFusion(
      { sessionId: "voyage", publishedVersionId: "edition", worldspaceId: "virtual" },
      false,
    );
    expect(virtual.ingest(frame, 1000, true).state).toBe("UNAVAILABLE");
  });
});
