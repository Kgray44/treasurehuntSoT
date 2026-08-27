import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.SHIPWRIGHT_PHASE5_PORT ?? "4175", 10);
const taskRoot = process.env.SHIPWRIGHT_PHASE5_TASK_ROOT;
if (!Number.isInteger(port) || port < 1024 || port > 65_535) throw new Error(`SHIPWRIGHT_PHASE5_PORT_REFUSED:${port}`);

export default defineConfig({
  testDir: "..",
  testMatch: /project-shipwright-phase5\.spec\.ts/u,
  timeout: 300_000,
  workers: 1,
  outputDir: taskRoot ? `${taskRoot}/browser/test-results` : "test-results/shipwright-phase5",
  reporter: taskRoot ? [["list"], ["html", { outputFolder: `${taskRoot}/browser/report`, open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "shipwright-phase5-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    cwd: "../../..",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
