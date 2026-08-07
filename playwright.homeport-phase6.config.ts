import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.HOMEPORT_PHASE6_PORT ?? "3616", 10);
const baseURL = `http://127.0.0.1:${port}`;
const taskRoot = path.resolve(
  process.env.HOMEPORT_PHASE6_TASK_ROOT ?? "C:/Users/kkids/AppData/Local/Temp/homeport-phase6-019fcb64",
);
const sourceDatabasePath = path.resolve(
  process.env.HOMEPORT_PHASE6_SOURCE_DATABASE ?? path.join(taskRoot, "database", "phase6.db"),
);
const databasePath = path.resolve(path.join(taskRoot, "database", "phase6-e2e.db"));
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE6_EVIDENCE_ROOT ??
    path.join("Development_Docs", "Projects", "Project_Homeport", "evidence", "phase6"),
);
const validationRoot = path.join(taskRoot, "runtime", "browser");
const profileMediaRoot = path.join(taskRoot, "storage", "profile");
const privateContentRoot = path.join(taskRoot, "storage", "private");

Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  PLAYWRIGHT_BASE_URL: baseURL,
  HOMEPORT_PHASE6_TASK_ROOT: taskRoot,
  HOMEPORT_PHASE6_SOURCE_DATABASE: sourceDatabasePath,
  HOMEPORT_PHASE6_DATABASE_PATH: databasePath,
  HOMEPORT_PHASE6_EVIDENCE_ROOT: evidenceRoot,
  PROFILE_MEDIA_ROOT: profileMediaRoot,
  PRIVATE_CONTENT_ROOT: privateContentRoot,
});

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /homeport-phase6\.spec\.ts/u,
  globalSetup: "./tests/e2e/homeport-phase6.setup.ts",
  timeout: 900_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(validationRoot, "playwright"),
  reporter: [["list"], ["html", { outputFolder: path.join(validationRoot, "report"), open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "homeport-phase6", use: { browserName: "chromium" } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      HOMEPORT_PHASE6_TASK_ROOT: taskRoot,
      PROFILE_MEDIA_ROOT: profileMediaRoot,
      PRIVATE_CONTENT_ROOT: privateContentRoot,
    },
  },
});
