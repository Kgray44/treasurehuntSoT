import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "..", "..");
const hook = join(repositoryRoot, ".codex", "hooks", "hookline.mjs");

function event(name, overrides = {}) {
  return {
    session_id: "hookline-test-session",
    cwd: repositoryRoot,
    hook_event_name: name,
    ...overrides,
  };
}

function runHook(payload, { stateRoot, env = {}, cwd = repositoryRoot } = {}) {
  const result = spawnSync(process.execPath, [hook], {
    cwd,
    input: JSON.stringify({ ...payload, cwd }),
    encoding: "utf8",
    env: {
      ...process.env,
      HOOKLINE_STATE_ROOT: stateRoot,
      ...env,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

async function withState(run) {
  const stateRoot = await mkdtemp(join(tmpdir(), "hookline-state-"));
  try {
    await run(stateRoot);
  } finally {
    await rm(stateRoot, { recursive: true, force: true });
  }
}

async function filesNamed(root, name) {
  const matches = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.name === name) matches.push(target);
    }
  }
  await visit(root);
  return matches;
}

async function capsule(stateRoot) {
  const matches = await filesNamed(stateRoot, "capsule.json");
  assert.equal(matches.length, 1, "exactly one Hookline capsule is expected");
  return JSON.parse(await readFile(matches[0], "utf8"));
}

async function events(stateRoot) {
  const matches = await filesNamed(stateRoot, "events.jsonl");
  assert.equal(matches.length, 1, "exactly one Hookline telemetry log is expected");
  return (await readFile(matches[0], "utf8"))
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

test("SessionStart startup, resume, and compact restore a bounded continuity capsule", async () => {
  await withState(async (stateRoot) => {
    const env = {
      HOOKLINE_OBJECTIVE: "Implement the Hookline fixture.",
      HOOKLINE_REMAINING_WORK: "run focused test,record validation",
    };
    for (const source of ["startup", "resume", "compact"]) {
      const result = runHook(event("SessionStart", { source }), { stateRoot, env });
      assert.equal(result.hookSpecificOutput.hookEventName, "SessionStart");
      assert.match(result.hookSpecificOutput.additionalContext, /Implement the Hookline fixture/);
      assert.match(result.hookSpecificOutput.additionalContext, /Remaining local work/);
      assert.ok(result.hookSpecificOutput.additionalContext.length < 1301);
    }
    const saved = await capsule(stateRoot);
    assert.equal(saved.objective.status, "active");
    assert.deepEqual(saved.remainingLocallyAttainableWork, ["run focused test", "record validation"]);
    assert.equal(saved.repository.baseCurrentMain.length, 40);
  });
});

test("PreCompact, PostCompact, and SessionEnd preserve a final local capsule", async () => {
  await withState(async (stateRoot) => {
    runHook(event("SessionStart", { source: "startup" }), { stateRoot });
    assert.deepEqual(runHook(event("PreCompact", { trigger: "manual" }), { stateRoot }), {});
    assert.deepEqual(runHook(event("PostCompact", { trigger: "manual" }), { stateRoot }), {});
    assert.deepEqual(runHook(event("SessionEnd", { reason: "other" }), { stateRoot }), {});
    const saved = await capsule(stateRoot);
    assert.ok(saved.sessionEndedAt);
    assert.deepEqual(
      (await events(stateRoot)).map((entry) => entry.type),
      ["session_start", "pre_compact", "post_compact", "session_end"],
    );
  });
});

test("PreToolUse permits safe Bash in GUARD mode", async () => {
  await withState(async (stateRoot) => {
    const result = runHook(event("PreToolUse", { tool_name: "Bash", tool_input: { command: "git status --short" } }), {
      stateRoot,
      env: { HOOKLINE_MODE: "GUARD" },
    });
    assert.deepEqual(result, {});
  });
});

test("PreToolUse blocks destructive Bash before it executes", async () => {
  await withState(async (stateRoot) => {
    const reset = runHook(event("PreToolUse", { tool_name: "Bash", tool_input: { command: "git reset --hard" } }), {
      stateRoot,
      env: { HOOKLINE_MODE: "GUARD" },
    });
    assert.equal(reset.hookSpecificOutput.permissionDecision, "deny");
    assert.match(reset.hookSpecificOutput.permissionDecisionReason, /reset --hard/);
    const removal = runHook(event("PreToolUse", { tool_name: "Bash", tool_input: { command: "rm -rf ." } }), {
      stateRoot,
      env: { HOOKLINE_MODE: "GUARD" },
    });
    assert.equal(removal.hookSpecificOutput.permissionDecision, "deny");
    assert.match(removal.hookSpecificOutput.permissionDecisionReason, /Broad repository removal/);
  });
});

test("PreToolUse fails safely for an ambiguous destructive Bash command", async () => {
  await withState(async (stateRoot) => {
    const result = runHook(
      event("PreToolUse", {
        tool_name: "Bash",
        tool_input: { command: "git reset $(Get-Content mode.txt) --hard" },
      }),
      { stateRoot, env: { HOOKLINE_MODE: "GUARD" } },
    );
    assert.equal(result.hookSpecificOutput.permissionDecision, "deny");
    assert.match(result.hookSpecificOutput.permissionDecisionReason, /Ambiguous/);
  });
});

test("OBSERVE leaves non-absolute broad restoration to normal Codex policy", async () => {
  await withState(async (stateRoot) => {
    const result = runHook(event("PreToolUse", { tool_name: "Bash", tool_input: { command: "git checkout -- ." } }), {
      stateRoot,
      env: { HOOKLINE_MODE: "OBSERVE" },
    });
    assert.deepEqual(result, {});
  });
});

test("PostToolUse records successful low-cost structured telemetry", async () => {
  await withState(async (stateRoot) => {
    runHook(event("SessionStart", { source: "startup" }), { stateRoot });
    assert.deepEqual(
      runHook(
        event("PostToolUse", {
          turn_id: "turn-success",
          tool_name: "Bash",
          tool_input: { command: "npm run test:hookline" },
          tool_response: { exit_code: 0, duration_ms: 44, output: "not persisted" },
        }),
        { stateRoot },
      ),
      {},
    );
    const telemetry = (await events(stateRoot)).at(-1);
    assert.deepEqual(
      {
        type: telemetry.type,
        operation: telemetry.operation,
        status: telemetry.status,
        durationMs: telemetry.durationMs,
        failureFingerprint: telemetry.failureFingerprint,
      },
      { type: "post_tool", operation: "test", status: "passed", durationMs: 44, failureFingerprint: null },
    );
    assert.equal(JSON.stringify(telemetry).includes("not persisted"), false);
  });
});

test("PostToolUse records a concise failed-test fingerprint without raw output", async () => {
  await withState(async (stateRoot) => {
    runHook(event("SessionStart", { source: "startup" }), { stateRoot });
    runHook(
      event("PostToolUse", {
        tool_name: "Bash",
        tool_input: { command: "npm test" },
        tool_response: { exit_code: 1, output: "private Chronicle detail" },
      }),
      { stateRoot },
    );
    const saved = await capsule(stateRoot);
    assert.equal(saved.focusedTest.status, "failed");
    assert.equal(saved.knownFailure.fingerprint, "EXIT_1");
    assert.equal(JSON.stringify(await events(stateRoot)).includes("private Chronicle detail"), false);
  });
});

test("SubagentStart receives a bounded workstream contract and SubagentStop stays advisory", async () => {
  await withState(async (stateRoot) => {
    const env = {
      HOOKLINE_OBJECTIVE: "Add Hookline fixture coverage.",
      HOOKLINE_REMAINING_WORK: "test lifecycle payloads",
      HOOKLINE_OWNED_PATHS: "tests/hookline/hookline.test.mjs,.codex/hooks/hookline.mjs",
      HOOKLINE_NON_OWNERSHIP: "src/**,prisma/**",
    };
    runHook(event("SessionStart", { source: "startup" }), { stateRoot, env });
    const start = runHook(event("SubagentStart", { agent_id: "agent-7", agent_type: "general" }), { stateRoot, env });
    assert.equal(start.hookSpecificOutput.hookEventName, "SubagentStart");
    assert.match(start.hookSpecificOutput.additionalContext, /Add Hookline fixture coverage/);
    assert.match(start.hookSpecificOutput.additionalContext, /Owned paths: tests\/hookline\/hookline.test.mjs/);
    assert.match(start.hookSpecificOutput.additionalContext, /Do not change: src\/\*\*/);
    assert.ok(start.hookSpecificOutput.additionalContext.length < 1001);
    assert.deepEqual(
      runHook(event("SubagentStop", { agent_id: "agent-7", agent_type: "general" }), { stateRoot, env }),
      {},
    );
    assert.equal((await events(stateRoot)).at(-1).observationOnly, true);
  });
});

test("Stop allows normal completion when there is no capsule", async () => {
  await withState(async (stateRoot) => {
    assert.deepEqual(runHook(event("Stop"), { stateRoot, env: { HOOKLINE_MODE: "CONTINUITY" } }), {});
    assert.equal((await filesNamed(stateRoot, "capsule.json")).length, 0);
  });
});

test("explicit credential-like objective values are redacted before local persistence", async () => {
  await withState(async (stateRoot) => {
    runHook(event("SessionStart", { source: "startup" }), {
      stateRoot,
      env: { HOOKLINE_OBJECTIVE: "Validate token=hookline-private-value safely." },
    });
    const serialized = JSON.stringify(await capsule(stateRoot));
    assert.equal(serialized.includes("hookline-private-value"), false);
    assert.match(serialized, /token=\[redacted\]/);
  });
});

test("Stop permits a completed objective", async () => {
  await withState(async (stateRoot) => {
    runHook(event("SessionStart", { source: "startup" }), {
      stateRoot,
      env: {
        HOOKLINE_MODE: "CONTINUITY",
        HOOKLINE_OBJECTIVE: "Complete fixture",
        HOOKLINE_OBJECTIVE_STATUS: "active",
        HOOKLINE_REMAINING_WORK: "run test",
      },
    });
    assert.deepEqual(
      runHook(event("Stop"), {
        stateRoot,
        env: { HOOKLINE_MODE: "CONTINUITY", HOOKLINE_OBJECTIVE_STATUS: "completed", HOOKLINE_REMAINING_WORK: "" },
      }),
      {},
    );
  });
});

test("Stop continues exactly once for positively declared locally attainable work", async () => {
  await withState(async (stateRoot) => {
    const env = {
      HOOKLINE_MODE: "CONTINUITY",
      HOOKLINE_MAX_CONTINUATIONS: "1",
      HOOKLINE_OBJECTIVE: "Complete fixture",
      HOOKLINE_OBJECTIVE_STATUS: "active",
      HOOKLINE_REMAINING_WORK: "run the focused test,finalize the record",
    };
    runHook(event("SessionStart", { source: "startup" }), { stateRoot, env });
    const first = runHook(event("Stop", { stop_hook_active: false }), { stateRoot, env });
    assert.equal(first.decision, "block");
    assert.match(first.reason, /Do not begin additional scope/);
    assert.deepEqual(runHook(event("Stop", { stop_hook_active: true }), { stateRoot, env }), {});
    assert.deepEqual(runHook(event("Stop", { stop_hook_active: false }), { stateRoot, env }), {});
    assert.equal((await capsule(stateRoot)).continuationCount, 1);
  });
});

test("PermissionRequest keeps safe operations undecided and denies known dangerous operations", async () => {
  await withState(async (stateRoot) => {
    assert.deepEqual(
      runHook(event("PermissionRequest", { tool_name: "Bash", tool_input: { command: "npm test" } }), { stateRoot }),
      {},
    );
    const dangerous = runHook(
      event("PermissionRequest", { tool_name: "Bash", tool_input: { command: "git push --force origin main" } }),
      { stateRoot },
    );
    assert.equal(dangerous.hookSpecificOutput.decision.behavior, "deny");
    assert.match(dangerous.hookSpecificOutput.decision.message, /Force push/);
  });
});

test("corrupt local state disables Stop continuation instead of guessing", async () => {
  await withState(async (stateRoot) => {
    const env = {
      HOOKLINE_MODE: "CONTINUITY",
      HOOKLINE_OBJECTIVE: "Complete fixture",
      HOOKLINE_REMAINING_WORK: "run test",
    };
    runHook(event("SessionStart", { source: "startup" }), { stateRoot, env });
    const [stateFile] = await filesNamed(stateRoot, "capsule.json");
    await writeFile(stateFile, "{not json", "utf8");
    assert.deepEqual(runHook(event("Stop", { stop_hook_active: false }), { stateRoot, env }), {});
  });
});

test("parallel worktrees with the same session id receive isolated state", async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), "hookline-isolation-"));
  const first = await mkdtemp(join(tmpdir(), "hookline-worktree-a-"));
  const second = await mkdtemp(join(tmpdir(), "hookline-worktree-b-"));
  try {
    for (const directory of [first, second]) execFileSync("git", ["init", "--quiet"], { cwd: directory });
    runHook(event("SessionStart", { source: "startup" }), { stateRoot, cwd: first });
    runHook(event("SessionStart", { source: "startup" }), { stateRoot, cwd: second });
    const stateFiles = await filesNamed(stateRoot, "capsule.json");
    assert.equal(stateFiles.length, 2);
    const roots = await Promise.all(
      stateFiles.map(async (file) => JSON.parse(await readFile(file, "utf8")).repository.gitRoot),
    );
    assert.deepEqual(new Set(roots), new Set([first, second].map((directory) => directory.replaceAll("\\", "/"))));
  } finally {
    await rm(stateRoot, { recursive: true, force: true });
    await rm(first, { recursive: true, force: true });
    await rm(second, { recursive: true, force: true });
  }
});
