// NCL-01 laptop preview only. No trust installation, external destinations, or arbitrary file routes.
import assert from "node:assert/strict";
import { X509Certificate, createPrivateKey, randomUUID, createHash } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const directory = "D:\\CodexTemp\\ncl01-preview\\tls";
const purpose = "NCL01_LAPTOP_PREVIEW_TLS_V1";
const scriptPath = fileURLToPath(import.meta.url);
const recordPath = path.join(directory, "https-process.json");
const fixedUpstream = "http://127.0.0.1:3149";
const allowedArguments = new Set(["--bootstrap", "--check", "--self-test"]);
for (const arg of process.argv.slice(2)) if (!allowedArguments.has(arg)) throw new Error("NCL01_ARGUMENT_REJECTED");

function ownedFile(name) {
  const filename = path.join(directory, name);
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("NCL01_TLS_FILE_REJECTED");
  return fs.readFileSync(filename);
}
function readConfiguration() {
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("NCL01_TLS_DIRECTORY_REJECTED");
  const owner = JSON.parse(ownedFile("owner.json"));
  const configuration = JSON.parse(ownedFile("server.config.json"));
  const keys = [
    "owner",
    "configId",
    "bindHost",
    "httpsPort",
    "bootstrapPort",
    "upstreamOrigin",
    "publicOrigin",
    "caSha256",
    "createdAt",
  ];
  if (
    Object.keys(configuration).length !== keys.length ||
    keys.some((key) => !(key in configuration)) ||
    configuration.owner !== purpose ||
    owner.purpose !== purpose ||
    owner.configId !== configuration.configId ||
    !/^[a-f0-9-]{36}$/.test(configuration.configId) ||
    owner.lanIp !== configuration.bindHost ||
    configuration.upstreamOrigin !== fixedUpstream ||
    configuration.httpsPort !== 8449 ||
    configuration.bootstrapPort !== 8448 ||
    configuration.publicOrigin !== `https://${configuration.bindHost}:8449` ||
    !/^\d{1,3}(\.\d{1,3}){3}$/.test(configuration.bindHost) ||
    !Object.values(os.networkInterfaces())
      .flat()
      .some((entry) => entry?.family === "IPv4" && !entry.internal && entry.address === configuration.bindHost)
  ) {
    throw new Error("NCL01_CONFIG_REJECTED");
  }
  const caPem = ownedFile("ca.pem"),
    cert = ownedFile("server.pem"),
    key = ownedFile("server.key.pem");
  const caDer = ownedFile("public-ca.cer"),
    profile = ownedFile("public-ca.mobileconfig");
  const profileText = profile.toString("utf8");
  const payloadTypes = [...profileText.matchAll(/<key>PayloadType<\/key>\s*<string>([^<]+)<\/string>/g)].map(
    (match) => match[1],
  );
  const certificateData = [...profileText.matchAll(/<key>PayloadContent<\/key>\s*<data>([A-Za-z0-9+/=\s]+)<\/data>/g)];
  if (
    payloadTypes.join(",") !== "Configuration,com.apple.security.root" ||
    certificateData.length !== 1 ||
    certificateData[0][1].replace(/\s/g, "") !== caDer.toString("base64")
  )
    throw new Error("NCL01_PUBLIC_PROFILE_REJECTED");
  const ca = new X509Certificate(caPem),
    server = new X509Certificate(cert);
  const validDates = (certificate) => {
    const from = Date.parse(certificate.validFrom),
      until = Date.parse(certificate.validTo);
    return (
      Number.isFinite(from) &&
      Number.isFinite(until) &&
      from <= Date.now() &&
      until > Date.now() + 300_000 &&
      until - from <= 7 * 86400_000 + 1000
    );
  };
  if (
    !validDates(ca) ||
    !validDates(server) ||
    !ca.ca ||
    server.ca ||
    !ca.verify(ca.publicKey) ||
    !server.checkIssued(ca) ||
    !server.verify(ca.publicKey) ||
    !server.checkPrivateKey(createPrivateKey(key)) ||
    server.checkIP(configuration.bindHost) !== configuration.bindHost ||
    server.checkIP("127.0.0.1") !== "127.0.0.1" ||
    server.checkHost("localhost") !== "localhost" ||
    !ca.raw.equals(caDer) ||
    createHash("sha256").update(caDer).digest("hex") !== configuration.caSha256 ||
    !server.keyUsage?.includes("1.3.6.1.5.5.7.3.1")
  )
    throw new Error("NCL01_CERTIFICATE_REJECTED");
  // Key/certificate compatibility is checked without opening a socket.
  tls.createSecureContext({ key, cert, ca: caPem, minVersion: "TLSv1.2" });
  return { configuration, caPem, cert, key, caDer, profile, validUntil: ca.validTo };
}

