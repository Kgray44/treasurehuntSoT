import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const port = 3188;
const baseURL = `http://127.0.0.1:${port}`;
const databasePath = path.resolve(process.cwd(), ".homeport-phase2-e2e.db");
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const evidenceRoot = path.resolve(
  process.env.HOMEPORT_PHASE2_EVIDENCE_ROOT ??
    path.join("Development_Docs", "Projects", "Project_Homeport", "evidence", "phase2"),
);

process.env.DATABASE_URL = databaseUrl;
process.env.PLAYWRIGHT_BASE_URL = baseURL;
process.env.HOMEPORT_PHASE2_DATABASE_PATH = databasePath;
process.env.HOMEPORT_PHASE2_EVIDENCE_ROOT = evidenceRoot;

/** Project Homeport Phase 2 owns its database, server, port, browser state, and evidence root. */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /homeport-phase2\.spec\.ts/u,
  globalSetup: "./tests/e2e/homeport-phase2.setup.ts",
  timeout: 240_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "artifacts/validation/homeport-phase2/playwright",
  reporter: [["list"], ["html", { outputFolder: "artifacts/validation/homeport-phase2/report", open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "homeport-phase2", use: { browserName: "chromium" } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: databaseUrl },
  },
});
