"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { EventEmitter, once } = require("node:events");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { WebSocket } = require("ws");
const { CompanionLoopbackServer } = require("./loopback-server.cjs");
const { CompanionStorage } = require("./storage.cjs");

function envelope(messageType, payload, options = {}) {
  return {
    protocolVersion: "2.0",
    messageType,
    messageId: options.messageId ?? `message_${crypto.randomUUID()}`,
    requestId: options.requestId,
    timestamp: new Date().toISOString(),
    sequence: options.sequence,
    payload,
  };
}

function nextMessage(socket) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket test response timed out.")), 5_000);
    socket.once("message", (data) => {
      clearTimeout(timeout);
      resolve(JSON.parse(data.toString("utf8")));
    });
  });
}

test("loopback server enforces exact origin, pairing proof, command allowlist, and replay closure", async (t) => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b2-loopback-"));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  const storage = new CompanionStorage(root);
  await storage.initialize();
  class FakeCore extends EventEmitter {
    async execute(command) {
      assert.equal(command, "capture.getStatus");
      return { state: "TARGET_SELECTED", verificationPerformed: false };
    }
  }
  const core = new FakeCore();
  const origin = "http://127.0.0.1:3000";
  const server = new CompanionLoopbackServer({ core, storage, port: 0, allowedOrigins: [origin] });
  const started = await server.start();
  t.after(() => server.stop());
  const base = `http://${started.host}:${started.port}`;

  const forbidden = await fetch(`${base}/v2/pair/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: "{}",
  });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("access-control-allow-origin"), null);

  const preflight = await fetch(`${base}/v2/pair/request`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Private-Network": "true",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-private-network"), "true");

  const diagnostic = await storage.writeDiagnosticBundle({ privacy: { playerFramesRetained: false } });
  const download = await server.issueDiagnosticDownload(diagnostic.bundleId, origin);
  const downloaded = await fetch(download.downloadUrl, { headers: { Origin: origin } });
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "application/gzip");
  assert.equal((await downloaded.arrayBuffer()).byteLength, diagnostic.fileSize);
  assert.equal((await fetch(download.downloadUrl, { headers: { Origin: origin } })).status, 400);

  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const requestedResponse = await fetch(`${base}/v2/pair/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({
      protocolVersion: "2.0",
      clientInstanceId: "browser_loopback_test_0001",
      publicKeyJwk: publicKey.export({ format: "jwk" }),
    }),
  });
  assert.equal(requestedResponse.status, 201);
  assert.equal(requestedResponse.headers.get("access-control-allow-origin"), origin);
  const requested = await requestedResponse.json();
  const pending = server.pairings.listPending()[0];
  server.pairings.approvePending(requested.pairingId, true);
  const completedResponse = await fetch(`${base}/v2/pair/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ pairingId: requested.pairingId, pairingCode: pending.pairingCode }),
  });
  assert.equal(completedResponse.status, 200);
  const paired = await completedResponse.json();

  const socket = new WebSocket(`ws://${started.host}:${started.port}/v2/socket`, { origin });
  const challengePromise = nextMessage(socket);
  await once(socket, "open");
  const challengeEnvelope = await challengePromise;
  assert.equal(challengeEnvelope.payload.eventType, "companion.challenge");
  const challenge = challengeEnvelope.payload.challenge;
  const signed = Buffer.from(`${challenge}|${paired.pairingId}|${origin}|2.0`, "utf8");
  const signature = crypto.sign("sha256", signed, { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  const authenticationPromise = nextMessage(socket);
  socket.send(
    JSON.stringify(
      envelope(
        "companion.authenticate",
        { pairingId: paired.pairingId, signature },
        { requestId: "request_auth_0001" },
      ),
    ),
  );
  const authenticated = await authenticationPromise;
  assert.equal(authenticated.payload.ok, true);

  const statusPromise = nextMessage(socket);
  socket.send(
    JSON.stringify(
      envelope(
        "capture.command",
        { command: "capture.getStatus", input: {} },
        { requestId: "request_status_0001", sequence: 1 },
      ),
    ),
  );
  const status = await statusPromise;
  assert.equal(status.payload.ok, true);
  assert.equal(status.payload.result.state, "TARGET_SELECTED");

  const replayPromise = nextMessage(socket);
  socket.send(
    JSON.stringify(
      envelope(
        "capture.command",
        { command: "capture.getStatus", input: {} },
        { requestId: "request_status_0002", sequence: 1 },
      ),
    ),
  );
  const replay = await replayPromise;
  assert.equal(replay.payload.ok, false);
  assert.equal(replay.payload.error.code, "PAIRING_REPLAY_REJECTED");
  await once(socket, "close");
});
