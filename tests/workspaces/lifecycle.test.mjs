import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import {
  Lifecycle,
  POLICY,
  GiB,
  checkBudget,
  git,
  sourceLanded,
  scan,
  removeOwnedTree,
  windowsProcesses,
  GitHubAuthority,
} from "../../scripts/workspaces/lifecycle.mjs";

const marker = ".voyagewright-workspace.json";
function fixture(t, overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vw-lifecycle-"));
  const main = path.join(root, "main");
  fs.mkdirSync(main);
  git(main, ["init", "-b", "main"]);
  git(main, ["config", "user.name", "Synthetic lifecycle test"]);
  git(main, ["config", "user.email", "lifecycle@example.invalid"]);
  fs.writeFileSync(path.join(main, ".gitignore"), "node_modules/\n.next/\nevidence/\n");
  fs.writeFileSync(path.join(main, "source.txt"), "original\n");
  git(main, ["add", "."]);
  git(main, ["commit", "-m", "synthetic baseline"]);
  git(main, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  const dependencies = {
    guard: () => ({ allowed: true, cFreeBytes: 100 * GiB, dFreeBytes: 100 * GiB }),
    estimate: (_, bytes) => ({ C: 0, D: bytes }),
    processes: () => [],
    authority: {
      refresh() {},
      verify(r) {
        return {
          head: r.head,
          merge: git(main, ["rev-parse", "main"]),
          method: sourceLanded(main, r.head, git(main, ["rev-parse", "main"])),
          appId: 15368,
        };
      },
    },
    smoke: () => ({ result: "synthetic-passed" }),
    ...overrides,
  };
  const state = path.join(root, "state");
  const manager = new Lifecycle(state, dependencies);
  manager.init(main, "synthetic/test");
  fs.writeFileSync(
    path.join(root, "synthetic-owner.json"),
    JSON.stringify({ kind: "voyagewright-lifecycle-test", root }),
  );
  t.after(() => {
    const owner = JSON.parse(fs.readFileSync(path.join(root, "synthetic-owner.json")));
    assert.equal(owner.kind, "voyagewright-lifecycle-test");
    assert.equal(owner.root, root);
    assert.ok(path.dirname(root) === os.tmpdir() && path.basename(root).startsWith("vw-lifecycle-"));
    // Test fixture Git stores are synthetic and private; never use the production
    // generated-resource remover to remove a real or shared object store.
    const links = scan(root).links;
    for (const link of links) removeOwnedTree(root, path.join(root, link.relative));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const create = (name = "one", extra = {}) =>
    manager.create({
      path: path.join(root, name),
      branch: `codex/${name}`,
      task: `task-${name}`,
      peakBytes: 16 * 1024 ** 2,
      generated: ["node_modules", ".next"],
      ...extra,
    }).record;
  const merge = (r, method = "normal") => {
    fs.writeFileSync(path.join(r.path, "source.txt"), "developed\n");
    git(r.path, ["add", "source.txt"]);
    git(r.path, ["commit", "-m", "synthetic change"]);
    if (method === "squash") {
      git(main, ["merge", "--squash", r.branch]);
      git(main, ["commit", "-m", "squashed change"]);
    } else git(main, ["merge", "--no-ff", r.branch, "-m", "protected merge fixture"]);
    git(main, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  };
  return { root, main, state, manager, create, merge, dependencies };
}
test("real CREATE DEVELOP MERGE VERIFY RETIRE, evidence and shared Git survive", (t) => {
  const f = fixture(t);
  const r = f.create();
  f.merge(r);
  fs.mkdirSync(path.join(r.path, "node_modules"));
  fs.writeFileSync(path.join(r.path, "node_modules", "generated"), "reproducible");
  fs.mkdirSync(path.join(r.path, "evidence"));
  fs.writeFileSync(path.join(r.path, "evidence", "failed-receipt.json"), "immutable failure");
  const result = f.manager.finish(r.id, "completed", 1);
  assert.equal(result.state, "RETIRED", result.hold?.reason);
  assert.equal(fs.existsSync(r.path), false);
  assert.equal(
    fs.readFileSync(path.join(result.evidence.archive, "evidence", "failed-receipt.json"), "utf8"),
    "immutable failure",
  );
  assert.equal(git(f.main, ["branch", "--show-current"]), "main");
  assert.ok(fs.existsSync(path.join(f.main, ".git", "objects")));
  assert.equal(f.manager.retire(r.id).state, "RETIRED");
  assert.equal(f.manager.finish(r.id, "completed", 1).state, "RETIRED");
});
test("active lease and live process prevent retirement", (t) => {
  const f = fixture(t, { processes: () => [{ pid: 1234 }] });
  const r = f.create();
  assert.equal(f.manager.retire(r.id).hold.reason, "ACTIVE_LEASE");
  assert.match(f.manager.finish(r.id, "completed").hold.reason, /ACTIVE_PROCESS/u);
  assert.ok(fs.existsSync(r.path));
});
test("canonical checkout, aliases, invalid marker, .git directory fail closed", (t) => {
  const f = fixture(t);
  assert.throws(
    () =>
      f.manager.adopt({
        path: f.main,
        task: "bad",
        adoptedReason: "Explicit synthetic test of protected canonical root",
      }),
    /PROTECTED_ROOT/u,
  );
  const r = f.create();
  fs.writeFileSync(path.join(r.path, marker), "{}");
  assert.throws(() => f.manager.finish(r.id, "completed"), /OWNERSHIP_MARKER_INVALID/u);
  assert.ok(fs.existsSync(r.path));
});
test("dirty unfinished source survives failed runs while generated data is released", (t) => {
  const f = fixture(t);
  const r = f.create();
  fs.writeFileSync(path.join(r.path, "source.txt"), "unfinished unique source");
  fs.mkdirSync(path.join(r.path, "node_modules"));
  fs.writeFileSync(path.join(r.path, "node_modules", "cache"), "generated");
  const result = f.manager.finish(r.id, "failed");
  assert.match(result.hold.reason, /DIRTY_UNIQUE_WORK/u);
  assert.equal(fs.readFileSync(path.join(r.path, "source.txt"), "utf8"), "unfinished unique source");
  assert.equal(fs.existsSync(path.join(r.path, "node_modules")), false);
});
test("junction target survives actual generated cleanup", (t) => {
  const f = fixture(t);
  const r = f.create();
  const target = path.join(f.root, "shared");
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "keep"), "shared bytes");
  fs.mkdirSync(path.join(r.path, "node_modules"));
  fs.symlinkSync(
    target,
    path.join(r.path, "node_modules", "shared"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const result = f.manager.finish(r.id, "completed");
  assert.equal(result.state, "RETIRED", result.hold?.reason);
  assert.equal(fs.readFileSync(path.join(target, "keep"), "utf8"), "shared bytes");
});
test("incoming shared junction holds its owning checkout", (t) => {
  const f = fixture(t);
  const r = f.create();
  const consumer = f.create("consumer");
  fs.mkdirSync(path.join(r.path, "node_modules"));
  fs.symlinkSync(
    path.join(r.path, "node_modules"),
    path.join(consumer.path, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.match(f.manager.finish(r.id, "completed").hold.reason, /SHARED_JUNCTION_CONSUMER/u);
  assert.ok(fs.existsSync(r.path));
});
test("squash merge is verified by source patch and safely retires branch", (t) => {
  const f = fixture(t);
  const r = f.create();
  f.merge(r, "squash");
  const result = f.manager.finish(r.id, "completed", 2);
  assert.equal(result.state, "RETIRED", result.hold?.reason);
  assert.equal(result.merge.method, "squash");
});
test("different landed source fails closed", (t) => {
  const f = fixture(t);
  const r = f.create();
  fs.writeFileSync(path.join(r.path, "source.txt"), "unlanded\n");
  git(r.path, ["add", "source.txt"]);
  git(r.path, ["commit", "-m", "unique source"]);
  assert.match(f.manager.finish(r.id, "completed", 3).hold.reason, /LANDED_SOURCE_MISMATCH/u);
  assert.ok(fs.existsSync(r.path));
});
test("policy denied removal records blocker and cannot claim success", (t) => {
  const f = fixture(t, {
    removeWorktree: () => {
      throw new Error("PLATFORM_POLICY_DENIED");
    },
  });
  const r = f.create();
  const result = f.manager.finish(r.id, "completed");
  assert.equal(result.state, "HELD");
  assert.match(result.lastCleanup.reason, /PLATFORM_POLICY_DENIED/u);
  assert.ok(fs.existsSync(path.join(r.path, marker)));
});
test("restart resumes cleanup after Git removal before registry commit", (t) => {
  const f = fixture(t);
  const r = f.create();
  f.manager.smoke = () => ({});
  f.manager.removeWorktree = (p) => {
    git(f.main, ["worktree", "remove", p]);
    throw new Error("SIMULATED_CRASH_AFTER_REMOVE");
  };
  f.manager.finish(r.id, "completed");
  // Model an abrupt process death at the persisted RETIRING checkpoint, not a handled failure.
  const db = JSON.parse(fs.readFileSync(path.join(f.state, "registry.json")));
  db.records[0].state = "RETIRING";
  db.records[0].hold = null;
  fs.writeFileSync(path.join(f.state, "registry.json"), JSON.stringify(db));
  const restarted = new Lifecycle(f.state, f.dependencies);
  assert.equal(restarted.sweep({ recoverOnly: true })[0].state, "RETIRED");
});
test("leases expire; failed clean runs and disposable runtimes retire automatically", (t) => {
  let timestamp = Date.now();
  const f = fixture(t, { clock: () => timestamp });
  const r = f.create();
  timestamp += POLICY.leaseMs + 1;
  assert.equal(f.manager.sweep()[0].state, "RETIRED");
  const runtime = path.join(f.root, "runtime");
  fs.mkdirSync(runtime);
  fs.writeFileSync(path.join(runtime, "diagnostic"), "preserve");
  const owned = f.manager.adopt({
    path: runtime,
    task: "runtime-task",
    kind: "runtime",
    adoptedReason: "Synthetic marker-owned non-Git browser runtime",
  });
  assert.equal(f.manager.finish(owned.id, "failed").state, "RETIRED");
  assert.equal(fs.existsSync(runtime), false);
  assert.ok(r.id);
});
test("aggregate, finite task budget, duplicate task and separate reserves deny allocation", () => {
  const input = { free: { C: 100 * GiB, D: 100 * GiB }, estimates: { C: 0, D: GiB }, footprint: 0, peak: GiB };
  assert.doesNotThrow(() => checkBudget(input));
  assert.throws(() => checkBudget({ ...input, footprint: 75 * GiB }), /AGGREGATE/u);
  assert.throws(() => checkBudget({ ...input, peak: Infinity }), /WORKSPACE/u);
  assert.throws(() => checkBudget({ ...input, peak: 13 * GiB }), /WORKSPACE/u);
  assert.throws(() => checkBudget({ ...input, taskCount: 1 }), /TASK_WORKSPACE/u);
  assert.throws(() => checkBudget({ ...input, estimates: { C: -1, D: 0 } }), /UNBOUNDED/u);
  assert.throws(() => checkBudget({ ...input, free: { C: 30 * GiB, D: 100 * GiB } }), /RESERVE_DENIED:C/u);
  assert.throws(() => checkBudget({ ...input, free: { C: 100 * GiB, D: 31 * GiB } }), /RESERVE_DENIED:D/u);
});
test("create reuses owned workspace; excessive creation leaves no checkout", (t) => {
  const f = fixture(t);
  const r = f.create();
  assert.equal(f.manager.create({ path: path.join(f.root, "other"), task: r.task }).record.id, r.id);
  assert.throws(() => f.create("huge", { peakBytes: 13 * GiB }), /WORKSPACE_BUDGET/u);
  assert.equal(fs.existsSync(path.join(f.root, "huge")), false);
});
test("nested Git stores and tracked generated roots are protected", (t) => {
  const f = fixture(t);
  const runtime = path.join(f.root, "runtime");
  fs.mkdirSync(runtime);
  fs.mkdirSync(path.join(runtime, ".git"));
  assert.throws(
    () =>
      f.manager.adopt({
        path: runtime,
        kind: "runtime",
        task: "git-runtime",
        adoptedReason: "Synthetic embedded Git store must remain untouched",
      }),
    /RUNTIME_CONTAINS_GIT/u,
  );
  assert.ok(fs.existsSync(path.join(runtime, ".git")));
});
test("source custody can retire duplicate diagnostic worktree without deleting retained ref", (t) => {
  const f = fixture(t);
  const keeper = f.create("keeper");
  const duplicate = path.join(f.root, "duplicate");
  git(f.main, ["worktree", "add", "--detach", duplicate, "HEAD"]);
  const r = f.manager.adopt({
    path: duplicate,
    task: "diagnostic",
    preserveRef: `refs/heads/${keeper.branch}`,
    adoptedReason: "Completed duplicate diagnostic; source lives in active owner checkout",
  });
  assert.equal(f.manager.finish(r.id, "completed").state, "RETIRED");
  assert.equal(git(keeper.path, ["rev-parse", "HEAD"]), keeper.head);
});
test("scan never follows a broken link or target; repeat cleanup is idempotent", (t) => {
  const f = fixture(t);
  const dir = path.join(f.root, "disposable");
  fs.mkdirSync(dir);
  fs.symlinkSync(
    path.join(f.root, "absent"),
    path.join(dir, "broken"),
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(scan(dir).links.length, 1);
  removeOwnedTree(dir, dir);
  removeOwnedTree(dir, dir);
  assert.equal(fs.existsSync(dir), false);
});
test("rebase merge preserves the candidate patch sequence", (t) => {
  const f = fixture(t);
  const r = f.create();
  fs.writeFileSync(path.join(r.path, "one.txt"), "one\n");
  git(r.path, ["add", "one.txt"]);
  git(r.path, ["commit", "-m", "first"]);
  const first = git(r.path, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(r.path, "two.txt"), "two\n");
  git(r.path, ["add", "two.txt"]);
  git(r.path, ["commit", "-m", "second"]);
  const head = git(r.path, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(f.main, "independent.txt"), "parallel main\n");
  git(f.main, ["add", "independent.txt"]);
  git(f.main, ["commit", "-m", "main advanced"]);
  git(f.main, ["cherry-pick", first, head]);
  git(f.main, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  assert.equal(sourceLanded(f.main, head, git(f.main, ["rev-parse", "HEAD"]), [first, head]), "rebase");
});
test("runtime creation has an admission reservation and failed run retires it", (t) => {
  const f = fixture(t);
  const r = f.manager.create({
    path: path.join(f.root, "browser-runtime"),
    task: "runtime-task",
    kind: "runtime",
    peakBytes: 4 * 1024 ** 2,
  }).record;
  assert.equal(r.kind, "runtime");
  assert.equal(f.manager.finish(r.id, "failed").state, "RETIRED");
});
test("a real Windows process holds a checkout until released", { skip: process.platform !== "win32" }, async (t) => {
  const f = fixture(t, { processes: windowsProcesses });
  const r = f.create();
  const child = spawn(process.execPath, ["-e", "console.log('READY');setInterval(()=>{},1000)", r.path], {
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
  t.after(() => child.kill());
  await new Promise((resolve) => child.stdout.once("data", resolve));
  const result = f.manager.finish(r.id, "completed");
  assert.match(result.hold.reason, /ACTIVE_PROCESS/u);
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await exited;
  assert.equal(f.manager.retire(r.id).state, "RETIRED");
});
test("registered junction aliases are inspected through their verified physical Git root", (t) => {
  const f = fixture(t);
  const r = f.create();
  const consumer = f.create("alias-consumer");
  const moved = path.join(f.root, "physical-consumer");
  fs.renameSync(consumer.path, moved);
  fs.symlinkSync(moved, consumer.path, process.platform === "win32" ? "junction" : "dir");
  fs.mkdirSync(path.join(r.path, "node_modules"));
  fs.symlinkSync(
    path.join(r.path, "node_modules"),
    path.join(moved, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );
  const result = f.manager.finish(r.id, "completed");
  assert.match(result.hold.reason, /SHARED_JUNCTION_CONSUMER/u);
  assert.ok(fs.existsSync(path.join(moved, "source.txt")));
});
test("a linked Git checkout cannot be disguised as a disposable runtime", (t) => {
  const f = fixture(t);
  const p = path.join(f.root, "unmarked-checkout");
  git(f.main, ["worktree", "add", "--detach", p, "HEAD"]);
  assert.throws(
    () =>
      f.manager.adopt({
        path: p,
        kind: "runtime",
        task: "wrong-class",
        adoptedReason: "Attempt to relabel a linked Git checkout as runtime",
      }),
    /RUNTIME_CONTAINS_GIT/u,
  );
  assert.equal(git(p, ["rev-parse", "HEAD"]), git(f.main, ["rev-parse", "HEAD"]));
});
test("host path binding rejects a copied registry and retains one file identity", (t) => {
  const f = fixture(t);
  assert.equal(f.manager.bindHost(f.state).physicalRegistryRoot, f.state);
  const copy = path.join(f.root, "copied-registry");
  fs.mkdirSync(copy);
  fs.copyFileSync(path.join(f.state, "registry.json"), path.join(copy, "registry.json"));
  assert.throws(() => f.manager.bindHost(copy), /HOST_REGISTRY_FILE_ID_MISMATCH/u);
});
test("bounded commit retrieval denies missing trees before any allocation or fetch", (t) => {
  const f = fixture(t);
  let admitted = false;
  const authority = new GitHubAuthority(
    { repository: "synthetic/test", commonDir: path.join(f.main, ".git") },
    {
      guard: () => {
        admitted = true;
      },
    },
  );
  authority.api = () => ({ tree: { sha: "b".repeat(40) }, parents: [] });
  assert.throws(
    () => authority.ensureCommit(f.main, "a".repeat(40)),
    /SOURCE_OBJECT_HYDRATION_REQUIRED_NO_UNBOUNDED_FETCH/u,
  );
  assert.equal(admitted, false);
});
test("explicit ordinary untracked generated output retires while unique siblings remain protected", (t) => {
  const f = fixture(t);
  const r = f.create("generated", { generated: ["partial-dependencies"] });
  fs.mkdirSync(path.join(r.path, "partial-dependencies"));
  fs.writeFileSync(path.join(r.path, "partial-dependencies", "package.txt"), "reproducible dependency");
  fs.writeFileSync(path.join(r.path, "unique.txt"), "unfinished source");
  assert.match(f.manager.finish(r.id, "completed").hold.reason, /DIRTY_UNIQUE_WORK/u);
  assert.ok(fs.existsSync(path.join(r.path, "unique.txt")));
  fs.unlinkSync(path.join(r.path, "unique.txt"));
  assert.equal(f.manager.finish(r.id, "completed").state, "RETIRED");
});
test("assume-unchanged source is protected even when ordinary Git status is clean", (t) => {
  const f = fixture(t);
  const r = f.create();
  git(r.path, ["update-index", "--assume-unchanged", "source.txt"]);
  fs.writeFileSync(path.join(r.path, "source.txt"), "hidden unique source");
  assert.match(f.manager.finish(r.id, "completed").hold.reason, /MASKED_TRACKED_SOURCE/u);
  assert.equal(fs.readFileSync(path.join(r.path, "source.txt"), "utf8"), "hidden unique source");
});
test("historical source smoke reads real landed manifests without claiming a product retest", (t) => {
  const f = fixture(t);
  for (const file of ["package.json", "package-lock.json"])
    fs.writeFileSync(path.join(f.main, file), JSON.stringify({ name: "synthetic", version: "1.0.0" }));
  git(f.main, ["add", "package.json", "package-lock.json"]);
  git(f.main, ["commit", "-m", "historical manifests"]);
  const proof = f.manager.landedSmoke({
    id: "historical",
    adoptedReason: "Audited historical merged checkout",
    merge: {
      merge: git(f.main, ["rev-parse", "HEAD"]),
      mergedAt: new Date(Date.now() - 3600000).toISOString(),
      decisionId: 42,
    },
  });
  assert.equal(proof.kind, "historical-landed-source-integrity");
  assert.equal(proof.functionalProductRetest, false);
  assert.equal(proof.manifests.length, 2);
});
test("binary evidence in a squash merge is verified through actual Git object identities", (t) => {
  const f = fixture(t);
  const r = f.create();
  fs.writeFileSync(path.join(r.path, "synthetic-evidence.bin"), Buffer.alloc(1024 ** 2));
  git(r.path, ["add", "synthetic-evidence.bin"]);
  git(r.path, ["commit", "-m", "synthetic binary evidence"]);
  f.merge(r, "squash");
  const result = f.manager.finish(r.id, "completed", 2);
  assert.equal(result.state, "RETIRED", result.hold?.reason);
  assert.equal(result.merge.method, "squash");
});
test("ambient Git context cannot redirect workspace creation into canonical main", (t) => {
  const f = fixture(t);
  const previous = process.env.GIT_WORK_TREE;
  try {
    process.env.GIT_WORK_TREE = f.main;
    assert.throws(() => f.create("redirected"), /GIT_CONTEXT_OVERRIDE_DENIED:GIT_WORK_TREE/u);
    assert.equal(fs.existsSync(path.join(f.root, "redirected")), false);
    assert.equal(fs.readFileSync(path.join(f.main, "source.txt"), "utf8"), "original\n");
  } finally {
    if (previous === undefined) delete process.env.GIT_WORK_TREE;
    else process.env.GIT_WORK_TREE = previous;
  }
});
test("nested generated paths cannot traverse an ancestor junction", (t) => {
  const f = fixture(t);
  const r = f.create("nested", { generated: ["node_modules/cache"] });
  const shared = path.join(f.root, "outside-owned-root");
  fs.mkdirSync(shared);
  fs.mkdirSync(path.join(shared, "cache"));
  fs.writeFileSync(path.join(shared, "cache", "keep"), "shared target survives");
  fs.symlinkSync(shared, path.join(r.path, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  assert.match(f.manager.finish(r.id, "completed").hold.reason, /REPARSE_ANCESTOR/u);
  assert.equal(fs.readFileSync(path.join(shared, "cache", "keep"), "utf8"), "shared target survives");
});
test(
  "a real process with only an inherited workspace cwd is protected before generated cleanup",
  { skip: process.platform !== "win32" },
  async (t) => {
    const f = fixture(t, { processes: windowsProcesses });
    const r = f.create();
    fs.mkdirSync(path.join(r.path, "node_modules"));
    fs.writeFileSync(path.join(r.path, "node_modules", "keep"), "active output");
    const child = spawn(process.execPath, ["-e", "console.log('READY');setInterval(()=>{},1000)"], {
      cwd: r.path,
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    });
    t.after(() => child.kill());
    await new Promise((resolve) => child.stdout.once("data", resolve));
    const result = f.manager.finish(r.id, "completed");
    assert.match(result.hold.reason, /ROOT_HANDLE_BUSY_WIN32/u);
    assert.equal(fs.readFileSync(path.join(r.path, "node_modules", "keep"), "utf8"), "active output");
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exited;
    assert.equal(f.manager.retire(r.id).state, "RETIRED");
  },
);
test("an actual worker crash after marker removal recovers the same directory and preserved evidence", (t) => {
  const f = fixture(t);
  const r = f.create();
  const moduleUrl = new URL("../../scripts/workspaces/lifecycle.mjs", import.meta.url).href;
  const script = `import {Lifecycle,GiB} from ${JSON.stringify(moduleUrl)}; const m=new Lifecycle(process.env.VW_TEST_STATE,{guard:()=>({allowed:true,cFreeBytes:100*GiB,dFreeBytes:100*GiB}),estimate:(_,bytes)=>({C:0,D:bytes}),processes:()=>[],authority:{refresh(){}},removeWorktree:()=>process.exit(23)});m.finish(process.env.VW_TEST_ID,"completed");`;
  const worker = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: f.root,
    env: { ...process.env, VW_TEST_STATE: f.state, VW_TEST_ID: r.id },
    encoding: "utf8",
    windowsHide: true,
    timeout: 60000,
  });
  assert.equal(worker.status, 23, worker.stderr);
  assert.equal(fs.existsSync(path.join(r.path, marker)), false);
  const restarted = new Lifecycle(f.state, f.dependencies);
  const result = restarted.sweep({ recoverOnly: true })[0];
  assert.equal(result.state, "RETIRED", result.hold?.reason);
  assert.equal(fs.existsSync(r.path), false);
});
test("invalid sweep limits fail before resource mutation", (t) => {
  const f = fixture(t);
  for (const limit of [-1, 0, 21, NaN]) assert.throws(() => f.manager.sweep({ limit }), /INVALID_SWEEP_LIMIT/u);
});
