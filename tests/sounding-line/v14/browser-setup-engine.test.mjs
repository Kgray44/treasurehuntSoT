import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { phase3ReadOnlySetupDeviceForEngine } from "../../../scripts/sounding-line/v14/browser-setup-engine.mjs";

test("the shared Phase 3 setup stays inside the sealed physical browser engine", () => {
  assert.equal(phase3ReadOnlySetupDeviceForEngine(undefined), "Desktop Chrome");
  assert.equal(phase3ReadOnlySetupDeviceForEngine("chromium"), "Desktop Chrome");
  assert.equal(phase3ReadOnlySetupDeviceForEngine("webkit"), "iPhone 14");
});

test("the shared Phase 3 setup rejects an unknown sealed browser engine", () => {
  assert.throws(() => phase3ReadOnlySetupDeviceForEngine("firefox"), /SOUNDING_LINE_BROWSER_ENGINE_INVALID/);
});

test("the Playwright configuration delegates the shared setup device to the sealed engine resolver", async () => {
  const config = await readFile("playwright.config.ts", "utf8");
  assert.match(config, /phase3ReadOnlySetupDeviceForEngine\(process\.env\.SOUNDING_LINE_BROWSER_ENGINE\)/u);
  assert.match(config, /devices\[phase3ReadOnlySetupDevice\]/u);
});
