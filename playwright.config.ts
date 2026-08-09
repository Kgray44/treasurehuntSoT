import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const playwrightPort = new URL(baseURL).port || "3100";
const useOwnedExternalServer = process.env.FOREVER_PLAYWRIGHT_EXTERNAL_SERVER === "1";
const soundingLineLane = process.env.FOREVER_SOUNDING_LINE_LANE ?? "";
const usesSoundingLineLane = /^(?:harborlight-a|harborlight-b)$/u.test(soundingLineLane);
const useWayfarerProductionServer = process.env.WAYFARER_PLAYWRIGHT_PRODUCTION === "1";
const phase3ReadOnlySetup = /phase3-readonly-setup\.setup\.ts/u;
const phase3PerformanceSpec = /phase3-performance\.spec\.ts/u;
const harborlightPhase2Spec = /harborlight-phase2\.spec\.ts/u;
const wayfarerPhase2Spec = /wayfarer-phase2\.spec\.ts/u;
const harborlightPhase3Spec = /harborlight-phase3\.spec\.ts/u;
const harborlightPhase4Spec = /harborlight-phase4\.spec\.ts/u;
const soundingLineAccessSentinelSpec = /access-gates\.spec\.ts/u;
const homeportPhase1Spec = /homeport-phase1\.spec\.ts/u;
const homeportPhase2Spec = /homeport-phase2\.spec\.ts/u;
const homeportPhase4Spec = /homeport-phase4\.spec\.ts/u;
const homeportPhase7WalkthroughSpecs = /homeport-phase7.*\.spec\.ts/u;
const helmPhase1Spec = /project-helm-phase1\.spec\.ts/u;
const admiraltyPhase1Spec = /admiralty-phase1\.spec\.ts/u;
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

if (useOwnedExternalServer && !usesSoundingLineLane && baseURL !== "http://127.0.0.1:3100") {
  throw new Error("Owned external Playwright validation must use http://127.0.0.1:3100.");
}
if (usesSoundingLineLane && !/^http:\/\/127\.0\.0\.1:31(?:0[1-9]|[1-9][0-9])$/u.test(baseURL)) {
  throw new Error("Sounding Line browser lanes require an owned loopback port from 3101 through 3199.");
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 240_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR ?? "artifacts/validation/playwright",
  reporter: [
    ["list"],
    ["html", { outputFolder: process.env.PLAYWRIGHT_REPORT_DIR ?? "artifacts/validation/report", open: "never" }],
  ],
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
      testIgnore: [
        phase3ReadOnlySetup,
        phase3PerformanceSpec,
        wayfarerPhase2Spec,
        harborlightPhase2Spec,
        harborlightPhase3Spec,
        harborlightPhase4Spec,
        homeportPhase1Spec,
        homeportPhase2Spec,
        homeportPhase4Spec,
        homeportPhase7WalkthroughSpecs,
        helmPhase1Spec,
        admiraltyPhase1Spec,
      ],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "homeport-phase1",
      testMatch: homeportPhase1Spec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Discovery lives in the shared registry, while execution is allowed
      // only through the dedicated config or Sounding Line's isolated clone.
      name: "homeport-phase2",
      testMatch: homeportPhase2Spec,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      // Phase 4 execution is authoritative only through its dedicated copied
      // database, fixture, media roots, port, and evidence configuration.
      name: "homeport-phase4",
      testMatch: homeportPhase4Spec,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      // Project Helm owns a canonical-account journey against Sounding Line's
      // copied database and loopback runtime. It must never share the generic
      // mutation project or a developer's canonical database.
      name: "helm-phase1",
      testMatch: helmPhase1Spec,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      // This is the narrow Sounding Line browser sentinel.  It deliberately
      // has no Phase 3 fixture dependency: access-gates never creates a
      // mutation fixture, and adding the dependency would require an
      // unnecessary mutable database copy just to prove access controls.
      name: "sounding-line-access-sentinel",
      testMatch: soundingLineAccessSentinelSpec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Discovery is shared with Sounding Line; authoritative execution uses
      // the Admiralty-owned fresh synthetic fixture and dedicated config.
      name: "admiralty-phase1",
      testMatch: admiraltyPhase1Spec,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "wayfarer-phase2",
      testMatch: wayfarerPhase2Spec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "wayfarer-phase3",
      testMatch: /wayfarer-phase3\.spec\.ts/u,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "wayfarer-phase4",
      testMatch: /wayfarer-phase4\.spec\.ts/u,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Harborlight owns its own isolated browser journey. It must not depend
      // on the Phase 3 fixture setup, whose Captain/session data is unrelated
      // to Exchange publication and installation evidence.
      name: "harborlight-phase2",
      testMatch: harborlightPhase2Spec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // The persisted Community Harbor acceptance matrix has its own synthetic
      // identities and never reuses the Exchange fixture or the Lanternwake
      // mutation setup.
      name: "harborlight-phase3",
      testMatch: harborlightPhase3Spec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Phase 4 uses a distinct moderator fixture so private case evidence,
      // conflict-of-interest checks, and operational state never share the
      // public Exchange acceptance identities.
      name: "harborlight-phase4",
      testMatch: harborlightPhase4Spec,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit-mobile",
      dependencies: ["phase3-readonly-setup"],
      testIgnore: [
        phase3ReadOnlySetup,
        phase3MutationSpecs,
        wayfarerPhase2Spec,
        harborlightPhase2Spec,
        harborlightPhase3Spec,
        homeportPhase1Spec,
        homeportPhase2Spec,
        homeportPhase4Spec,
        homeportPhase7WalkthroughSpecs,
        helmPhase1Spec,
        admiraltyPhase1Spec,
      ],
      use: { ...devices["iPhone 14"] },
    },
  ],
  webServer: useOwnedExternalServer
    ? undefined
    : {
        // Match the owned acceptance server. Webpack avoids Next 16 dev-chunk
        // invalidation during long-lived WebKit matrices.
        command: useWayfarerProductionServer
          ? `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${playwrightPort}`
          : `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${playwrightPort}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: useWayfarerProductionServer ? { WAYFARER_PROVIDER_SIMULATORS: "1" } : undefined,
      },
});
