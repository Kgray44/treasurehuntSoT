import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import path from "node:path";
import { digest } from "./evidence.mjs";
import { readSourceSnapshotBatches } from "./source-snapshot-batches.mjs";

const need = (condition, code) => {
  if (!condition) throw new Error(`SOUNDING_LINE_ARTIFACT_SNAPSHOT_${code}`);
};
const safePath = (file) =>
  typeof file === "string" &&
  file.length <= 2048 &&
  !/[\\\u0000-\u001f\u007f]/u.test(file) &&
  !path.posix.isAbsolute(file) &&
  file.split("/").every((part) => part && part !== "." && part !== "..");

// Actual immutable Git entries plus the exact raw code bytes needed by the graph.
// Media remain content identities; this reader never hydrates missing objects.
export function readExperienceArtifactSnapshot(root, revision, { fixturePaths = [], execute = execFileSync } = {}) {
  need(path.isAbsolute(root) && /^[a-f0-9]{40}$/u.test(revision ?? ""), "IDENTITY");
  need(
    Array.isArray(fixturePaths) &&
      fixturePaths.length <= 8192 &&
      new Set(fixturePaths).size === fixturePaths.length &&
      fixturePaths.every(safePath),
    "FIXTURE_PATHS",
  );
  const began = performance.now(),
    operations = [];
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  const read = (args, options = {}) => {
    const remaining = 30000 - (performance.now() - began);
    need(remaining > 0, "READ_DEADLINE");
    const transport = ["http", "https", "file", "ssh", "git", "ext"].flatMap((protocol) => [
      "-c",
      `protocol.${protocol}.allow=never`,
    ]);
    const result = execute("git", ["-c", "core.fsmonitor=false", "-c", "protocol.allow=never", ...transport, ...args], {
      cwd: root,
      env: { ...environment, GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
      timeout: Math.ceil(remaining),
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    });
    operations.push({ kind: args[0], elapsedMs: performance.now() - began });
    return result;
  };
  need(read(["cat-file", "-t", revision]).trim() === "commit", "COMMIT_REQUIRED");
  const entries = read(["ls-tree", "-rz", revision])
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const [metadata, file] = row.split("\t"),
        [mode, type, blob] = metadata.split(" ");
      need(
        safePath(file) &&
          type === "blob" &&
          ["100644", "100755", "120000"].includes(mode) &&
          /^[a-f0-9]{40}$/u.test(blob),
        "ENTRY",
      );
      return { path: file, mode, type, blob };
    });
  need(entries.length <= 100000 && new Set(entries.map((entry) => entry.path)).size === entries.length, "ENTRY_BOUND");
  const explicit = new Set(fixturePaths);
  need(
    fixturePaths.every((file) => entries.some((entry) => entry.path === file)),
    "FIXTURE_MISSING",
  );
  const selected = entries.filter(
    (entry) => /\.(?:[cm]?[jt]sx?|css|scss)$/u.test(entry.path) || explicit.has(entry.path),
  );
  need(selected.length <= 8192, "SOURCE_BOUND");
  const contents = readSourceSnapshotBatches(selected, read, {
    maxBuffer: 8 * 1024 * 1024,
    maxTotalBytes: 64 * 1024 * 1024,
    encoding: null,
  });
  let bytes = 0;
  for (const entry of selected) {
    const value = contents.get(entry.path);
    bytes += value.length;
    need(bytes <= 64 * 1024 * 1024, "SOURCE_BYTES_BOUND");
    need(
      createHash("sha1").update(`blob ${value.length}\0`).update(value).digest("hex") === entry.blob,
      "SOURCE_BYTES_CHANGED",
    );
  }
  return {
    revision,
    entries,
    contents,
    sourceTreeDigest: digest(entries),
    measurements: { gitInvocations: operations.length, rawSourceBytes: bytes, elapsedMs: performance.now() - began },
    qualification: false,
  };
}
