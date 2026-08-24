import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sha = (value) => /^[0-9a-f]{40}$/u.test(value);

/**
 * Hosted governed workers deliberately execute a task-owned copy that has no
 * Git metadata. The reusable worker has already rebound GITHUB_SHA to this
 * exact sealed value, so require the two identities to agree before using it.
 */
export function resolveSourceSha(environment, gitSource) {
  const sealed = environment.SOUNDING_LINE_SEALED_SOURCE_SHA;
  if (sealed) {
    if (!sha(sealed)) throw new Error("SHIPWRIGHT_SEALED_SOURCE_SHA_INVALID");
    if (environment.GITHUB_SHA !== sealed) throw new Error("SHIPWRIGHT_SEALED_SOURCE_SHA_MISMATCH");
    return sealed;
  }
  return gitSource();
}

export async function main(environment = process.env) {
  const repositoryRoot = path.resolve(process.cwd());
  const allowedRoot = path.resolve(required("LOCALAPPDATA", environment), "ProjectShipwright");
  const taskRoot = path.resolve(environment.SHIPWRIGHT_PHASE2_TASK_ROOT ?? path.join(allowedRoot, "phase2-browser"));
  if (!taskRoot.startsWith(`${allowedRoot}${path.sep}`)) throw new Error(`SHIPWRIGHT_TASK_ROOT_REFUSED:${taskRoot}`);

  run("scripts/shipwright/prepare-phase2-fixture.mjs", [], { ...environment, SHIPWRIGHT_PHASE2_TASK_ROOT: taskRoot });
  const credentials = JSON.parse(
    await readFile(path.join(taskRoot, "credentials", "shipwright-phase2-browser.private.json"), "utf8"),
  );
  const port = await availablePort();
  const databasePath = path.join(taskRoot, "database", "shipwright-phase2.db");
  const sourceSha = resolveSourceSha(environment, () => output("git", ["rev-parse", "HEAD"], repositoryRoot));
  const env = {
    ...environment,
    SHIPWRIGHT_PHASE2_TASK_ROOT: taskRoot,
    SHIPWRIGHT_PHASE2_PORT: String(port),
    SHIPWRIGHT_TEST_CREATOR_EMAIL: credentials.creator.email,
    SHIPWRIGHT_TEST_CREATOR_PASSWORD: credentials.password,
    DATABASE_URL: sqliteUrl(databasePath),
    NEXT_DIST_DIR: ".next-shipwright-phase2-browser",
    VOYAGEWRIGHT_BUILD_SHA: sourceSha,
  };
  run("node_modules/@playwright/test/cli.js", ["test", "-c", "playwright.shipwright-phase2.config.ts"], env);
  process.stdout.write(
    `${JSON.stringify({ status: "SHIPWRIGHT_PHASE2_BROWSER_JOURNEY_PASSED", sourceSha, fixtureVersion: "shipwright-phase2-v1", taskRoot, port })}\n`,
  );
}

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

function output(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr}`);
  return result.stdout.trim();
}

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("SHIPWRIGHT_DYNAMIC_PORT_UNAVAILABLE"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function sqliteUrl(value) {
  return `file:${value.replaceAll("\\", "/")}`;
}

function required(name, environment = process.env) {
  const value = environment[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
