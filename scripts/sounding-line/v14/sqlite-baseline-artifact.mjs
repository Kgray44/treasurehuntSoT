/* Certified immutable SQLite baseline identity and content verification. */
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
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
async function orderedMigrationDigest(root) {
  const migrations = path.join(root, "prisma", "migrations");
  const entries = await readdir(migrations, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath ?? migrations, entry.name))
    .sort((left, right) => left.localeCompare(right));
  return digest(
    await Promise.all(
      files.map(async (file) => ({
        path: path.relative(migrations, file).replaceAll("\\", "/"),
        digest: await sha256(file),
      })),
    ),
  );
}

export async function sqliteBaselineInputs(root) {
  const [sqliteSchemaDigest, migrations, seedDigest, isolationDigest, lockfileDigest, prismaPackage, policy] =
    await Promise.all([
      sha256(path.join(root, "prisma", "schema.sqlite.prisma")),
      orderedMigrationDigest(root),
      sha256(path.join(root, "prisma", "seed.ts")),
      sha256(path.join(root, "scripts", "prepare-validation-isolation.ts")),
      sha256(path.join(root, "package-lock.json")),
      readFile(path.join(root, "node_modules", "prisma", "package.json"), "utf8"),
      readFile(path.join(root, "testing", "prepared-artifacts.json"), "utf8"),
    ]);
  return {
    sqliteSchemaDigest,
    orderedMigrationDigest: migrations,
    fixtureBuilderDigest: digest({ seedDigest, isolationDigest }),
    fixtureVersion: "sounding-line-isolated-validation-runtime-v1",
    baselineCertificationPolicyDigest: digest(
      JSON.parse(policy).layers.find((layer) => layer.id === "sqlite-baseline"),
    ),
    seedDigest,
    isolationDigest,
    lockfileDigest,
    prismaVersion: JSON.parse(prismaPackage).version,
    os: process.platform,
    architecture: process.arch,
  };
}

export async function sqliteBaselineCacheIdentity(root) {
  const inputs = await sqliteBaselineInputs(root);
  const identityDigest = digest({ version: 1, layerType: "sqlite-baseline", inputs });
  return {
    key: `sounding-line-sqlite-baseline-v1-${identityDigest}`,
    producer: `protected-authoritative-workflow:sqlite-baseline:${identityDigest}`,
    inputs,
  };
}

export async function createSqliteBaselineManifest({ root, sourceDirectory, producer, expiresAt }) {
  if (!producer || !expiresAt) throw new Error("SQLITE_BASELINE_PUBLISH_IDENTITY_REQUIRED");
  const identity = await sqliteBaselineCacheIdentity(root);
  return createTypedPreparedLayerManifest({
    layerType: "sqlite-baseline",
    sourceInputs: identity.inputs,
    contentManifest: await contentManifestFromDirectory(sourceDirectory),
    producer,
    platform: { os: process.platform, architecture: process.arch },
    policyDigest: identity.inputs.baselineCertificationPolicyDigest,
    securityScan: { status: "CLEAN", scope: "certified-immutable-sqlite-baseline" },
    retentionClass: "workflow-artifact-immutable",
    retentionState: { expiresAt },
    consumerConstraints: { os: process.platform, architecture: process.arch },
  });
}

export async function verifySqliteBaseline({ root, sourceDirectory, manifest }) {
  const identity = await sqliteBaselineCacheIdentity(root);
  if (
    process.env.SOUNDING_LINE_SQLITE_BASELINE_CACHE_KEY &&
    process.env.SOUNDING_LINE_SQLITE_BASELINE_CACHE_KEY !== identity.key
  )
    throw new Error("SQLITE_BASELINE_CACHE_KEY_MISMATCH");
  const contentManifest = await contentManifestFromDirectory(sourceDirectory);
  if (contentManifest.length !== 1 || contentManifest[0].path !== "validation.db")
    throw new Error("SQLITE_BASELINE_CONTENT_INVALID");
  const integrity = verifyPreparedLayerManifest(manifest, contentManifest);
  if (!integrity.valid) throw new Error(`SQLITE_BASELINE_REJECTED:${integrity.reason}`);
  const trust = validateLayerConsumption(manifest, {
    trustedProducers: [identity.producer],
    platform: { os: process.platform, architecture: process.arch },
  });
  if (!trust.valid) throw new Error(`SQLITE_BASELINE_REJECTED:${trust.code}`);
  const expected = createTypedPreparedLayerManifest({
    layerType: "sqlite-baseline",
    sourceInputs: identity.inputs,
    contentManifest,
    producer: manifest.producer,
    platform: manifest.platform,
    policyDigest: identity.inputs.baselineCertificationPolicyDigest,
    securityScan: manifest.securityScan,
    retentionClass: manifest.retentionClass,
    retentionState: manifest.retentionState,
    revocationState: manifest.revocationState,
    consumerConstraints: manifest.consumerConstraints,
    createdAt: manifest.createdAt,
  });
  if (expected.identityDigest !== manifest.identityDigest) throw new Error("SQLITE_BASELINE_SOURCE_IDENTITY_MISMATCH");
  return { identityDigest: manifest.identityDigest, fileCount: contentManifest.length };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const root = path.resolve(valueFor(args, "--root") ?? process.cwd());
  const sourceDirectory = path.resolve(root, valueFor(args, "--source") ?? "sounding-line-sqlite-baseline");
  const manifestPath = valueFor(args, "--manifest");
  if (command === "cache-key") {
    process.stdout.write(`${JSON.stringify(await sqliteBaselineCacheIdentity(root))}\n`);
    return;
  }
  if (command === "publish") {
    if (!manifestPath) throw new Error("SQLITE_BASELINE_MANIFEST_PATH_REQUIRED");
    const manifest = await createSqliteBaselineManifest({
      root,
      sourceDirectory,
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
    if (!manifestPath) throw new Error("SQLITE_BASELINE_MANIFEST_PATH_REQUIRED");
    const manifest = JSON.parse(await readFile(path.resolve(root, manifestPath), "utf8"));
    process.stdout.write(`${JSON.stringify(await verifySqliteBaseline({ root, sourceDirectory, manifest }))}\n`);
    return;
  }
  throw new Error("SQLITE_BASELINE_COMMAND_INVALID");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
