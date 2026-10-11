import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const root = process.cwd();
const candidate = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const timestamp = new Date().toISOString().replace(/\D/g, "");
const file = `validation-isolated-${timestamp.slice(0, 8)}-${timestamp.slice(8)}-${randomUUID().replaceAll("-", "")}.db`;
const database = `file:${path.resolve(root, "artifacts", "sounding-line", `generic-${candidate.slice(0, 12)}`, file).replaceAll("\\", "/")}`;
const preload = new URL("./synthetic-provider-preload.mjs", import.meta.url).href;
const tests = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [
    "scripts/sounding-line/run-browser-suite.mjs",
    "--profile",
    "generic",
    "--candidate",
    candidate,
    "--database-url",
    database,
    "--",
    ...(tests.length ? tests : ["tests/e2e/parallax-spatial-assistant.spec.ts"]),
  ],
  {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      DATABASE_URL: database,
      SOUNDING_LINE_SUITE_PROFILE: "generic",
      PARALLAX_A1_SYNTHETIC_PROVIDER: "1",
      OPENAI_API_KEY: "parallax-a1-synthetic-provider-only",
      NODE_OPTIONS: `--import=${preload}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
