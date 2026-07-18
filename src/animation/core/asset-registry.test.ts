import { describe, expect, it } from "vitest";
import { animationAssets } from "./asset-registry";

describe("animation asset registry", () => {
  it("has unique keys and only local runtime paths", () => {
    expect(new Set(animationAssets.map((asset) => asset.key)).size).toBe(animationAssets.length);
    for (const asset of animationAssets) {
      if (asset.path) expect(asset.path).toMatch(/^\//);
      if (asset.fallback) expect(asset.fallback).toMatch(/^\//);
      expect(`${asset.path ?? ""}${asset.fallback ?? ""}`).not.toMatch(/^https?:/);
    }
  });

  it("documents all three motion behaviors and provenance", () => {
    for (const asset of animationAssets) {
      expect(asset.behavior.full).toBeTruthy();
      expect(asset.behavior.gentle).toBeTruthy();
      expect(asset.behavior.reduced).toBeTruthy();
      expect(asset.provenance.length).toBeGreaterThan(10);
    }
  });
});
