import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.SHIPWRIGHT_PHASE2_PORT ?? "4173", 10);
const taskRoot = process.env.SHIPWRIGHT_PHASE2_TASK_ROOT;
const browserEngine = process.env.SOUNDING_LINE_BROWSER_ENGINE === "webkit" ? "webkit" : "chromium";
if (!Number.isInteger(port) || port < 1024 || port > 65_535) throw new Error(`SHIPWRIGHT_PHASE2_PORT_REFUSED:${port}`);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /project-shipwright-phase2\.spec\.ts/u,
  timeout: 60_000,
  workers: 1,
  outputDir: taskRoot ? `${taskRoot}/browser/test-results` : "test-results/shipwright-phase2",
  reporter: taskRoot ? [["list"], ["html", { outputFolder: `${taskRoot}/browser/report`, open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: `shipwright-phase2-${browserEngine}`,
      use: browserEngine === "webkit" ? { ...devices["Desktop Safari"] } : { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
