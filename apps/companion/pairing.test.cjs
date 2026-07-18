"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { PairingManager, SlidingRateLimiter, browserCommands } = require("./loopback-server.cjs");

async function pairingFixture(t, options = {}) {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b2-pairing-"));
  t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const origin = "http://127.0.0.1:3000";
  const manager = new PairingManager(directory, [origin], options);
  await manager.initialize();
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pending = await manager.requestPairing(origin, {
    protocolVersion: "2.0",
    clientInstanceId: "browser_instance_12345678",
    publicKeyJwk: publicKey.export({ format: "jwk" }),
  });
  const code = manager.listPending()[0].pairingCode;
  return { directory, origin, manager, pending, code, privateKey };
}

test("pairing requires exact origin, desktop approval, short code, and signed challenge", async (t) => {
  const fixture = await pairingFixture(t);
  await assert.rejects(
    fixture.manager.completePairing(fixture.origin, {
      pairingId: fixture.pending.pairingId,
      pairingCode: fixture.code,
    }),
    {
      code: "PAIRING_REQUIRED",
    },
  );
  fixture.manager.approvePending(fixture.pending.pairingId, true);
  await assert.rejects(
    fixture.manager.completePairing(fixture.origin, { pairingId: fixture.pending.pairingId, pairingCode: "000000" }),
    { code: "PAIRING_CODE_INVALID" },
  );
  const paired = await fixture.manager.completePairing(fixture.origin, {
    pairingId: fixture.pending.pairingId,
    pairingCode: fixture.code,
  });
  const challenge = crypto.randomBytes(32).toString("base64url");
  const signed = Buffer.from(`${challenge}|${paired.pairingId}|${fixture.origin}|2.0`, "utf8");
  const signature = crypto
    .sign("sha256", signed, { key: fixture.privateKey, dsaEncoding: "ieee-p1363" })
    .toString("base64url");
  const authenticated = fixture.manager.authenticate(fixture.origin, paired.pairingId, challenge, signature);
  assert.equal(authenticated.pairingId, paired.pairingId);
  assert.throws(() => fixture.manager.authenticate(fixture.origin, paired.pairingId, challenge, signature), {
    code: "PAIRING_REPLAY_REJECTED",
  });
});

test("paired requests enforce monotonic sequence, unique request IDs, persistence, and revocation", async (t) => {
  const fixture = await pairingFixture(t);
  fixture.manager.approvePending(fixture.pending.pairingId, true);
  const paired = await fixture.manager.completePairing(fixture.origin, {
    pairingId: fixture.pending.pairingId,
    pairingCode: fixture.code,
  });
  const pairing = fixture.manager.pairings.get(paired.pairingId);
  await fixture.manager.acceptRequest(pairing, "request_sequence_0001", 1);
  await assert.rejects(fixture.manager.acceptRequest(pairing, "request_sequence_0002", 1), {
    code: "PAIRING_REPLAY_REJECTED",
  });
  await assert.rejects(fixture.manager.acceptRequest(pairing, "request_sequence_0001", 2), {
    code: "PAIRING_REPLAY_REJECTED",
  });

  const reloaded = new PairingManager(fixture.directory, [fixture.origin]);
  await reloaded.initialize();
  assert.equal(reloaded.listPairings().length, 1);
  assert.equal((await reloaded.revoke(paired.pairingId)).revoked, true);
  assert.throws(() => reloaded.authenticate(fixture.origin, paired.pairingId, "fresh-challenge", "invalid"), {
    code: "PAIRING_REVOKED",
  });
});

test("browser surface is fixed and rate limiter is bounded", () => {
  assert.equal(browserCommands.has("capture.hotkey.configure"), false);
  assert.equal(browserCommands.has("native.execute"), false);
  assert.equal(browserCommands.has("capture.scan.start"), true);
  const limiter = new SlidingRateLimiter(2, 60_000);
  assert.equal(limiter.accept("origin"), true);
  assert.equal(limiter.accept("origin"), true);
  assert.equal(limiter.accept("origin"), false);
});
