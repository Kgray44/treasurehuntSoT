import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const playwrightPort = new URL(baseURL).port || "3100";
const useOwnedExternalServer = process.env.FOREVER_PLAYWRIGHT_EXTERNAL_SERVER === "1";
const phase3ReadOnlySetup = /phase3-readonly-setup\.setup\.ts/u;
const phase3PerformanceSpec = /phase3-performance\.spec\.ts/u;
const phase3MutationSpecs =
  /phase3-(?:player-event-matrix|player-motion|replay-resilience|lifecycle(?:-extended)?|performance)\.spec\.ts/u;
const phase3MutationSpecGuard = [
  "phase3-player-event-matrix.spec.ts",
  "phase3-player-motion.spec.ts",
  "phase3-replay-resilience.spec.ts",
  "phase3-lifecycle.spec.ts",
  "phase3-lifecycle-extended.spec.ts",
  "phase3-performance.spec.ts",
] as const;

if (
  phase3MutationSpecGuard.length !== 6 ||
  phase3MutationSpecGuard.some((specName) => !phase3MutationSpecs.test(specName)) ||
  phase3MutationSpecs.test("phase3-visual-checkpoints.spec.ts") ||
  phase3MutationSpecs.test("phase3-accessibility-viewports.spec.ts")
) {
  throw new Error("Phase 3 Playwright project routing must isolate exactly the six mutation spec families.");
}

if (useOwnedExternalServer && baseURL !== "http://127.0.0.1:3100") {
  throw new Error("Owned external Playwright validation must use http://127.0.0.1:3100.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 240_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  outputDir: "artifacts/validation/playwright",
  reporter: [["list"], ["html", { outputFolder: "artifacts/validation/report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "phase3-readonly-setup",
      testMatch: phase3ReadOnlySetup,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      dependencies: ["phase3-readonly-setup"],
      testIgnore: [phase3ReadOnlySetup, phase3PerformanceSpec],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit-mobile",
      dependencies: ["phase3-readonly-setup"],
      testIgnore: [phase3ReadOnlySetup, phase3MutationSpecs],
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: useOwnedExternalServer
    ? undefined
    : {
        command: `node node_modules/next/dist/bin/next dev -H 127.0.0.1 -p ${playwrightPort}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
