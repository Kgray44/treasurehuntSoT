import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(process.cwd());
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectShipwright");
const taskRoot = path.resolve(process.env.SHIPWRIGHT_PHASE3_TASK_ROOT ?? path.join(allowedRoot, "phase3-browser"));
if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`))
  throw new Error(`SHIPWRIGHT_PHASE3_TASK_ROOT_REFUSED:${taskRoot}`);

// The Phase 2 fixture is intentionally reused only as a synthetic Creator
// account seed. Phase 3 owns its database path, browser reports, port, and
// test selection; no canonical data or credentials are touched.
run("scripts/shipwright/prepare-phase2-fixture.mjs", [], {
  ...process.env,
  SHIPWRIGHT_PHASE2_TASK_ROOT: taskRoot,
});
const credentials = JSON.parse(
  await readFile(path.join(taskRoot, "credentials", "shipwright-phase2-browser.private.json"), "utf8"),
);
const port = await availablePort();
const databasePath = path.join(taskRoot, "database", "shipwright-phase2.db");
const sourceSha = output("git", ["rev-parse", "HEAD"]);
const env = {
  ...process.env,
  SHIPWRIGHT_PHASE3_TASK_ROOT: taskRoot,
  SHIPWRIGHT_PHASE3_PORT: String(port),
  SHIPWRIGHT_TEST_CREATOR_EMAIL: credentials.creator.email,
  SHIPWRIGHT_TEST_CREATOR_PASSWORD: credentials.password,
  DATABASE_URL: sqliteUrl(databasePath),
  NEXT_DIST_DIR: ".next-shipwright-phase3-browser",
  VOYAGEWRIGHT_BUILD_SHA: sourceSha,
};
run("node_modules/@playwright/test/cli.js", ["test", "-c", "playwright.shipwright-phase3.config.ts"], env);
process.stdout.write(
  `${JSON.stringify({ status: "SHIPWRIGHT_PHASE3_BROWSER_JOURNEY_PASSED", sourceSha, fixtureVersion: "shipwright-phase2-v1", taskRoot, port })}\n`,
);

function run(script, args, env) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function output(command, args) {
  const result = spawnSync(command, args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  return result.stdout.trim();
}
function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("SHIPWRIGHT_PHASE3_DYNAMIC_PORT_UNAVAILABLE"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}
function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}
function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}
