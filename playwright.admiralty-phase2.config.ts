import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const taskRoot = path.resolve(required("ADMIRALTY_PHASE2_TASK_ROOT"));
const databasePath = path.resolve(required("ADMIRALTY_PHASE2_DATABASE_PATH"));
const port = Number.parseInt(process.env.ADMIRALTY_PHASE2_PORT ?? "3793", 10);
const baseURL = `http://127.0.0.1:${port}`;
const bridgewatchPort = Number.parseInt(process.env.ADMIRALTY_PHASE2_BRIDGEWATCH_PORT ?? "4318", 10);
const bridgewatchURL = `http://127.0.0.1:${bridgewatchPort}`;
const bridgewatchDatabasePath = path.join(taskRoot, "database", "bridgewatch.sqlite");
const distDir = process.env.NEXT_DIST_DIR ?? ".next";
const env = {
  ...process.env,
  DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
  NEXT_DIST_DIR: distDir,
  VOYAGEWRIGHT_BUILD_SHA: required("ADMIRALTY_PHASE2_SOURCE_SHA"),
  BRIDGEWATCH_INTERNAL_URL: bridgewatchURL,
};

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /admiralty-phase2\.spec\.ts/u,
  timeout: 300_000,
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
  projects: [{ name: "admiralty-phase2-chromium", use: { browserName: "chromium" } }],
  webServer: [
    {
      command: `"${process.execPath}" dist/lib/server.js`,
      cwd: path.join(process.cwd(), "bridgewatch"),
      url: `${bridgewatchURL}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        ...process.env,
        BRIDGEWATCH_HOST: "127.0.0.1",
        BRIDGEWATCH_PORT: String(bridgewatchPort),
        BRIDGEWATCH_REPOSITORY: "Kgray44/treasurehuntSoT",
        BRIDGEWATCH_DB_PATH: bridgewatchDatabasePath,
        BRIDGEWATCH_GITHUB_API: "https://127.0.0.1:1",
        BRIDGEWATCH_REQUEST_TIMEOUT_MS: "1000",
      },
    },
    {
      command: `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      env,
    },
  ],
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
