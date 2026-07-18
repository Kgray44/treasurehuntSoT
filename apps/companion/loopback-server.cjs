"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { WebSocketServer } = require("ws");
const {
  CAPTURE_PROTOCOL_VERSION,
  assertExactKeys,
  captureError,
  requireIdentifier,
  serializeCaptureError,
  validateCommand,
  validateEnvelope,
} = require("./capture-contract.cjs");

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function randomCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function safeJson(value) {
  return JSON.stringify(value);
}

function sendJson(response, status, body, origin) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  response.end(safeJson(body));
}

async function readJson(request, maximumBytes = 32 * 1024) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maximumBytes)
      throw captureError("COMPANION_PAYLOAD_TOO_LARGE", "Local Companion payload is too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw captureError("VALIDATION_FAILED", "Local Companion payload is not valid JSON.");
  }
}

class PairingManager {
  constructor(storageDirectory, allowedOrigins, options = {}) {
    this.storageDirectory = storageDirectory;
    this.allowedOrigins = new Set(allowedOrigins);
    this.pendingLifetimeMs = options.pendingLifetimeMs ?? 120_000;
    this.sessionLifetimeMs = options.sessionLifetimeMs ?? 30 * 60_000;
    this.pending = new Map();
    this.pairings = new Map();
    this.usedChallenges = new Set();
    this.filePath = path.join(storageDirectory, "pairings-v2.json");
    this.persistPromise = Promise.resolve();
  }

