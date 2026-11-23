import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const REQUIRED_BASE_URL = "http://127.0.0.1:3200";
const configuredBaseURL = process.env.FOREVER_PHASE3_PERFORMANCE_BASE_URL ?? REQUIRED_BASE_URL;
const fixtureBaseURL = process.env.PHASE3_BASE_URL ?? REQUIRED_BASE_URL;
const artifactRootFromEnv = process.env.VALIDATION_ARTIFACTS;

if (
  configuredBaseURL !== REQUIRED_BASE_URL ||
  fixtureBaseURL !== REQUIRED_BASE_URL ||
  process.env.FOREVER_VALIDATION_ISOLATION !== "1" ||
  process.env.FOREVER_VALIDATION_PRODUCTION_IDENTITY !== "1" ||
  !/^[a-f0-9]{64}$/u.test(process.env.FOREVER_VALIDATION_NONCE_HASH ?? "")
) {
  throw new Error(`Phase 3 production performance requires ${REQUIRED_BASE_URL}.`);
}
if (!artifactRootFromEnv || !path.isAbsolute(artifactRootFromEnv)) {
  throw new Error("Phase 3 production performance requires an absolute VALIDATION_ARTIFACTS root.");
}

const artifactRoot = path.resolve(artifactRootFromEnv);

// Development-only matrix. Require an explicit variant for every diagnostic runner.
const compareBrowser = process.env.JOURNAL_COMPARE_BROWSER;
const compareCapture = process.env.JOURNAL_COMPARE_CAPTURE;
if (!["shell", "chromium"].includes(compareBrowser ?? "") || !["record", "no-record"].includes(compareCapture ?? ""))
  throw new Error("The matched Journal run requires an explicit browser and capture mode.");
console.log("JOURNAL_MATCHED_CONFIGURATION " + JSON.stringify({ browser: compareBrowser, capture: compareCapture }));

export default defineConfig({
  testDir: "../../e2e",
  testMatch: "phase3-performance.spec.ts",
  timeout: 10 * 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(artifactRoot, "phase3-performance", "playwright"),
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(artifactRoot, "phase3-performance", "report"), open: "never" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: REQUIRED_BASE_URL,
    ...(compareBrowser === "chromium" ? { channel: "chromium" } : {}),
    trace: compareCapture === "record" ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
    video: compareCapture === "record" ? "retain-on-failure" : "off",
  },
  projects: [{ name: "chromium-production", use: { browserName: "chromium" } }],
});
