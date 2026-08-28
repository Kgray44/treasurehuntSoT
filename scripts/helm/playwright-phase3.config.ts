import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const repositoryRoot = path.resolve(__dirname, "../..");
const taskRoot = path.resolve(required("HELM_PHASE3_TASK_ROOT"));
const databasePath = path.resolve(required("HELM_PHASE3_DATABASE_PATH"));
const port = Number.parseInt(required("HELM_PHASE3_BROWSER_PORT"), 10);
if (!Number.isInteger(port) || port < 1024 || port > 65_535)
  throw new Error(`HELM_PHASE3_BROWSER_PORT_REFUSED:${port}`);

const baseURL = `http://127.0.0.1:${port}`;
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;
Object.assign(process.env, { DATABASE_URL: databaseUrl, PLAYWRIGHT_BASE_URL: baseURL });

export default defineConfig({
  testDir: path.join(repositoryRoot, "tests/e2e"),
  testMatch: /project-helm-phase1\.spec\.ts/u,
  timeout: 600_000,
  expect: { timeout: 30_000 },
  workers: 1,
  outputDir: path.join(taskRoot, "test-results"),
  reporter: [["list"], ["html", { outputFolder: path.join(taskRoot, "report"), open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "helm-phase3-chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`,
    cwd: repositoryRoot,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: process.env.SESSION_SECRET ?? "helm-phase3-task-owned-session-secret",
      HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
      HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
      HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(taskRoot, "outbox", "messages.jsonl"),
    },
  },
});

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
