import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = process.cwd();
const candidate = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw new Error("PARALLAX_A1_COMMITTED_BROWSER_SOURCE_REQUIRED");
const artifactRoot = path.resolve(root, "artifacts", "parallax-a1", "browser", candidate.slice(0, 12));
mkdirSync(artifactRoot, { recursive: true });
const record = {
  schemaVersion: 1,
  candidate,
  tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
  packageLockSha256: createHash("sha256").update(readFileSync("package-lock.json")).digest("hex"),
  provider: "SYNTHETIC_UNPAID",
  startedAt: new Date().toISOString(),
};
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
      PARALLAX_BROWSER_RUNTIME: "PRODUCTION",
      PARALLAX_A1_SOURCE_SHA: candidate,
      OPENAI_API_KEY: "parallax-a1-synthetic-provider-only",
      NODE_OPTIONS: `--import=${preload}`,
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
// Playwright owns and replaces test-results on each run. Retain its motion
// recordings beside this exact source receipt before another run can replace them.
const recordings = [];
const resultRoot = path.resolve(root, "test-results");
if (existsSync(resultRoot)) {
  for (const directory of readdirSync(resultRoot, { withFileTypes: true })) {
    if (!directory.isDirectory() || !directory.name.startsWith("parallax-")) continue;
    for (const recording of readdirSync(path.join(resultRoot, directory.name))) {
      if (recording === "error-context.md" || /^test-failed.*\.png$/.test(recording)) {
        copyFileSync(
          path.join(resultRoot, directory.name, recording),
          path.join(artifactRoot, `${directory.name}-${recording}`),
        );
        continue;
      }
      if (!/^video(?:-\d+)?\.webm$/.test(recording)) continue;
      const file = path.join(resultRoot, directory.name, recording);
      const destination = path.join(artifactRoot, `${directory.name}-${recording}`);
      copyFileSync(file, destination);
      recordings.push({
        file: path.basename(destination),
        sha256: createHash("sha256").update(readFileSync(destination)).digest("hex"),
      });
    }
  }
}
const sourceUnchanged =
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === candidate &&
  !execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
writeFileSync(
  path.join(artifactRoot, "run.json"),
  JSON.stringify(
    {
      ...record,
      finishedAt: new Date().toISOString(),
      exitCode: result.status,
      sourceBinding: sourceUnchanged ? "VALID" : "INVALIDATED",
      recordings,
    },
    null,
    2,
  ),
);
if (result.error) throw result.error;
if (!sourceUnchanged) throw new Error("PARALLAX_A1_BROWSER_SOURCE_CHANGED_DURING_CAPTURE");
process.exitCode = result.status ?? 1;
