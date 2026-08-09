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
  /(?:^src\/.*\.(?:test|spec)\.(?:ts|tsx|mjs|js)|^tests\/.*\.(?:test|spec)\.(?:ts|tsx|mjs|js)|^scripts\/.*\.(?:test|spec)\.(?:ts|tsx|mjs|js))$/u.test(
    value.replace(/\\/gu, "/"),
  );

const node = process.execPath;
const vitest = ["node_modules/vitest/vitest.mjs", "run"];

export const adapters = Object.freeze({
  // Family adapters are resolved from the sealed active registry by authority.mjs.
  // They intentionally cannot be run without an exact, non-empty file selection.
  "vitest-family": { command: null, resources: ["node-slot", "vitest-worker-pool"], mode: "CERTIFIED" },
  "playwright-family": {
    command: null,
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
    mode: "SERIAL_WITHIN_FAMILY",
  },
  "powershell-family": { command: null, resources: ["validation-runtime"], mode: "SERIAL_WITHIN_FAMILY" },
  "vitest-all": { command: [node, ...vitest], resources: ["node-slot", "vitest-worker-pool"], mode: "CERTIFIED" },
  "playwright-chromium": {
    command: [node, "node_modules/@playwright/test/cli.js", "test", "--project=chromium"],
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
    mode: "SERIAL_WITHIN_FAMILY",
  },
  "playwright-webkit": {
    command: [node, "node_modules/@playwright/test/cli.js", "test", "--project=webkit-mobile"],
    resources: ["application-port", "sqlite-clone", "browser-webkit", "trace-root"],
    mode: "SERIAL_WITHIN_FAMILY",
  },
  "playwright-access-sentinel": {
    command: [
      node,
      "node_modules/@playwright/test/cli.js",
      "test",
      "--project=sounding-line-access-sentinel",
      "tests/e2e/access-gates.spec.ts",
    ],
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
    mode: "SERIAL_WITHIN_FAMILY",
  },
  static: { command: [node, "scripts/sounding-line/static.mjs"], resources: ["node-slot"], mode: "CERTIFIED" },
  policy: {
    command: [node, "scripts/sounding-line/cli.mjs", "validate-policy"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  "p34-retirement": {
    command: [node, "scripts/sounding-line/p34-retirement.mjs"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  inventory: {
    command: [node, "scripts/sounding-line/cli.mjs", "inventory"],
    resources: ["node-slot"],
    mode: "CERTIFIED",
  },
  runtime: {
    command: [
      node,
      "--test",
      "tests/sounding-line/phase2-runtime.test.mjs",
      "scripts/sounding-line/cli.test.mjs",
      "tests/sounding-line/authority-cutover.test.mjs",
    ],
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
    command: [node, "scripts/sounding-line/build.mjs"],
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
  "harborlight-browser-lanes": {
    command: [node, "scripts/sounding-line/harborlight-browser-lanes.mjs"],
    resources: ["browser-lane-a", "browser-lane-b", "sqlite-clone", "trace-root"],
    mode: "CERTIFIED",
  },
  "harborlight-sqlite": {
    command: [node, "node_modules/prisma/build/index.js", "validate", "--schema", "prisma/schema.sqlite.prisma"],
    resources: ["sqlite-clone", "prisma-sqlite-client"],
    mode: "CERTIFIED",
  },
  "admiralty-phase1-browser": {
    command: [node, "scripts/admiralty/run-phase1-journeys.mjs"],
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root", "production-build-directory"],
    mode: "CERTIFIED",
  },
  "admiralty-phase2-browser": {
    command: [node, "scripts/admiralty/run-phase2-journeys.mjs"],
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root", "production-build-directory"],
    mode: "CERTIFIED",
  },
});

export function resolveAdapter(id, argumentsList = []) {
  const adapter = adapters[id];
  if (!adapter) throw new Error(`unallowlisted Sounding Line adapter: ${id}`);
  if (!Array.isArray(argumentsList)) throw new Error("adapter arguments must be an array");
  if (argumentsList.length) throw new Error(`adapter ${id} does not accept arguments`);
  if (!adapter.command) return { id, command: null, resources: [...adapter.resources], mode: adapter.mode };
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

export function resolvePlaywrightFamilyAdapter(project, specs) {
  if (!safeProject(project) || !Array.isArray(specs) || !specs.length)
    throw new Error("Playwright family adapter requires declared projects and non-empty specs");
  const safeSpecs = [...new Set(specs.map((spec) => spec.replace(/\\/gu, "/")))];
  if (safeSpecs.some((spec) => !safePath(spec) || !/^tests\/e2e\/.*\.(?:spec|setup)\.ts$/u.test(spec)))
    throw new Error("Playwright family adapter received an unsafe spec");
  return {
    id: "playwright-family",
    command: [node, "node_modules/@playwright/test/cli.js", "test", `--project=${project}`, ...safeSpecs],
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
    mode: "SERIAL_WITHIN_FAMILY",
  };
}

export function resolveIsolatedBrowserFamilyAdapter(selections, baselineDatabase, expectMutation = true) {
  if (!Array.isArray(selections) || !selections.length)
    throw new Error("Isolated browser adapter requires non-empty exact browser selections");
  if (typeof baselineDatabase !== "string" || !path.isAbsolute(baselineDatabase))
    throw new Error("Isolated browser adapter requires an absolute trusted baseline database");
  if (typeof expectMutation !== "boolean")
    throw new Error("Isolated browser adapter mutation expectation must be boolean");
  const normalizedSelections = selections.map((selection) => ({
    project: selection?.project,
    files: Array.isArray(selection?.files)
      ? [...new Set(selection.files.map((file) => file.replace(/\\/gu, "/")))].sort()
      : [],
    grep: selection?.grep,
    caseCount: selection?.caseCount,
  }));
  if (
    normalizedSelections.some(
      (selection) =>
        !safeProject(selection.project) ||
        !selection.files.length ||
        selection.files.some((file) => !/^tests\/e2e\/.*\.(?:spec|setup)\.ts$/u.test(file)) ||
        typeof selection.grep !== "string" ||
        !selection.grep.length ||
        !Number.isInteger(selection.caseCount) ||
        selection.caseCount <= 0,
    )
  )
    throw new Error("Isolated browser adapter accepts only exact registered e2e selections");
  const browserSelectionsBase64 = Buffer.from(JSON.stringify(normalizedSelections), "utf8").toString("base64");
  return {
    id: "isolated-playwright-family",
    command: [
      "powershell.exe",
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "scripts/sounding-line/isolated-validation-runtime.ps1",
      "-SkipBrowserInstall",
      "-BaselineDatabasePath",
      baselineDatabase,
      "-BrowserOnly",
      "-SoundingLineLane",
      "browser-family",
      "-SoundingLinePort",
      "3100",
      "-BrowserSelectionsBase64",
      browserSelectionsBase64,
      "-ExpectMutation",
      String(expectMutation),
    ],
    resources: ["application-port", "sqlite-clone", "browser-chromium", "trace-root"],
    mode: "SERIAL_WITHIN_FAMILY",
    caseCount: normalizedSelections.reduce((total, selection) => total + selection.caseCount, 0),
  };
}

export async function executeAdapter(adapter, { cwd, env = {}, maxLogBytes = 64 * 1024, timeoutMs } = {}) {
  if (!adapter?.command?.length || !cwd) throw new Error("adapter command and working directory are required");
  if (timeoutMs !== undefined && (!Number.isInteger(timeoutMs) || timeoutMs <= 0))
    throw new Error("adapter timeout must be a positive integer when provided");
  return new Promise((resolve, reject) => {
    const [file, ...args] = adapter.command;
    const child = spawn(file, args, { cwd, env: { ...process.env, ...env }, shell: false, windowsHide: true });
    let output = "";
    let timedOut = false;
    const timer = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          // A PowerShell browser adapter owns a child server and Playwright
          // process tree. Killing only its shell leaves the tree alive on
          // Windows and prevents a governed timeout receipt from being
          // written before the hosted-worker deadline.
          if (process.platform === "win32" && child.pid) {
            const terminator = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
              shell: false,
              windowsHide: true,
            });
            terminator.on("error", () => {});
            terminator.unref();
          } else child.kill();
        }, timeoutMs)
      : undefined;
    const append = (chunk) => {
      if (output.length < maxLogBytes) output += chunk.toString().slice(0, maxLogBytes - output.length);
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", (error) => {
      if (timer) clearTimeout(timer);
      reject(error);
    });
    child.once("close", (exitCode, signal) => {
      if (timer) clearTimeout(timer);
      resolve({
        exitCode: timedOut ? 124 : (exitCode ?? -1),
        signal: signal ?? null,
        log: output,
        pid: child.pid,
        timedOut,
      });
    });
  });
}
