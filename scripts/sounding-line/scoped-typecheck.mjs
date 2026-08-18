/* Type-check only the declared maintenance TypeScript roots and their imports. */
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== "--paths-base64") throw new Error("SCOPED_TYPECHECK_ARGUMENTS_INVALID");
let paths;
try {
  paths = JSON.parse(Buffer.from(args[1], "base64").toString("utf8"));
} catch {
  throw new Error("SCOPED_TYPECHECK_PATHS_INVALID");
}
if (
  !Array.isArray(paths) ||
  paths.length === 0 ||
  paths.some((entry) => typeof entry !== "string" || path.isAbsolute(entry))
)
  throw new Error("SCOPED_TYPECHECK_PATHS_INVALID");

const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
if (parsed.errors.length)
  throw new Error(parsed.errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n")).join("\n"));

const roots = [...new Set(paths)].sort().map((entry) => path.resolve(entry));
// A scoped program is ephemeral: inheriting the repository's incremental
// project mode without its build-info output is invalid in TypeScript. Keep
// the full strict diagnostic options while disabling only persistent build
// state for this focused maintenance proof.
const program = ts.createProgram({
  rootNames: roots,
  options: { ...parsed.options, composite: false, incremental: false, tsBuildInfoFile: undefined },
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  const report = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => "\n",
  });
  process.stderr.write(report);
  process.exitCode = 1;
}
