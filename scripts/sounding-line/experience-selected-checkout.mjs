// One owned, bounded checkout. No branch/tag enumeration or deferred fetching.
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnOwnedProcess, processExit, stopOwnedProcess } from "./owned-process.mjs";
import { EXPERIENCE_CHECKOUT_ROOTS } from "./experience-checkout-roots.mjs";

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
export async function selectedCheckout({
  root,
  remote,
  baseSha,
  candidateSha,
  roots = EXPERIENCE_CHECKOUT_ROOTS,
  budgetMs = 600000,
  signal,
  progress = true,
}) {
  need(oid(baseSha) && oid(candidateSha) && roots.every(oid), "INVALID_ROOT");
  need(Number.isSafeInteger(budgetMs) && budgetMs > 5000 && budgetMs <= 600000, "INVALID_DEADLINE");
  const began = Date.now(),
    deadline = began + budgetMs,
    commands = [];
  const allRoots = [...new Set([baseSha, candidateSha, ...roots])];
  const command = async (args) => {
    need(!signal?.aborted, "CANCELLED");
    const remaining = deadline - Date.now() - 5000;
    need(remaining > 0, "DEADLINE");
    const child = spawnOwnedProcess(gitExecutable(), args, {
      root,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_NO_LAZY_FETCH: "1",
      },
      cleanupOptions: { gracefulMs: 500, forceMs: 1000 },
    });
    child.stdout.unpipe(process.stdout);
    child.stderr.unpipe(process.stderr);
    const chunks = [];
    let size = 0,
      timer,
      abort;
    child.stdout.on("data", (bytes) => {
      size += bytes.length;
      if (size <= 128 * 1024 * 1024) chunks.push(bytes);
    });
    child.stderr.on("data", (bytes) => {
      if (progress) process.stderr.write(bytes);
    });
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
      need(size <= 128 * 1024 * 1024, "OUTPUT_LIMIT");
      return Buffer.concat(chunks).toString("utf8").trim();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      receipt = await stopOwnedProcess(child);
      commands.push({ args, cleanup: receipt });
      need(receipt.treeReaped && receipt.streamsClosed, "CLEANUP_FAILED");
    }
  };
  await mkdir(root); // Fresh owned directory only; never reuse a shallow checkout.
  let result;
  try {
    await command(["init", "--quiet"]);
    await command(["remote", "add", "origin", remote]);
    await command([
      "fetch",
      "--no-tags",
      "--no-recurse-submodules",
      "--progress",
      "origin",
      ...allRoots.map((sha) => `+${sha}:refs/sounding-line/selected/${sha}`),
    ]);
    for (const sha of allRoots) need((await command(["rev-parse", `${sha}^{commit}`])) === sha, "ROOT_CHANGED");
    need((await command(["rev-parse", "--is-shallow-repository"])) === "false", "SHALLOW");
    const closure = await command(["rev-list", "--objects", "--missing=print", ...allRoots]);
    need(!closure.split(/\r?\n/u).some((line) => line.startsWith("?")), "MISSING_OBJECT");
    await command(["merge-base", "--is-ancestor", baseSha, candidateSha]);
    await command(["update-ref", "refs/remotes/origin/main", baseSha]);
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
    for (const pin of pins)
      need(inventory.get(pin.path) === `${pin.mode ?? "100644"} blob ${pin.blob}`, "PRESERVATION_CHANGED");
    need(Date.now() < deadline, "DEADLINE");
    result = {
      status: "PASS",
      baseSha,
      candidateSha,
      roots: allRoots,
      preservationPins: pins.length,
      nonshallow: true,
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
