import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseHeartbeat, type Heartbeat } from "../src/telemetry.js";

function safeIdentifier(value: string | undefined, fallback: string) {
  const normalized = (value ?? fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 75);
  return /^[a-z][a-z0-9._-]{0,80}$/u.test(normalized) ? normalized : fallback;
}

function git(args: string[]) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function codexTaskHeartbeat(
  environment: Record<string, string | undefined> = process.env,
  now = new Date(),
): Heartbeat {
  const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
  const sourceSha = git(["-C", repositoryRoot, "rev-parse", "HEAD"]);
  const branch = git(["-C", repositoryRoot, "branch", "--show-current"]);
  const started = environment.BRIDGEWATCH_TASK_STARTED_AT;
  const startedAt = started && !Number.isNaN(Date.parse(started)) ? started : now.toISOString();
  if (!sourceSha || !/^[a-f0-9]{7,64}$/iu.test(sourceSha)) throw new Error("CODEX_REPORT_SOURCE_SHA_REQUIRED");
  if (!branch || !/^[A-Za-z0-9._/-]+$/u.test(branch)) throw new Error("CODEX_REPORT_BRANCH_REQUIRED");
  return parseHeartbeat(
    {
      workerId: safeIdentifier(environment.CODEX_TASK_ID, "codex-local-bridgewatch"),
      project: "bridgewatch",
      phase: environment.BRIDGEWATCH_CODEX_PHASE ?? "3",
      task: (environment.CODEX_TASK_SUMMARY ?? "Bridgewatch operational bring-up")
        .replace(/[\r\n]+/gu, " ")
        .slice(0, 200),
      state: "WORKING",
      branch,
      sourceSha,
      host: safeIdentifier(environment.COMPUTERNAME, "local-host"),
      startedAt,
      heartbeatAt: now.toISOString(),
    },
    now.getTime(),
  );
}

async function main() {
  const endpoint = process.env.BRIDGEWATCH_TELEMETRY_ENDPOINT;
  const token = process.env.BRIDGEWATCH_TELEMETRY_TOKEN;
  if (!endpoint || !/^https?:\/\//u.test(endpoint)) throw new Error("BRIDGEWATCH_TELEMETRY_ENDPOINT_REQUIRED");
  if (!token) throw new Error("BRIDGEWATCH_TELEMETRY_TOKEN_REQUIRED");
  const completion = process.argv.includes("--finish");
  const heartbeat = codexTaskHeartbeat();
  const telemetryBase = endpoint.replace(/\/(?:heartbeat|finish)\/?$/u, "").replace(/\/$/u, "");
  const response = await fetch(`${telemetryBase}${completion ? "/finish" : "/heartbeat"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(heartbeat),
  });
  if (!response.ok) throw new Error(`BRIDGEWATCH_CODEX_REPORT_REJECTED:${response.status}`);
  process.stdout.write(
    `${JSON.stringify({ accepted: true, workerId: heartbeat.workerId, state: completion ? "FINISHED" : "WORKING" })}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
