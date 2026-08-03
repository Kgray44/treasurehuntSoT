import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3194;
const baseURL = `http://127.0.0.1:${port}`;
const taskRoot = path.resolve(
  process.env.HOMEPORT_PHASE4_TASK_ROOT ??
    "C:/Users/kkids/AppData/Local/Temp/project-homeport-phase4-20260803-022307-9a3252f7",
);
const sourceDatabasePath = path.resolve(
  process.env.HOMEPORT_PHASE4_SOURCE_DATABASE ?? path.join(taskRoot, "database", "phase4.db"),
);
const databasePath = path.resolve(path.join(taskRoot, "database", "phase4-e2e.db"));
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE4_EVIDENCE_ROOT ??
    path.join("Development_Docs", "Projects", "Project_Homeport", "evidence", "phase4"),
);
const validationRoot = path.join(taskRoot, "browser");
const profileMediaRoot = path.join(taskRoot, "media", "profile");
const privateContentRoot = path.join(taskRoot, "media", "private");

Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  PLAYWRIGHT_BASE_URL: baseURL,
  HOMEPORT_PHASE4_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE4_SOURCE_DATABASE: sourceDatabasePath,
  HOMEPORT_PHASE4_DATABASE_PATH: databasePath,
  HOMEPORT_PHASE4_EVIDENCE_ROOT: evidenceRoot,
  PROFILE_MEDIA_ROOT: profileMediaRoot,
  PRIVATE_CONTENT_ROOT: privateContentRoot,
});

/** Phase 4 owns its copied database, port, media, browser output, and fixture receipt. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /homeport-phase4\.spec\.ts/u,
  globalSetup: "./tests/e2e/homeport-phase4.setup.ts",
  timeout: 360_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(validationRoot, "playwright"),
  reporter: [["list"], ["html", { outputFolder: path.join(validationRoot, "report"), open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 1000 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "homeport-phase4", use: { browserName: "chromium" } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      HOMEPORT_PHASE4_TASK_ROOT: taskRoot,
      PROFILE_MEDIA_ROOT: profileMediaRoot,
      PRIVATE_CONTENT_ROOT: privateContentRoot,
    },
  },
});
