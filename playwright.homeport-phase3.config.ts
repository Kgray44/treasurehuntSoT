import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3193;
const baseURL = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), ".homeport-phase3-e2e.db");
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const validationRoot = path.resolve("artifacts", "validation", "homeport-phase3");
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE3_EVIDENCE_ROOT ??
    path.join("Development_Docs", "Projects", "Project_Homeport", "evidence", "phase3"),
);
const profileMediaRoot = path.join(validationRoot, "profile-media");
const privateContentRoot = path.join(validationRoot, "private-content");

Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  PLAYWRIGHT_BASE_URL: baseURL,
  HOMEPORT_PHASE3_DATABASE_PATH: databasePath,
  HOMEPORT_PHASE3_EVIDENCE_ROOT: evidenceRoot,
  PROFILE_MEDIA_ROOT: profileMediaRoot,
  PRIVATE_CONTENT_ROOT: privateContentRoot,
});

/** Project Homeport Phase 3 owns its database, server, port, media roots, browser state, and evidence root. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /homeport-phase3\.spec\.ts/u,
  globalSetup: "./tests/e2e/homeport-phase3.setup.ts",
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
  projects: [{ name: "homeport-phase3", use: { browserName: "chromium" } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { DATABASE_URL: databaseUrl, PROFILE_MEDIA_ROOT: profileMediaRoot, PRIVATE_CONTENT_ROOT: privateContentRoot },
  },
});
