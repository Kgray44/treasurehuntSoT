import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertSafeRootMaintenanceArtifactPath,
  readSealedRootMaintenanceArtifact,
} from "../../../scripts/sounding-line/root-maintenance-artifact.mjs";

const validPlan = { authority: "SOUNDING_LINE_ROOT_MAINTENANCE", candidateSha: "a".repeat(40) };
const validFinalization = { authority: "SOUNDING_LINE_ROOT_MAINTENANCE_FINALIZER", decision: "ROOT_MAINTENANCE_GO" };

async function artifactRoot() {
  return mkdtemp(path.join(os.tmpdir(), "root-maintenance-artifact-"));
}

async function writeSealed(root, relative = "") {
  const directory = path.join(root, relative);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, "root-maintenance-plan.json"), JSON.stringify(validPlan)),
    writeFile(path.join(directory, "root-maintenance-finalization.json"), JSON.stringify(validFinalization)),
  ]);
}

test("Root Maintenance qualification artifact handshake accepts root and real hosted nested layouts", async () => {
  const root = await artifactRoot();
  await writeSealed(root);
  const atRoot = await readSealedRootMaintenanceArtifact(root);
  assert.deepEqual(atRoot.plan, validPlan);

  const nested = await artifactRoot();
  await writeSealed(nested, "_temp/sounding-line-root-maintenance-32542951448-1");
  await assert.rejects(readFile(path.join(nested, "root-maintenance-plan.json"), "utf8"), /ENOENT/u);
  const hosted = await readSealedRootMaintenanceArtifact(nested);
  assert.deepEqual(hosted.finalization, validFinalization);
  assert.match(hosted.files["root-maintenance-plan.json"], /sounding-line-root-maintenance-32542951448-1/u);
});

test("Root Maintenance artifact discovery fails closed for missing, duplicate, and malformed sealed files", async () => {
  const missing = await artifactRoot();
  await assert.rejects(readSealedRootMaintenanceArtifact(missing), /ROOT_MAINTENANCE_ARTIFACT_REQUIRED_FILE_MISSING:root-maintenance-plan\.json/u);

  const duplicate = await artifactRoot();
  await writeSealed(duplicate, "first");
  await writeSealed(duplicate, "second");
  await assert.rejects(readSealedRootMaintenanceArtifact(duplicate), /ROOT_MAINTENANCE_ARTIFACT_REQUIRED_FILE_AMBIGUOUS:root-maintenance-plan\.json/u);

  const malformed = await artifactRoot();
  await writeSealed(malformed);
  await writeFile(path.join(malformed, "root-maintenance-finalization.json"), "not-json");
  await assert.rejects(readSealedRootMaintenanceArtifact(malformed), /ROOT_MAINTENANCE_ARTIFACT_JSON_INVALID:root-maintenance-finalization\.json/u);
});

test("Root Maintenance artifact discovery rejects traversal and symlink escapes", async (t) => {
  const root = await artifactRoot();
  const outside = await artifactRoot();
  await assert.rejects(assertSafeRootMaintenanceArtifactPath(root, path.join(root, "..", path.basename(outside))), /ROOT_MAINTENANCE_ARTIFACT_OUT_OF_ROOT/u);
  await writeSealed(outside);
  try {
    await symlink(outside, path.join(root, "escape"), "junction");
  } catch (error) {
    if (error?.code === "EPERM" || error?.code === "EACCES") {
      t.skip("Windows host does not permit test junction creation");
      return;
    }
    throw error;
  }
  await assert.rejects(readSealedRootMaintenanceArtifact(root), /ROOT_MAINTENANCE_ARTIFACT_SYMLINK_REJECTED/u);
});