function validHost(request, configuration, port) {
  const hosts = request.rawHeaders
    .filter((_, index) => index % 2 === 0)
    .filter((name) => name.toLowerCase() === "host");
  return (
    hosts.length === 1 &&
    [`${configuration.bindHost}:${port}`, `localhost:${port}`, `127.0.0.1:${port}`].includes(request.headers.host)
  );
}
function validTarget(target) {
  return (
    typeof target === "string" &&
    target.startsWith("/") &&
    !target.startsWith("//") &&
    !/[\\\r\n\0]/.test(target) &&
    !/^\/\/(?:[^/])/.test(target)
  );
}
function proxyHeaders(request, configuration, websocket = false) {
  const connectionTokens = String(request.headers.connection ?? "")
    .toLowerCase()
    .split(",")
    .map((token) => token.trim());
  const hop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    ...connectionTokens,
  ]);
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (
      !hop.has(name) &&
      name !== "host" &&
      name !== "forwarded" &&
      name !== "x-real-ip" &&
      !name.startsWith("x-forwarded-")
    )
      headers[name] = value;
  }
  const authority = `${configuration.bindHost}:8449`;
  headers.host = authority;
  headers["x-forwarded-host"] = authority;
  headers["x-forwarded-proto"] = "https";
  headers["x-forwarded-port"] = "8449";
  headers["x-forwarded-for"] = request.socket.remoteAddress;
  headers["x-real-ip"] = request.socket.remoteAddress;
  headers.forwarded = `proto=https;host="${authority}"`;
  if (websocket) {
    headers.connection = "Upgrade";
    headers.upgrade = "websocket";
  }
  return headers;
}
function secureResponseHeaders(upstreamHeaders) {
  const headers = { ...upstreamHeaders };
  if (headers["set-cookie"] !== undefined) {
    const cookies = Array.isArray(headers["set-cookie"]) ? headers["set-cookie"] : [headers["set-cookie"]];
    // Cookie scope ignores ports. HTTPS preview cookies must never accompany public-CA HTTP requests.
    headers["set-cookie"] = cookies.map((cookie) =>
      /(?:^|;)\s*secure\s*(?:;|$)/i.test(cookie) ? cookie : cookie + "; Secure",
    );
  }
  return headers;
}
function websocketAllowed(request, configuration) {
  return (
    request.method === "GET" &&
    validHost(request, configuration, 8449) &&
    validTarget(request.url) &&
    /^\/_next\/webpack-hmr(?:\?|$)/.test(request.url) &&
    [`https://${configuration.bindHost}:8449`, "https://localhost:8449", "https://127.0.0.1:8449"].includes(
      request.headers.origin,
    ) &&
    String(request.headers.upgrade ?? "").toLowerCase() === "websocket"
  );
}
function bootstrapRoute(method, target) {
  if (method !== "GET" && method !== "HEAD") return null;
  return (
    new Map([
      ["/", "help"],
      ["/public-ca.cer", "certificate"],
      ["/public-ca.mobileconfig", "profile"],
    ]).get(target) ?? null
  );
}
function reject(response, status) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    connection: "close",
  });
  response.end("NCL-01 preview request rejected.\n");
}
function logCode(code) {
  const safe = typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "UNAVAILABLE";
  process.stderr.write(`NCL01_PREVIEW ${safe}\n`);
}