  async initialize() {
    await fsp.mkdir(this.storageDirectory, { recursive: true });
    try {
      const parsed = JSON.parse(await fsp.readFile(this.filePath, "utf8"));
      for (const pairing of parsed.pairings ?? []) {
        if (pairing.protocolVersion !== CAPTURE_PROTOCOL_VERSION || pairing.revokedAt) continue;
        if (Date.parse(pairing.expiresAt) <= Date.now()) continue;
        if (!this.allowedOrigins.has(pairing.allowedOrigin)) continue;
        this.pairings.set(pairing.pairingId, { ...pairing, requestIds: new Set(pairing.requestIds ?? []) });
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    await this.#persist();
  }

  isOriginAllowed(origin) {
    return this.allowedOrigins.has(origin);
  }

  async requestPairing(origin, input) {
    if (!this.isOriginAllowed(origin)) throw captureError("ORIGIN_NOT_ALLOWED", "This website is not allowed to pair.");
    assertExactKeys(input, ["protocolVersion", "clientInstanceId", "publicKeyJwk", "accountHint"], "pairing request");
    if (input.protocolVersion !== CAPTURE_PROTOCOL_VERSION)
      throw captureError("PROTOCOL_INCOMPATIBLE", "Browser and Companion protocol versions do not match.");
    requireIdentifier(input.clientInstanceId, "clientInstanceId");
    const key = input.publicKeyJwk;
    if (
      !key ||
      key.kty !== "EC" ||
      key.crv !== "P-256" ||
      typeof key.x !== "string" ||
      typeof key.y !== "string" ||
      key.d !== undefined ||
      key.x.length > 100 ||
      key.y.length > 100
    )
      throw captureError("VALIDATION_FAILED", "Pairing public key is invalid.");
    const pairingId = `pairing_${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.pendingLifetimeMs).toISOString();
    this.pending.set(pairingId, {
      pairingId,
      allowedOrigin: origin,
      clientInstanceId: input.clientInstanceId,
      accountHint: typeof input.accountHint === "string" ? input.accountHint.slice(0, 100) : null,
      publicKeyJwk: { kty: "EC", crv: "P-256", x: key.x, y: key.y, ext: true },
      code: randomCode(),
      codeAttempts: 0,
      desktopApproved: false,
      createdAt,
      expiresAt,
    });
    return { pairingId, allowedOrigin: origin, createdAt, expiresAt, desktopApprovalRequired: true };
  }

  listPending() {
    this.#expirePending();
    return [...this.pending.values()].map((pending) => ({
      pairingId: pending.pairingId,
      allowedOrigin: pending.allowedOrigin,
      clientInstanceId: pending.clientInstanceId,
      accountHint: pending.accountHint,
      pairingCode: pending.code,
      desktopApproved: pending.desktopApproved,
      createdAt: pending.createdAt,
      expiresAt: pending.expiresAt,
    }));
  }

  approvePending(pairingId, approved) {
    this.#expirePending();
    const pending = this.pending.get(pairingId);
    if (!pending) throw captureError("PAIRING_EXPIRED", "Pairing request expired.");
    if (!approved) {
      this.pending.delete(pairingId);
      return { pairingId, approved: false, rejected: true };
    }
    pending.desktopApproved = true;
    pending.approvedAt = new Date().toISOString();
    return { pairingId, approved: true, allowedOrigin: pending.allowedOrigin, expiresAt: pending.expiresAt };
  }

  async completePairing(origin, input) {
    assertExactKeys(input, ["pairingId", "pairingCode"], "pairing completion");
    requireIdentifier(input.pairingId, "pairingId");
    if (typeof input.pairingCode !== "string" || !/^\d{6}$/.test(input.pairingCode))
      throw captureError("PAIRING_CODE_INVALID", "Pairing code is invalid.");
    this.#expirePending();
    const pending = this.pending.get(input.pairingId);
    if (!pending || pending.allowedOrigin !== origin) throw captureError("PAIRING_EXPIRED", "Pairing request expired.");
    if (!pending.desktopApproved)
      throw captureError("PAIRING_REQUIRED", "Approve this website in the desktop Companion first.");
    pending.codeAttempts += 1;
    if (pending.codeAttempts > 5) {
      this.pending.delete(pending.pairingId);
      throw captureError("PAIRING_EXPIRED", "Too many pairing attempts.");
    }
    const expected = Buffer.from(pending.code);
    const supplied = Buffer.from(input.pairingCode);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied))
      throw captureError("PAIRING_CODE_INVALID", "Pairing code is invalid.");
    this.pending.delete(pending.pairingId);
    const pairedAt = new Date().toISOString();
    const pairing = {
      pairingId: pending.pairingId,
      allowedOrigin: pending.allowedOrigin,
      clientInstanceId: pending.clientInstanceId,
      publicKeyJwk: pending.publicKeyJwk,
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
      pairedAt,
      expiresAt: new Date(Date.now() + this.sessionLifetimeMs).toISOString(),
      revokedAt: null,
      lastSequence: 0,
      requestIds: new Set(),
    };
    this.pairings.set(pairing.pairingId, pairing);
    await this.#persist();
    return {
      pairingId: pairing.pairingId,
      allowedOrigin: pairing.allowedOrigin,
      protocolVersion: pairing.protocolVersion,
      pairedAt,
      expiresAt: pairing.expiresAt,
      authentication: "ECDSA_P256_CHALLENGE",
    };
  }

  authenticate(origin, pairingId, challenge, signature) {
    const pairing = this.#requirePairing(origin, pairingId);
    if (this.usedChallenges.has(challenge))
      throw captureError("PAIRING_REPLAY_REJECTED", "Pairing challenge was replayed.");
    if (typeof signature !== "string" || signature.length > 256)
      throw captureError("VALIDATION_FAILED", "Pairing signature is invalid.");
    const signed = Buffer.from(`${challenge}|${pairingId}|${origin}|${CAPTURE_PROTOCOL_VERSION}`, "utf8");
    const publicKey = crypto.createPublicKey({ key: pairing.publicKeyJwk, format: "jwk" });
    const valid = crypto.verify(
      "sha256",
      signed,
      { key: publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url"),
    );
    this.usedChallenges.add(challenge);
    if (this.usedChallenges.size > 1_000) this.usedChallenges.delete(this.usedChallenges.values().next().value);
    if (!valid) throw captureError("PAIRING_REPLAY_REJECTED", "Pairing authentication proof was rejected.");
    return pairing;
  }

  async acceptRequest(pairing, requestId, sequence) {
    requireIdentifier(requestId, "requestId");
    if (!Number.isSafeInteger(sequence) || sequence <= pairing.lastSequence)
      throw captureError("PAIRING_REPLAY_REJECTED", "Pairing request sequence was replayed or out of order.");
    if (pairing.requestIds.has(requestId))
      throw captureError("PAIRING_REPLAY_REJECTED", "Pairing request ID was replayed.");
    pairing.lastSequence = sequence;
    pairing.requestIds.add(requestId);
    while (pairing.requestIds.size > 500) pairing.requestIds.delete(pairing.requestIds.values().next().value);
    await this.#persist();
  }

  listPairings() {
    return [...this.pairings.values()].map((pairing) => ({
      pairingId: pairing.pairingId,
      allowedOrigin: pairing.allowedOrigin,
      clientInstanceId: pairing.clientInstanceId,
      protocolVersion: pairing.protocolVersion,
      pairedAt: pairing.pairedAt,
      expiresAt: pairing.expiresAt,
      revokedAt: pairing.revokedAt,
    }));
  }

  async revoke(pairingId) {
    const pairing = this.pairings.get(pairingId);
    if (!pairing) return { pairingId, revoked: false, idempotent: true };
    pairing.revokedAt = new Date().toISOString();
    await this.#persist();
    return { pairingId, revoked: true, revokedAt: pairing.revokedAt };
  }

  #requirePairing(origin, pairingId) {
    const pairing = this.pairings.get(pairingId);
    if (!pairing || pairing.allowedOrigin !== origin) throw captureError("PAIRING_REQUIRED", "Pairing is required.");
    if (pairing.revokedAt) throw captureError("PAIRING_REVOKED", "Pairing was revoked.");
    if (Date.parse(pairing.expiresAt) <= Date.now()) throw captureError("PAIRING_EXPIRED", "Pairing expired.");
    return pairing;
  }

  #expirePending() {
    const now = Date.now();
    for (const [id, pending] of this.pending) if (Date.parse(pending.expiresAt) <= now) this.pending.delete(id);
  }

  async #persist() {
    const operation = this.persistPromise
      .catch(() => {})
      .then(async () => {
        const temporary = `${this.filePath}.${crypto.randomUUID()}.tmp`;
        const serializable = [...this.pairings.values()].map((pairing) => ({
          ...pairing,
          requestIds: [...pairing.requestIds].slice(-500),
        }));
        try {
          await fsp.writeFile(temporary, `${JSON.stringify({ schemaVersion: 1, pairings: serializable }, null, 2)}\n`, {
            encoding: "utf8",
          });
          await fsp.rename(temporary, this.filePath);
        } finally {
          await fsp.rm(temporary, { force: true }).catch(() => {});
        }
      });
    this.persistPromise = operation;
    return operation;
  }
}

class SlidingRateLimiter {
  constructor(limit = 30, windowMs = 10_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.entries = new Map();
  }

  accept(key) {
    const now = Date.now();
    const current = (this.entries.get(key) ?? []).filter((time) => now - time < this.windowMs);
    current.push(now);
    this.entries.set(key, current);
    return current.length <= this.limit;
  }
}

const browserCommands = new Set([
  "capture.getCapabilities",
  "capture.listTargets",
  "capture.getStatus",
  "capture.selectTarget",
  "capture.creator.start",
  "capture.creator.pause",
  "capture.creator.resume",
  "capture.creator.stop",
  "capture.creator.cancel",
  "capture.creator.list",
  "capture.creator.delete",
  "capture.creator.preview",
  "capture.scan.start",
  "capture.scan.stop",
  "capture.scan.cancel",
  "capture.privacy.pause",
  "capture.privacy.resume",
  "capture.diagnostic.create",
  "capture.diagnostic.export",
]);

class CompanionLoopbackServer {
  constructor(options) {
    this.core = options.core;
    this.storage = options.storage;
    this.host = "127.0.0.1";
    this.port = options.port ?? 32179;
    this.allowedOrigins = [...new Set(options.allowedOrigins)];
    this.pairings = new PairingManager(this.storage.paths.pairings, this.allowedOrigins, options.pairingOptions);
    this.server = null;
    this.webSocketServer = null;
    this.sockets = new Set();
    this.rateLimiter = new SlidingRateLimiter();
    this.previewTokens = new Map();
    this.diagnosticTokens = new Map();
    this.logger = options.logger ?? (() => {});
    this.boundCoreEvents = [];
  }

  async start() {
    await this.pairings.initialize();
    this.server = http.createServer((request, response) => void this.#handleHttp(request, response));
    this.webSocketServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false });
    this.server.on("upgrade", (request, socket, head) => this.#handleUpgrade(request, socket, head));
    this.webSocketServer.on("connection", (socket, request) => this.#handleSocket(socket, request));
    for (const eventName of ["status", "state", "capture-progress", "capture-completed", "capture-error"]) {
      const listener = (payload) => this.#broadcast(eventName, payload);
      this.core.on(eventName, listener);
      this.boundCoreEvents.push([eventName, listener]);
    }
    await new Promise((resolve, reject) => {
      this.server.once("error", reject);
      this.server.listen(this.port, this.host, resolve);
    });
    this.port = this.server.address().port;
    return {
      host: this.host,
      port: this.port,
      origins: this.allowedOrigins,
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
    };
  }

  async stop() {
    for (const [eventName, listener] of this.boundCoreEvents) this.core.removeListener(eventName, listener);
    this.boundCoreEvents = [];
    for (const socket of this.sockets) socket.close(1001, "Companion shutting down");
    this.sockets.clear();
    await new Promise((resolve) => this.webSocketServer?.close(resolve));
    await new Promise((resolve) => this.server?.close(resolve));
    this.server = null;
  }

  getStatus() {
    return {
      listening: Boolean(this.server?.listening),
      host: this.host,
      port: this.port,
      allowedOrigins: this.allowedOrigins,
      authenticatedConnections: [...this.sockets].filter((socket) => socket.companionPairing).length,
      pendingPairings: this.pairings.listPending().length,
    };
  }

  async executeDesktopCommand(command, payload, desktopOrigin) {
    if (command === "capture.pairing.pending") return { pairings: this.pairings.listPending() };
    if (command === "capture.pairing.list") return { pairings: this.pairings.listPairings() };
    if (command === "capture.pairing.approve") return this.pairings.approvePending(payload.pairingId, payload.approved);
    if (command === "capture.pairing.revoke") {
      const result = await this.pairings.revoke(payload.pairingId);
      for (const socket of this.sockets) {
        if (socket.companionPairing?.pairingId === payload.pairingId) socket.close(4003, "Pairing revoked");
      }
      this.#log("INFO", "pairing_revoked", { pairingId: payload.pairingId });
      return result;
    }
    if (command === "capture.creator.preview") return this.issuePreview(payload.artifactId, desktopOrigin);
    if (command === "capture.diagnostic.export") return this.issueDiagnosticDownload(payload.bundleId, desktopOrigin);
    return this.core.execute(command, payload);
  }

  async issuePreview(artifactId, origin) {
    const artifact = await this.storage.getCreatorArtifact(artifactId);
    const token = base64Url(crypto.randomBytes(32));
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    this.previewTokens.set(token, { artifactId, mediaPath: artifact.mediaPath, origin, expiresAt });
    return {
      artifactId,
      previewUrl: `http://${this.host}:${this.port}/v2/preview/${token}`,
      expiresAt,
      mediaType: "video/webm",
    };
  }

  async issueDiagnosticDownload(bundleId, origin) {
    const diagnostic = await this.storage.getDiagnosticBundle(bundleId);
    const token = base64Url(crypto.randomBytes(32));
    const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
    this.diagnosticTokens.set(token, { ...diagnostic, origin, expiresAt });
    return {
      bundleId,
      downloadUrl: `http://${this.host}:${this.port}/v2/diagnostic/${token}`,
      expiresAt,
      mediaType: diagnostic.mediaType,
      fileSize: diagnostic.fileSize,
    };
  }

  async #handleHttp(request, response) {
    const origin = request.headers.origin;
    try {
      if (!origin || !this.pairings.isOriginAllowed(origin))
        throw captureError("ORIGIN_NOT_ALLOWED", "This website is not allowed to use the Companion.");
      if (!this.rateLimiter.accept(`${request.socket.remoteAddress}|${origin}`))
        throw captureError("COMPANION_RATE_LIMITED", "Too many local Companion requests.");
      if (request.method === "OPTIONS") {
        const privateNetworkRequested = request.headers["access-control-request-private-network"] === "true";
        response.writeHead(204, {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          ...(privateNetworkRequested ? { "Access-Control-Allow-Private-Network": "true" } : {}),
          "Access-Control-Max-Age": "300",
          Vary: "Origin",
        });
        response.end();
        return;
      }
      const url = new URL(request.url, `http://${this.host}:${this.port}`);
      if (request.method === "POST" && url.pathname === "/v2/pair/request") {
        const pairing = await this.pairings.requestPairing(origin, await readJson(request));
        this.#log("INFO", "pairing_requested", { pairingId: pairing.pairingId, allowedOrigin: origin });
        sendJson(response, 201, pairing, origin);
        return;
      }
      if (request.method === "POST" && url.pathname === "/v2/pair/complete") {
        const pairing = await this.pairings.completePairing(origin, await readJson(request));
        this.#log("INFO", "pairing_completed", { pairingId: pairing.pairingId, allowedOrigin: origin });
        sendJson(response, 200, pairing, origin);
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith("/v2/preview/")) {
        await this.#servePreview(request, response, origin, url.pathname.slice("/v2/preview/".length));
        return;
      }
      if (request.method === "GET" && url.pathname.startsWith("/v2/diagnostic/")) {
        await this.#serveDiagnostic(response, origin, url.pathname.slice("/v2/diagnostic/".length));
        return;
      }
      sendJson(response, 404, { error: { code: "NOT_FOUND" } }, origin);
    } catch (error) {
      const serialized = serializeCaptureError(error);
      const status =
        serialized.code === "ORIGIN_NOT_ALLOWED"
          ? 403
          : serialized.code === "COMPANION_RATE_LIMITED"
            ? 429
            : serialized.code.startsWith("PAIRING_")
              ? 401
              : serialized.code === "COMPANION_PAYLOAD_TOO_LARGE"
                ? 413
                : 400;
      sendJson(
        response,
        status,
        { error: serialized },
        origin && this.pairings.isOriginAllowed(origin) ? origin : null,
      );
    }
  }

