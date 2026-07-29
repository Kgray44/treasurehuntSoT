/*
 * Governed product-suite adapters.  This module intentionally contains the
 * only command catalogue used by the Sounding Line runtime.  Policy may name
 * an adapter, but it can never supply a shell fragment or executable path.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const safePath = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  !path.isAbsolute(value) &&
  !value.includes("\\0") &&
  !value.split(/[\\/]/u).includes("..");
const safeProject = (value) => typeof value === "string" && /^[a-z][a-z0-9-]{0,80}$/u.test(value);
const safeSuite = (value) =>
  safePath(value) &&
  /(?:^src\/.*\.test\.(?:ts|tsx)|^tests\/.*\.test\.(?:ts|tsx)|^scripts\/.*\.test\.ts)$/u.test(
    value.replace(/\\/gu, "/"),
  );

const node = process.execPath;
const vitest = ["node_modules/vitest/vitest.mjs", "run"];

export const adapters = Object.freeze({
  policy: {
    command: [node, "scripts/sounding-line/cli.mjs", "validate-policy"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  inventory: {
    command: [node, "scripts/sounding-line/cli.mjs", "inventory"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  runtime: {
    command: [node, "--test", "tests/sounding-line/phase2-runtime.test.mjs"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  docs: { command: [node, "scripts/validate-documentation.mjs"], resources: ["node-slot"], mode: "CERTIFIED" },
  features: {
    command: [node, "node_modules/tsx/dist/cli.mjs", "scripts/features/validate-feature-catalog.ts"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  architecture: {
    command: [node, "node_modules/tsx/dist/cli.mjs", "scripts/validate-project-one-voyage.ts"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  language: {
    command: [node, "node_modules/tsx/dist/cli.mjs", "scripts/validate-user-facing-language.ts"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  privacy: {
    command: [node, "node_modules/tsx/dist/cli.mjs", "scripts/private-content/scan.ts"],
    resources: ["node-slot", "scanner"],
    mode: "CERTIFIED",
  },
  build: {
    command: [node, "node_modules/next/dist/bin/next", "build", "--webpack"],
    resources: ["node-slot", "production-build-directory"],
    mode: "SERIAL_WITHIN_FAMILY",
  },
  "sqlite-validate": {
    command: [node, "node_modules/prisma/build/index.js", "validate", "--schema", "prisma/schema.sqlite.prisma"],
    resources: ["node-slot", "prisma-sqlite-client"],
    mode: "CERTIFIED",
  },
  "mysql-validate": {
    command: [node, "node_modules/prisma/build/index.js", "validate", "--schema", "prisma/schema.prisma"],
    resources: ["node-slot", "mysql-schema"],
    mode: "SERIAL_WITHIN_FAMILY",
  },
  "legacy-full": {
    command: ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/test-all.ps1"],
    resources: ["validation-runtime"],
    mode: "EMERGENCY_SERIAL",
  },
  "harborlight-browser-lanes": {
    command: [node, "scripts/sounding-line/harborlight-browser-lanes.mjs"],
    resources: ["browser-lane-a", "browser-lane-b", "sqlite-clone", "trace-root"],
    mode: "CERTIFIED",
  },
});

export function resolveAdapter(id, argumentsList = []) {
  const adapter = adapters[id];
  if (!adapter) throw new Error(`unallowlisted Sounding Line adapter: ${id}`);
  if (!Array.isArray(argumentsList)) throw new Error("adapter arguments must be an array");
  if (argumentsList.length) throw new Error(`adapter ${id} does not accept arguments`);
  return { id, command: [...adapter.command], resources: [...adapter.resources], mode: adapter.mode };
}

export function resolveVitestAdapter(files) {
  if (!Array.isArray(files) || !files.length || files.some((file) => !safeSuite(file)))
    throw new Error("Vitest adapter accepts only repository-relative test files");
  return {
    id: "vitest",
    command: [node, ...vitest, ...files.map((file) => file.replace(/\\/gu, "/"))],
    resources: ["node-slot", "vitest-worker-pool"],
    mode: "CERTIFIED",
  };
}

export function resolvePlaywrightAdapter(project, spec) {
  if (
    !safeProject(project) ||
    (spec !== undefined && (!safePath(spec) || !/^tests\/e2e\/.*\.spec\.ts$/u.test(spec.replace(/\\/gu, "/"))))
  )
    throw new Error("Playwright adapter requires a safe project and optional e2e spec");
  return {
    id: "playwright",
    command: [
      node,
      "node_modules/@playwright/test/cli.js",
      "test",
      `--project=${project}`,
      ...(spec ? [spec.replace(/\\/gu, "/")] : []),
    ],
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
    mode: "SERIAL_WITHIN_FAMILY",
  };
}

export async function executeAdapter(adapter, { cwd, env = {}, maxLogBytes = 64 * 1024 } = {}) {
  if (!adapter?.command?.length || !cwd) throw new Error("adapter command and working directory are required");
  return new Promise((resolve, reject) => {
    const [file, ...args] = adapter.command;
    const child = spawn(file, args, { cwd, env: { ...process.env, ...env }, shell: false, windowsHide: true });
    let output = "";
    const append = (chunk) => {
      if (output.length < maxLogBytes) output += chunk.toString().slice(0, maxLogBytes - output.length);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", reject);
    child.once("close", (exitCode, signal) =>
      resolve({ exitCode: exitCode ?? -1, signal: signal ?? null, log: output, pid: child.pid }),
    );
  });
}
