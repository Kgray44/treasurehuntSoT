import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
describe("PWA cache truth boundary", () => {
  const worker = readFileSync(join(process.cwd(), "public", "sw.js"), "utf8");
  it("never cache-firsts API, authentication, Studio, Captain, Player, or live story routes", () => {
    for (const prefix of ["/api/", "/studio", "/captain", "/player", "/play/", "/quartermaster", "/join/"])
      expect(worker).toContain(`\"${prefix}\"`);
    expect(worker).toContain('fetch(request, { cache: "no-store" })');
  });
  it("limits the install shell to an offline truth page, manifest, and icons", () => {
    expect(worker).toContain("const SHELL = [");
    expect(worker).toContain('"/offline"');
    expect(worker).toContain('"/manifest.webmanifest"');
    expect(worker).not.toContain('cache.add("/api/');
  });
});
