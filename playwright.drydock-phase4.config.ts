import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.DRYDOCK_PHASE4_PORT ?? "4194", 10);
const taskRoot = process.env.DRYDOCK_PHASE4_TASK_ROOT;
if (!Number.isInteger(port) || port < 1024 || port > 65_535) throw new Error(`DRYDOCK_PHASE4_PORT_REFUSED:${port}`);

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /drydock-phase4\.spec\.ts/u,
  timeout: 90_000,
  workers: 1,
  outputDir: taskRoot ? `${taskRoot}/browser/test-results` : "test-results/drydock-phase4",
  reporter: taskRoot ? [["list"], ["html", { outputFolder: `${taskRoot}/browser/report`, open: "never" }]] : [["list"]],
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure" },
  projects: [{ name: "drydock-phase4-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `"${process.execPath}" node_modules/next/dist/bin/next dev --webpack -H 127.0.0.1 -p ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
