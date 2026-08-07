import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const taskRoot = path.resolve(required("HOMEPORT_PHASE7_TASK_ROOT"));
const journeyId = required("HOMEPORT_PHASE7_PATCH_A_JOURNEY_ID");
const port = Number.parseInt(process.env.HOMEPORT_PHASE7_PATCH_A_PORT ?? "3781", 10);
const databasePath = path.resolve(required("HOMEPORT_PHASE7_PATCH_A_DATABASE_PATH"));
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
const baseURL = `http://127.0.0.1:${port}`;
const outboxPath = path.join(taskRoot, "outbox", `patch-a-journey-${journeyId}.jsonl`);
const distDir = process.env.NEXT_DIST_DIR ?? ".sealed-build-phase7-owner-correction-round3-patch-a";
const mobile = journeyId === "L";
const syntheticFailure = journeyId === "F" ? "VERIFY_EMAIL_ONCE" : "";

Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  PLAYWRIGHT_BASE_URL: baseURL,
  HOMEPORT_PHASE7_TASK_ROOT: taskRoot,
  HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
  HOMEPORT_SYNTHETIC_OUTBOX_PATH: outboxPath,
  HOMEPORT_PHASE7_VALIDATION_DELAY_HOOK: "1",
  WAYFARER_PROVIDER_SIMULATORS: "1",
  PROFILE_MEDIA_ROOT: path.join(taskRoot, "media"),
  PRIVATE_CONTENT_ROOT: path.join(taskRoot, "media", "private", journeyId),
  NEXT_DIST_DIR: distDir,
  ...(syntheticFailure ? { HOMEPORT_SYNTHETIC_EMAIL_FAILURE: syntheticFailure } : {}),
});

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /homeport-phase7-owner-correction-round3-patch-a\.spec\.ts/u,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(taskRoot, "browser", "traces", journeyId),
  reporter: [["list"], ["html", { outputFolder: path.join(taskRoot, "browser", "reports", journeyId), open: "never" }]],
  use: {
    ...(mobile ? devices["iPhone 13"] : devices["Desktop Chrome"]),
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: `homeport-phase7-owner-correction-round3-patch-a-${journeyId}`, use: { browserName: "chromium" } },
  ],
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
      HOMEPORT_PHASE7_VALIDATION_DELAY_HOOK: "1",
      WAYFARER_PROVIDER_SIMULATORS: "1",
      PROFILE_MEDIA_ROOT: path.join(taskRoot, "media"),
      PRIVATE_CONTENT_ROOT: path.join(taskRoot, "media", "private", journeyId),
      NEXT_DIST_DIR: distDir,
      ...(syntheticFailure ? { HOMEPORT_SYNTHETIC_EMAIL_FAILURE: syntheticFailure } : {}),
    },
  },
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
