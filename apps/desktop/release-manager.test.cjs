"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DirectoryArtifactStore, JsonReleaseStateStore, ReleaseManager } = require("./release-manager.cjs");

function manifestFor(buffer) {
  return {
    schemaVersion: 1,
    releaseVersion: "0.8.0-b6",
    channel: "development",
    publicationDate: "2026-07-18T12:00:00.000Z",
    platform: "win32",
    architecture: "x64",
    artifact: {
      location: "artifacts/Forever-Treasure-0.8.0-b6.exe",
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      size: buffer.length,
      authenticode: {
        required: false,
        status: "UNSIGNED_DEVELOPMENT",
        signerThumbprint: null,
        timestamped: false,
      },
    },
    minimumSupportedVersion: "0.7.0-b5",
    compatibility: {
      packageSchemas: [1],
      companionProtocols: ["2.0"],
      modelBundles: ["classical-local-v1"],
    },
    releaseNotes: ["Unsigned deterministic development fixture."],
    rollback: { eligible: true, targetVersion: "0.7.0-b5" },
    mandatory: false,
    source: { commit: "fa521c3", buildId: "build-b6-test", lockHash: "a".repeat(64) },
    manifestSignature: null,
  };
}

async function fixture(healthCheck = async () => ({ healthy: true })) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "forever-treasure-b6-update-"));
  const stateStore = new JsonReleaseStateStore(path.join(root, "state"));
  const artifactStore = new DirectoryArtifactStore(path.join(root, "releases"));
  const manager = new ReleaseManager({
    stateStore,
    artifactStore,
    healthCheck,
    allowUnsignedDevelopment: true,
    platform: "win32",
    architecture: "x64",
    clock: () => new Date("2026-07-18T12:00:00.000Z"),
  });
  return { root, stateStore, manager };
}

test("verified update stages and atomically activates without touching user projects", async (t) => {
  const { root, stateStore, manager } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const userData = path.join(root, "user-projects", "published-waypoint.json");
  await fs.mkdir(path.dirname(userData), { recursive: true });
  await fs.writeFile(userData, "immutable-user-data", "utf8");
  const buffer = Buffer.from("atomic update artifact");
  const staged = await manager.prepare(manifestFor(buffer), buffer, {
    installationId: "installation-test",
    channel: "development",
    currentVersion: "0.7.0-b5",
  });
  assert.equal(staged.phase, "STAGED");
  assert.equal((await fs.stat(staged.staged.artifactPath)).size, buffer.length);
  const completed = await manager.activate();
  assert.equal(completed.phase, "IDLE");
  assert.equal(completed.currentVersion, "0.8.0-b6");
  assert.equal(await fs.readFile(userData, "utf8"), "immutable-user-data");
  assert.equal((await stateStore.load()).lastHealthStatus, "HEALTHY");
});

test("failed health check and interrupted activation roll back to the previous version", async (t) => {
  const unhealthy = await fixture(async () => ({ healthy: false }));
  t.after(() => fs.rm(unhealthy.root, { recursive: true, force: true }));
  const buffer = Buffer.from("unhealthy update artifact");
  await unhealthy.manager.prepare(manifestFor(buffer), buffer, {
    installationId: "installation-unhealthy",
    channel: "development",
    currentVersion: "0.7.0-b5",
  });
  await assert.rejects(
    () => unhealthy.manager.activate(),
    (error) => error.code === "UPDATE_HEALTH_CHECK_FAILED",
  );
  const rolledBack = await unhealthy.stateStore.load();
  assert.equal(rolledBack.phase, "ROLLED_BACK");
  assert.equal(rolledBack.currentVersion, "0.7.0-b5");

  const interrupted = await fixture();
  t.after(() => fs.rm(interrupted.root, { recursive: true, force: true }));
  await interrupted.stateStore.save({
    schemaVersion: 1,
    installationId: "installation-interrupted",
    channel: "development",
    currentVersion: "0.7.0-b5",
    previousVersion: "0.7.0-b5",
    targetVersion: "0.8.0-b6",
    phase: "PENDING_HEALTH",
  });
  const recovered = await interrupted.manager.recoverInterruptedActivation();
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.state.phase, "ROLLED_BACK");
});

test("corrupt update and active story state fail before activation", async (t) => {
  const { root, manager } = await fixture();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const buffer = Buffer.from("expected artifact");
  await assert.rejects(
    () =>
      manager.prepare(manifestFor(buffer), Buffer.from("tampered"), {
        installationId: "installation-corrupt",
        channel: "development",
        currentVersion: "0.7.0-b5",
      }),
    (error) => ["UPDATE_SIZE_MISMATCH", "UPDATE_HASH_MISMATCH"].includes(error.code),
  );
  await assert.rejects(
    () =>
      manager.prepare(manifestFor(buffer), buffer, {
        installationId: "installation-active",
        channel: "development",
        currentVersion: "0.7.0-b5",
        activeStoryCriticalPresentation: true,
      }),
    (error) => error.code === "UPDATE_ACTIVE_SESSION",
  );
});
