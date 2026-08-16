import { spawn } from "node:child_process";
import { access, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const lintableExtensions = new Set([".js", ".cjs", ".mjs", ".ts", ".tsx"]);

function fail(code) {
  throw new Error(code);
}

export async function buildStaticCommandPlan({ root, changedPaths, fileInfo = prettier.getFileInfo }) {
  const scoped = Array.isArray(changedPaths);
  if (scoped && changedPaths.length === 0) fail("STATIC_CHANGED_PATHS_EMPTY");
  const paths = scoped ? [...new Set(changedPaths)].sort() : ["."];
  if (
    scoped &&
    paths.some(
      (candidate) =>
        typeof candidate !== "string" ||
        candidate.length === 0 ||
        path.isAbsolute(candidate) ||
        candidate.split(/[\\/]/u).includes(".."),
    )
  ) {
    fail("STATIC_CHANGED_PATHS_INVALID");
  }

  const trustedRoot = await realpath(root);
  const resolved = await Promise.all(
    paths.map(async (candidate) => {
      const absolute = path.resolve(root, candidate);
      try {
        await access(absolute);
      } catch {
        fail(`STATIC_CHANGED_PATH_UNAVAILABLE:${candidate}`);
      }
      const physical = await realpath(absolute);
      const relative = path.relative(trustedRoot, physical);
      if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        fail(`STATIC_CHANGED_PATH_OUTSIDE_ROOT:${candidate}`);
      }
      return { absolute, candidate };
    }),
  );
  const formatterPaths = [];
  for (const target of resolved) {
    const info = await fileInfo(target.absolute, { resolveConfig: true });
    if (info.inferredParser) formatterPaths.push(target.candidate);
  }
  const lintPaths = resolved
    .filter((target) => lintableExtensions.has(path.extname(target.candidate)))
    .map((target) => target.candidate);
  const commands = [];
  if (formatterPaths.length > 0) {
    commands.push([process.execPath, "node_modules/prettier/bin/prettier.cjs", "--check", ...formatterPaths]);
  }
  if (lintPaths.length > 0) {
    commands.push([process.execPath, "node_modules/eslint/bin/eslint.js", ...lintPaths]);
  }
  commands.push(
    [process.execPath, "node_modules/typescript/bin/tsc", "--noEmit"],
    [process.execPath, "node_modules/tsx/dist/cli.mjs", "scripts/validate-user-facing-language.ts"],
    [process.execPath, "node_modules/tsx/dist/cli.mjs", "scripts/validate-project-one-voyage.ts"],
  );
  return { commands, formatterPaths, lintPaths, scoped };
}

async function main() {
  const args = process.argv.slice(2);
  let changedPaths;
  if (args.length > 0) {
    if (args.length !== 2 || args[0] !== "--paths") fail("STATIC_ARGUMENTS_INVALID");
    try {
      changedPaths = JSON.parse(await readFile(args[1], "utf8"));
    } catch {
      fail("STATIC_CHANGED_PATHS_UNREADABLE");
    }
  }
  const plan = await buildStaticCommandPlan({ root: process.cwd(), changedPaths });
  console.log(
    JSON.stringify({
      kind: "sounding-line-static-scope",
      scope: plan.scoped ? "CHANGED_PATHS" : "REPOSITORY",
      formatterPaths: plan.formatterPaths,
      lintPaths: plan.lintPaths,
    }),
  );
  for (const [file, ...args] of plan.commands) {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(file, args, { cwd: process.cwd(), shell: false, stdio: "inherit", windowsHide: true });
      child.once("error", reject);
      child.once("close", (code) => resolve(code));
    });
    if (result !== 0) process.exit(result ?? 1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
