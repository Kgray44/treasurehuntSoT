// Internal owned child: compile, hydrate and verify an explicit snapshot closure.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
const need = (ok, code) => {
  if (!ok) throw new Error(`SOUNDING_LINE_SELECTED_CHECKOUT_${code}`);
};
export async function checkoutHydration(file) {
  const input = JSON.parse(readFileSync(file, "utf8")),
    root = input.root;
  const git = (args, stdin) =>
    execFileSync(input.git, args, {
      cwd: root,
      env: process.env,
      input: stdin,
      encoding: "utf8",
      maxBuffer: 128 * 1024 * 1024,
      stdio: ["pipe", "pipe", "inherit"],
    });
  const check = (objects) => {
    const lines = git(["cat-file", "--batch-check"], objects.map((x) => x.sha).join("\n") + "\n")
      .trim()
      .split(/\r?\n/u);
    need(lines.length === objects.length, "OBJECT_CHECK_INCOMPLETE");
    return lines.map((line, index) => {
      const [sha, type, size] = line.split(" ");
      need(sha === objects[index].sha, "OBJECT_CHECK_CHANGED");
      return { sha, type, size: Number(size), expected: objects[index].type };
    });
  };
  if (input.operation === "compile") {
    const required = new Map(input.objects.map((value) => [value.sha, value]));
    for (const revision of input.snapshots) {
      need(/^[a-f0-9]{40}$/u.test(revision), "INVALID_ROOT");
      required.set(revision, { sha: revision, type: "commit" });
      for (const row of git(["ls-tree", "-rz", revision]).split("\0").filter(Boolean)) {
        const [mode, type, sha] = row.split("\t")[0].split(" ");
        need(type === "blob" && ["100644", "100755", "120000"].includes(mode), "UNSUPPORTED_TREE_ENTRY");
        need(!required.has(sha) || required.get(sha).type === type, "OBJECT_TYPE_CHANGED");
        required.set(sha, { sha, type });
      }
    }
    const value = {
      objects: [...required.values()].sort((a, b) => a.sha.localeCompare(b.sha)),
      snapshots: input.snapshots,
    };
    writeFileSync(input.output, JSON.stringify(value), { flag: "wx" });
    return {
      requiredObjects: value.objects.length,
      snapshots: input.snapshots.length,
      manifestSha256: createHash("sha256").update(readFileSync(input.output)).digest("hex"),
    };
  }
  const closure = JSON.parse(readFileSync(input.closure, "utf8"));
  if (input.operation === "hydrate") {
    const checked = check(closure.objects),
      missing = checked.filter((value) => value.type === "missing");
    need(
      checked.every((value) => value.type === "missing" || value.type === value.expected),
      "OBJECT_TYPE_CHANGED",
    );
    need(
      missing.every((value) => value.expected === "blob"),
      "MISSING_COMMIT_OR_TREE",
    );
    if (missing.length) {
      // One explicit list over stdin; no command-line size limit, wildcard,
      // implicit lazy fetch, discovery fallback or nested retry budget.
      const child = spawn(
        input.git,
        [
          "-c",
          "fetch.negotiationAlgorithm=noop",
          "fetch",
          "--filter=blob:none",
          "--no-tags",
          "--no-recurse-submodules",
          "--no-write-fetch-head",
          "--progress",
          "--stdin",
          "origin",
        ],
        { cwd: root, env: process.env, windowsHide: true, stdio: ["pipe", "inherit", "inherit"] },
      );
      child.stdin.on("error", () => {});
      child.stdin.end(missing.map((value) => value.sha).join("\n") + "\n");
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("close", resolve);
      });
      need(code === 0, "HYDRATION_FAILED");
    }
    return { explicitMissingBlobs: missing.length, fetchInvocations: missing.length ? 1 : 0 };
  }
  need(input.operation === "verify", "INVALID_OPERATION");
  const checked = check(closure.objects);
  need(
    checked.every((value) => value.type === value.expected && Number.isSafeInteger(value.size) && value.size >= 0),
    "MISSING_REQUIRED_OBJECT",
  );
  git(["rev-list", "--objects", "--filter=blob:none", "--missing=error", ...input.roots]);
  const required = new Set(closure.objects.map((value) => value.sha)),
    missing = git(["rev-list", "--objects", "--missing=print", ...input.roots])
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("?"))
      .map((line) => line.slice(1));
  need(
    missing.every((sha) => !required.has(sha)),
    "MISSING_REQUIRED_OBJECT",
  );
  return {
    requiredObjects: checked.length,
    requiredBlobs: checked.filter((value) => value.type === "blob").length,
    requiredBlobBytes: checked.filter((value) => value.type === "blob").reduce((n, value) => n + value.size, 0),
    unneededHistoricalBlobsAbsent: missing.length,
    completeCommitTreeAncestry: true,
    blobStore: "EXPLICIT_WHOLE_SNAPSHOT_CLOSURE",
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(await checkoutHydration(process.argv[2])));
