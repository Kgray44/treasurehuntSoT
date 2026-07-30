import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DurableController } from "../../scripts/sounding-line/phase4-controller.mjs";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const digests = {
  sourceDigest: hash("source"),
  policyDigest: hash("policy"),
  dependencyLockDigest: hash("lock"),
  environmentDigest: hash("environment"),
};
const worker = {
  workerId: "worker-a",
  hostId: "host-a",
  bootId: "boot-a",
  trustDomain: "LOCAL_TRUSTED",
  platform: process.platform,
  architecture: process.arch,
  nodeVersion: process.versions.node,
  executableDigest: hash(process.execPath),
  enrollmentId: "enroll-a",
  capabilities: { browser: ["chromium"], database: ["sqlite"], provider: ["local"] },
};

test("durable controller persists an allowlisted child-process execution and rejects replay", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-phase4-"));
  try {
    const statePath = path.join(root, "controller.json");
    const controller = await new DurableController({ statePath, cwd: process.cwd(), ...digests }).load();
    const registered = await controller.register(worker);
    const assignment = await controller.seal({
      workerId: registered.workerId,
      adapterId: "policy",
      node: {
        id: "policy",
        requirements: { trustDomain: "LOCAL_TRUSTED", platform: process.platform, architecture: process.arch },
      },
    });
    const completed = await controller.execute(assignment.digest);
    assert.equal(completed.assignment.status, "COMPLETE");
    assert.equal(completed.evidence.outcome, "PASS");
    await assert.rejects(() => controller.execute(assignment.digest), /NOT_SEALED/);
    const reloaded = await new DurableController({ statePath, cwd: process.cwd(), ...digests }).load();
    assert.equal(reloaded.snapshot().assignments[assignment.digest].status, "COMPLETE");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("drain, cancellation, revocation, and stale-worker recovery persist fail-closed state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-phase4-"));
  try {
    const controller = await new DurableController({
      statePath: path.join(root, "controller.json"),
      cwd: process.cwd(),
      ...digests,
    }).load();
    await controller.register(worker);
    await controller.drain(worker.workerId, "maintenance");
    assert.equal(controller.snapshot().workers[worker.workerId].state, "DRAINING");
    await controller.revoke(worker.workerId, "security-incident");
    assert.equal(controller.snapshot().workers[worker.workerId].state, "REVOKED");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
