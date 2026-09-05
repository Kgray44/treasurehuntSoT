// eslint-disable-next-line @typescript-eslint/no-require-imports -- Playwright loads this isolated config as CommonJS.
const path = require("node:path");
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Playwright loads this isolated config as CommonJS.
const { defineConfig, devices } = require("@playwright/test");

const repositoryRoot = path.resolve(__dirname, "../../..");
const taskRoot = path.resolve(required("ADMIRALTY_PHASE3_TASK_ROOT"));
const databasePath = path.resolve(required("ADMIRALTY_PHASE3_DATABASE_PATH"));
const port = Number.parseInt(process.env.ADMIRALTY_PHASE3_PORT ?? "3796", 10);
const baseURL = `http://127.0.0.1:${port}`;
const distDir = process.env.NEXT_DIST_DIR ?? ".next-brightwork-wave5";
const serverCommand =
  process.env.ADMIRALTY_PHASE3_SERVER_COMMAND ??
  `"${process.execPath}" node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${port}`;
process.env.DATABASE_URL = `file:${databasePath.replaceAll("\\", "/")}`;

module.exports = defineConfig({
  testDir: ".",
  testMatch: /browser\.spec\.ts/u,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: path.join(taskRoot, "browser", "traces"),
  reporter: [["list"], ["html", { outputFolder: path.join(taskRoot, "browser", "report"), open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "admiralty-brightwork-wave5-chromium", use: { browserName: "chromium" } }],
  webServer: {
    cwd: repositoryRoot,
    command: serverCommand,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
      NEXT_DIST_DIR: distDir,
      VOYAGEWRIGHT_BUILD_SHA: required("ADMIRALTY_PHASE3_SOURCE_SHA"),
    },
  },
});

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
