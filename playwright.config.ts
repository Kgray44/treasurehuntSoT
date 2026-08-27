import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const port = new URL(baseURL).port || "3100";
const phase3ReadOnlySetup = /phase3-readonly-setup\.setup\.ts/u;
const harborlightPhase2 = /harborlight-phase2\.spec\.ts/u;
const harborlightPhase3 = /harborlight-phase3\.spec\.ts/u;
const harborlightPhase4 = /harborlight-phase4\.spec\.ts/u;
const admiraltyPhase1 = /admiralty-phase1\.spec\.ts/u;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 240_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [
    {
      name: "phase3-readonly-setup",
      testMatch: phase3ReadOnlySetup,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: [phase3ReadOnlySetup, harborlightPhase2, harborlightPhase3, harborlightPhase4, admiraltyPhase1],
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "admiralty-phase1", testMatch: admiraltyPhase1, use: { ...devices["Desktop Chrome"] } },
    { name: "harborlight-phase2", testMatch: harborlightPhase2, use: { ...devices["Desktop Chrome"] } },
    { name: "harborlight-phase3", testMatch: harborlightPhase3, use: { ...devices["Desktop Chrome"] } },
    { name: "harborlight-phase4", testMatch: harborlightPhase4, use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 14"] } },
  ],
  webServer:
    process.env.FOREVER_PLAYWRIGHT_EXTERNAL_SERVER === "1"
      ? undefined
      : {
          // Sounding Line builds generic product candidates before browser
          // proof. Start that exact production output instead of opening a
          // webpack dev compiler against the same .next directory: a hot
          // update can otherwise abort an in-flight product mutation.
          command: `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
});
