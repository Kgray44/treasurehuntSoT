import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const GiB = 1024 ** 3;
export const POLICY = Object.freeze({
  reserveBytes: 30 * GiB,
  aggregateBytes: 75 * GiB,
  workspaceBytes: 12 * GiB,
  leaseMs: 8 * 3600000,
  holdMs: 15 * 60000,
});
const markerName = ".voyagewright-workspace.json";
const terminal = new Set(["completed", "failed", "cancelled"]);
const key = (p) => path.resolve(p).replaceAll("\\", "/").toLowerCase();
export const within = (root, p) => key(p).startsWith(`${key(root)}/`);
const same = (a, b) => key(a) === key(b);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const hashFile = (file) => {
  const fd = fs.openSync(file, "r");
  const buffer = Buffer.alloc(1024 ** 2);
  const hash = createHash("sha256");
  try {
    let count;
    while ((count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, count));
    return hash.digest("hex");
  } finally {
    fs.closeSync(fd);
  }
};
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const now = () => new Date().toISOString();
function fail(code) {
  throw new Error(code);
}
function atomic(file, value) {
  const tmp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  fs.renameSync(tmp, file);
}
export function run(command, args, cwd, options = {}) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 64 * 1024 ** 2,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0" },
    ...options,
  });
}
export const git = (cwd, args) => run("git", ["-c", "core.fsmonitor=false", "-C", cwd, ...args], undefined).trim();
const branchOf = (cwd) => {
  try {
    return git(cwd, ["symbolic-ref", "--short", "-q", "HEAD"]);
  } catch {
    return null;
  }
};
function succeeds(cwd, args) {
  try {
    git(cwd, args);
    return true;
  } catch {
    return false;
  }
}
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code !== "ESRCH";
  }
}
export function physical(p) {
  if (!path.isAbsolute(p)) fail("ABSOLUTE_PATH_REQUIRED");
  let current = path.parse(path.resolve(p)).root;
  for (const part of path.resolve(p).slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail(`REPARSE_ANCESTOR:${current}`);
  }
  return fs.existsSync(p) ? fs.realpathSync.native(p) : path.resolve(p);
}
export function worktrees(canonical) {
  return git(canonical, ["worktree", "list", "--porcelain", "-z"])
    .split("\0\0")
    .filter(Boolean)
    .map((block) => {
      const fields = Object.fromEntries(
        block
          .split("\0")
          .filter(Boolean)
          .map((s) => {
            const n = s.indexOf(" ");
            return n < 0 ? [s, true] : [s.slice(0, n), s.slice(n + 1)];
          }),
      );
      return {
        path: fields.worktree,
        head: fields.HEAD,
        branch: fields.branch ?? null,
        locked: fields.locked ?? false,
        prunable: fields.prunable ?? false,
      };
    });
}
// Never follow directory links. Logical bytes are measured; rounded bytes are a
// conservative admission bound, not a promise of physical volume reclamation.
export function scan(root, { entries = false, excludedRoots = [], allowGitStores = false } = {}) {
  const result = { logicalBytes: 0, allocationBoundBytes: 0, files: 0, links: [], errors: [], entries: [] };
  if (!fs.existsSync(root)) return result;
  const stack = [root];
  while (stack.length) {
    const p = stack.pop();
    if (excludedRoots.some((r) => same(r, p))) continue;
    try {
      const s = fs.lstatSync(p);
      const relative = path.relative(root, p).replaceAll("\\", "/");
      if (s.isSymbolicLink()) {
        const target = fs.readlinkSync(p);
        result.links.push({
          relative,
          target,
          resolved: path.resolve(path.dirname(p), target.replace(/^\\\\\?\\/u, "")),
        });
        if (entries) result.entries.push({ path: relative, kind: "link", target });
      } else if (s.isDirectory()) {
        if (!allowGitStores && relative && path.basename(p) === ".git") fail(`NESTED_GIT_STORE:${relative}`);
        for (const name of fs.readdirSync(p)) stack.push(path.join(p, name));
      } else if (s.isFile()) {
        if (!allowGitStores && path.basename(p) === ".git" && relative !== ".git")
          fail(`NESTED_GIT_POINTER:${relative}`);
        result.files++;
        result.logicalBytes += s.size;
        result.allocationBoundBytes += Math.ceil(s.size / 4096) * 4096;
        if (entries)
          result.entries.push({ path: relative, kind: "file", bytes: s.size, mtime: s.mtimeMs, nlink: s.nlink });
      } else fail(`SPECIAL_FILE:${p}`);
    } catch (e) {
      result.errors.push(`${p}:${e.message}`);
    }
  }
  return result;
}
export function scanLinks(root) {
  const result = { links: [], errors: [] };
  if (!fs.existsSync(root)) return result;
  const stack = [root];
  while (stack.length) {
    const directory = stack.pop();
    try {
      if (fs.lstatSync(directory).isSymbolicLink()) fail("REPARSE_ROOT");
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const p = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) {
          const target = fs.readlinkSync(p);
          result.links.push({
            relative: path.relative(root, p),
            target,
            resolved: path.resolve(directory, target.replace(/^\\\\\?\\/u, "")),
          });
        } else if (entry.isDirectory() && entry.name !== ".git") stack.push(p);
      }
    } catch (e) {
      result.errors.push(`${directory}:${e.message}`);
    }
  }
  return result;
}
// Used only for marker-owned generated/runtime roots; linked checkouts themselves
// always go through git worktree remove. Directory links are unlinked, never walked.
export function removeOwnedTree(root, target) {
  if (!same(root, target) && !within(root, target)) fail("DELETE_OUTSIDE_OWNER");
  let s;
  try {
    s = fs.lstatSync(target);
  } catch (e) {
    if (e.code === "ENOENT") return;
    throw e;
  }
  if (s.isSymbolicLink()) {
    try {
      fs.unlinkSync(target);
    } catch (e) {
      if (process.platform !== "win32") throw e;
      fs.rmdirSync(target);
    }
  } else if (s.isDirectory()) {
    if (path.basename(target) === ".git") fail("GIT_STORE_DELETE_DENIED");
    for (const name of fs.readdirSync(target)) removeOwnedTree(root, path.join(target, name));
    fs.rmdirSync(target);
  } else fs.unlinkSync(target);
}
export function checkBudget({ policy = POLICY, free, estimates, footprint, peak, taskCount = 0, additionalReason }) {
  for (const drive of ["C", "D"]) {
    if (!Number.isSafeInteger(estimates[drive]) || estimates[drive] < 0) fail(`UNBOUNDED_ESTIMATE:${drive}`);
    if (!Number.isSafeInteger(free[drive]) || free[drive] - estimates[drive] <= policy.reserveBytes)
      fail(`RESERVE_DENIED:${drive}`);
  }
  if (!Number.isSafeInteger(peak) || peak <= 0 || peak > policy.workspaceBytes) fail("WORKSPACE_BUDGET_DENIED");
  if (footprint + peak > policy.aggregateBytes) fail("AGGREGATE_BUDGET_DENIED");
  if (taskCount > 0 && (!additionalReason || additionalReason.trim().length < 30))
    fail("TASK_WORKSPACE_ALREADY_EXISTS");
}
export function reserve(estimates = { C: 0, D: 0 }) {
  if (process.platform !== "win32") fail("WINDOWS_RESERVE_GUARD_REQUIRED");
  const guard =
    process.env.VOYAGEWRIGHT_RESERVE_GUARD ??
    path.join(os.homedir(), "AppData", "Local", "AeroStorageWatch", "ReserveGuard.ps1");
  return JSON.parse(
    run("powershell.exe", [
      "-NoProfile",
      "-File",
      guard,
      "-EstimatedCBytes",
      String(estimates.C),
      "-EstimatedDBytes",
      String(estimates.D),
    ]),
  );
}
function driveEstimates(p, bytes) {
  const drive = path.parse(path.resolve(p)).root[0].toUpperCase();
  if (!["C", "D"].includes(drive)) fail("UNBUDGETED_VOLUME");
  return { C: drive === "C" ? bytes : 0, D: drive === "D" ? bytes : 0 };
}
export function windowsProcesses(root, registered = []) {
  const script =
    "$ErrorActionPreference='Stop'; @(Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath,CommandLine) | ConvertTo-Json -Compress";
  const all = JSON.parse(run("powershell.exe", ["-NoProfile", "-Command", script]));
  const ignored = new Set([process.pid]);
  let parent = all.find((p) => p.ProcessId === process.pid)?.ParentProcessId;
  while (parent && !ignored.has(parent)) {
    ignored.add(parent);
    parent = all.find((p) => p.ProcessId === parent)?.ParentProcessId;
  }
  const needle = key(root);
  return all
    .filter(
      (p) =>
        registered.some((r) => r.pid === p.ProcessId && (!r.creationDate || r.creationDate === p.CreationDate)) ||
        (!ignored.has(p.ProcessId) &&
          `${p.CommandLine ?? ""} ${p.ExecutablePath ?? ""}`.replaceAll("\\", "/").toLowerCase().includes(needle)),
    )
    .map((p) => ({
      pid: p.ProcessId,
      creationDate: p.CreationDate,
      name: path.basename(p.ExecutablePath ?? "unknown"),
    }));
}
function patchId(canonical, revisionArgs) {
  const diff = run("git", ["-C", canonical, "diff", "--binary", "--no-ext-diff", ...revisionArgs]);
  return run("git", ["patch-id", "--stable"], canonical, { input: diff }).trim().split(" ")[0];
}
export function sourceLanded(canonical, head, merge, commits = [], verifiedMain = "refs/remotes/origin/main") {
  if (!succeeds(canonical, ["merge-base", "--is-ancestor", merge, verifiedMain])) fail("MERGE_NOT_ON_MAIN");
  if (succeeds(canonical, ["merge-base", "--is-ancestor", head, merge])) return "normal";
  if (!succeeds(canonical, ["rev-parse", "--verify", `${merge}^`])) fail("LANDED_SOURCE_MISMATCH");
  const base = git(canonical, ["merge-base", head, `${merge}^`]);
  const original = patchId(canonical, [base, head]);
  if (original && original === patchId(canonical, [`${merge}^`, merge])) return "squash";
  if (commits.length && commits.length <= 500) {
    const landed = git(canonical, ["rev-list", `--max-count=${commits.length}`, merge])
      .split("\n")
      .reverse();
    const candidatePatches = commits.map((c) => patchId(canonical, [`${c}^`, c]));
    const landedPatches = landed.map((c) => patchId(canonical, [`${c}^`, c]));
    if (candidatePatches.every(Boolean) && JSON.stringify(candidatePatches) === JSON.stringify(landedPatches))
      return "rebase";
  }
  fail("LANDED_SOURCE_MISMATCH");
}
export class GitHubAuthority {
  constructor(config, { guard = reserve } = {}) {
    this.config = config;
    this.guard = guard;
  }
  api(endpoint) {
    return JSON.parse(run("gh", ["api", endpoint]));
  }
  ensureCommit(canonical, revision) {
    if (!/^[a-f0-9]{40}$/u.test(revision)) fail("INVALID_REMOTE_COMMIT");
    if (succeeds(canonical, ["cat-file", "-e", `${revision}^{commit}`])) return;
    const pending = [revision];
    const seen = new Set();
    let bytes = 0;
    while (pending.length) {
      const sha = pending.pop();
      if (seen.has(sha) || succeeds(canonical, ["cat-file", "-e", `${sha}^{commit}`])) continue;
      if (seen.size >= 100) fail("COMMIT_METADATA_BUDGET_EXCEEDED");
      const commit = this.api(`repos/${this.config.repository}/git/commits/${sha}`);
      const length = Buffer.byteLength(JSON.stringify(commit));
      if (length > 1024 ** 2 || !succeeds(canonical, ["cat-file", "-e", `${commit.tree.sha}^{tree}`]))
        fail("SOURCE_OBJECT_HYDRATION_REQUIRED_NO_UNBOUNDED_FETCH");
      bytes += length;
      seen.add(sha);
      pending.push(...commit.parents.map((p) => p.sha));
    }
    // Trees and blobs are already local. Only this bounded commit metadata graph
    // is admitted; unrelated main history and blob hydration are never fetched.
    this.guard(driveEstimates(this.config.commonDir, bytes * 8 + 16 * 1024 ** 2));
    run("git", ["-C", canonical, "fetch", "--no-tags", "--filter=blob:none", "origin", revision]);
    if (!succeeds(canonical, ["cat-file", "-e", `${revision}^{commit}`])) fail("FETCHED_COMMIT_NOT_OBSERVED");
  }
  refresh(canonical) {
    const branch = this.api(`repos/${this.config.repository}/branches/main`);
    if (!branch.protected) fail("MAIN_NOT_PROTECTED");
    this.ensureCommit(canonical, branch.commit.sha);
    const old = git(canonical, ["rev-parse", "refs/remotes/origin/main"]);
    git(canonical, ["update-ref", "refs/remotes/origin/main", branch.commit.sha, old]);
  }
  verify(record, canonical) {
    const repo = this.config.repository;
    if (!/^[-\w.]+\/[-\w.]+$/u.test(repo)) fail("INVALID_REPOSITORY");
    const pr = this.api(`repos/${repo}/pulls/${record.pr}`);
    if (
      !pr.merged ||
      pr.base.ref !== "main" ||
      pr.base.repo.full_name.toLowerCase() !== repo.toLowerCase() ||
      pr.head.sha !== record.head
    )
      fail("PROTECTED_MERGE_NOT_VERIFIED");
    const branch = this.api(`repos/${repo}/branches/main`);
    if (!branch.protected) fail("MAIN_NOT_PROTECTED");
    const protection = this.api(`repos/${repo}/branches/main/protection/required_status_checks`);
    if (
      !protection.strict ||
      !protection.checks?.some((c) => c.context === "Sounding Line / Mainline Decision" && c.app_id === 15368)
    )
      fail("REQUIRED_MAINLINE_PROTECTION_CHANGED");
    const checks = this.api(`repos/${repo}/commits/${pr.head.sha}/check-runs?per_page=100`).check_runs;
    const decision = checks
      .filter((c) => c.name === "Sounding Line / Mainline Decision" && c.app.id === 15368)
      .sort((a, b) => b.id - a.id)[0];
    if (!decision || decision.conclusion !== "success") fail("REQUIRED_PROTECTED_DECISION_MISSING");
    const commits = this.api(`repos/${repo}/pulls/${record.pr}/commits?per_page=100`).map((c) => c.sha);
    if (pr.commits > commits.length) fail("PR_COMMIT_PAGINATION_REQUIRED");
    const comparison = this.api(`repos/${repo}/compare/${pr.merge_commit_sha}...${branch.commit.sha}`);
    if (!["identical", "ahead"].includes(comparison.status)) fail("MERGE_NOT_ON_PROTECTED_MAIN");
    this.ensureCommit(canonical, pr.merge_commit_sha);
    return {
      pr: record.pr,
      head: pr.head.sha,
      merge: pr.merge_commit_sha,
      mergedAt: pr.merged_at,
      decisionId: decision.id,
      appId: decision.app.id,
      method: sourceLanded(canonical, record.head, pr.merge_commit_sha, commits, pr.merge_commit_sha),
      mainlineProof: { head: branch.commit.sha, comparison: comparison.status, strict: true },
      checkedAt: now(),
    };
  }
}
export class Lifecycle {
  constructor(stateRoot, dependencies = {}) {
    this.root = physical(path.resolve(stateRoot));
    this.file = path.join(this.root, "registry.json");
    this.guard = dependencies.guard ?? reserve;
    this.processes = dependencies.processes ?? windowsProcesses;
    this.smoke = dependencies.smoke ?? ((r) => this.landedSmoke(r));
    this.authority = dependencies.authority;
    this.clock = dependencies.clock ?? (() => Date.now());
    this.estimate = dependencies.estimate ?? driveEstimates;
    this.removeWorktree =
      dependencies.removeWorktree ?? ((p) => git(this.config.canonical, ["worktree", "remove", "--", p]));
    if (fs.existsSync(this.file)) this.load();
  }
  load() {
    this.db = json(this.file);
    if (this.db.version !== 1 || !Array.isArray(this.db.records)) fail("REGISTRY_INVALID");
    this.config = this.db.config;
    if (within(this.config.canonical, this.root)) fail("REGISTRY_INSIDE_CANONICAL");
    if (!this.authority) this.authority = new GitHubAuthority(this.config, { guard: this.guard });
  }
  init(canonical, repository) {
    if (fs.existsSync(this.file)) fail("REGISTRY_ALREADY_EXISTS");
    canonical = physical(canonical);
    const listed = worktrees(canonical);
    if (!same(listed[0]?.path ?? "", canonical) || listed[0].branch !== "refs/heads/main")
      fail("CANONICAL_MAIN_REQUIRED");
    if (listed.some((r) => same(r.path, this.root) || within(r.path, this.root))) fail("REGISTRY_INSIDE_WORKTREE");
    this.guard(this.estimate(this.root, 1024 ** 2));
    fs.mkdirSync(this.root, { recursive: true });
    this.config = {
      canonical,
      commonDir: physical(git(canonical, ["rev-parse", "--path-format=absolute", "--git-common-dir"])),
      repository,
      policy: { ...POLICY },
      smokeFiles: ["scripts/workspaces/lifecycle.mjs", "tests/workspaces/lifecycle.test.mjs"],
    };
    this.db = { version: 1, config: this.config, records: [], createdAt: now() };
    atomic(this.file, this.db);
    this.load();
    return this.config;
  }
  transaction(fn) {
    if (!this.config) fail("REGISTRY_NOT_INITIALIZED");
    this.guard(this.estimate(this.root, 1024 ** 2));
    const lock = path.join(this.root, "registry.lock");
    try {
      fs.mkdirSync(lock);
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const owner = path.join(lock, "owner.json");
      if (!fs.existsSync(owner) || alive(json(owner).pid)) fail("REGISTRY_BUSY");
      fs.unlinkSync(owner);
      fs.rmdirSync(lock);
      fs.mkdirSync(lock);
    }
    fs.writeFileSync(path.join(lock, "owner.json"), JSON.stringify({ pid: process.pid, started: now() }), {
      flag: "wx",
    });
    try {
      this.load();
      return fn();
    } finally {
      fs.unlinkSync(path.join(lock, "owner.json"));
      fs.rmdirSync(lock);
    }
  }
  save() {
    atomic(this.file, this.db);
  }
  bindHost(physicalRoot) {
    return this.transaction(() => {
      const target = path.join(physicalRoot, "registry.json");
      const original = fs.statSync(this.file, { bigint: true });
      const resolved = fs.statSync(target, { bigint: true });
      if (original.ino !== resolved.ino || original.dev !== resolved.dev) fail("HOST_REGISTRY_FILE_ID_MISMATCH");
      this.config.registryAliases = [...new Set([this.root, path.resolve(physicalRoot)])];
      this.config.physicalRegistryRoot = path.resolve(physicalRoot);
      this.save();
      return this.config;
    });
  }
  receipt(record, event, details) {
    const receipt = { id: randomUUID(), at: now(), workspaceId: record?.id ?? null, event, ...details };
    const dir = path.join(this.root, "receipts");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${receipt.at.replaceAll(/[:.]/gu, "-")}-${receipt.id}.json`),
      `${JSON.stringify(receipt, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    );
    return receipt;
  }
  record(id) {
    const r = this.db.records.find((x) => x.id === id || same(x.path, id));
    if (!r) fail("UNKNOWN_OWNER");
    return r;
  }
  assertTarget(p) {
    p = physical(p);
    if (
      same(p, this.config.canonical) ||
      within(this.config.canonical, p) ||
      within(p, this.config.canonical) ||
      same(p, this.config.commonDir) ||
      within(p, this.root) ||
      same(p, this.root)
    )
      fail("PROTECTED_ROOT");
    return p;
  }
  assertOwner(r) {
    this.assertTarget(r.path);
    if (!fs.existsSync(r.path)) fail("OWNER_ROOT_MISSING");
    const marker = path.join(r.path, markerName);
    if (!fs.existsSync(marker) || fs.lstatSync(marker).isSymbolicLink()) fail("OWNERSHIP_MARKER_MISSING");
    const m = json(marker);
    if (
      m.id !== r.id ||
      m.token !== r.token ||
      !same(m.path, r.path) ||
      m.task !== r.task ||
      m.kind !== r.kind ||
      (!same(m.registry, this.root) &&
        !(
          this.config.registryAliases?.some((p) => same(p, m.registry)) &&
          this.config.registryAliases?.some((p) => same(p, this.root))
        ))
    )
      fail("OWNERSHIP_MARKER_INVALID");
    if (r.kind === "worktree") {
      if (!fs.lstatSync(path.join(r.path, ".git")).isFile()) fail("LINKED_WORKTREE_REQUIRED");
      const w = worktrees(this.config.canonical).find((x) => same(x.path, r.path));
      if (!w || w.locked || w.prunable) fail("WORKTREE_REGISTRATION_UNSAFE");
      if (
        !same(physical(git(r.path, ["rev-parse", "--path-format=absolute", "--git-common-dir"])), this.config.commonDir)
      )
        fail("GIT_COMMON_DIRECTORY_CHANGED");
    } else if (r.kind !== "runtime") fail("RESOURCE_CLASS_NOT_RETIRABLE");
    else if (fs.existsSync(path.join(r.path, ".git"))) fail("RUNTIME_CONTAINS_GIT");
  }
  marker(r) {
    atomic(path.join(r.path, markerName), {
      id: r.id,
      token: r.token,
      path: r.path,
      task: r.task,
      kind: r.kind,
      registry: this.root,
    });
  }
  inventory() {
    const listed = worktrees(this.config.canonical);
    const extra = this.db.records
      .filter((r) => r.state !== "RETIRED" && r.kind === "runtime")
      .map((r) => ({ path: r.path }));
    const roots = [...listed.filter((r) => !same(r.path, this.config.canonical)), ...extra]
      .map((r) => ({
        ...r,
        registeredPath: r.path,
        path: fs.existsSync(r.path) ? fs.realpathSync.native(r.path) : r.path,
      }))
      .filter((r, index, all) => all.findIndex((x) => same(x.path, r.path)) === index);
    const items = roots.map((w) => ({
      ...w,
      ...scan(w.path, {
        allowGitStores: true,
        excludedRoots: roots.filter((other) => within(w.path, other.path)).map((other) => other.path),
      }),
    }));
    const complete = !items.some((i) => i.errors.length);
    const actualBound = items.reduce((s, i) => s + i.allocationBoundBytes, 0);
    const reservations = this.db.records
      .filter((r) => ["CREATING", "ACTIVE"].includes(r.state))
      .reduce(
        (s, r) => s + Math.max(0, r.peakBytes - (items.find((i) => same(i.path, r.path))?.allocationBoundBytes ?? 0)),
        0,
      );
    return {
      at: now(),
      complete,
      registeredCount: listed.length,
      items,
      logicalBytes: items.reduce((s, i) => s + i.logicalBytes, 0),
      allocationBoundBytes: actualBound,
      reservedAdditionalBytes: reservations,
      admissionFootprint: actualBound + reservations,
    };
  }
  register({
    path: p,
    task,
    kind = "worktree",
    peakBytes = POLICY.workspaceBytes,
    generated = [],
    adoptedReason,
    preserveRef = null,
    custodyManifest = null,
  }) {
    p = this.assertTarget(p);
    if (!["worktree", "runtime"].includes(kind)) fail("RESOURCE_CLASS_NOT_RETIRABLE");
    if (kind === "runtime" && fs.existsSync(path.join(p, ".git"))) fail("RUNTIME_CONTAINS_GIT");
    if (kind === "worktree" && !fs.lstatSync(path.join(p, ".git")).isFile()) fail("LINKED_WORKTREE_REQUIRED");
    const markerBudget = this.estimate(p, 1024 ** 2);
    const registryBudget = this.estimate(this.root, 1024 ** 2);
    this.guard({ C: markerBudget.C + registryBudget.C, D: markerBudget.D + registryBudget.D });
    if (!task || this.db.records.some((r) => same(r.path, p) && !["RETIRED", "UNOWNED"].includes(r.state)))
      fail("OWNER_TASK_OR_PATH_INVALID");
    if (fs.existsSync(path.join(p, markerName))) fail("EXISTING_OWNERSHIP_MARKER");
    this.db.records = this.db.records.filter((r) => !same(r.path, p) || r.state !== "UNOWNED");
    if (this.db.records.some((r) => r.state !== "RETIRED" && within(p, r.path))) fail("NESTED_RESOURCE_OWNER");
    const r = {
      id: randomUUID(),
      token: randomUUID(),
      path: p,
      kind,
      task,
      project: this.config.repository,
      commonDir: this.config.commonDir,
      createdAt: now(),
      lastActiveAt: now(),
      state: "ACTIVE",
      lease: { expiresAt: this.clock() + POLICY.leaseMs },
      processOwners: [],
      peakBytes,
      generated: [],
      pr: null,
      head: null,
      branch: null,
      evidence: null,
      merge: null,
      eligible: false,
      lastCleanup: null,
      adoptedReason,
      preserveRef,
      custodyManifest,
    };
    for (const relative of generated) {
      if (
        path.isAbsolute(relative) ||
        relative.split(/[\\/]/u).includes("..") ||
        !relative ||
        relative === ".git" ||
        relative === "."
      )
        fail("GENERATED_PATH_INVALID");
      r.generated.push(relative.replaceAll("\\", "/"));
    }
    if (kind === "worktree") {
      r.head = git(p, ["rev-parse", "HEAD"]);
      r.branch = branchOf(p);
    }
    this.db.records.push(r);
    this.marker(r);
    this.save();
    this.assertOwner(r);
    this.receipt(r, "REGISTERED", { adoptedReason });
    return r;
  }
  create(options) {
    return this.transaction(() => {
      const p = this.assertTarget(options.path);
      const reusable = this.db.records.find(
        (r) => r.task === options.task && r.state === "ACTIVE" && fs.existsSync(r.path),
      );
      if (reusable && !options.additionalReason) {
        this.assertOwner(reusable);
        return { reused: true, record: reusable };
      }
      if (fs.existsSync(p)) fail("CREATE_TARGET_EXISTS");
      const inventory = this.inventory();
      if (!inventory.complete) fail("STORAGE_SCAN_INCOMPLETE");
      const estimate = this.estimate(p, options.peakBytes);
      const stateEstimate = this.estimate(this.root, 1024 ** 2);
      estimate.C += stateEstimate.C;
      estimate.D += stateEstimate.D;
      const free = this.guard(estimate);
      checkBudget({
        policy: this.config.policy,
        free: { C: free.cFreeBytes, D: free.dFreeBytes },
        estimates: estimate,
        footprint: inventory.admissionFootprint,
        peak: options.peakBytes,
        taskCount: this.db.records.filter(
          (r) => r.task === options.task && r.kind === "worktree" && r.state !== "RETIRED",
        ).length,
        additionalReason: options.additionalReason,
      });
      if ((options.kind ?? "worktree") === "worktree" && !options.branch?.startsWith("codex/"))
        fail("OWNED_BRANCH_REQUIRED");
      if ((options.kind ?? "worktree") === "worktree") {
        const sourceBytes = git(this.config.canonical, ["ls-tree", "-rl", "refs/remotes/origin/main"])
          .split("\n")
          .reduce((sum, line) => {
            const match = line.match(/^\d+ blob [a-f0-9]+\s+(\d+)\t(.+)$/u);
            if (!match) return sum;
            const name = match[2];
            return (
              sum +
              (!options.sparse?.length || !name.includes("/") || options.sparse.some((s) => name.startsWith(`${s}/`))
                ? Math.ceil(Number(match[1]) / 4096) * 4096
                : 0)
            );
          }, 0);
        if (sourceBytes + 1024 ** 2 > options.peakBytes) fail("CHECKOUT_EXCEEDS_DECLARED_PEAK");
      }
      // Persist allocation reservation before git writes significant checkout bytes.
      const pending = {
        id: randomUUID(),
        path: p,
        kind: options.kind ?? "worktree",
        task: options.task,
        state: "CREATING",
        peakBytes: options.peakBytes,
        createdAt: now(),
        lastCleanup: null,
      };
      this.db.records.push(pending);
      this.save();
      try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        if (pending.kind === "runtime") fs.mkdirSync(p);
        else
          git(this.config.canonical, [
            "worktree",
            "add",
            "--no-checkout",
            "-b",
            options.branch,
            p,
            "refs/remotes/origin/main",
          ]);
        this.db.records = this.db.records.filter((r) => r.id !== pending.id);
        // --no-checkout has a valid HEAD; register and mark before hydration.
        const r = this.register({ ...options, path: p });
        r.state = "CREATING";
        this.save();
        if (pending.kind === "worktree") {
          if (options.sparse?.length) {
            git(p, ["sparse-checkout", "init", "--cone"]);
            git(p, ["sparse-checkout", "set", "--", ...options.sparse]);
          }
          git(p, ["reset", "--hard", "HEAD"]);
        }
        r.state = "ACTIVE";
        r.storage = scan(p);
        this.save();
        this.receipt(r, "CREATED", {
          storage: r.storage,
          admission: { footprint: inventory.admissionFootprint, peakBytes: options.peakBytes },
        });
        return { reused: false, record: r };
      } catch (e) {
        pending.lastCleanup = { at: now(), error: e.message };
        this.save();
        throw e;
      }
    });
  }
  adopt(options) {
    return this.transaction(() => {
      if (!options.adoptedReason || options.adoptedReason.length < 30) fail("EXPLICIT_CUSTODY_REASON_REQUIRED");
      return this.register(options);
    });
  }
  finish(id, outcome, pr) {
    return this.transaction(() => {
      const r = this.record(id);
      if (r.state === "RETIRED") return r;
      this.assertOwner(r);
      if (!terminal.has(outcome)) fail("INVALID_TERMINAL_OUTCOME");
      if (r.kind === "worktree") {
        r.head = git(r.path, ["rev-parse", "HEAD"]);
        r.branch = branchOf(r.path);
      }
      if (pr !== undefined && (!Number.isSafeInteger(pr) || pr < 1)) fail("INVALID_PR");
      r.outcome = outcome;
      r.pr = pr ?? r.pr;
      r.lease = null;
      r.state = "PENDING";
      this.save();
      this.receipt(r, "TASK_FINISHED", { outcome, pr: r.pr });
      return this.reconcile(r);
    });
  }
  lease(id, pid) {
    return this.transaction(() => {
      const r = this.record(id);
      this.assertOwner(r);
      if (r.state !== "ACTIVE") fail("TERMINAL_TASK_CANNOT_RENEW");
      r.lease = { expiresAt: this.clock() + POLICY.leaseMs };
      r.lastActiveAt = now();
      if (pid) {
        const p = windowsProcesses("__no_path__", [{ pid }]).find((x) => x.pid === pid);
        if (!p) fail("PROCESS_IDENTITY_REQUIRED");
        r.processOwners.push(p);
      }
      this.save();
      return r;
    });
  }
  auditRecord(r) {
    this.assertOwner(r);
    const storage = scan(r.path, { entries: true });
    if (storage.errors.length) fail(`SCAN_FAILED:${storage.errors[0]}`);
    const processes = this.processes(r.path, r.processOwners);
    let dirty = [];
    if (r.kind === "worktree") {
      if (git(r.path, ["rev-parse", "HEAD"]) !== r.head) fail("HEAD_CHANGED_REQUIRES_FINISH");
      const flagged = run("git", ["-C", r.path, "ls-files", "-v", "-z"]).split("\0").filter(Boolean);
      for (const entry of flagged) {
        if (/^[a-z]/u.test(entry)) fail(`MASKED_TRACKED_SOURCE:${entry.slice(2)}`);
        if (entry.startsWith("S ")) {
          try {
            fs.lstatSync(path.join(r.path, entry.slice(2)));
          } catch (e) {
            if (e.code === "ENOENT") continue;
            throw e;
          }
          fail(`SKIPPED_TRACKED_SOURCE_PRESENT:${entry.slice(2)}`);
        }
      }
      const status = run("git", [
        "-c",
        "core.fsmonitor=false",
        "-C",
        r.path,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "-z",
      ]);
      dirty = status.split("\0").filter((line) => {
        if (!line || line === `?? ${markerName}`) return false;
        if (!line.startsWith("?? ")) return true;
        const relative = line.slice(3).replaceAll("\\", "/");
        // Explicit generated roots can contain ordinary untracked dependency or
        // build output. Tracked source is independently rejected before cleanup.
        return !r.generated.some((g) => relative === g || relative.startsWith(`${g}/`));
      });
      if (fs.existsSync(git(r.path, ["rev-parse", "--path-format=absolute", "--git-path", "index.lock"])))
        fail("GIT_OPERATION_IN_PROGRESS");
    }
    // Evidence directories may be preserved, but unique dirty source is never discarded.
    return { storage, processes, dirty };
  }
  blocked(r, error) {
    r.state = "HELD";
    r.eligible = false;
    r.hold = {
      reason: error.message,
      since: r.hold?.since ?? now(),
      nextAttemptAt: this.clock() + POLICY.holdMs,
      attempts: (r.hold?.attempts ?? 0) + 1,
    };
    r.lastCleanup = { at: now(), result: "BLOCKED", reason: error.message };
    this.save();
    this.receipt(r, "RETIREMENT_BLOCKED", { reason: error.message, hold: r.hold });
    return r;
  }
  preserve(r, audit) {
    const excluded = (p) =>
      p === markerName || p === ".git" || r.generated.some((g) => p === g || p.startsWith(`${g}/`));
    let tracked = new Set();
    if (r.kind === "worktree") tracked = new Set(run("git", ["-C", r.path, "ls-files", "-z"]).split("\0"));
    const evidence = audit.storage.entries.filter((e) => !excluded(e.path) && !tracked.has(e.path));
    const bytes = evidence.reduce((sum, e) => sum + (e.bytes ?? 0), 0);
    this.guard(this.estimate(this.root, bytes + evidence.length * 2048 + 1024 ** 2));
    const archive = path.join(this.root, "preserved", r.id, randomUUID());
    fs.mkdirSync(archive, { recursive: true });
    const manifest = [];
    for (const entry of evidence) {
      const source = path.join(r.path, entry.path);
      const dest = path.join(archive, entry.path);
      if (!within(archive, dest)) fail("ARCHIVE_PATH_ESCAPE");
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      if (entry.kind === "link") {
        manifest.push({ path: entry.path, kind: "link", target: entry.target });
        continue;
      }
      if (fs.lstatSync(source).isSymbolicLink()) fail("EVIDENCE_CHANGED_TO_LINK");
      fs.copyFileSync(source, dest, fs.constants.COPYFILE_EXCL);
      const hash = hashFile(source);
      if (hash !== hashFile(dest)) fail("PRESERVATION_HASH_MISMATCH");
      manifest.push({ path: entry.path, kind: "file", bytes: entry.bytes, sha256: hash });
    }
    const info = { archive, manifest, sha256: sha256(JSON.stringify(manifest)), head: r.head, at: now() };
    atomic(path.join(archive, "manifest.json"), info);
    r.evidence = { archive, sha256: info.sha256, at: info.at, files: manifest.length };
    this.save();
    this.receipt(r, "PRESERVED", { archive, sha256: info.sha256, files: manifest.length });
  }
  verifyPreserved(r) {
    if (!r.evidence) fail("PRESERVATION_MISSING");
    const info = json(path.join(r.evidence.archive, "manifest.json"));
    if (info.sha256 !== r.evidence.sha256 || sha256(JSON.stringify(info.manifest)) !== info.sha256)
      fail("PRESERVATION_IDENTITY_CHANGED");
    for (const e of info.manifest)
      if (e.kind === "file" && hashFile(path.join(info.archive, e.path)) !== e.sha256) fail("PRESERVATION_CORRUPT");
  }
  verifyExternalCustody(r) {
    if (!r.custodyManifest) return;
    const manifest = json(r.custodyManifest);
    const items = manifest.items.filter((i) => within(r.path, i.mapping.source));
    if (!items.length) fail("EXTERNAL_CUSTODY_MAPPING_MISSING");
    for (const item of items) {
      const destination = physical(item.mapping.destination);
      if (within(r.path, destination) || fs.existsSync(item.mapping.source))
        fail("EXTERNAL_CUSTODY_NOT_OUTSIDE_CHECKOUT");
      const actual = scan(destination, { entries: true });
      if (actual.errors.length) fail("EXTERNAL_CUSTODY_SCAN_FAILED");
      const expected = item.manifest.entries.filter((e) => e.kind !== "directory");
      if (actual.entries.length !== expected.length) fail("EXTERNAL_CUSTODY_FILE_SET_CHANGED");
      for (const entry of expected) {
        const found = actual.entries.find((e) => e.path === entry.path);
        if (!found) fail("EXTERNAL_CUSTODY_FILE_MISSING");
        if (entry.kind === "file") {
          if (
            found.kind !== "file" ||
            found.bytes !== entry.size ||
            hashFile(path.join(destination, entry.path)) !== entry.sha256
          )
            fail("EXTERNAL_CUSTODY_HASH_MISMATCH");
        } else if (
          found.kind !== "link" ||
          key(found.target.replace(/^\\\\\?\\/u, "")) !== key(entry.target.replace(/^\\\\\?\\/u, ""))
        )
          fail(`EXTERNAL_CUSTODY_LINK_CHANGED:${entry.path}`);
      }
    }
    r.externalEvidence = {
      manifest: r.custodyManifest,
      sha256: hashFile(r.custodyManifest),
      verifiedAt: now(),
      items: items.length,
    };
    this.save();
  }
  landedSmoke(r) {
    const merge = r.merge.merge;
    if (!succeeds(this.config.canonical, ["cat-file", "-e", `${merge}:scripts/workspaces/lifecycle.mjs`])) {
      if (!r.adoptedReason || !r.merge.mergedAt || Date.parse(r.merge.mergedAt) >= Date.parse(this.db.createdAt))
        fail("HISTORICAL_SMOKE_NOT_ELIGIBLE");
      // Historical checkouts predate this manager. Their existing protected
      // functional decision remains the authority; this new smoke checks landed
      // source custody and parseable manifests, without claiming a product retest.
      const tree = git(this.config.canonical, ["rev-parse", `${merge}^{tree}`]);
      const manifests = [];
      for (const file of ["package.json", "package-lock.json"]) {
        const bytes = run("git", ["-C", this.config.canonical, "show", `${merge}:${file}`]);
        if (Buffer.byteLength(bytes) > 16 * 1024 ** 2) fail("HISTORICAL_MANIFEST_BUDGET_EXCEEDED");
        const parsed = JSON.parse(bytes);
        if (!parsed.name || !parsed.version) fail("HISTORICAL_MANIFEST_INVALID");
        manifests.push({ file, sha256: sha256(bytes) });
      }
      return this.receipt(r, "LANDED_SMOKE_PASSED", {
        kind: "historical-landed-source-integrity",
        merge,
        tree,
        manifests,
        protectedDecisionId: r.merge.decisionId,
        functionalProductRetest: false,
      });
    }
    const dest = path.join(this.root, "smoke", randomUUID());
    fs.mkdirSync(dest, { recursive: true });
    const owner = { id: randomUUID(), path: dest, purpose: "landed-smoke" };
    atomic(path.join(dest, markerName), owner);
    this.guard(this.estimate(dest, 32 * 1024 ** 2));
    const blobs = [];
    for (const file of this.config.smokeFiles) {
      const output = path.join(dest, file);
      fs.mkdirSync(path.dirname(output), { recursive: true });
      const bytes = run("git", ["-C", this.config.canonical, "show", `${r.merge.merge}:${file}`], undefined, {
        encoding: "buffer",
      });
      if (bytes.length > 2 * 1024 ** 2) fail("SMOKE_SOURCE_BUDGET_EXCEEDED");
      fs.writeFileSync(output, bytes, { flag: "wx" });
      blobs.push({ file, sha256: sha256(bytes) });
    }
    let output;
    try {
      output = run(process.execPath, ["--test", "tests/workspaces/lifecycle.test.mjs"], dest, {
        timeout: 300000,
        env: { ...process.env, TMP: dest, TEMP: dest },
      });
    } catch (e) {
      this.receipt(r, "LANDED_SMOKE_FAILED", { error: e.message, output: String(e.stdout ?? "").slice(-100000) });
      throw e;
    }
    const proof = this.receipt(r, "LANDED_SMOKE_PASSED", { merge: r.merge.merge, blobs, output });
    if (json(path.join(dest, markerName)).id !== owner.id) fail("SMOKE_OWNER_CHANGED");
    removeOwnedTree(dest, dest);
    return proof;
  }
  sourcePreserved(r) {
    if (r.pr) {
      r.merge = this.authority.verify(r, this.config.canonical);
      this.save();
      r.smoke = this.smoke(r);
      this.save();
      return;
    }
    if (r.preserveRef) {
      if (!/^refs\/heads\/codex\/[\w./-]+$/u.test(r.preserveRef)) fail("PRESERVE_REF_INVALID");
      const other = worktrees(this.config.canonical).find((w) => w.branch === r.preserveRef && !same(w.path, r.path));
      if (!other || !succeeds(this.config.canonical, ["merge-base", "--is-ancestor", r.head, r.preserveRef]))
        fail("SOURCE_CUSTODY_NOT_VERIFIED");
      r.sourceCustody = {
        ref: r.preserveRef,
        head: git(this.config.canonical, ["rev-parse", r.preserveRef]),
        path: other.path,
        at: now(),
      };
      this.save();
      return;
    }
    this.authority.refresh(this.config.canonical);
    if (!succeeds(this.config.canonical, ["merge-base", "--is-ancestor", r.head, "refs/remotes/origin/main"]))
      fail("UNMERGED_SOURCE_PRESERVED");
    r.sourceCustody = {
      ref: "refs/remotes/origin/main",
      head: git(this.config.canonical, ["rev-parse", "refs/remotes/origin/main"]),
      at: now(),
    };
    this.save();
  }
  generatedCleanup(r, audit) {
    // No file outside the explicit, task-registered generated roots is disposable.
    for (const relative of r.generated) {
      const target = path.join(r.path, relative);
      if (!within(r.path, target)) fail("GENERATED_PATH_ESCAPE");
      const generatedScan = scan(target);
      if (generatedScan.errors.length) fail(`GENERATED_SCAN_FAILED:${generatedScan.errors[0]}`);
      if (r.kind === "worktree" && git(r.path, ["ls-files", "--", relative]))
        fail(`GENERATED_ROOT_HAS_TRACKED_SOURCE:${relative}`);
      removeOwnedTree(r.path, target);
    }
    this.receipt(r, "GENERATED_RELEASED", { outcome: r.outcome, beforeLogicalBytes: audit.storage.logicalBytes });
  }
  reconcile(r) {
    if (r.state === "RETIRED") return r;
    try {
      // A crash after Git removed the root but before registry commit is resumable.
      if (r.retirement && ["RETIRING", "HELD"].includes(r.state) && !fs.existsSync(r.path)) {
        if (worktrees(this.config.canonical).some((w) => same(w.path, r.path)))
          fail("STALE_WORKTREE_REGISTRATION_REQUIRES_REPAIR");
        this.verifyPreserved(r);
        return this.complete(r);
      }
      this.assertOwner(r);
      if (r.lease && r.lease.expiresAt > this.clock()) fail("ACTIVE_LEASE");
      if (!r.outcome) {
        r.outcome = "expired";
        this.save();
      }
      let audit = this.auditRecord(r);
      r.storage = {
        logicalBytes: audit.storage.logicalBytes,
        allocationBoundBytes: audit.storage.allocationBoundBytes,
        measuredAt: now(),
      };
      if (audit.processes.length) fail(`ACTIVE_PROCESS:${audit.processes.map((p) => p.pid).join(",")}`);
      const consumers = worktrees(this.config.canonical).filter((w) => !same(w.path, r.path));
      consumers.push(
        ...this.db.records.filter((x) => x.kind === "runtime" && x.state !== "RETIRED" && !same(x.path, r.path)),
      );
      const links = consumers.map((w) => {
        let target = w.path;
        if (fs.existsSync(target)) {
          target = fs.realpathSync.native(target);
          // A registered checkout can have a junction alias. Inspect its explicit
          // physical Git root read-only after verifying the common store; never
          // recurse through nested junctions and never mutate this consumer.
          if (
            !same(target, w.path) &&
            w.kind !== "runtime" &&
            !same(
              physical(git(w.path, ["rev-parse", "--path-format=absolute", "--git-common-dir"])),
              this.config.commonDir,
            )
          )
            fail(`CONSUMER_GIT_IDENTITY_CHANGED:${w.path}`);
        }
        return { workspace: w.path, physicalPath: target, ...scanLinks(target) };
      });
      const incomplete = links.find((w) => w.errors.length);
      if (incomplete) fail(`SHARED_CONSUMER_SCAN_INCOMPLETE:${incomplete.workspace}:${incomplete.errors[0]}`);
      const inbound = links
        .flatMap((w) => w.links.map((l) => ({ workspace: w.workspace, ...l })))
        .filter((l) => same(l.resolved, r.path) || within(r.path, l.resolved));
      if (inbound.length) fail(`SHARED_JUNCTION_CONSUMER:${inbound[0].workspace}:${inbound[0].relative}`);
      // Failed/expired work can shed reproducible outputs while its source stays.
      if (audit.dirty.length) {
        if (["failed", "cancelled", "expired"].includes(r.outcome)) this.generatedCleanup(r, audit);
        fail(`DIRTY_UNIQUE_WORK:${audit.dirty.length}`);
      }
      if (["failed", "cancelled", "expired"].includes(r.outcome)) {
        this.generatedCleanup(r, audit);
        audit = this.auditRecord(r);
      }
      if (r.kind === "worktree") this.sourcePreserved(r);
      this.verifyExternalCustody(r);
      this.preserve(r, audit);
      this.verifyPreserved(r);
      // Re-read source, lease, process and content immediately before mutation.
      const final = this.auditRecord(r);
      if (final.dirty.length || final.processes.length) fail("FINAL_USAGE_OR_SOURCE_CHANGED");
      const signature = (s) =>
        JSON.stringify(s.entries.filter((e) => e.path !== markerName).sort((a, b) => a.path.localeCompare(b.path)));
      if (signature(final.storage) !== signature(audit.storage)) fail("CONTENT_CHANGED_DURING_PREFLIGHT");
      r.eligible = true;
      r.state = "RETIRING";
      r.retirement = {
        startedAt: now(),
        freeBefore: this.guard({ C: 0, D: 0 }),
        beforeLogicalBytes: audit.storage.logicalBytes,
      };
      this.save();
      this.generatedCleanup(r, audit);
      // Git and native unlink never traverse reparse targets.
      for (const l of scan(r.path).links) removeOwnedTree(r.path, path.join(r.path, l.relative));
      if (r.kind === "worktree") {
        fs.unlinkSync(path.join(r.path, markerName));
        try {
          this.removeWorktree(r.path);
        } catch (e) {
          if (fs.existsSync(r.path)) this.marker(r);
          throw e;
        }
      } else removeOwnedTree(r.path, r.path);
      if (fs.existsSync(r.path) || worktrees(this.config.canonical).some((w) => same(w.path, r.path)))
        fail("REMOVAL_NOT_OBSERVED");
      return this.complete(r);
    } catch (e) {
      return this.blocked(r, e);
    }
  }
  complete(r) {
    this.verifyPreserved(r);
    this.verifyExternalCustody(r);
    const after = this.guard({ C: 0, D: 0 });
    r.state = "RETIRED";
    r.eligible = false;
    r.hold = null;
    r.lease = null;
    r.lastCleanup = {
      result: "RETIRED",
      at: now(),
      freeAfter: after,
      netFreeChange: r.retirement
        ? {
            C: after.cFreeBytes - r.retirement.freeBefore.cFreeBytes,
            D: after.dFreeBytes - r.retirement.freeBefore.dFreeBytes,
          }
        : null,
    };
    // Compare-and-delete only a merged branch whose tip is unchanged and which
    // no other worktree uses. Preserve custody refs and all remote refs.
    if (
      r.merge &&
      r.branch?.startsWith("codex/") &&
      !worktrees(this.config.canonical).some((w) => w.branch === `refs/heads/${r.branch}`) &&
      succeeds(this.config.canonical, ["show-ref", "--verify", `refs/heads/${r.branch}`]) &&
      git(this.config.canonical, ["rev-parse", `refs/heads/${r.branch}`]) === r.head
    ) {
      git(this.config.canonical, ["update-ref", "-d", `refs/heads/${r.branch}`, r.head]);
      r.lastCleanup.branchRetired = r.branch;
    }
    this.save();
    this.receipt(r, "RETIRED", {
      merge: r.merge,
      evidence: { archive: r.evidence.archive, sha256: r.evidence.sha256 },
      cleanup: r.lastCleanup,
    });
    return r;
  }
  retire(id) {
    return this.transaction(() => this.reconcile(this.record(id)));
  }
  sweep({ limit = 4, recoverOnly = false } = {}) {
    return this.transaction(() => {
      for (const w of worktrees(this.config.canonical).filter((w) => !same(w.path, this.config.canonical))) {
        if (!this.db.records.some((r) => same(r.path, w.path) && r.state !== "RETIRED"))
          this.db.records.push({
            id: randomUUID(),
            path: w.path,
            kind: "worktree",
            commonDir: this.config.commonDir,
            project: this.config.repository,
            head: w.head,
            branch: w.branch,
            task: null,
            state: "UNOWNED",
            discoveredAt: now(),
            eligible: false,
            hold: { reason: "OWNERSHIP_UNVERIFIED", nextAttemptAt: null },
            lastCleanup: null,
          });
      }
      this.save();
      const candidates = this.db.records.filter(
        (r) =>
          !["RETIRED", "UNOWNED"].includes(r.state) &&
          (!recoverOnly || ["RETIRING", "CREATING"].includes(r.state) || r.retirement) &&
          (!r.lease || r.lease.expiresAt <= this.clock()) &&
          (!r.hold || r.hold.nextAttemptAt <= this.clock()),
      );
      const results = [];
      for (const r of candidates.slice(0, Math.min(limit, 20))) {
        if (r.state === "CREATING") {
          results.push(this.blocked(r, new Error("INTERRUPTED_CREATION_REQUIRES_AUDIT")));
          continue;
        }
        results.push(this.reconcile(r));
      }
      this.receipt(null, "RECONCILED", {
        considered: candidates.length,
        attempted: results.length,
        retired: results.filter((r) => r.state === "RETIRED").length,
      });
      return results;
    });
  }
  status() {
    return { config: this.config, records: this.db.records, free: this.guard({ C: 0, D: 0 }) };
  }
}
