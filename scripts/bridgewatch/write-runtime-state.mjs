import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const allowedStates = new Set(["STARTING", "RUNNING", "STOPPED", "FAILED"]);

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasOption(name) {
  return process.argv.includes(name);
}

function runtimeStatePath() {
  const configured = process.env.BRIDGEWATCH_VOYAGEWRIGHT_RUNTIME_STATE_PATH;
  const fallback = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, "ForeverTreasureCompanion", "bridgewatch-runtime-state.json")
    : null;
  const target = configured ?? fallback;
  if (!target || !isAbsolute(target)) throw new Error("BRIDGEWATCH_RUNTIME_STATE_PATH_REQUIRED");
  return resolve(target);
}

function sourceSha(sourceRoot) {
  try {
    const value = execFileSync("git", ["-C", sourceRoot, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return /^[a-f0-9]{7,64}$/iu.test(value) ? value : null;
  } catch {
    return null;
  }
}

async function existingStartedAt(path, port) {
  try {
    const prior = JSON.parse(await readFile(path, "utf8"));
    return prior?.port === port && typeof prior?.startedAt === "string" && Number.isFinite(Date.parse(prior.startedAt))
      ? prior.startedAt
      : null;
  } catch {
    return null;
  }
}

export async function writeVoyagewrightRuntimeState({ state, port, sourceRoot = process.cwd() }) {
  if (!allowedStates.has(state)) throw new Error("BRIDGEWATCH_RUNTIME_STATE_INVALID");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("BRIDGEWATCH_RUNTIME_PORT_INVALID");
  const path = runtimeStatePath();
  const observedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    sourceSha: sourceSha(sourceRoot),
    port,
    startedAt: state === "RUNNING" ? ((await existingStartedAt(path, port)) ?? observedAt) : null,
    state,
    observedAt,
    runtime: "next-development",
  };
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload)}\n`, { encoding: "utf8", flag: "w" });
  await rename(temporary, path);
  return payload;
}

async function maintainVoyagewrightRuntimeState({ state, port, sourceRoot, intervalMs }) {
  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  do {
    await writeVoyagewrightRuntimeState({ state, port, sourceRoot });
    if (!stopping) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (!stopping);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const state = option("--state");
  const port = Number(option("--port"));
  const sourceRoot = option("--source-root") ?? process.cwd();
  const intervalMs = Number(option("--interval-ms") ?? 30_000);
  if (!Number.isInteger(intervalMs) || intervalMs < 5_000 || intervalMs > 60_000)
    throw new Error("BRIDGEWATCH_RUNTIME_REFRESH_INTERVAL_INVALID");
  if (hasOption("--watch")) await maintainVoyagewrightRuntimeState({ state, port, sourceRoot, intervalMs });
  else await writeVoyagewrightRuntimeState({ state, port, sourceRoot });
}
