// Bounded development-only photo journey. This is not protected production browser qualification.
import { execFileSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  copyFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import path from "node:path";
const root = process.cwd();
const requestedTests = process.argv.slice(2);
const allowedTests = new Set([
  "tests/e2e/parallax-environment-entry.spec.ts",
  "tests/e2e/parallax-room-photo.spec.ts",
  "tests/e2e/parallax-environment-creation.spec.ts",
  "tests/e2e/parallax-environment-library.spec.ts",
]);
if (requestedTests.some((test) => !allowedTests.has(test))) throw new Error("Task-owned photo journey required");
const tests = requestedTests.length ? requestedTests : ["tests/e2e/parallax-room-photo.spec.ts"];
// Large Playwright traces may use an explicitly supplied task-owned disk location.
// This changes no shared configuration and the immutable recordings are still archived below.
const resultRoot = process.env.PARALLAX_ROOM_BROWSER_OUTPUT
  ? path.resolve(process.env.PARALLAX_ROOM_BROWSER_OUTPUT)
  : path.join(root, "test-results");
const candidate = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim())
  throw new Error("Committed source required");
const folder = path.join(root, "artifacts", "parallax-a1", "browser", candidate.slice(0, 12));
const isolatedRoot = path.join(root, "artifacts", "sounding-line", `generic-${candidate.slice(0, 12)}`);
mkdirSync(isolatedRoot, { recursive: true });
mkdirSync(folder, { recursive: true });
const timestamp = new Date().toISOString().replace(/\D/g, "");
const database = `file:${path.join(isolatedRoot, `validation-isolated-${timestamp.slice(0, 8)}-${timestamp.slice(8)}-${randomUUID().replaceAll("-", "")}.db`).replaceAll("\\", "/")}`;
const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    server.close((error) => (error ? reject(error) : resolve(address.port)));
  });
});
const baseURL = `http://127.0.0.1:${port}`;
const privateRoot = mkdtempSync(path.join(tmpdir(), "voyagewright-photo-browser-"));
const env = {
  ...process.env,
  DATABASE_URL: database,
  NODE_ENV: "development",
  NEXT_DIST_DIR: ".next-photo-development",
  NEXT_TELEMETRY_DISABLED: "1",
  SOUNDING_LINE_SUITE_PROFILE: "generic",
  SOUNDING_LINE_TASK_OWNED_HTTP: "1",
  FOREVER_VALIDATION_ISOLATION: "1",
  FOREVER_VALIDATION_NONCE_HASH: createHash("sha256").update(`sounding-line:${candidate}:generic`).digest("hex"),
  FOREVER_PLAYWRIGHT_EXTERNAL_SERVER: "1",
  PLAYWRIGHT_BASE_URL: baseURL,
  PARALLAX_A1_SOURCE_SHA: candidate,
  PARALLAX_A1_SYNTHETIC_PROVIDER: "1",
  PARALLAX_ROOM_PHOTO_RUNTIME: "SYNTHETIC_DEVELOPMENT",
  OPENAI_API_KEY: "parallax-a1-synthetic-provider-only",
  PRIVATE_CONTENT_PROVIDER_ROOT: privateRoot,
  PRIVATE_CONTENT_LOCAL_MASTER_KEY: "1".repeat(64),
  PRIVATE_CONTENT_SCANNER_PROVIDER: "synthetic",
  NODE_OPTIONS: `--import=${new URL("./synthetic-provider-preload.mjs", import.meta.url).href}`,
};
for (const args of [
  ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma"],
  ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", database],
  ["scripts/sounding-line/prepare-validation-isolation.mjs"],
])
  execFileSync(process.execPath, args, { cwd: root, env, stdio: "inherit", windowsHide: true });
const startedAt = new Date().toISOString();
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)],
  { cwd: root, env, stdio: "inherit", windowsHide: true },
);
let exitCode = 1;
try {
  const deadline = Date.now() + 120000;
  for (;;) {
    if (server.exitCode !== null) throw new Error("Owned development server exited");
    try {
      if ((await fetch(baseURL)).ok) break;
    } catch {
      /* readiness only */
    }
    if (Date.now() > deadline) throw new Error("Owned development server readiness timed out");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const browser = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", ...tests, "--project", "chromium", "--output", resultRoot],
    { cwd: root, env, stdio: "inherit", windowsHide: true },
  );
  exitCode = await new Promise((resolve, reject) => {
    browser.once("error", reject);
    browser.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  if (process.platform === "win32")
    execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  else server.kill("SIGTERM");
  if (!path.resolve(privateRoot).startsWith(path.resolve(tmpdir()) + path.sep))
    throw new Error("Unsafe private fixture cleanup");
  rmSync(privateRoot, { recursive: true });
  const recordings = [];
  for (const directory of existsSync(resultRoot) ? readdirSync(resultRoot, { withFileTypes: true }) : []) {
    if (!directory.isDirectory() || !directory.name.startsWith("parallax-")) continue;
    for (const file of readdirSync(path.join(resultRoot, directory.name))) {
      if (!/^video(?:-\d+)?\.webm$/.test(file)) continue;
      const source = path.join(resultRoot, directory.name, file),
        name = `photo-${directory.name}-${file}`;
      copyFileSync(source, path.join(folder, name));
      recordings.push({ file: name, sha256: createHash("sha256").update(readFileSync(source)).digest("hex") });
    }
  }
  const unchanged =
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === candidate &&
    !execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  writeFileSync(
    path.join(folder, "photo-run.json"),
    JSON.stringify(
      {
        candidate,
        tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
        runtime: "DEVELOPMENT",
        provider: "SYNTHETIC_UNPAID",
        startedAt,
        finishedAt: new Date().toISOString(),
        exitCode,
        sourceBinding: unchanged ? "VALID" : "INVALIDATED",
        recordings,
      },
      null,
      2,
    ),
  );
  if (!unchanged) throw new Error("Source changed during photo capture");
}
process.exitCode = exitCode;
