import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createDependencyLayerManifest,
  verifyDependencyLayer,
} from "../../../scripts/sounding-line/v14/prepared-layer-artifact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("workflow dependency layers bind source inputs and rehash every transferred byte", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "sounding-line-layer-"));
  await writeFile(path.join(fixture, "module.js"), "export const immutable = true;\n", "utf8");
  const previous = process.env.SOUNDING_LINE_NPM_VERSION;
  process.env.SOUNDING_LINE_NPM_VERSION = "test-npm";
  try {
    const manifest = await createDependencyLayerManifest({
      root,
      sourceDirectory: fixture,
      producer: "protected-authoritative-workflow:test-run",
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
