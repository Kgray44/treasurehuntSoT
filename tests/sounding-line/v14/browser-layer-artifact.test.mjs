import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  browserLayerCacheIdentity,
  createBrowserLayerManifest,
  verifyBrowserLayer,
} from "../../../scripts/sounding-line/v14/browser-layer-artifact.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-browser-layer-"));
  await Promise.all([
    mkdir(path.join(root, "node_modules", "@playwright", "test"), { recursive: true }),
    mkdir(path.join(root, "node_modules", "playwright-core"), { recursive: true }),
    mkdir(path.join(root, "browser-layer"), { recursive: true }),
    mkdir(path.join(root, "testing"), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(path.join(root, "package-lock.json"), "lock-v1\n"),
    writeFile(path.join(root, "node_modules", "@playwright", "test", "package.json"), '{"version":"1.56.1"}\n'),
    writeFile(path.join(root, "node_modules", "playwright-core", "browsers.json"), '{"browsers":["chromium-1"]}\n'),
    writeFile(path.join(root, "browser-layer", "chromium.bin"), "certified-browser-content\n"),
    writeFile(
      path.join(root, "testing", "prepared-artifacts.json"),
      JSON.stringify({ layers: [{ id: "browser-chromium" }, { id: "browser-webkit" }] }),
    ),
  ]);
  return root;
}

test("browser layer binds its browser revision and fails closed on a mixed-engine request", async () => {
  const root = await fixture();
  try {
    const chromium = await browserLayerCacheIdentity(root, ["chromium"]);
    await assert.rejects(browserLayerCacheIdentity(root, ["chromium", "webkit"]), /BROWSER_LAYER_ENGINES_INVALID/);
    await writeFile(
      path.join(root, "node_modules", "playwright-core", "browsers.json"),
      '{"browsers":["chromium-2"]}\n',
    );
    assert.notEqual(chromium.key, (await browserLayerCacheIdentity(root, ["chromium"])).key);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("browser layer rejects corrupt content and source identity drift", async () => {
  const root = await fixture();
  const priorKey = process.env.SOUNDING_LINE_BROWSER_CACHE_KEY;
  try {
    const identity = await browserLayerCacheIdentity(root, ["chromium"]);
    const manifest = await createBrowserLayerManifest({
      root,
      sourceDirectory: path.join(root, "browser-layer"),
      engines: ["chromium"],
      producer: identity.producer,
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    process.env.SOUNDING_LINE_BROWSER_CACHE_KEY = identity.key;
    await verifyBrowserLayer({
      root,
      sourceDirectory: path.join(root, "browser-layer"),
      engines: ["chromium"],
      manifest,
    });
    await writeFile(path.join(root, "browser-layer", "chromium.bin"), "corrupt\n");
    await assert.rejects(
      verifyBrowserLayer({ root, sourceDirectory: path.join(root, "browser-layer"), engines: ["chromium"], manifest }),
      /BROWSER_LAYER_REJECTED/,
    );
  } finally {
    if (priorKey === undefined) delete process.env.SOUNDING_LINE_BROWSER_CACHE_KEY;
    else process.env.SOUNDING_LINE_BROWSER_CACHE_KEY = priorKey;
    await rm(root, { recursive: true, force: true });
  }
});
