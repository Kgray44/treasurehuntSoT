import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const port = new URL(baseURL).port || "3100";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 240_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 14"] } },
  ],
  webServer:
    process.env.FOREVER_PLAYWRIGHT_EXTERNAL_SERVER === "1"
      ? undefined
      : {
          command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
});
