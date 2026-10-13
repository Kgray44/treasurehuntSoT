// Owner-authorized real-photo development journey. Scanner qualification and production deployment are separate.
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
const args = process.argv.slice(2);
const argument = (name) => {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
};
if (!args.includes("--live-authorized")) throw new Error("Explicit live authorization required");
const model = argument("--model") ?? "gpt-6-luna";
const reasoningEffort = argument("--reasoning-effort") ?? "low";
const maxCalls = Number(argument("--max-calls"));
const timeoutMs = Number(argument("--timeout-ms") ?? 60000);
const budgetNano = Math.round(Number(argument("--budget-usd")) * 1e9);
if (
  !["gpt-6-luna", "gpt-6.1-sol"].includes(model) ||
  !["low", "medium"].includes(reasoningEffort) ||
  !Number.isInteger(maxCalls) ||
  maxCalls < 1 ||
  maxCalls > 6 ||
  !Number.isInteger(timeoutMs) ||
  timeoutMs < 1000 ||
  timeoutMs > 180000 ||
  !Number.isSafeInteger(budgetNano) ||
  budgetNano <= 0 ||
  budgetNano > 500000000
)
  throw new Error("Use at most six calls within the bounded model-specific photo budget");
if (!process.env.OPENAI_API_KEY?.trim()) throw new Error("Shared Windows process credential is absent");
const images = [argument("--image-one"), argument("--image-two")];
if (images.some((image) => !image || !existsSync(image)))
  throw new Error("Both owner-supplied local image paths are required");
const root = process.cwd();
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
const guardFile = path.join(folder, `owner-photo-${model}-guard.json`);
const dispatchFile = path.join(folder, `owner-photo-${model}-dispatch.jsonl`);
if (existsSync(dispatchFile)) throw new Error("Preserve the previous paid run before starting another run");
writeFileSync(guardFile, JSON.stringify({ model, reasoningEffort, maxCalls, budgetNano, dispatchFile }));
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
  PARALLAX_A1_SYNTHETIC_PROVIDER: "",
  PARALLAX_ROOM_PHOTO_RUNTIME: "OWNER_AUTHORIZED_LIVE_DEVELOPMENT",
  PARALLAX_ROOM_PHOTO_GUARD: guardFile,
  PARALLAX_OWNER_PHOTO_ONE: images[0],
  PARALLAX_OWNER_PHOTO_TWO: images[1],
  PARALLAX_OWNER_PHOTO_MODEL: model,
  PARALLAX_OWNER_PHOTO_REASONING: reasoningEffort,
  PARALLAX_OWNER_PHOTO_TIMEOUT_MS: String(timeoutMs),
  PARALLAX_OWNER_PHOTO_COMPARISON_ONLY: args.includes("--comparison-only") ? "1" : "",
  PARALLAX_OWNER_PHOTO_BUDGET_NANO: String(budgetNano),
  PARALLAX_OWNER_PHOTO_MAX_CALLS: String(maxCalls),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  PRISMA_GENERATE_SKIP_AUTOINSTALL: "true",
  PRIVATE_CONTENT_PROVIDER_ROOT: privateRoot,
  PRIVATE_CONTENT_LOCAL_MASTER_KEY: "1".repeat(64),
  PRIVATE_CONTENT_SCANNER_PROVIDER: "synthetic",
  NODE_OPTIONS: `--import=${new URL("./live-room-photo-budget-preload.mjs", import.meta.url).href}`,
};
for (const args of [
  ["node_modules/prisma/build/index.js", "generate", "--schema", "prisma/schema.sqlite.prisma"],
  ["scripts/sounding-line/sqlite-bootstrap.mjs", "--database-url", database],
  ["scripts/sounding-line/prepare-validation-isolation.mjs"],
])
  execFileSync(process.execPath, args, {
    cwd: root,
    env: { ...env, OPENAI_API_KEY: "", NODE_OPTIONS: "" },
    stdio: "inherit",
    windowsHide: true,
  });
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
    [
      "node_modules/@playwright/test/cli.js",
      "test",
      "tests/e2e/parallax-owner-room-photo.spec.ts",
      "--project",
      "chromium",
    ],
    { cwd: root, env: { ...env, OPENAI_API_KEY: "", NODE_OPTIONS: "" }, stdio: "inherit", windowsHide: true },
  );
  exitCode = await new Promise((resolve, reject) => {
    browser.once("error", reject);
    browser.once("exit", (code) => resolve(code ?? 1));
  });
} finally {
  if (server.exitCode === null) {
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      } catch (cause) {
        // An observed startup exit needs no second kill; retain the original failure and its receipt.
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (server.exitCode === null) throw cause;
      }
    } else server.kill("SIGTERM");
  }
  if (!path.resolve(privateRoot).startsWith(path.resolve(tmpdir()) + path.sep))
    throw new Error("Unsafe private fixture cleanup");
  rmSync(privateRoot, { recursive: true });
  const recordings = [];
  for (const directory of existsSync(path.join(root, "test-results"))
    ? readdirSync(path.join(root, "test-results"), { withFileTypes: true })
    : []) {
    if (!directory.isDirectory() || !directory.name.startsWith("parallax-owner-room-photo-")) continue;
    for (const file of readdirSync(path.join(root, "test-results", directory.name))) {
      if (!/^video(?:-\d+)?\.webm$/.test(file)) continue;
      const source = path.join(root, "test-results", directory.name, file),
        name = `photo-${model}-${directory.name}-${file}`;
      copyFileSync(source, path.join(folder, name));
      recordings.push({ file: name, sha256: createHash("sha256").update(readFileSync(source)).digest("hex") });
    }
  }
  const unchanged =
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === candidate &&
    !execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
  writeFileSync(
    path.join(folder, `owner-photo-${model}-run.json`),
    JSON.stringify(
      {
        candidate,
        tree: execFileSync("git", ["rev-parse", "HEAD^{tree}"], { encoding: "utf8" }).trim(),
        runtime: "DEVELOPMENT",
        provider: "OPENAI_REAL_OWNER_PHOTOS",
        scanner: "SYNTHETIC_DEVELOPMENT_ONLY_NOT_SECURITY_QUALIFICATION",
        authorizedBudgetNano: budgetNano,
        maxCalls,
        model,
        reasoningEffort,
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
