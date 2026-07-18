"use strict";

const assert = require("node:assert/strict");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { StructuredCompanionLogger, parseAllowedOrigins } = require("./companion-coordinator.cjs");

test("origin configuration remains exact and never accepts wildcard or credentialed URLs", () => {
  assert.deepEqual(
    parseAllowedOrigins(
      "https://example.test,*,https://user:password@example.test,http://127.0.0.1:3000/path,http://localhost:3000",
      ["http://127.0.0.1:32178"],
    ),
    ["http://127.0.0.1:32178", "https://example.test", "http://localhost:3000"],
  );
});

test("structured Companion logs retain correlation fields but omit secrets, pixels, and titles", async (t) => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b2-log-"));
  t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const logger = new StructuredCompanionLogger(directory);
  await logger.initialize();
  logger.write({
    event: "pairing_completed",
    level: "INFO",
    pairingId: "pairing_12345678",
    allowedOrigin: "https://example.test",
    pairingCode: "123456",
    secret: "do-not-log",
    pixels: Buffer.from("raw-frame"),
    windowTitle: "personal title",
  });
  await logger.pending;
  const entry = JSON.parse((await fsp.readFile(logger.logPath, "utf8")).trim());
  assert.equal(entry.pairingId, "pairing_12345678");
  assert.equal(entry.allowedOrigin, "https://example.test");
  assert.equal("pairingCode" in entry, false);
  assert.equal("secret" in entry, false);
  assert.equal("pixels" in entry, false);
  assert.equal("windowTitle" in entry, false);
});
