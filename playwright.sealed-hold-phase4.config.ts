import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.SEALED_HOLD_PHASE4_BASE_URL ?? "http://127.0.0.1:3114";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /sealed-hold-phase4\.spec\.ts/u,
  timeout: 180_000,
  workers: 1,
  fullyParallel: false,
  outputDir: "artifacts/validation/sealed-hold-phase4/playwright",
  reporter: [["list"], ["html", { outputFolder: "artifacts/validation/sealed-hold-phase4/report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "sealed-hold-phase4", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${new URL(baseURL).port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
