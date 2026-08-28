import { spawnSync } from "node:child_process";

export default function globalSetup() {
  process.env.ADMIRALTY_PHASE3_SYNTHETIC_PASSWORD ??= "Adm3-synthetic-fixture-password-20260825!";
  run("tests/admiralty/phase3/prepare-fixture.mjs");
  run("tests/admiralty/support-pilot-s1/reset-fixture.mjs");
}

function run(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ADMIRALTY_SUPPORT_PILOT_S1_FIXTURE_SETUP_FAILED:${result.status ?? 1}`);
}
