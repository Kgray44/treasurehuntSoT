import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const taskRoot =
  process.env.VOYAGEWRIGHT_OAUTH_VALIDATION_ROOT ??
  fs.mkdtempSync(path.join(os.tmpdir(), "voyagewright-oauth-browser-"));
const databasePath = path.join(taskRoot, "oauth-validation.db").replaceAll("\\", "/");
if (!fs.existsSync(databasePath)) fs.writeFileSync(databasePath, "", { flag: "wx" });
const databaseUrl = `file:${databasePath}`;
process.env.VOYAGEWRIGHT_OAUTH_VALIDATION_ROOT = taskRoot;
process.env.VOYAGEWRIGHT_OAUTH_VALIDATION_DATABASE_URL = databaseUrl;

export default defineConfig({
  testDir: "./tests/oauth",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./tests/oauth/global-setup.ts",
  outputDir: path.join(taskRoot, "playwright-output"),
  reporter: [["list"], ["json", { outputFile: path.join(taskRoot, "playwright-report.json") }]],
  use: {
    baseURL: "http://localhost:3217",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3217",
    url: "http://localhost:3217/api/auth/providers",
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      HOMEPORT_PUBLIC_APP_ORIGIN: "http://localhost:3217",
      HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
      VOYAGEWRIGHT_OAUTH_TEST_MODE: "1",
    },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
