import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const allowedRoot = path.resolve(required("LOCALAPPDATA"), "ProjectShipwright");
const taskRoot = path.resolve(process.env.SHIPWRIGHT_PHASE5_TASK_ROOT ?? path.join(allowedRoot, "phase5-browser"));
if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`))
  throw new Error(`SHIPWRIGHT_PHASE5_TASK_ROOT_REFUSED:${taskRoot}`);

// The established Phase 2 fixture supplies only a synthetic Creator identity.
// Phase 5 owns the database path, browser output, port, and all authored data.
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
  SHIPWRIGHT_PHASE5_TASK_ROOT: taskRoot,
  SHIPWRIGHT_PHASE5_PORT: String(port),
  SHIPWRIGHT_TEST_CREATOR_EMAIL: credentials.creator.email,
  SHIPWRIGHT_TEST_CREATOR_PASSWORD: credentials.password,
  DATABASE_URL: sqliteUrl(databasePath),
  NEXT_DIST_DIR: ".next-shipwright-phase5-browser",
  VOYAGEWRIGHT_BUILD_SHA: sourceSha,
};
run(
  "node_modules/@playwright/test/cli.js",
  ["test", "-c", "tests/e2e/fixtures/shipwright-phase5-playwright.config.ts"],
  env,
);
process.stdout.write(
  `${JSON.stringify({ status: "SHIPWRIGHT_PHASE5_BROWSER_JOURNEY_PASSED", sourceSha, fixtureVersion: "shipwright-phase2-v1", taskRoot, port })}\n`,
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
  if (result.error || result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string")
        return reject(new Error("SHIPWRIGHT_PHASE5_DYNAMIC_PORT_UNAVAILABLE"));
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
