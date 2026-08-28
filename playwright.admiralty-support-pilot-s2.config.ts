import { devices, defineConfig } from "@playwright/test";
import path from "node:path";

const taskRoot = path.resolve(
  process.env.ADMIRALTY_S2_TASK_ROOT ?? path.join(required("LOCALAPPDATA"), "ProjectAdmiralty", "support-pilot-s2"),
);
const databasePath = path.join(taskRoot, "database", "admiralty-phase2.db");
const distDir = process.env.NEXT_DIST_DIR ?? ".next-admiralty-support-pilot-s2";
const baseURL = "http://127.0.0.1:3132";
const serverCommand = `set NEXT_DIST_DIR=${distDir}&& set DATABASE_URL=file:${databasePath.replaceAll("\\", "/")}&& "${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3132`;

process.env.ADMIRALTY_S2_TASK_ROOT = taskRoot;
process.env.ADMIRALTY_S1_TASK_ROOT = taskRoot;
process.env.ADMIRALTY_PHASE3_TASK_ROOT = taskRoot;
process.env.DATABASE_URL = `file:${databasePath.replaceAll("\\", "/")}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /admiralty-support-pilot-s2\.spec\.ts/u,
  globalSetup: "./tests/admiralty/support-pilot-s2/global-setup.mjs",
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(taskRoot, "browser", "traces"),
  reporter: [["list"], ["html", { outputFolder: path.join(taskRoot, "browser", "report"), open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    actionTimeout: 20_000,
    viewport: { width: 1440, height: 900 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "admiralty-support-pilot-s2-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      ADMIRALTY_S2_TASK_ROOT: taskRoot,
      ADMIRALTY_S1_TASK_ROOT: taskRoot,
      ADMIRALTY_PHASE3_TASK_ROOT: taskRoot,
      DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
      NEXT_DIST_DIR: distDir,
      VOYAGEWRIGHT_BUILD_SHA: process.env.ADMIRALTY_S2_SOURCE_SHA ?? "0000000000000000000000000000000000000000",
    },
  },
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
