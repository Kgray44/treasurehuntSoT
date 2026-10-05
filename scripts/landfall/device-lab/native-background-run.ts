import { generateKeyPairSync, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { nativeReturnLogObservation } from "../../../src/landfall/device-lab/native-return-observation";
import { labTool } from "./host";

/** Ephemeral memory-only signing material reaches the actual optimized server.
 * Neither the key nor notification claims are files, command arguments or logs. */
async function main() {
  const candidate = process.argv[2] ?? "";
  if (
    process.platform !== "linux" ||
    process.env.GITHUB_ACTIONS !== "true" ||
    process.env.RUNNER_ENVIRONMENT !== "github-hosted" ||
    process.env.LANDFALL_NATIVE_BACKGROUND !== "1" ||
    !/^[a-f0-9]{40}$/.test(candidate) ||
    (await labTool("git", ["rev-parse", "HEAD"])).trim() !== candidate
  )
    throw new Error("LANDFALL_NATIVE_RETURN_HOSTED_SOURCE_REQUIRED");
  const key = generateKeyPairSync("ed25519").privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const clock = new Date().toISOString().replace(/[-:TZ.]/g, "");
  const database = path.join(
    process.cwd(),
    "artifacts/sounding-line",
    `generic-${candidate.slice(0, 12)}`,
    `validation-isolated-${clock.slice(0, 8)}-${clock.slice(8)}-${randomUUID().replaceAll("-", "")}.db`,
  );
  const observerPath = path.resolve("artifacts/landfall-device-lab", `native-return-observer-${randomUUID()}.json`);
  await mkdir(path.dirname(observerPath), { recursive: true });
  const events: NonNullable<ReturnType<typeof nativeReturnLogObservation>>[] = [];
  await writeFile(observerPath, JSON.stringify({ version: 1, sourceSha: candidate, events }));
  let buffer = "",
    observerFailed = false,
    saving = Promise.resolve();
  const child = spawn(
    process.execPath,
    [
      "scripts/sounding-line/run-browser-suite.mjs",
      "--profile",
      "generic",
      "--candidate",
      candidate,
      "--database-url",
      `file:${database}`,
      "--",
      "tests/e2e/landfall-native-background.spec.ts",
    ],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "inherit"],
      env: {
        ...process.env,
        SOUNDING_LINE_BROWSER_PORT: "4487",
        LANDFALL_PACKAGE_SIGNING_KEY: key,
        LANDFALL_PACKAGE_KEY_ID: "landfall-native-return-lab",
        LANDFALL_NATIVE_RETURN_OBSERVATION_PATH: observerPath,
        LOG_LEVEL: "info",
      },
      windowsHide: true,
    },
  );
  child.stdout!.on("data", (chunk: Buffer) => {
    // Preserve the runner's normal output. Only validated finite platform events
    // become files; no raw log, PID, URL, claim or signing key is copied.
    process.stdout.write(chunk);
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    if (buffer.length > 65536) buffer = "";
    for (const line of lines) {
      const event = nativeReturnLogObservation(line);
      if (!event || events.length >= 32) continue;
      events.push(event);
      const snapshot = JSON.stringify({ version: 1, sourceSha: candidate, events });
      saving = saving
        .then(async () => {
          await writeFile(observerPath + ".next", snapshot);
          await rename(observerPath + ".next", observerPath);
        })
        .catch(() => {
          observerFailed = true;
        });
    }
  });
  const code = await new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (value) => resolve(value ?? 1));
  });
  await saving;
  process.exitCode = observerFailed ? 1 : code;
}
main().catch(() => {
  process.stderr.write("LANDFALL_NATIVE_RETURN_EXECUTION_FAILED\n");
  process.exitCode = 1;
});
