/* Measured local filesystem prototype for immutable prepared-layer transport. */
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPreparedLayerManifest, verifyPreparedLayerManifest } from "./foundation.mjs";

const now = () => performance.now();
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fileManifest(sourcePath) {
  const source = await stat(sourcePath);
  if (source.isFile())
    return [{ path: path.basename(sourcePath), digest: hash(await readFile(sourcePath)), bytes: source.size }];
  const entries = [];
  async function walk(current, relative = "") {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      const nextRelative = path.join(relative, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) await walk(next, nextRelative);
      else if (entry.isFile()) {
        const details = await stat(next);
        entries.push({ path: nextRelative, digest: hash(await readFile(next)), bytes: details.size });
      }
    }
  }
  await walk(sourcePath);
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
async function copySource(source, destination) {
  const details = await stat(source);
  if (details.isFile()) {
    await mkdir(destination, { recursive: true });
    await cp(source, path.join(destination, path.basename(source)), { force: true });
    return;
  }
  await cp(source, destination, { recursive: true, force: true });
}

export async function benchmarkPreparedLayers({ root, createdAt = new Date().toISOString() }) {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "sounding-line-v14-layer-"));
  const layers = [
    {
      layerType: "dependency",
      source: path.join(root, "package-lock.json"),
      sourceInputs: { packageLock: "package-lock.json", nodeVersionFile: ".node-version", installPolicy: "npm-ci" },
    },
    {
      layerType: "prisma-generated",
      source: path.join(root, "prisma"),
      sourceInputs: { schema: "prisma/schema.prisma", migrations: "prisma/migrations", generator: "prisma" },
    },
  ];
  try {
    const results = [];
    for (const layer of layers) {
      const normalTarget = path.join(workspace, `${layer.layerType}-normal`);
      const preparedTarget = path.join(workspace, `${layer.layerType}-prepared`);
      const restoreTarget = path.join(workspace, `${layer.layerType}-restore`);
      let started = now();
      await copySource(layer.source, normalTarget);
      const normalPreparationMs = now() - started;
      started = now();
      const contentManifest = await fileManifest(layer.source);
      await copySource(layer.source, preparedTarget);
      const manifest = createPreparedLayerManifest({
        layerType: layer.layerType,
        sourceInputs: layer.sourceInputs,
        contentManifest,
        producer: "local-filesystem-prototype",
        platform: { os: process.platform, arch: process.arch },
        createdAt,
      });
      const preparedCreationMs = now() - started;
      started = now();
      await copySource(preparedTarget, restoreTarget);
      const preparedRestoreMs = now() - started;
      started = now();
      const observed = await fileManifest(restoreTarget);
      const verification = verifyPreparedLayerManifest(manifest, observed);
      const verificationMs = now() - started;
      results.push({
        layerType: layer.layerType,
        transport: "local-filesystem-copy",
        normalPreparationMs,
        preparedCreationMs,
        preparedRestoreMs,
        verificationMs,
        contentFiles: contentManifest.length,
        contentBytes: contentManifest.reduce((sum, entry) => sum + entry.bytes, 0),
        verification,
      });
    }
    return {
      version: 1,
      authorityBoundary: "SHADOW_OPTIONAL_ADDITIVE_NONAUTHORITATIVE",
      methodology:
        "Local filesystem copy microprototype. It measures identity, copy, and verification only; it does not claim npm ci, GitHub cache, compression, artifact-transfer, or hosted-runner improvement.",
      results,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outIndex = process.argv.indexOf("--out");
  const report = await benchmarkPreparedLayers({ root: process.cwd() });
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outIndex >= 0) await writeFile(path.resolve(process.argv[outIndex + 1]), serialized, "utf8");
  process.stdout.write(serialized);
}
