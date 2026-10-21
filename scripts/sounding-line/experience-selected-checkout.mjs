// Complete commit/tree ancestry and an explicit whole-snapshot blob closure.
// Unneeded historical blobs may be absent; no implicit or later Git transport.
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnOwnedProcess, processExit, stopOwnedProcess } from "./owned-process.mjs";
import {
  EXPERIENCE_CHECKOUT_ROOTS,
  EXPERIENCE_READER_REVISIONS,
  EXPERIENCE_READER_OBJECTS,
  EXPERIENCE_CURRENT_PUBLICATION,
} from "./experience-checkout-roots.mjs";

const need = (ok, code) => {
  if (!ok) throw new Error(`SOUNDING_LINE_SELECTED_CHECKOUT_${code}`);
};
const gitExecutable = () => {
  const name = process.platform === "win32" ? "git.exe" : "git";
  const resolved = (process.env.PATH ?? "")
    .split(path.delimiter)
    .map((directory) => path.join(directory, name))
    .find((file) => existsSync(file));
  need(resolved, "GIT_NOT_FOUND");
  return path.resolve(resolved);
};
const oid = (s) => /^[a-f0-9]{40}$/u.test(s ?? "");
export function requireCheckoutCleanup(receipt) {
  need(receipt?.status === "PASS" && receipt.treeReaped && receipt.streamsClosed, "CLEANUP_FAILED");
}
export function validatePreservationInventories(pins, inventory, candidateInventory, currentPublication) {
  const historicalManifestPinsRetained = [];
  for (const pin of pins) {
    const expected = `${pin.mode ?? "100644"} blob ${pin.blob}`;
    need(inventory.get(pin.path) === expected, "PRESERVATION_CHANGED");
    if (pin.path === currentPublication.path) {
      need(
        (pin.mode ?? "100644") === currentPublication.historicalMode && pin.blob === currentPublication.historicalBlob,
        "HISTORICAL_MANIFEST_PIN_CHANGED",
      );
      need(
        candidateInventory.get(pin.path) ===
          `${currentPublication.publishedMode} blob ${currentPublication.publishedBlob}`,
        "CURRENT_MANIFEST_PIN_CHANGED",
      );
      historicalManifestPinsRetained.push(currentPublication);
    } else need(candidateInventory.get(pin.path) === expected, "PRESERVATION_CHANGED");
  }
  return historicalManifestPinsRetained;
}
export async function selectedCheckout({
  root,
  remote,
  baseSha,
  candidateSha,
  roots = EXPERIENCE_CHECKOUT_ROOTS,
  readerRevisions = EXPERIENCE_READER_REVISIONS,
  readerObjects = EXPERIENCE_READER_OBJECTS,
  currentPublication = EXPERIENCE_CURRENT_PUBLICATION,
  budgetMs = 600000,
  signal,
  progress = true,
}) {
  need(
    oid(baseSha) &&
      oid(candidateSha) &&
      roots.every(oid) &&
      readerRevisions.every(oid) &&
      readerObjects.every((value) => oid(value.sha) && ["commit", "tree", "blob"].includes(value.type)),
    "INVALID_ROOT",
  );
  need(Number.isSafeInteger(budgetMs) && budgetMs > 5000 && budgetMs <= 600000, "INVALID_DEADLINE");
  const began = Date.now(),
    deadline = began + budgetMs,
    commands = [];
  const allRoots = [...new Set([baseSha, candidateSha, ...roots])];
  let operationalEnv;
  const command = async (args, executable = gitExecutable()) => {
    need(!signal?.aborted, "CANCELLED");
    const remaining = deadline - Date.now() - 5000;
    need(remaining > 0, "DEADLINE");
    const child = spawnOwnedProcess(executable, args, {
      root,
      env: operationalEnv,
      cleanupOptions: { gracefulMs: 500, forceMs: 1000 },
    });
    child.stdout.unpipe(process.stdout);
    child.stderr.unpipe(process.stderr);
    const chunks = [],
      stderrChunks = [];
    let stderrBytes = 0;
    let size = 0,
      timer,
      abort;
    child.stdout.on("data", (bytes) => {
      size += bytes.length;
      if (size <= 128 * 1024 * 1024) chunks.push(bytes);
    });
    child.stderr.on("data", (bytes) => {
      stderrBytes += bytes.length;
      if (stderrBytes <= 256 * 1024) stderrChunks.push(bytes);
      if (progress) process.stderr.write(bytes);
    });
    // unpipe() pauses a Readable. Explicitly resume both streams after attaching
    // collectors, or output larger than the pipe capacity can block the payload.
    child.stdout.resume();
    child.stderr.resume();
    let receipt;
    try {
      const result = await Promise.race([
        processExit(child),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("SOUNDING_LINE_SELECTED_CHECKOUT_DEADLINE")), remaining);
          abort = () => reject(new Error("SOUNDING_LINE_SELECTED_CHECKOUT_CANCELLED"));
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) abort();
        }),
      ]);
      need(result.code === 0 && !result.supervisionFailure, "GIT_FAILED");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      receipt = await stopOwnedProcess(child);
      commands.push({
        args,
        cleanup: receipt,
        stderrBytes,
        stderrTail: Buffer.concat(stderrChunks).toString("utf8").slice(-4096),
      });
      requireCheckoutCleanup(receipt);
    }
    need(size <= 128 * 1024 * 1024, "OUTPUT_LIMIT");
    return Buffer.concat(chunks).toString("utf8").trim();
  };
  await mkdir(root); // Fresh owned directory only; never reuse a shallow checkout.
  const emptyConfig = path.join(root, "..", `${path.basename(root)}.empty-git-config`);
  await writeFile(emptyConfig, "", { flag: "wx", mode: 0o600 });
  operationalEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key))),
    GIT_CONFIG_GLOBAL: emptyConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
  };
  const stage = (name) => {
    if (progress)
      process.stderr.write(
        JSON.stringify({ namespace: "SOUNDING_LINE_SELECTED_CHECKOUT", stage: name, elapsedMs: Date.now() - began }) +
          "\n",
      );
  };
  let result;
  try {
    await command(["init", "--quiet", "--template="]);
    await command(["remote", "add", "origin", remote]);
    await command(["config", "--local", "remote.origin.promisor", "true"]);
    await command(["config", "--local", "remote.origin.partialclonefilter", "blob:none"]);
    await command(["config", "--local", "core.autocrlf", "false"]);
    if (process.platform === "win32") await command(["config", "--local", "core.longpaths", "true"]);
    stage("COMPLETE_COMMIT_TREE_FETCH");
    await command([
      "fetch",
      "--filter=blob:none",
      "--no-tags",
      "--no-recurse-submodules",
      "--progress",
      "origin",
      ...allRoots.map((sha) => `+${sha}:refs/sounding-line/selected/${sha}`),
    ]);
    need((await command(["rev-parse", "--is-shallow-repository"])) === "false", "SHALLOW");
    const closureFile = path.join(root, ".git", "selected-required-objects.json"),
      hydrationScript = fileURLToPath(new URL("./experience-checkout-hydration.mjs", import.meta.url));
    const operation = async (name, extra) => {
      const file = path.join(root, ".git", `selected-${name}.json`);
      await writeFile(file, JSON.stringify({ operation: name, root, git: gitExecutable(), ...extra }), { flag: "wx" });
      return JSON.parse(await command([hydrationScript, file], process.execPath));
    };
    const compiled = await operation("compile", {
      snapshots: [...new Set([...allRoots, ...readerRevisions])],
      objects: readerObjects,
      output: closureFile,
    });
    stage("EXPLICIT_WHOLE_SNAPSHOT_HYDRATION");
    const hydration = await operation("hydrate", { closure: closureFile });
    await command(["config", "--local", "remote.origin.promisor", "false"]);
    await command(["config", "--local", "--unset-all", "remote.origin.partialclonefilter"]);
    await command(["config", "--local", "protocol.allow", "never"]);
    for (const protocol of ["file", "http", "https", "ssh", "git", "ext"])
      await command(["config", "--local", `protocol.${protocol}.allow`, "never"]);
    const verified = await operation("verify", { closure: closureFile, roots: allRoots });
    for (const sha of allRoots) need((await command(["rev-parse", `${sha}^{commit}`])) === sha, "ROOT_CHANGED");
    await command(["merge-base", "--is-ancestor", baseSha, candidateSha]);
    await command(["update-ref", "refs/remotes/origin/main", baseSha]);
    stage("EXACT_CANDIDATE_CHECKOUT");
    await command(["checkout", "--detach", candidateSha]);
    need((await command(["rev-parse", "HEAD"])) === candidateSha, "HEAD_CHANGED");
    const registry = JSON.parse(await command(["show", `${baseSha}:testing/product-experience-exceptions.json`]));
    const record = registry.exceptions.at(-1),
      pins = record.immutableHistory ?? [];
    const revision = record.currentSourceAdmission?.preservationRevision ?? record.frozenReferenceSha;
    const inventory = new Map(
      (await command(["ls-tree", "-rz", revision]))
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const [metadata, file] = row.split("\t");
          return [file, metadata];
        }),
    );
    const candidateInventory = new Map(
      (await command(["ls-tree", "-rz", candidateSha]))
        .split("\0")
        .filter(Boolean)
        .map((row) => {
          const [metadata, file] = row.split("\t");
          return [file, metadata];
        }),
    );
    const historicalManifestPinsRetained = validatePreservationInventories(
      pins,
      inventory,
      candidateInventory,
      currentPublication,
    );
    need(Date.now() < deadline, "DEADLINE");
    result = {
      status: "PASS",
      baseSha,
      candidateSha,
      roots: allRoots,
      preservationPins: pins.length,
      currentPinsUnchanged: pins.length - historicalManifestPinsRetained.length,
      historicalManifestPinsRetained,
      nonshallow: true,
      compiled,
      hydration,
      verified,
      lateGitTransport: "DISABLED",
      elapsedMs: Date.now() - began,
      budgetMs,
      commands,
    };
    return result;
  } catch (error) {
    result = {
      status: "FAIL",
      error: error.message,
      baseSha,
      candidateSha,
      elapsedMs: Date.now() - began,
      budgetMs,
      commands,
    };
    throw error;
  } finally {
    if (result)
      await writeFile(path.join(root, "..", `${path.basename(root)}.checkout.json`), JSON.stringify(result, null, 2), {
        flag: "wx",
      });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(
    process.argv.slice(2).reduce((pairs, value, index, values) => {
      if (value.startsWith("--")) pairs.push([value.slice(2), values[index + 1]]);
      return pairs;
    }, []),
  );
  need(process.env.GITHUB_REPOSITORY === "Kgray44/treasurehuntSoT", "REPOSITORY_CHANGED");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once("SIGTERM", cancel);
  process.once("SIGINT", cancel);
  try {
    console.log(
      JSON.stringify(
        await selectedCheckout({
          root: path.resolve(args.workspace),
          remote: "https://github.com/Kgray44/treasurehuntSoT.git",
          baseSha: args.base,
          candidateSha: args.candidate,
          signal: controller.signal,
        }),
      ),
    );
  } finally {
    process.removeListener("SIGTERM", cancel);
    process.removeListener("SIGINT", cancel);
  }
}
