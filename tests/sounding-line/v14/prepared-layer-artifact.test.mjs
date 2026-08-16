import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  createDependencyLayerManifest,
  dependencyLayerCacheIdentity,
  verifyDependencyLayer,
} from "../../../scripts/sounding-line/v14/prepared-layer-artifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const exec = promisify(execFile);

test("workflow dependency layers bind source inputs and rehash every transferred byte", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "sounding-line-layer-"));
  await writeFile(path.join(fixture, "module.js"), "export const immutable = true;\n", "utf8");
  const previous = process.env.SOUNDING_LINE_NPM_VERSION;
  const producer = `protected-authoritative-workflow:${process.env.GITHUB_RUN_ID ?? "test-run"}`;
  process.env.SOUNDING_LINE_NPM_VERSION = "test-npm";
  try {
    const manifest = await createDependencyLayerManifest({
      root,
      sourceDirectory: fixture,
      producer,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    const verified = await verifyDependencyLayer({ root, sourceDirectory: fixture, manifest });
    assert.equal(verified.identityDigest, manifest.identityDigest);
    await writeFile(path.join(fixture, "module.js"), "export const immutable = false;\n", "utf8");
    await assert.rejects(
      () => verifyDependencyLayer({ root, sourceDirectory: fixture, manifest }),
      /PREPARED_LAYER_REJECTED:.*LAYER_CONTENT_CORRUPT/u,
    );
  } finally {
    if (previous === undefined) delete process.env.SOUNDING_LINE_NPM_VERSION;
    else process.env.SOUNDING_LINE_NPM_VERSION = previous;
  }
});

test("digest-keyed dependency cache accepts only its exact immutable source identity", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "sounding-line-layer-cache-"));
  await writeFile(path.join(fixture, "module.js"), "export const cached = true;\n", "utf8");
  const previousNpm = process.env.SOUNDING_LINE_NPM_VERSION;
  const previousKey = process.env.SOUNDING_LINE_PREPARED_CACHE_KEY;
  process.env.SOUNDING_LINE_NPM_VERSION = "test-npm";
  try {
    const cache = await dependencyLayerCacheIdentity(root);
    const manifest = await createDependencyLayerManifest({
      root,
      sourceDirectory: fixture,
      producer: cache.producer,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    process.env.SOUNDING_LINE_PREPARED_CACHE_KEY = cache.key;
    await assert.doesNotReject(() => verifyDependencyLayer({ root, sourceDirectory: fixture, manifest }));
    process.env.SOUNDING_LINE_PREPARED_CACHE_KEY = `${cache.key}-wrong`;
    await assert.rejects(
      () => verifyDependencyLayer({ root, sourceDirectory: fixture, manifest }),
      /PREPARED_LAYER_CACHE_KEY_MISMATCH/u,
    );
  } finally {
    if (previousNpm === undefined) delete process.env.SOUNDING_LINE_NPM_VERSION;
    else process.env.SOUNDING_LINE_NPM_VERSION = previousNpm;
    if (previousKey === undefined) delete process.env.SOUNDING_LINE_PREPARED_CACHE_KEY;
    else process.env.SOUNDING_LINE_PREPARED_CACHE_KEY = previousKey;
  }
});

test("dependency cache identity is stable when warm and deterministically rotates for a changed toolchain input", async () => {
  const previous = process.env.SOUNDING_LINE_NPM_VERSION;
  try {
    process.env.SOUNDING_LINE_NPM_VERSION = "warm-npm";
    const warmFirst = await dependencyLayerCacheIdentity(root);
    const warmSecond = await dependencyLayerCacheIdentity(root);
    assert.deepEqual(warmSecond, warmFirst);
    process.env.SOUNDING_LINE_NPM_VERSION = "cold-npm";
    const cold = await dependencyLayerCacheIdentity(root);
    assert.notEqual(cold.key, warmFirst.key);
    assert.notEqual(cold.producer, warmFirst.producer);
  } finally {
    if (previous === undefined) delete process.env.SOUNDING_LINE_NPM_VERSION;
    else process.env.SOUNDING_LINE_NPM_VERSION = previous;
  }
});

test("cache-key resolves without a dependency manifest because it runs before cache restore and publication", async () => {
  const { stdout } = await exec(
    process.execPath,
    ["scripts/sounding-line/v14/prepared-layer-artifact.mjs", "cache-key"],
    {
      cwd: root,
      env: { ...process.env, SOUNDING_LINE_NPM_VERSION: "test-npm" },
    },
  );
  const cache = JSON.parse(stdout);
  assert.match(cache.key, /^sounding-line-dependency-v1-[0-9a-f]{64}$/u);
  assert.match(cache.producer, /^protected-authoritative-workflow:dependency-cache:[0-9a-f]{64}$/u);
});