const material = readConfiguration();
const configuration = material.configuration;
if (process.argv.includes("--self-test")) {
  const request = (host, extra = {}) => ({
    headers: { host, ...extra },
    rawHeaders: ["Host", host],
    socket: { remoteAddress: "192.0.2.10" },
    method: "GET",
    url: "/",
  });
  assert.equal(validHost(request(`${configuration.bindHost}:8449`), configuration, 8449), true);
  assert.equal(validHost(request("evil.example:8449"), configuration, 8449), false);
  assert.equal(
    validHost(
      {
        ...request(`${configuration.bindHost}:8449`),
        rawHeaders: ["Host", `${configuration.bindHost}:8449`, "Host", "evil.example"],
      },
      configuration,
      8449,
    ),
    false,
  );
  assert.equal(validTarget("https://evil.example/private"), false);
  assert.equal(validTarget("//evil.example/private"), false);
  assert.equal(validTarget("/\\evil.example/private"), false);
  assert.equal(validTarget("/player?block=synthetic"), true);
  const headers = proxyHeaders(
    request(`${configuration.bindHost}:8449`, {
      cookie: "synthetic-cookie",
      authorization: "synthetic-authorization",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "http",
      "x-forwarded-for": "evil",
      "x-forwarded-prefix": "/evil",
      forwarded: "evil",
      connection: "keep-alive, x-remove",
      "x-remove": "discard",
      "proxy-authorization": "discard",
    }),
    configuration,
  );
  assert.equal(headers["x-forwarded-host"], `${configuration.bindHost}:8449`);
  assert.equal(headers["x-forwarded-proto"], "https");
  assert.equal(headers["x-forwarded-for"], "192.0.2.10");
  assert.equal(headers["x-forwarded-prefix"], undefined);
  assert.equal(headers["x-remove"], undefined);
  assert.equal(headers["proxy-authorization"], undefined);
  assert.equal(headers.cookie, "synthetic-cookie");
  assert.equal(headers.authorization, "synthetic-authorization");
  assert.deepEqual(
    secureResponseHeaders({ "set-cookie": ["wayfarer_account=synthetic; Path=/; HttpOnly; SameSite=Lax"] })[
      "set-cookie"
    ],
    ["wayfarer_account=synthetic; Path=/; HttpOnly; SameSite=Lax; Secure"],
  );
  assert.deepEqual(secureResponseHeaders({ "set-cookie": ["a=synthetic; sEcUrE; SameSite=None"] })["set-cookie"], [
    "a=synthetic; sEcUrE; SameSite=None",
  ]);
  assert.deepEqual(secureResponseHeaders({ location: "/player/sign-in" }), { location: "/player/sign-in" });
  assert.equal(bootstrapRoute("GET", "/public-ca.cer"), "certificate");
  assert.equal(bootstrapRoute("GET", "/public-ca.mobileconfig"), "profile");
  assert.equal(bootstrapRoute("HEAD", "/public-ca.cer"), "certificate");
  for (const target of [
    "/server.key.pem",
    "/ca.key.pem",
    "/server.config.json",
    "/../server.key.pem",
    "/%2e%2e/server.key.pem",
    "/player",
    "/api/auth/session",
    "/public-ca.cer?file=key",
  ])
    assert.equal(bootstrapRoute("GET", target), null);
  assert.equal(bootstrapRoute("POST", "/public-ca.cer"), null);
  assert.equal(
    websocketAllowed(
      {
        ...request(`${configuration.bindHost}:8449`, { origin: configuration.publicOrigin, upgrade: "websocket" }),
        url: "/_next/webpack-hmr",
      },
      configuration,
    ),
    true,
  );
  assert.equal(
    websocketAllowed(
      {
        ...request(`${configuration.bindHost}:8449`, { origin: "https://evil.example", upgrade: "websocket" }),
        url: "/_next/webpack-hmr",
      },
      configuration,
    ),
    false,
  );
  assert.equal(
    websocketAllowed(
      {
        ...request(`${configuration.bindHost}:8449`, { origin: configuration.publicOrigin, upgrade: "websocket" }),
        url: "/api/auth/session",
      },
      configuration,
    ),
    false,
  );
  process.stdout.write(
    "NCL01_PREVIEW_SELF_TEST_PASS: TLS identity and 33 bounded proxy/bootstrap assertions; no listeners started.\n",
  );
} else if (process.argv.includes("--check")) {
  process.stdout.write(
    JSON.stringify({
      status: "READY_NOT_LISTENING",
      publicOrigin: configuration.publicOrigin,
      caSha256: configuration.caSha256,
      caValidUntil: material.validUntil,
    }) + "\n",
  );
} else {
  const instanceId = randomUUID(),
    servers = [],
    sockets = new Set(),
    upstreamRequests = new Set();
  let stopping = false;
  const record = {
    owner: purpose,
    configId: configuration.configId,
    instanceId,
    pid: process.pid,
    scriptPath,
    startedAt: new Date().toISOString(),
    publicOrigin: configuration.publicOrigin,
    bootstrap: process.argv.includes("--bootstrap"),
  };
  if (fs.existsSync(recordPath)) {
    const old = JSON.parse(ownedFile("https-process.json"));
    if (
      old.owner !== purpose ||
      old.configId !== configuration.configId ||
      old.scriptPath !== scriptPath ||
      !Number.isSafeInteger(old.pid) ||
      old.pid < 1
    )
      throw new Error("NCL01_PROCESS_RECORD_UNOWNED");
    let alive = true;
    try {
      process.kill(old.pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") alive = false;
    }
    if (alive) throw new Error("NCL01_PREVIEW_ALREADY_RUNNING");
    fs.unlinkSync(recordPath);
  }
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  const removeOwnRecord = () => {
    try {
      const current = JSON.parse(fs.readFileSync(recordPath));
      if (current.instanceId === instanceId && current.pid === process.pid) fs.unlinkSync(recordPath);
    } catch {}
  };
  const stop = (code = 0) => {
    if (stopping) return;
    stopping = true;
    for (const server of servers) server.close();
    for (const request of upstreamRequests) request.destroy();
    for (const socket of sockets) socket.destroy();
    removeOwnRecord();
    process.exitCode = code;
  };
  process.once("SIGTERM", () => stop());
  process.once("SIGINT", () => stop());
  process.once("exit", removeOwnRecord);
  const trackSocket = (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => {});
  };
  const bounded = (server) => {
    servers.push(server);
    server.maxHeadersCount = 64;
    server.headersTimeout = 10000;
    server.requestTimeout = 60000;
    server.keepAliveTimeout = 5000;
    server.on("connection", trackSocket);
    server.on("clientError", (_, socket) => {
      if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
      else socket.destroy();
    });
    server.on("error", (error) => {
      logCode(error.code);
      stop(1);
    });
    return server;
  };
  const proxy = bounded(
    https.createServer(
      { key: material.key, cert: material.cert, ca: material.caPem, minVersion: "TLSv1.2", maxHeaderSize: 16384 },
      (request, response) => {
        if (!validHost(request, configuration, 8449) || !validTarget(request.url) || request.method === "CONNECT") {
          request.resume();
          reject(response, 400);
          return;
        }
        const upstream = http.request(
          {
            hostname: "127.0.0.1",
            port: 3149,
            method: request.method,
            path: request.url,
            headers: proxyHeaders(request, configuration),
            maxHeaderSize: 16384,
          },
          (incoming) => {
            response.writeHead(incoming.statusCode ?? 502, secureResponseHeaders(incoming.headers));
            incoming.pipe(response);
            incoming.on("error", () => response.destroy());
          },
        );
        upstreamRequests.add(upstream);
        upstream.once("close", () => upstreamRequests.delete(upstream));
        upstream.setTimeout(120000, () => upstream.destroy(new Error("NCL01_UPSTREAM_TIMEOUT")));
        upstream.on("error", (error) => {
          logCode(error.code);
          if (!response.headersSent) reject(response, 502);
          else response.destroy();
        });
        let bodyBytes = 0;
        request.on("data", (block) => {
          bodyBytes += block.length;
          if (bodyBytes > 32 * 1024 * 1024) {
            upstream.destroy();
            if (!response.headersSent) reject(response, 413);
            request.destroy();
          }
        });
        request.on("aborted", () => upstream.destroy());
        response.on("close", () => {
          if (!response.writableFinished) upstream.destroy();
        });
        request.pipe(upstream);
      },
    ),
  );
  proxy.on("upgrade", (request, client, head) => {
    if (!websocketAllowed(request, configuration) || head.length > 16384) {
      client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const upstream = http.request({
      hostname: "127.0.0.1",
      port: 3149,
      method: "GET",
      path: request.url,
      headers: proxyHeaders(request, configuration, true),
      maxHeaderSize: 16384,
    });
    upstreamRequests.add(upstream);
    upstream.once("close", () => upstreamRequests.delete(upstream));
    upstream.setTimeout(120000, () => upstream.destroy());
    upstream.on("upgrade", (incoming, remote, remoteHead) => {
      trackSocket(remote);
      remote.setTimeout(120000, () => remote.destroy());
      const allowed = new Set([
        "upgrade",
        "connection",
        "sec-websocket-accept",
        "sec-websocket-protocol",
        "sec-websocket-extensions",
      ]);
      const responseHeaders = Object.entries(incoming.headers)
        .filter(([name]) => allowed.has(name))
        .map(([name, value]) => `${name}: ${value}`)
        .join("\r\n");
      client.write(`HTTP/1.1 101 Switching Protocols\r\n${responseHeaders}\r\n\r\n`);
      if (head.length) remote.write(head);
      if (remoteHead.length) client.write(remoteHead);
      client.pipe(remote).pipe(client);
      client.once("close", () => remote.destroy());
      remote.once("close", () => client.destroy());
    });
    upstream.on("response", (incoming) => {
      incoming.resume();
      client.end("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n");
    });
    upstream.on("error", () => client.destroy());
    upstream.end();
  });
  proxy.on("connect", (_, socket) => socket.end("HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n"));
  proxy.listen(8449, configuration.bindHost, () =>
    process.stdout.write(`NCL01_HTTPS_LISTENING ${configuration.publicOrigin}\n`),
  );
  if (process.argv.includes("--bootstrap")) {
    const help = Buffer.from(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NCL-01 laptop preview certificate</title><h1>NCL-01 laptop preview</h1><p>This HTTP endpoint serves only this laptop's public seven-day test CA and certificate profile. Open the app at <a href="${configuration.publicOrigin}">${configuration.publicOrigin}</a>.</p><p><a href="/public-ca.mobileconfig">Download the test certificate profile</a> or <a href="/public-ca.cer">download the public CA certificate</a>. Installation and TLS trust are separate manual owner actions. Remove the profile after testing.</p><p>CA SHA-256: <code>${configuration.caSha256}</code></p><p><a href="https://support.apple.com/en-us/102390">Apple's instructions for manually trusting an installed test certificate</a>.</p>`,
    );
    const bootstrap = bounded(
      http.createServer({ maxHeaderSize: 8192 }, (request, response) => {
        if (!validHost(request, configuration, 8448)) {
          request.resume();
          reject(response, 400);
          return;
        }
        const route = bootstrapRoute(request.method, request.url);
        if (!route) {
          request.resume();
          reject(response, 404);
          return;
        }
        const body = route === "certificate" ? material.caDer : route === "profile" ? material.profile : help;
        response.writeHead(200, {
          "content-type":
            route === "certificate"
              ? "application/pkix-cert"
              : route === "profile"
                ? "application/x-apple-aspen-config"
                : "text/html; charset=utf-8",
          "content-length": body.length,
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          "referrer-policy": "no-referrer",
        });
        response.end(request.method === "HEAD" ? undefined : body);
      }),
    );
    bootstrap.on("upgrade", (_, socket) => socket.destroy());
    bootstrap.on("connect", (_, socket) => socket.destroy());
    bootstrap.listen(8448, configuration.bindHost, () =>
      process.stdout.write(`NCL01_PUBLIC_CA_BOOTSTRAP_LISTENING http://${configuration.bindHost}:8448\n`),
    );
  }
}
