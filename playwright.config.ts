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
          // Sounding Line builds generic product candidates before browser
          // proof. Start that exact production output instead of opening a
          // webpack dev compiler against the same .next directory: a hot
          // update can otherwise abort an in-flight authority mutation.
          command: `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
        },
});
