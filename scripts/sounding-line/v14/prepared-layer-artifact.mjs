#!/usr/bin/env node
/* Build and verify the workflow-scoped immutable dependency layer. */
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { createTypedPreparedLayerManifest, digest, verifyPreparedLayerManifest } from "./foundation.mjs";
import { contentManifestFromDirectory, validateLayerConsumption } from "./fast-channel.mjs";

const exec = promisify(execFile);
const sha256File = async (file) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const valueFor = (args, flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const dependencyContentManifest = async (sourceDirectory) =>
  (await contentManifestFromDirectory(sourceDirectory)).filter((entry) => !entry.path.startsWith(".prisma/"));

export async function dependencyLayerInputs(root) {
  const npmVersion =
    process.env.SOUNDING_LINE_NPM_VERSION ??
    (
      await exec(process.platform === "win32" ? "npm.cmd" : "npm", ["--version"], {
        cwd: root,
        shell: process.platform === "win32",
      })
    ).stdout.trim();
  const [packageJsonDigest, packageLockDigest, policy] = await Promise.all([
    sha256File(path.join(root, "package.json")),
    sha256File(path.join(root, "package-lock.json")),
    readFile(path.join(root, "testing", "prepared-artifacts.json"), "utf8"),
  ]);
  return {
    packageJsonDigest,
    packageLockDigest,
    nodeVersion: process.version,
    npmVersion,
    os: process.platform,
    architecture: process.arch,
    nativeDependencyClass: `${process.platform}-${process.arch}`,
    installPolicyDigest: digest(JSON.parse(policy)),
  };
}

export async function createDependencyLayerManifest({ root, sourceDirectory, producer, expiresAt }) {
  const [sourceInputs, contentManifest, policy] = await Promise.all([
    dependencyLayerInputs(root),
    dependencyContentManifest(sourceDirectory),
    readFile(path.join(root, "testing", "prepared-artifacts.json"), "utf8"),
  ]);
  return createTypedPreparedLayerManifest({
    layerType: "dependency",
    sourceInputs,
    contentManifest,
    producer,
    platform: { os: process.platform, architecture: process.arch },
    policyDigest: digest(JSON.parse(policy)),
    securityScan: { status: "CLEAN", scope: "workflow-scoped-published-layer" },
    retentionClass: "workflow-artifact-immutable",
    retentionState: { expiresAt },
    consumerConstraints: { os: process.platform, architecture: process.arch },
  });
}

export async function verifyDependencyLayer({ root, sourceDirectory, manifest }) {
  const [contentManifest, sourceInputs, policy] = await Promise.all([
    dependencyContentManifest(sourceDirectory),
    dependencyLayerInputs(root),
    readFile(path.join(root, "testing", "prepared-artifacts.json"), "utf8"),
  ]);
  const integrity = verifyPreparedLayerManifest(manifest, contentManifest);
  if (!integrity.valid) throw new Error(`PREPARED_LAYER_REJECTED:${integrity.reason}`);
  const expectedProducer =
    process.env.SOUNDING_LINE_PREPARED_PRODUCER ||
    (process.env.GITHUB_RUN_ID ? `protected-authoritative-workflow:${process.env.GITHUB_RUN_ID}` : manifest.producer);
  const consumption = validateLayerConsumption(manifest, {
    trustedProducers: [expectedProducer],
    platform: { os: process.platform, architecture: process.arch },
  });
  if (!consumption.valid) throw new Error(`PREPARED_LAYER_REJECTED:${consumption.code}`);
  const expectedIdentity = createTypedPreparedLayerManifest({
    layerType: "dependency",
    sourceInputs,
    contentManifest,
    producer: manifest.producer,
    platform: manifest.platform,
    policyDigest: digest(JSON.parse(policy)),
    securityScan: manifest.securityScan,
    retentionClass: manifest.retentionClass,
    retentionState: manifest.retentionState,
    revocationState: manifest.revocationState,
    consumerConstraints: manifest.consumerConstraints,
    createdAt: manifest.createdAt,
  });
  if (manifest.identityDigest !== expectedIdentity.identityDigest)
    throw new Error("PREPARED_LAYER_SOURCE_IDENTITY_MISMATCH");
  return { identityDigest: manifest.identityDigest, fileCount: contentManifest.length };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const root = path.resolve(valueFor(args, "--root") ?? process.cwd());
  const sourceDirectory = path.resolve(root, valueFor(args, "--source") ?? "node_modules");
  const manifestPath = valueFor(args, "--manifest");
  if (!manifestPath) throw new Error("PREPARED_LAYER_MANIFEST_PATH_REQUIRED");
  if (command === "publish") {
    const producer = valueFor(args, "--producer");
    const expiresAt = valueFor(args, "--expires-at");
    if (!producer || !expiresAt) throw new Error("PREPARED_LAYER_PUBLISH_IDENTITY_REQUIRED");
    const manifest = await createDependencyLayerManifest({ root, sourceDirectory, producer, expiresAt });
    await writeFile(path.resolve(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    process.stdout.write(
      `${JSON.stringify({ identityDigest: manifest.identityDigest, fileCount: manifest.contentManifest.length })}\n`,
    );
    return;
  }
  if (command === "verify") {
    const manifest = JSON.parse(await readFile(path.resolve(root, manifestPath), "utf8"));
    process.stdout.write(`${JSON.stringify(await verifyDependencyLayer({ root, sourceDirectory, manifest }))}\n`);
    return;
  }
  throw new Error("PREPARED_LAYER_COMMAND_INVALID");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
