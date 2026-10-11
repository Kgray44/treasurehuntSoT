import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isolatedBrowserFixtureCredentials } from "../sounding-line/browser-suite-profiles.mjs";

// Focused preparation only. It never emits a Sounding Line acceptance decision.
const root = process.cwd();
const artifactRoot = path.resolve("artifacts/crossdeck/realtime-browser");
await mkdir(artifactRoot, { recursive: true });
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const freePort = () =>
  new Promise((resolve, reject) => {
    const reservation = createServer();
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => {
      const address = reservation.address();
      reservation.close(() => resolve(address.port));
    });
  });
const port = await freePort();
const secondaryPort = await freePort();
const databaseRoot = path.resolve("artifacts/sounding-line", `generic-${sourceSha.slice(0, 12)}`);
await mkdir(databaseRoot, { recursive: true });
const databasePath = path.join(
  databaseRoot,
  `validation-isolated-20261011-141000000-${randomUUID().replaceAll("-", "")}.db`,
);
const emailRoot = path.join(artifactRoot, "email");
const env = {
  ...process.env,
  ...isolatedBrowserFixtureCredentials("generic"),
  DATABASE_URL: `file:${databasePath.replaceAll("\\", "/")}`,
  SOUNDING_LINE_SUITE_PROFILE: "generic",
  SOUNDING_LINE_INTERNAL_RUNTIME: "1",
  SOUNDING_LINE_TASK_OWNED_HTTP: "1",
  FOREVER_VALIDATION_ISOLATION: "1",
  FOREVER_VALIDATION_NONCE_HASH: createHash("sha256").update(randomUUID()).digest("hex"),
  HOMEPORT_TRANSACTIONAL_EMAIL_PROVIDER: "SYNTHETIC_OUTBOX",
  HOMEPORT_SYNTHETIC_EMAIL_ADAPTER: "TASK_OWNED_TEST",
  HOMEPORT_PHASE7_TASK_ROOT: emailRoot,
  HOMEPORT_SYNTHETIC_OUTBOX_PATH: path.join(emailRoot, "outbox/messages.jsonl"),
  VALIDATION_ARTIFACTS: artifactRoot,
  PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`,
  CROSSDECK_SECONDARY_URL: `http://127.0.0.1:${secondaryPort}`,
  FOREVER_PLAYWRIGHT_EXTERNAL_SERVER: "1",
  SEALED_HOLD_SINGLE_FORK: "1",
  CIRCLE_NODE_TOTAL: "2",
};
function run(args) {
  execFileSync(process.execPath, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
}
run(["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma"]);
run(["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", env.DATABASE_URL]);
run(["node_modules/tsx/dist/cli.mjs", "prisma/seed.ts"]);
run(["node_modules/tsx/dist/cli.mjs", "scripts/migrate-legacy-companion.ts"]);
run(["scripts/sounding-line/prepare-validation-isolation.mjs"]);
let buildSourceSha = sourceSha;
const reusedProductBuild = process.env.CROSSDECK_REUSE_FOCUSED_BUILD === "1";
if (reusedProductBuild) {
  const previous = JSON.parse(await readFile(path.join(artifactRoot, "runtime.json"), "utf8"));
  if (previous.status !== "PASS") throw new Error("CROSSDECK_PREVIOUS_BUILD_NOT_QUALIFIED");
  buildSourceSha = previous.buildSourceSha ?? previous.sourceSha;
  const changedProduct = execFileSync(
    "git",
    [
      "diff",
      "--name-only",
      buildSourceSha,
      sourceSha,
      "--",
      "src",
      "prisma",
      "public",
      "package.json",
      "package-lock.json",
      "next.config.ts",
      "tsconfig.json",
    ],
    { encoding: "utf8" },
  ).trim();
  if (changedProduct) throw new Error("CROSSDECK_PRODUCT_CHANGED_REBUILD_REQUIRED");
} else run(["node_modules/next/dist/bin/next", "build"]);
const log = [];
const metricsPath = path.join(artifactRoot, "server-metrics.json");
env.CROSSDECK_SERVER_METRICS_PATH = metricsPath;
const startServer = (selectedPort, selectedMetrics) =>
  spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(selectedPort)], {
    env: {
      ...env,
      NODE_ENV: "production",
      CROSSDECK_SERVER_METRICS_PATH: selectedMetrics,
      NODE_OPTIONS: `${env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(path.resolve("scripts/crossdeck/server-metrics-preload.mjs")).href}`,
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
const server = startServer(port, metricsPath);
const secondary = startServer(secondaryPort, path.join(artifactRoot, "secondary-metrics.json"));
for (const ownedServer of [server, secondary]) {
  ownedServer.stdout.on("data", (chunk) => log.push(String(chunk)));
  ownedServer.stderr.on("data", (chunk) => log.push(String(chunk)));
}
let status = "FAIL";
try {
  const start = Date.now();
  let ready = false;
  while (Date.now() - start < 60000) {
    try {
      const response = await fetch(env.PLAYWRIGHT_BASE_URL, { signal: AbortSignal.timeout(1000) });
      const secondaryResponse = await fetch(env.CROSSDECK_SECONDARY_URL, { signal: AbortSignal.timeout(1000) });
      if (response.status < 500 && secondaryResponse.status < 500) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("CROSSDECK_OWNED_SERVER_NOT_READY");
  run([
    "node_modules/@playwright/test/cli.js",
    "test",
    ...(process.argv.slice(2).length
      ? process.argv.slice(2)
      : [
          "tests/e2e/crossdeck-phase1.spec.ts",
          "tests/e2e/crossdeck-phase2.spec.ts",
          "tests/e2e/crossdeck-realtime.spec.ts",
        ]),
    "--project=chromium",
    "--workers=1",
    "--reporter=list",
  ]);
  status = "PASS";
} finally {
  for (const ownedServer of [server, secondary]) ownedServer.kill();
  await Promise.all(
    [server, secondary].map(
      (ownedServer) =>
        new Promise((resolve) => {
          if (ownedServer.exitCode !== null) resolve();
          else ownedServer.once("exit", resolve);
        }),
    ),
  );
  await writeFile(path.join(artifactRoot, "server.log"), log.join(""));
  await writeFile(
    path.join(artifactRoot, "runtime.json"),
    JSON.stringify(
      {
        status,
        sourceSha,
        buildSourceSha,
        reusedProductBuild,
        sourceTree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
        dirtySource: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim().length > 0,
        lockfileSha256: createHash("sha256")
          .update(await readFile("package-lock.json"))
          .digest("hex"),
        port,
        ownedPid: server.pid,
        secondaryPort,
        secondaryPid: secondary.pid,
        cleanup: "owned server exited",
        qualification: "FOCUSED_DEVELOPMENT_ONLY",
      },
      null,
      2,
    ) + "\n",
  );
}
