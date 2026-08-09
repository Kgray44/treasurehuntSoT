import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const taskRoot = path.resolve(required("ADMIRALTY_PHASE1_TASK_ROOT"));
const databasePath = path.resolve(required("ADMIRALTY_PHASE1_DATABASE_PATH"));
const port = Number.parseInt(process.env.ADMIRALTY_PHASE1_PORT ?? "3791", 10);
const baseURL = `http://127.0.0.1:${port}`;
const distDir = process.env.NEXT_DIST_DIR ?? ".next";
const env = {
  ...process.env,
  DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
  NEXT_DIST_DIR: distDir,
  VOYAGEWRIGHT_BUILD_SHA: required("ADMIRALTY_PHASE1_SOURCE_SHA"),
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /admiralty-phase1\.spec\.ts/u,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(taskRoot, "browser", "traces"),
  reporter: [["list"], ["html", { outputFolder: path.join(taskRoot, "browser", "report"), open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "admiralty-phase1-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env,
  },
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
