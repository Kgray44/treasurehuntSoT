import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const port = 3187;
const baseURL = `http://127.0.0.1:${port}`;
const databaseUrl = `file:${path.resolve(process.cwd(), ".true-north-e2e.db").replaceAll("\\", "/")}`;

/** Task-owned browser project; it never uses the shared acceptance server or port. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /project-true-north\.spec\.ts/u,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  outputDir: "artifacts/validation/true-north-playwright",
  reporter: [["list"], ["html", { outputFolder: "artifacts/validation/true-north-report", open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [
    { name: "true-north-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "true-north-mobile", use: { ...devices["iPhone 14"] } },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: databaseUrl },
  },
});
