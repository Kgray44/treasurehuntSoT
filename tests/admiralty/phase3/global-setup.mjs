import { spawnSync } from "node:child_process";

export default function globalSetup() {
  process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ??= "Adm3-synthetic-fixture-password-20260825!";
  // The journey runner prepares the fixture before Playwright starts the web server.
  if (process.env.ADMIRALTY_PHASE3_FIXTURE_READY === "1") return;
  run("node_modules/prisma/build/index.js", ["generate", "--schema", "prisma/schema.sqlite.prisma"]);
  run("tests/admiralty/phase3/prepare-fixture.mjs");
}

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ADMIRALTY_PHASE3_FIXTURE_SETUP_FAILED:${result.status ?? 1}`);
}
