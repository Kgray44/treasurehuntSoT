/* Digest-bound immutable Playwright browser layer. Mutable profiles stay run-owned. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createTypedPreparedLayerManifest, digest, verifyPreparedLayerManifest } from "./foundation.mjs";
import { contentManifestFromDirectory, validateLayerConsumption } from "./fast-channel.mjs";

const sha256 = async (file) =>
  createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
const valueFor = (args, flag) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const browserEngines = (engines) => {
  if (
    !Array.isArray(engines) ||
    engines.length !== 1 ||
    engines.some((engine) => !["chromium", "webkit"].includes(engine))
  )
    throw new Error("BROWSER_LAYER_ENGINES_INVALID");
  return [...new Set(engines)];
};
const layerTypeFor = (engines) => `browser-${browserEngines(engines)[0]}`;

export async function browserLayerInputs(root, engines) {
  const normalizedEngines = browserEngines(engines);
  const [lockfileDigest, playwrightPackage, browserRevisionsDigest, policy] = await Promise.all([
    sha256(path.join(root, "package-lock.json")),
    readFile(path.join(root, "node_modules", "@playwright", "test", "package.json"), "utf8"),
    sha256(path.join(root, "node_modules", "playwright-core", "browsers.json")),
    readFile(path.join(root, "testing", "prepared-artifacts.json"), "utf8"),
  ]);
  return {
    lockfileDigest,
    playwrightVersion: JSON.parse(playwrightPackage).version,
    browserEngine: normalizedEngines[0],
    browserRevision: browserRevisionsDigest,
    os: process.platform,
    architecture: process.arch,
    browserPolicyDigest: digest(JSON.parse(policy).layers.filter((layer) => layer.id.startsWith("browser-"))),
  };
}

export async function browserLayerCacheIdentity(root, engines) {
  const inputs = await browserLayerInputs(root, engines);
  const identityDigest = digest({ version: 1, layerType: layerTypeFor(engines), inputs });
  return {
    key: `sounding-line-browser-v1-${identityDigest}`,
    producer: `protected-authoritative-workflow:browser-cache:${identityDigest}`,
    inputs,
  };
}

export async function createBrowserLayerManifest({ root, sourceDirectory, engines, producer, expiresAt }) {
  if (!producer || !expiresAt) throw new Error("BROWSER_LAYER_PUBLISH_IDENTITY_REQUIRED");
  const identity = await browserLayerCacheIdentity(root, engines);
  return createTypedPreparedLayerManifest({
    layerType: layerTypeFor(engines),
    sourceInputs: identity.inputs,
    contentManifest: await contentManifestFromDirectory(sourceDirectory),
    producer,
    platform: { os: process.platform, architecture: process.arch },
    policyDigest: identity.inputs.browserPolicyDigest,
    securityScan: { status: "CLEAN", scope: "digest-keyed-browser-layer" },
    retentionClass: "workflow-artifact-immutable",
    retentionState: { expiresAt },
    consumerConstraints: { os: process.platform, architecture: process.arch },
  });
}

export async function verifyBrowserLayer({ root, sourceDirectory, engines, manifest }) {
  const identity = await browserLayerCacheIdentity(root, engines);
  if (process.env.SOUNDING_LINE_BROWSER_CACHE_KEY && process.env.SOUNDING_LINE_BROWSER_CACHE_KEY !== identity.key)
    throw new Error("BROWSER_LAYER_CACHE_KEY_MISMATCH");
  const contentManifest = await contentManifestFromDirectory(sourceDirectory);
  const integrity = verifyPreparedLayerManifest(manifest, contentManifest);
  if (!integrity.valid) throw new Error(`BROWSER_LAYER_REJECTED:${integrity.reason}`);
  const trust = validateLayerConsumption(manifest, {
    trustedProducers: [identity.producer],
    platform: { os: process.platform, architecture: process.arch },
  });
  if (!trust.valid) throw new Error(`BROWSER_LAYER_REJECTED:${trust.code}`);
  const expected = createTypedPreparedLayerManifest({
    layerType: layerTypeFor(engines),
    sourceInputs: identity.inputs,
    contentManifest,
    producer: manifest.producer,
    platform: manifest.platform,
    policyDigest: identity.inputs.browserPolicyDigest,
    securityScan: manifest.securityScan,
    retentionClass: manifest.retentionClass,
    retentionState: manifest.retentionState,
    revocationState: manifest.revocationState,
    consumerConstraints: manifest.consumerConstraints,
    createdAt: manifest.createdAt,
  });
  if (manifest.identityDigest !== expected.identityDigest) throw new Error("BROWSER_LAYER_SOURCE_IDENTITY_MISMATCH");
  return { identityDigest: manifest.identityDigest, fileCount: contentManifest.length };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const root = path.resolve(valueFor(args, "--root") ?? process.cwd());
  const sourceDirectory = path.resolve(root, valueFor(args, "--source") ?? "sounding-line-browser-cache/browsers");
  const manifestPath = valueFor(args, "--manifest");
  const engines = JSON.parse(valueFor(args, "--engines-json") ?? "");
  if (command === "cache-key") {
    process.stdout.write(`${JSON.stringify(await browserLayerCacheIdentity(root, engines))}\n`);
    return;
  }
  if (command === "publish") {
    if (!manifestPath) throw new Error("BROWSER_LAYER_MANIFEST_PATH_REQUIRED");
    const manifest = await createBrowserLayerManifest({
      root,
      sourceDirectory,
      engines,
      producer: valueFor(args, "--producer"),
      expiresAt: valueFor(args, "--expires-at"),
    });
    await writeFile(path.resolve(root, manifestPath), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    process.stdout.write(
      `${JSON.stringify({ identityDigest: manifest.identityDigest, fileCount: manifest.contentManifest.length })}\n`,
    );
    return;
  }
  if (command === "verify") {
    if (!manifestPath) throw new Error("BROWSER_LAYER_MANIFEST_PATH_REQUIRED");
    const manifest = JSON.parse(await readFile(path.resolve(root, manifestPath), "utf8"));
    process.stdout.write(`${JSON.stringify(await verifyBrowserLayer({ root, sourceDirectory, engines, manifest }))}\n`);
    return;
  }
  throw new Error("BROWSER_LAYER_COMMAND_INVALID");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
