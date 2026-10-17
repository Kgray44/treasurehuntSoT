// Replay-admission observations only. These details never grant execution permission.
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

export const REPLAY_ADMISSION_SUBSTAGES = Object.freeze([
  "ENTRY",
  "SOURCE_RECOGNITION",
  "PLAN_INPUT",
  "REGISTRY_READ",
  "CAMPAIGN_RELATION",
  "HEAD_CHECK",
  "PLAN_REBUILD",
  "EXECUTOR_CONTEXT",
  "LOCAL_LEASE",
  "PLAN_COMPARE",
  "ORDINARY_LEASE",
  "CUSTODY_REQUEST",
  "LIVE_CONTEXT",
  "HISTORICAL_CUSTODY",
  "RESERVATION",
  "TECHNICAL_COMPLETE",
  "HISTORICAL_PREPARE",
  "PHASE_CLAIM",
]);
const substages = new Set(REPLAY_ADMISSION_SUBSTAGES);
const components = new Set([
  "EXPERIENCE_EXCEPTION",
  "PRODUCT_EXPERIENCE",
  "DIAGNOSED_CONTINUATION",
  "R8_FORMAT",
  "R9_CONTINUATION",
  "R10_CONTINUATION",
  "R11_CONTINUATION",
]);
const fixedArguments = new Set([
  "rev-parse",
  "show",
  "ls-tree",
  "merge-base",
  "cat-file",
  "diff",
  "merge-file",
  "--path-format=absolute",
  "--git-common-dir",
  "HEAD",
  "origin/main",
  "--name-only",
  "--no-renames",
  "--is-ancestor",
  "--stdout",
  "--batch",
  "-rz",
  "--",
  "--exit-code",
]);
const metadataFiles = new Map([
  [".agents/README.md", "AGENTS_README"],
  ["Development_Docs/INDEX.md", "DOCS_INDEX"],
  ["Development_Docs/Testing/Product_Experience/README.md", "EXPERIENCE_README"],
]);
const scope = new AsyncLocalStorage();
const failures = new WeakMap();
const object = (value) => value !== null && ["object", "function"].includes(typeof value);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const hashLimit = 64 * 1024;
const fullSha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
function publicPath(value) {
  return (
    typeof value === "string" &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !path.posix.isAbsolute(value) &&
    value.split("/").every((part) => part && part !== "." && part !== "..") &&
    (/^(?:src|app|components|lib|styles|public|prisma|scripts|tests|testing|native|\.github|\.agents|Development_Docs)(?:\/|$)/u.test(
      value,
    ) ||
      /^(?:package(?:-lock)?\.json|tsconfig\.json|\.nvmrc|\.prettierrc\.json|\.prettierignore|\.gitignore|\.gitattributes|[\w.-]+\.config\.[\w]+)$/u.test(
        value,
      ))
  );
}
function revision(value) {
  if (fullSha(value) || ["HEAD", "origin/main"].includes(value)) return true;
  const match = typeof value === "string" && /^([a-f0-9]{40})(?:\^\{tree\}|:(.+))$/u.exec(value);
  return Boolean(match && (!match[2] || publicPath(match[2])));
}
function supportedRead(component, args, options, metadata) {
  try {
    if (
      !components.has(component) ||
      !Array.isArray(args) ||
      !args.every((value) => typeof value === "string") ||
      typeof options.cwd !== "string" ||
      !path.isAbsolute(options.cwd) ||
      options.env !== undefined ||
      options.shell
    )
      return false;
    if (args[0] !== "cat-file" && options.input !== undefined) return false;
    if (args[0] === "rev-parse")
      return (
        (args.length === 2 && revision(args[1])) ||
        JSON.stringify(args) === '["rev-parse","--path-format=absolute","--git-common-dir"]'
      );
    if (args[0] === "show") return args.length === 2 && revision(args[1]);
    if (args[0] === "ls-tree")
      return (
        (args.length === 3 && args[1] === "-rz" && fullSha(args[2])) ||
        (args.length === 4 && fullSha(args[1]) && args[2] === "--" && publicPath(args[3]))
      );
    if (args[0] === "merge-base")
      return args.length === 4 && args[1] === "--is-ancestor" && args.slice(2).every(fullSha);
    if (args[0] === "diff")
      return (
        args.length === 5 && args[1] === "--name-only" && args[2] === "--no-renames" && args.slice(3).every(fullSha)
      );
    if (args[0] === "cat-file")
      return (
        args.length === 2 &&
        args[1] === "--batch" &&
        typeof options.input === "string" &&
        /^[a-f0-9]{40}(?:\n[a-f0-9]{40})*\n?$/u.test(options.input)
      );
    if (args[0] === "merge-file") {
      const prefix = new Map([
        ["DIAGNOSED_CONTINUATION", "r12-readme-"],
        ["R8_FORMAT", "r8-format-metadata-"],
        ["R9_CONTINUATION", "r9-readme-"],
        ["R10_CONTINUATION", "r10-readme-"],
        ["R11_CONTINUATION", "r11-readme-"],
      ]).get(component);
      return (
        args.length === 5 &&
        args[1] === "--stdout" &&
        prefix &&
        validMetadata(metadata) &&
        args
          .slice(2)
          .every(
            (file, index) => path.isAbsolute(file) && path.basename(file) === ["current", "base", "other"][index],
          ) &&
        args.slice(3).every((file) => path.dirname(file) === path.dirname(args[2])) &&
        path.basename(path.dirname(args[2])).startsWith(prefix)
      );
    }
    return false;
  } catch {
    return false;
  }
}
function remember(error, git = null) {
  if (object(error) && scope.getStore() && !failures.has(error))
    failures.set(error, { substage: scope.getStore().substage, git });
}
export function withReplayAdmissionSubstage(substage, operation) {
  if (!scope.getStore()) return operation();
  return scope.run({ substage: substages.has(substage) ? substage : "ENTRY" }, () => {
    try {
      const result = operation();
      if (result && typeof result.then === "function")
        return result.then(undefined, (error) => {
          remember(error);
          throw error;
        });
      return result;
    } catch (error) {
      remember(error);
      throw error;
    }
  });
}
export function withReplayAdmissionScope(operation) {
  return scope.run({ substage: "ENTRY" }, () => withReplayAdmissionSubstage("ENTRY", operation));
}
export function inheritSourceFailure(cause, error) {
  if (object(cause) && object(error) && failures.has(cause) && !failures.has(error))
    failures.set(error, failures.get(cause));
  return error;
}
export function replayAdmissionFailure(error) {
  return object(error) && failures.has(error) ? structuredClone(failures.get(error)) : null;
}
function outputBinding(value) {
  if (!Buffer.isBuffer(value) && typeof value !== "string") return { available: false };
  const binary = Buffer.isBuffer(value);
  const bytes = binary ? value.length : Buffer.byteLength(value);
  const prefix = binary
    ? value.subarray(0, hashLimit)
    : Buffer.from(value.slice(0, hashLimit + 1)).subarray(0, hashLimit);
  return {
    available: true,
    representation: binary ? "BUFFER" : "UTF8_STRING",
    bytes,
    hashedBytes: prefix.length,
    complete: bytes <= hashLimit,
    sha256: hash(prefix),
  };
}
function operationIdentity(args) {
  if (args[0] === "merge-base" && args[1] === "--is-ancestor") return "ANCESTRY";
  if (args[0] === "merge-file" && args[1] === "--stdout" && args.length === 5) return "METADATA_MERGE";
  return (
    new Map([
      ["rev-parse", "REV_PARSE"],
      ["show", "SHOW"],
      ["ls-tree", "LS_TREE"],
      ["merge-base", "MERGE_BASE"],
      ["cat-file", "CAT_FILE"],
      ["diff", "DIFF"],
    ]).get(args[0]) ?? "OTHER_GIT_OPERATION"
  );
}
function revisionPositions(args) {
  if (args[0] === "show") return new Set([1]);
  if (args[0] === "merge-base") return new Set(args[1] === "--is-ancestor" ? [2, 3] : [1, 2]);
  if (["rev-parse", "ls-tree", "diff"].includes(args[0])) {
    const end = args.indexOf("--");
    return new Set(
      args
        .map((value, index) => index)
        .filter((index) => index > 0 && (end < 0 || index < end) && !args[index].startsWith("-")),
    );
  }
  return new Set();
}
function argumentBindings(args) {
  const revisions = revisionPositions(args);
  return args.map((value, index) => {
    const revision = revisions.has(index) && /^([a-f0-9]{40})(?:\^\{tree\}|:([^\0]+))?$/u.exec(value);
    return {
      index,
      sha256: hash(value),
      ...(fixedArguments.has(value) ? { fixed: value } : {}),
      ...(revision
        ? {
            revision: {
              sha: revision[1],
              selector: revision[2] ? "PATH" : value.endsWith("^{tree}") ? "TREE" : "OBJECT",
              ...(revision[2] ? { pathSha256: hash(revision[2]) } : {}),
            },
          }
        : {}),
    };
  });
}
function validMetadata(metadata) {
  return (
    metadataFiles.has(metadata?.file) &&
    Array.isArray(metadata?.revisions) &&
    metadata.revisions.length === 3 &&
    metadata.revisions.every(fullSha)
  );
}
function metadataBinding(metadata) {
  if (!validMetadata(metadata)) return null;
  return {
    file: metadataFiles.get(metadata.file),
    pathSha256: hash(metadata.file),
    revisions: [...metadata.revisions],
  };
}
export function sourceDiagnosticGit(component, args, options = {}, metadata) {
  if (!scope.getStore() || !supportedRead(component, args, options, metadata))
    return execFileSync("git", args, options);
  // Preserve every child option, including historically discarded stderr. Missing
  // output is reported unavailable; capture must not introduce a maxBuffer failure.
  try {
    return execFileSync("git", args, options);
  } catch (error) {
    try {
      const operation = operationIdentity(args);
      const exitCode = Number.isInteger(error.status) && error.status >= 0 && error.status <= 255 ? error.status : null;
      const signal = new Set([
        "SIGTERM",
        "SIGKILL",
        "SIGINT",
        "SIGABRT",
        "SIGSEGV",
        "SIGPIPE",
        "SIGHUP",
        "SIGQUIT",
      ]).has(error.signal)
        ? error.signal
        : null;
      const classification =
        !error.signal && operation === "ANCESTRY" && exitCode === 1
          ? "NOT_ANCESTOR"
          : !error.signal && operation === "METADATA_MERGE" && exitCode > 0 && exitCode <= 127
            ? "MERGE_CONFLICT"
            : "UNCLASSIFIED_GIT_FAILURE";
      remember(error, {
        component: components.has(component) ? component : null,
        operation,
        classification,
        exitCode,
        signal,
        argumentCount: args.length,
        argumentsSha256: hash(JSON.stringify(args)),
        arguments: argumentBindings(args),
        cwdSha256: typeof options.cwd === "string" ? hash(options.cwd) : null,
        stdout: outputBinding(error.stdout),
        stderr: outputBinding(error.stderr),
        metadata: metadataBinding(metadata),
      });
    } catch {
      /* Diagnostic failures must never replace the original command failure. */
    }
    throw error;
  }
}
