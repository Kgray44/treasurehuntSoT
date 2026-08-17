import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { phase3ReadOnlySetupUseForEngine } from "../../../scripts/sounding-line/v14/browser-setup-engine.mjs";

test("a WebKit batch retains Chromium-only Phase 3 setup through a sealed sidecar", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-chromium-setup-"));
  const executable = path.join(root, "chromium-1194", "chrome-win", "chrome.exe");
  try {
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(executable, "sealed chromium setup\n");
    assert.deepEqual(phase3ReadOnlySetupUseForEngine(undefined), { deviceName: "Desktop Chrome" });
    assert.deepEqual(phase3ReadOnlySetupUseForEngine("chromium"), { deviceName: "Desktop Chrome" });
    assert.deepEqual(phase3ReadOnlySetupUseForEngine("webkit", root), {
      deviceName: "Desktop Chrome",
      executablePath: executable,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the Chromium setup sidecar accepts the Playwright headless-shell cache layout", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sounding-line-chromium-headless-shell-"));
  const executable = path.join(root, "chromium_headless_shell-1194", "chrome-win", "headless_shell.exe");
  try {
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(executable, "sealed Chromium headless shell\n");
    assert.deepEqual(phase3ReadOnlySetupUseForEngine("webkit", root), {
      deviceName: "Desktop Chrome",
      executablePath: executable,
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the shared Phase 3 setup rejects an unknown sealed browser engine", () => {
  assert.throws(() => phase3ReadOnlySetupUseForEngine("firefox"), /SOUNDING_LINE_BROWSER_ENGINE_INVALID/);
});

test("the Playwright configuration and governed worker bind the Chromium setup sidecar explicitly", async () => {
  const config = await readFile("playwright.config.ts", "utf8");
  const worker = await readFile(".github/workflows/sounding-line-governed-worker.yml", "utf8");
  assert.match(
    config,
    /phase3ReadOnlySetupUseForEngine\(\s*process\.env\.SOUNDING_LINE_BROWSER_ENGINE,\s*process\.env\.SOUNDING_LINE_CHROMIUM_SETUP_BROWSERS_PATH/u,
  );
  assert.match(config, /executablePath: phase3ReadOnlySetup\.executablePath/u);
  assert.match(worker, /id: chromium-setup-browser-identity/u);
  assert.match(worker, /SOUNDING_LINE_CHROMIUM_SETUP_BROWSERS_PATH/u);
  assert.match(worker, /GOVERNED_CHROMIUM_SETUP_LAYER_RESTORE_FAILED/u);
});
