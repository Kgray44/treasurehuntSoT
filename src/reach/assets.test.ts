// @sounding-line-registration owner=reach suite=unit.reach contracts=reach.phase1.foundation
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { handModel } from "@/watchglass/hand-provider";
it("binds local model/runtime bytes to pinned license and provenance", () => {
  const root = path.join(process.cwd(), "public/reach/vendor");
  const manifest = JSON.parse(readFileSync(path.join(root, "asset-manifest.json"), "utf8"));
  expect(manifest.runtimeVersion).toBe(handModel.runtimeVersion);
  expect(manifest.assets).toHaveLength(7);
  for (const asset of manifest.assets) {
    expect(asset.file).not.toContain("..");
    expect(asset.license).toBe("Apache-2.0");
    expect(asset.source).toMatch(/^https:\/\/(registry.npmjs.org|storage.googleapis.com|raw.githubusercontent.com)\//);
    const bytes = readFileSync(path.join(root, asset.file));
    expect(bytes.length).toBe(asset.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
  }
  expect(manifest.assets.find((a: { file: string }) => a.file === "hand_landmarker.task").sha256).toBe(
    handModel.modelDigest,
  );
});
