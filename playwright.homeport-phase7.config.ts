import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_JOURNEY_ID");
const port = Number.parseInt(process.env.HOMEPORT_PHASE7_PORT ?? "3718", 10);
const databasePath = path.resolve(required("HOMEPORT_PHASE7_DATABASE_PATH"));
const baseURL = `http://127.0.0.1:${port}`;
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const outboxPath = path.join(taskRoot, "synthetic-outbox", `phase7-journey-${journeyId}.jsonl`);

Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  PLAYWRIGHT_BASE_URL: baseURL,
  HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
  HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
  HOMEPORT_SYNTHETIC_OUTBOX_PATH: outboxPath,
  PROFILE_MEDIA_ROOT: path.join(taskRoot, "synthetic-media", "profile", journeyId),
  PRIVATE_CONTENT_ROOT: path.join(taskRoot, "synthetic-media", "private", journeyId),
});

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /homeport-phase7\.spec\.ts/u,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(taskRoot, "traces", journeyId),
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(taskRoot, "reports", `playwright-${journeyId}`), open: "never" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    viewport: journeyId === "L" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: `homeport-phase7-${journeyId}`, use: { browserName: "chromium" } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
      HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
      HOMEPORT_SYNTHETIC_OUTBOX_PATH: outboxPath,
      PROFILE_MEDIA_ROOT: path.join(taskRoot, "synthetic-media", "profile", journeyId),
      PRIVATE_CONTENT_ROOT: path.join(taskRoot, "synthetic-media", "private", journeyId),
    },
  },
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
