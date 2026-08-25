import { spawnSync } from "node:child_process";

export default function globalSetup() {
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