  async #servePreview(request, response, origin, token) {
    const preview = this.previewTokens.get(token);
    if (!preview || preview.origin !== origin || Date.parse(preview.expiresAt) <= Date.now())
      throw captureError("ARTIFACT_NOT_FOUND", "Preview link expired.");
    const stat = await fsp.stat(preview.mediaPath);
    const range = request.headers.range;
    let start = 0;
    let end = stat.size - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) throw captureError("VALIDATION_FAILED", "Preview byte range is invalid.");
      start = Number(match[1]);
      end = match[2] ? Math.min(stat.size - 1, Number(match[2])) : stat.size - 1;
      if (start > end || start >= stat.size) throw captureError("VALIDATION_FAILED", "Preview byte range is invalid.");
    }
    response.writeHead(range ? 206 : 200, {
      "Content-Type": "video/webm",
      "Content-Length": end - start + 1,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
      ...(range ? { "Content-Range": `bytes ${start}-${end}/${stat.size}` } : {}),
    });
    fs.createReadStream(preview.mediaPath, { start, end }).pipe(response);
  }

  async #serveDiagnostic(response, origin, token) {
    const diagnostic = this.diagnosticTokens.get(token);
    this.diagnosticTokens.delete(token);
    if (!diagnostic || diagnostic.origin !== origin || Date.parse(diagnostic.expiresAt) <= Date.now())
      throw captureError("ARTIFACT_NOT_FOUND", "Diagnostic download link expired.");
    response.writeHead(200, {
      "Content-Type": diagnostic.mediaType,
      "Content-Length": diagnostic.fileSize,
      "Content-Disposition": `attachment; filename="${diagnostic.bundleId}.json.gz"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": origin,
      Vary: "Origin",
    });
    fs.createReadStream(diagnostic.bundlePath).pipe(response);
  }

  #handleUpgrade(request, socket, head) {
    const origin = request.headers.origin;
    let url;
    try {
      url = new URL(request.url, `http://${this.host}:${this.port}`);
    } catch {
      socket.destroy();
      return;
    }
    if (
      request.socket.localAddress !== this.host ||
      url.pathname !== "/v2/socket" ||
      !origin ||
      !this.pairings.isOriginAllowed(origin)
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    this.webSocketServer.handleUpgrade(request, socket, head, (webSocket) =>
      this.webSocketServer.emit("connection", webSocket, request),
    );
  }

  #handleSocket(socket, request) {
    socket.companionOrigin = request.headers.origin;
    socket.companionChallenge = base64Url(crypto.randomBytes(32));
    socket.companionServerSequence = 0;
    this.sockets.add(socket);
    this.#send(socket, "capture.event", {
      eventType: "companion.challenge",
      challenge: socket.companionChallenge,
      protocolVersion: CAPTURE_PROTOCOL_VERSION,
    });
    const authenticationTimeout = setTimeout(() => {
      if (!socket.companionPairing) socket.close(4001, "Authentication timeout");
    }, 10_000);
    socket.on("message", (binary, isBinary) => void this.#handleSocketMessage(socket, binary, isBinary));
    socket.on("close", () => {
      clearTimeout(authenticationTimeout);
      this.sockets.delete(socket);
    });
  }

  async #handleSocketMessage(socket, binary, isBinary) {
    let envelope;
    try {
      if (isBinary || binary.length > 64 * 1024)
        throw captureError("COMPANION_PAYLOAD_TOO_LARGE", "WebSocket payload is invalid.");
      envelope = validateEnvelope(JSON.parse(binary.toString("utf8")));
      if (!socket.companionPairing) {
        if (envelope.messageType !== "companion.authenticate")
          throw captureError("PAIRING_REQUIRED", "Authenticate before sending Companion commands.");
        assertExactKeys(envelope.payload, ["pairingId", "signature"], "authentication payload");
        socket.companionPairing = this.pairings.authenticate(
          socket.companionOrigin,
          envelope.payload.pairingId,
          socket.companionChallenge,
          envelope.payload.signature,
        );
        socket.companionChallenge = null;
        this.#log("INFO", "pairing_socket_authenticated", {
          pairingId: socket.companionPairing.pairingId,
          allowedOrigin: socket.companionOrigin,
        });
        this.#send(socket, "capture.response", {
          requestId: envelope.requestId ?? envelope.messageId,
          ok: true,
          result: { authenticated: true, pairingId: socket.companionPairing.pairingId },
        });
        return;
      }
      if (envelope.messageType !== "capture.command")
        throw captureError("VALIDATION_FAILED", "Only capture commands are accepted after authentication.");
      assertExactKeys(envelope.payload, ["command", "input"], "command payload");
      if (!browserCommands.has(envelope.payload.command))
        throw captureError("VALIDATION_FAILED", "Browser command is not allowed.");
      const input = validateCommand(envelope.payload.command, { ...(envelope.payload.input ?? {}) });
      await this.pairings.acceptRequest(
        socket.companionPairing,
        envelope.requestId ?? envelope.messageId,
        envelope.sequence,
      );
      const result =
        envelope.payload.command === "capture.creator.preview"
          ? await this.issuePreview(input.artifactId, socket.companionOrigin)
          : envelope.payload.command === "capture.diagnostic.export"
            ? await this.issueDiagnosticDownload(input.bundleId, socket.companionOrigin)
            : await this.core.execute(envelope.payload.command, input);
      this.#send(socket, "capture.response", {
        requestId: envelope.requestId ?? envelope.messageId,
        ok: true,
        result,
      });
    } catch (error) {
      this.#send(socket, "capture.response", {
        requestId: envelope?.requestId ?? envelope?.messageId ?? null,
        ok: false,
        error: serializeCaptureError(error),
      });
      if (["PAIRING_REQUIRED", "PAIRING_EXPIRED", "PAIRING_REVOKED", "PAIRING_REPLAY_REJECTED"].includes(error?.code))
        socket.close(4003, error.code);
    }
  }

  #send(socket, messageType, payload) {
    if (socket.readyState !== 1) return;
    socket.companionServerSequence = (socket.companionServerSequence ?? 0) + 1;
    socket.send(
      safeJson({
        protocolVersion: CAPTURE_PROTOCOL_VERSION,
        messageType,
        messageId: `message_${crypto.randomUUID()}`,
        sessionId: socket.companionPairing?.pairingId,
        timestamp: new Date().toISOString(),
        sequence: socket.companionServerSequence,
        payload,
      }),
    );
  }

  #broadcast(eventType, payload) {
    for (const socket of this.sockets) {
      if (socket.companionPairing) this.#send(socket, "capture.event", { eventType, data: payload });
    }
  }

  #log(level, event, fields) {
    this.logger({ timestamp: new Date().toISOString(), level, event, ...fields });
  }
}

module.exports = {
  CompanionLoopbackServer,
  PairingManager,
  SlidingRateLimiter,
  base64Url,
  browserCommands,
  readJson,
};
