import { readFile, writeFile, mkdir, statfs } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnOwnedProcess, processExit, stopOwnedProcess, bounded } from "file:///C:/Users/kkids/.codex/worktrees/parallax-integration-prep-20261019/Codex_TreasureHunt/scripts/sounding-line/owned-process.mjs";

const root = "C:/Users/kkids/.codex/worktrees/parallax-integration-prep-20261019/Codex_TreasureHunt";
const out = "D:/CodexTemp/parallax-resume-20261021-01a15554/journal-heading-repair-06";
const stats = await statfs("C:/");
if (stats.bavail * stats.bsize < 30 * 1024 ** 3 + 32 * 1024 ** 2) throw new Error("C_RESERVE_FAILED");
await mkdir(path.join(out, "temp"));
await writeFile(path.join(out, "vitest-output-paths.config.mts"), `import base from "${root}/vitest.config.ts";\nexport default {...base, cacheDir: "${out}/vite-cache", test: {...base.test, cache: false}};\n`, { flag: "wx" });
const files = ["src/components/player/journal/ChronicleJournalSession.tsx", "src/components/player/journal/ChronicleJournalSession.test.ts", "src/components/player/parallax/ChronicleLens.tsx", "src/components/player/parallax/ChronicleLens.module.css", "src/styles/chronicle.css", "tests/e2e/crossdeck-experience-refit.spec.ts", "tests/e2e/fixtures/journal-layout.ts", "package-lock.json", "vitest.config.ts"];
const hash = async (file) => createHash("sha256").update(await readFile(path.join(root, file))).digest("hex");
const inputs = await Promise.all(files.map(async (file) => ({ file, sha256: await hash(file) })));
await writeFile(path.join(out, "input.json"), JSON.stringify({ parent: "933102dbc2b5d3702814ab8cee4f5285e880dcfe", qualification: false, files: inputs }, null, 2) + "\n", { flag: "wx" });
const env = { ...process.env, TEMP: path.join(out, "temp"), TMP: path.join(out, "temp"), SEALED_HOLD_SINGLE_FORK: "1", DATABASE_PROVIDER: "sqlite", DATABASE_URL: `file:${out}/isolated.sqlite` };
async function check(name, args) {
  const stdout = createWriteStream(path.join(out, `${name}.stdout.original.log`), { flags: "wx" });
  const stderr = createWriteStream(path.join(out, `${name}.stderr.original.log`), { flags: "wx" });
  const child = spawnOwnedProcess(process.execPath, args, { root, env });
  child.stdout.unpipe(process.stdout);
  child.stderr.unpipe(process.stderr);
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  let exit, failure;
  try { exit = await bounded(() => processExit(child), 240000, "LOCAL_CHECK_DEADLINE"); }
  catch (error) { failure = error.message; }
  const cleanup = await stopOwnedProcess(child);
  await Promise.all([new Promise((resolve) => stdout.end(resolve)), new Promise((resolve) => stderr.end(resolve))]);
  return { name, exit, failure, cleanup, pass: exit?.code === 0 && cleanup.status === "PASS" };
}
const results = await Promise.allSettled([
  check("unit", ["node_modules/vitest/vitest.mjs", "run", "src/components/player/journal/ChronicleJournalSession.test.ts", "src/components/player/parallax/ChronicleLens.test.tsx", "--config", path.join(out, "vitest-output-paths.config.mts"), "--reporter=json", "--outputFile", path.join(out, "unit-report.json")]),
  check("type", ["node_modules/typescript/bin/tsc", "--noEmit", "--incremental", "false"]),
  check("lint", ["node_modules/eslint/bin/eslint.js", ...files.filter((file) => /[.]tsx?$/u.test(file) && !file.startsWith("tests/e2e") && file !== "vitest.config.ts"), "--no-cache", "--max-warnings=0"]),
]);
for (const input of inputs) if (await hash(input.file) !== input.sha256) throw new Error("SOURCE_CHANGED_DURING_CHECKS");
const record = { qualification: false, inputs, results, completedAtUtc: new Date().toISOString() };
await writeFile(path.join(out, "checks.json"), JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(results, null, 2));
if (results.some((item) => item.status !== "fulfilled" || !item.value.pass)) process.exitCode = 1;
