import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const maxStateBytes = 8 * 1024;
const currentStates = new Set(["STARTING", "READY"]);
const knownStates = new Set(["STARTING", "READY", "STOPPED", "FAILED"]);

export type CommunityWorkerRuntimeState = "STARTING" | "READY" | "STOPPED" | "FAILED";
export type CommunityWorkerRuntime = Readonly<{
  schemaVersion: 1;
  state: CommunityWorkerRuntimeState;
  startedAt: string;
  heartbeatAt: string;
  ready: boolean;
}>;

function configuredPath() {
  const value = process.env.COMMUNITY_WORKER_STATE_PATH?.trim();
  if (!value) return null;
  if (!path.isAbsolute(value)) throw new Error("COMMUNITY_WORKER_STATE_PATH must be absolute");
  return path.resolve(value);
}

function asTimestamp(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

export async function readCommunityWorkerRuntime(): Promise<CommunityWorkerRuntime | null> {
  let file: string | null;
  try {
    file = configuredPath();
  } catch {
    return null;
  }
  if (!file) return null;
  try {
    const raw = await readFile(file, "utf8");
    if (Buffer.byteLength(raw, "utf8") > maxStateBytes) return null;
    const candidate = JSON.parse(raw) as Record<string, unknown>;
    const state = typeof candidate.state === "string" ? candidate.state : "";
    const startedAt = asTimestamp(candidate.startedAt);
    const heartbeatAt = asTimestamp(candidate.heartbeatAt);
    if (
      candidate.schemaVersion !== 1 ||
      !knownStates.has(state) ||
      !startedAt ||
      !heartbeatAt ||
      typeof candidate.ready !== "boolean"
    )
      return null;
    return {
      schemaVersion: 1,
      state: state as CommunityWorkerRuntimeState,
      startedAt,
      heartbeatAt,
      ready: candidate.ready,
    };
  } catch {
    return null;
  }
}

export function workerRuntimeCurrent(runtime: CommunityWorkerRuntime | null, staleAfterMs = 90_000) {
  return Boolean(
    runtime &&
      currentStates.has(runtime.state) &&
      runtime.ready &&
      Date.now() - Date.parse(runtime.heartbeatAt) >= 0 &&
      Date.now() - Date.parse(runtime.heartbeatAt) <= staleAfterMs,
  );
}

export async function writeCommunityWorkerRuntime(
  state: CommunityWorkerRuntimeState,
  startedAt: string,
  ready: boolean,
): Promise<void> {
  const file = configuredPath();
  if (!file) return;
  const heartbeatAt = new Date().toISOString();
  const payload: CommunityWorkerRuntime = {
    schemaVersion: 1,
    state,
    startedAt,
    heartbeatAt,
    ready,
  };
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload)}\n`, { encoding: "utf8", flag: "w" });
  await rename(temporary, file);
}
