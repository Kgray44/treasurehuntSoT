#!/usr/bin/env node
/*
 * Hookline is deliberately local-only. It uses only the documented hook JSON
 * payload and stores its compact capsule under the current user's local app
 * data, never under a tracked repository path.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const MODES = new Set(["OBSERVE", "GUARD", "CONTINUITY"]);
const MAX_TEXT = 600;
const MAX_WORK_ITEMS = 6;
const STATE_FILE = "capsule.json";
const EVENT_FILE = "events.jsonl";

function now() {
  return new Date().toISOString();
}

function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function shortDigest(value) {
  return digest(value).slice(0, 16);
}

function readJson(text) {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function boundedText(value, limit = MAX_TEXT) {
  if (typeof value !== "string") return null;
  const compact = value.replaceAll(/\s+/gu, " ").trim();
  if (!compact) return null;
  return compact
    .replaceAll(/(\b(?:api[_-]?key|password|secret|token)\s*[:=]\s*)[^\s]+/giu, "$1[redacted]")
    .slice(0, limit);
}

function boundedList(value) {
  if (typeof value !== "string") return null;
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => boundedText(item, 140))
        .filter(Boolean),
    ),
  ].slice(0, MAX_WORK_ITEMS);
}

function git(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
    }).trim();
  } catch {
    return null;
  }
}

function resolveIdentity(event) {
  const cwd = typeof event.cwd === "string" && event.cwd.trim() ? event.cwd : process.cwd();
  const gitRoot = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (!gitRoot) return null;
  const commonGitDir = git(gitRoot, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const origin = git(gitRoot, ["remote", "get-url", "origin"]);
  const branch = git(gitRoot, ["branch", "--show-current"]) || "DETACHED";
  const currentHead = git(gitRoot, ["rev-parse", "HEAD"]);
  const currentMain = git(gitRoot, ["rev-parse", "origin/main"]);
  const repositoryIdentity = origin || commonGitDir || gitRoot;
  return {
    gitRoot,
    commonGitDir: commonGitDir || null,
    branch,
    currentHead: currentHead || null,
    currentMain: currentMain || null,
    repositoryKey: shortDigest(repositoryIdentity),
    worktreeKey: shortDigest(gitRoot),
  };
}

function runtimeBase() {
  if (process.env.HOOKLINE_STATE_ROOT) return path.resolve(process.env.HOOKLINE_STATE_ROOT);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "VoyagewrightHookline");
  return path.join(os.homedir(), ".local", "state", "VoyagewrightHookline");
}

function sessionDirectory(identity, event) {
  const sessionId = typeof event.session_id === "string" && event.session_id ? event.session_id : "unknown-session";
  return path.join(runtimeBase(), identity.repositoryKey, identity.worktreeKey, shortDigest(sessionId));
}

function defaultConfig() {
  return {
    schemaVersion: 1,
    defaultMode: "GUARD",
    maxAutomaticContinuations: 1,
    permissionAutoApproveEnabled: false,
    futurePermissionAllowlist: [],
  };
}

function loadConfig(identity) {
  const fallback = defaultConfig();
  const configPath = path.join(identity.gitRoot, ".codex", "hookline.config.json");
  if (!existsSync(configPath)) return fallback;
  try {
    const parsed = readJson(readFileSync(configPath, "utf8"));
    if (!parsed || parsed.schemaVersion !== 1) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function positiveInteger(value, fallback) {
  const number = Number.parseInt(String(value), 10);
  return Number.isSafeInteger(number) && number >= 0 && number <= 10 ? number : fallback;
}

function settings(identity) {
  const config = loadConfig(identity);
  const requestedMode = String(process.env.HOOKLINE_MODE || config.defaultMode || "GUARD").toUpperCase();
  return {
    mode: MODES.has(requestedMode) ? requestedMode : "GUARD",
    maxAutomaticContinuations: positiveInteger(
      process.env.HOOKLINE_MAX_CONTINUATIONS,
      positiveInteger(config.maxAutomaticContinuations, 1),
    ),
    permissionAutoApproveEnabled: false,
    futurePermissionAllowlist: Array.isArray(config.futurePermissionAllowlist) ? config.futurePermissionAllowlist : [],
  };
}

function freshState(identity, event, integrity = "trusted") {
  const timestamp = now();
  return {
    schemaVersion: 1,
    integrity,
    sessionId: typeof event.session_id === "string" ? event.session_id : "unknown-session",
    repository: {
      gitRoot: identity.gitRoot,
      worktreeKey: identity.worktreeKey,
      repositoryKey: identity.repositoryKey,
      branch: identity.branch,
      baseCurrentMain: identity.currentMain,
      currentHead: identity.currentHead,
    },
    objective: { status: "unknown", text: null },
    completedWorkstreams: [],
    remainingLocallyAttainableWork: [],
    ownedPaths: [],
    nonOwnershipBoundaries: [],
    focusedTest: null,
    knownFailure: null,
    knownBlocker: null,
    continuationCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    sessionEndedAt: null,
  };
}

function statePath(identity, event) {
  return path.join(sessionDirectory(identity, event), STATE_FILE);
}

function loadState(identity, event) {
  const target = statePath(identity, event);
  if (!existsSync(target)) return { state: freshState(identity, event), integrity: "missing" };
  try {
    const parsed = readJson(readFileSync(target, "utf8"));
    if (!parsed || parsed.schemaVersion !== 1 || !parsed.repository || !parsed.objective)
      throw new Error("HOOKLINE_STATE_INVALID");
    return { state: parsed, integrity: parsed.integrity === "trusted" ? "trusted" : "untrusted" };
  } catch {
    try {
      renameSync(target, `${target}.corrupt-${Date.now()}`);
    } catch {
      // The original can be left in place; automatic continuation remains disabled.
    }
    return { state: freshState(identity, event, "recovered_after_corruption"), integrity: "corrupt" };
  }
}

function writeState(identity, event, state) {
  const directory = sessionDirectory(identity, event);
  mkdirSync(directory, { recursive: true });
  state.updatedAt = now();
  const target = path.join(directory, STATE_FILE);
  const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  renameSync(temporary, target);
}

function recordEvent(identity, event, type, details = {}) {
  const directory = sessionDirectory(identity, event);
  mkdirSync(directory, { recursive: true });
  const entry = {
    schemaVersion: 1,
    timestamp: now(),
    type,
    sessionKey: shortDigest(event.session_id || "unknown-session"),
    turnKey: event.turn_id ? shortDigest(event.turn_id) : null,
    repositoryKey: identity.repositoryKey,
    worktreeKey: identity.worktreeKey,
    branch: identity.branch,
    ...details,
  };
  appendFileSync(path.join(directory, EVENT_FILE), `${JSON.stringify(entry)}\n`, "utf8");
}

function hasEnv(name) {
  return Object.prototype.hasOwnProperty.call(process.env, name);
}

function refreshState(state, identity) {
  state.repository.branch = identity.branch;
  state.repository.baseCurrentMain = identity.currentMain;
  state.repository.currentHead = identity.currentHead;
  const objective = boundedText(process.env.HOOKLINE_OBJECTIVE);
  if (objective) state.objective.text = objective;
  const requestedStatus = String(process.env.HOOKLINE_OBJECTIVE_STATUS || "").toLowerCase();
  if (state.objective.text && ["active", "completed"].includes(requestedStatus))
    state.objective.status = requestedStatus;
  else if (state.objective.text && state.objective.status === "unknown") state.objective.status = "active";
  const completed = boundedList(process.env.HOOKLINE_COMPLETED_WORKSTREAMS);
  if (completed) state.completedWorkstreams = completed;
  const remaining = boundedList(process.env.HOOKLINE_REMAINING_WORK);
  if (remaining) state.remainingLocallyAttainableWork = remaining;
  else if (hasEnv("HOOKLINE_REMAINING_WORK")) state.remainingLocallyAttainableWork = [];
  const ownedPaths = boundedList(process.env.HOOKLINE_OWNED_PATHS);
  if (ownedPaths) state.ownedPaths = ownedPaths;
  else if (hasEnv("HOOKLINE_OWNED_PATHS")) state.ownedPaths = [];
  const nonOwnershipBoundaries = boundedList(process.env.HOOKLINE_NON_OWNERSHIP);
  if (nonOwnershipBoundaries) state.nonOwnershipBoundaries = nonOwnershipBoundaries;
  else if (hasEnv("HOOKLINE_NON_OWNERSHIP")) state.nonOwnershipBoundaries = [];
  const blocker = boundedText(process.env.HOOKLINE_BLOCKER, 240);
  if (blocker) state.knownBlocker = { summary: blocker, requiresOwner: true, recordedAt: now() };
  else if (hasEnv("HOOKLINE_BLOCKER")) state.knownBlocker = null;
  return state;
}

function classifyOperation(event) {
  const tool = typeof event.tool_name === "string" ? event.tool_name : "unknown";
  const command = typeof event.tool_input?.command === "string" ? event.tool_input.command.toLowerCase() : "";
  if (tool === "Bash") {
    if (/(?:^|\s)(?:npm|pnpm|yarn|npx)\s+(?:run\s+)?(?:test|lint|build|format:check)/u.test(command)) {
      if (/\bbuild\b/u.test(command)) return "build";
      if (/\blint\b|format:check/u.test(command)) return "quality";
      return "test";
    }
    if (/\bgit\b/u.test(command)) return "git";
    return "shell";
  }
  if (tool === "apply_patch") return "edit";
  if (tool === "Agent") return "subagent";
  if (tool.startsWith("mcp__")) return "mcp";
  return "local";
}

function outcome(event) {
  const response = event.tool_response;
  if (response === undefined || response === null) return { status: "unknown", fingerprint: null, durationMs: null };
  const scan = response && typeof response === "object" ? response : {};
  const code = scan.exit_code ?? scan.exitCode ?? scan.statusCode;
  const duration = scan.duration_ms ?? scan.durationMs;
  if (scan.isError === true || scan.error || (Number.isFinite(code) && code !== 0)) {
    const fingerprint = Number.isFinite(code) ? `EXIT_${code}` : scan.isError === true ? "TOOL_ERROR" : "TOOL_FAILURE";
    return { status: "failed", fingerprint, durationMs: Number.isFinite(duration) ? duration : null };
  }
  return { status: "passed", fingerprint: null, durationMs: Number.isFinite(duration) ? duration : null };
}

function updateFocusedTest(state, event, result) {
  const operation = classifyOperation(event);
  if (!["test", "build", "quality"].includes(operation)) return;
  state.focusedTest = { operation, status: result.status, timestamp: now() };
  state.knownFailure =
    result.status === "failed"
      ? { operation, fingerprint: result.fingerprint, timestamp: now(), locallyAttainable: true }
      : null;
}

function commandFrom(event) {
  return typeof event.tool_input?.command === "string" ? event.tool_input.command.trim() : null;
}

function commandLooksAmbiguous(command) {
  if (!command || command.length > 12000 || command.includes("\u0000")) return true;
  let single = false;
  let double = false;
  let escaped = false;
  for (const character of command) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && !single) {
      escaped = true;
      continue;
    }
    if (character === "'" && !double) single = !single;
    if (character === '"' && !single) double = !double;
  }
  return (
    single || double || /`|\$\(|\b(?:eval|iex|invoke-expression)\b|\b(?:bash|sh|pwsh|powershell)\s+-c\b/iu.test(command)
  );
}

function commandSegments(command) {
  return command
    .split(/(?:&&|\|\||;|\r?\n)/u)
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);
}

function dangerousCommand(command) {
  if (!command) return null;
  const lower = command.toLowerCase();
  const potential = /\bgit\b/u.test(lower) && /\b(?:reset|clean|checkout|restore|push)\b/u.test(lower);
  if (commandLooksAmbiguous(command) && (potential || /\b(?:rm|rmdir|remove-item|del|drop\s+database)\b/u.test(lower)))
    return { severity: "absolute", reason: "Ambiguous potentially destructive command blocked by Hookline." };
  for (const segment of commandSegments(command)) {
    const gitCommand = /^(?:command\s+)?(?:sudo\s+)?git\b/u.test(segment);
    if (gitCommand && /\breset\b[\s\S]*--hard\b/u.test(segment))
      return { severity: "absolute", reason: "git reset --hard is blocked by repository policy." };
    if (
      gitCommand &&
      /\bclean\b/u.test(segment) &&
      !/(?:^|\s)(?:-n|--dry-run)(?:\s|$)/u.test(segment) &&
      /(?:^|\s)(?:--force|-[-a-z]*f[-a-z]*)(?:\s|$)/u.test(segment)
    )
      return { severity: "absolute", reason: "Forced git clean is blocked by repository policy." };
    if (
      gitCommand &&
      /\bpush\b/u.test(segment) &&
      /(?:--force(?:-with-lease)?|(?:^|\s)-[-a-z]*f[-a-z]*(?:\s|$))/u.test(segment)
    )
      return { severity: "absolute", reason: "Force push is blocked by repository policy." };
    if (gitCommand && /\bcheckout\s+--\s+(?:\.|:\/)(?:\s|$)/u.test(segment))
      return { severity: "guard", reason: "Broad git checkout restoration is blocked by repository policy." };
    if (gitCommand && /\brestore\b[\s\S]*(?:^|\s)(?:\.|:\/)(?:\s|$)/u.test(segment))
      return { severity: "guard", reason: "Broad git restore is blocked by repository policy." };
    if (
      /^(?:sudo\s+)?(?:rm|rmdir|remove-item|rd)\b/u.test(segment) &&
      /(?:--recursive|-[-a-z]*r[-a-z]*|-recurse|\/s)/u.test(segment) &&
      /(?:--force|-[-a-z]*f[-a-z]*|-force|\/q)/u.test(segment) &&
      /(?:^|\s)(?:\.|\.\/|\*|:\/)(?:\s|$)/u.test(segment)
    )
      return { severity: "absolute", reason: "Broad repository removal is blocked by repository policy." };
    if (
      /\b(?:rm|rmdir|del|remove-item)\b/u.test(segment) &&
      /(?:^|[\\/\s])(?:prisma|codex_chats)(?:[\\/\s]|$)/u.test(segment)
    )
      return { severity: "absolute", reason: "Destructive canonical-data operation is blocked by repository policy." };
    if (/\bdrop\s+database\b/u.test(segment))
      return { severity: "absolute", reason: "Database destruction is blocked by repository policy." };
  }
  return null;
}

function preToolDecision(event, mode) {
  const unsafe = dangerousCommand(commandFrom(event));
  if (!unsafe) return null;
  if (mode === "OBSERVE" && unsafe.severity !== "absolute") return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: unsafe.reason,
    },
  };
}

function permissionDecision(event) {
  const unsafe = dangerousCommand(commandFrom(event));
  if (!unsafe) return null;
  return {
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "deny", message: unsafe.reason },
    },
  };
}

function continuityContext(state, mode) {
  const pieces = [`Hookline ${mode} continuity active.`];
  if (state.objective.text) pieces.push(`Objective: ${state.objective.text}`);
  if (state.repository.branch)
    pieces.push(`Branch: ${state.repository.branch}; main: ${state.repository.baseCurrentMain || "unresolved"}.`);
  if (state.remainingLocallyAttainableWork.length)
    pieces.push(`Remaining local work: ${state.remainingLocallyAttainableWork.join("; ")}.`);
  if (state.focusedTest) pieces.push(`Focused ${state.focusedTest.operation}: ${state.focusedTest.status}.`);
  if (state.knownBlocker?.summary) pieces.push(`Blocker: ${state.knownBlocker.summary}.`);
  return pieces.join(" ").slice(0, 1300);
}

function subagentContext(state) {
  if (!state.objective.text) return null;
  const pieces = [
    "Hookline subagent contract.",
    `Objective: ${state.objective.text}`,
    state.remainingLocallyAttainableWork.length
      ? `Owned workstream: ${state.remainingLocallyAttainableWork.join("; ")}.`
      : "Owned workstream: the delegated task only.",
    state.ownedPaths.length
      ? `Owned paths: ${state.ownedPaths.join("; ")}.`
      : "Owned paths: only those named in the delegation.",
    state.nonOwnershipBoundaries.length
      ? `Do not change: ${state.nonOwnershipBoundaries.join("; ")}.`
      : "Do not change protected-main, unrelated source, or canonical data.",
    "Return completed work, focused evidence, and any owner-required blocker.",
  ];
  return pieces.join(" ").slice(0, 1000);
}

function stopDecision(state, options, event) {
  if (options.mode !== "CONTINUITY") return null;
  if (state.integrity !== "trusted") return null;
  if (event.stop_hook_active === true) return null;
  if (!state.objective.text || state.objective.status !== "active") return null;
  if (!state.remainingLocallyAttainableWork.length) return null;
  if (state.knownBlocker?.requiresOwner) return null;
  if (state.continuationCount >= options.maxAutomaticContinuations) return null;
  state.continuationCount += 1;
  return {
    decision: "block",
    reason: `Continue the existing authorized objective. Remaining locally attainable work: ${state.remainingLocallyAttainableWork.join("; ")}. Do not begin additional scope.`,
  };
}

function emit(value) {
  if (value !== undefined && value !== null) process.stdout.write(`${JSON.stringify(value)}\n`);
}

function parseInput() {
  const chunks = [];
  process.stdin.on("data", (chunk) => chunks.push(chunk));
  process.stdin.on("end", () => {
    const event = readJson(Buffer.concat(chunks).toString("utf8"));
    handle(event || {}).catch((error) => {
      const eventName = event?.hook_event_name;
      if (["PreToolUse", "PermissionRequest", "Stop"].includes(eventName)) emit({});
      else emit({ systemMessage: "Hookline advisory hook failed; continuing without Hookline state." });
      process.stderr.write(`HOOKLINE_ADVISORY_FAILURE ${error instanceof Error ? error.name : "unknown"}\n`);
    });
  });
}

async function handle(event) {
  const identity = resolveIdentity(event);
  if (!identity) {
    if (
      [
        "SessionStart",
        "PreCompact",
        "PostCompact",
        "SessionEnd",
        "SubagentStart",
        "SubagentStop",
        "PostToolUse",
      ].includes(event.hook_event_name)
    )
      emit({ systemMessage: "Hookline could not resolve this Git worktree; ordinary Codex behavior continues." });
    else emit({});
    return;
  }
  const options = settings(identity);
  const eventName = event.hook_event_name;

  if (eventName === "PreToolUse") {
    const decision = preToolDecision(event, options.mode);
    recordEvent(identity, event, "pre_tool_policy", {
      mode: options.mode,
      toolFamily: typeof event.tool_name === "string" ? event.tool_name : "unknown",
      decision: decision ? "deny" : "none",
    });
    emit(decision || {});
    return;
  }

  if (eventName === "PermissionRequest") {
    const decision = permissionDecision(event);
    recordEvent(identity, event, "permission_request", {
      mode: options.mode,
      toolFamily: typeof event.tool_name === "string" ? event.tool_name : "unknown",
      decision: decision ? "deny" : "none",
      autoApprovalEnabled: false,
    });
    emit(decision || {});
    return;
  }

  const loaded = loadState(identity, event);
  const state = refreshState(loaded.state, identity);

  if (eventName === "SessionStart") {
    recordEvent(identity, event, "session_start", { source: event.source || "unknown", mode: options.mode });
    writeState(identity, event, state);
    emit({
      ...(loaded.integrity === "corrupt"
        ? {
            systemMessage:
              "Hookline recovered a corrupt local capsule; automatic Stop continuation is disabled for this session.",
          }
        : {}),
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: continuityContext(state, options.mode),
      },
    });
    return;
  }

  if (eventName === "PreCompact" || eventName === "PostCompact") {
    recordEvent(identity, event, eventName === "PreCompact" ? "pre_compact" : "post_compact", {
      trigger: event.trigger || "unknown",
    });
    writeState(identity, event, state);
    emit({});
    return;
  }

  if (eventName === "SessionEnd") {
    state.sessionEndedAt = now();
    recordEvent(identity, event, "session_end", { reason: event.reason || "other", mode: options.mode });
    writeState(identity, event, state);
    emit({});
    return;
  }

  if (eventName === "PostToolUse") {
    const result = outcome(event);
    const operation = classifyOperation(event);
    updateFocusedTest(state, event, result);
    recordEvent(identity, event, "post_tool", {
      toolFamily: typeof event.tool_name === "string" ? event.tool_name : "unknown",
      operation,
      status: result.status,
      durationMs: result.durationMs,
      failureFingerprint: result.fingerprint,
    });
    writeState(identity, event, state);
    emit({});
    return;
  }

  if (eventName === "SubagentStart") {
    recordEvent(identity, event, "subagent_start", {
      agentKey: shortDigest(event.agent_id || "unknown-agent"),
      agentType: boundedText(event.agent_type, 80) || "unknown",
    });
    writeState(identity, event, state);
    const context = subagentContext(state);
    emit(context ? { hookSpecificOutput: { hookEventName: "SubagentStart", additionalContext: context } } : {});
    return;
  }

  if (eventName === "SubagentStop") {
    recordEvent(identity, event, "subagent_stop", {
      agentKey: shortDigest(event.agent_id || "unknown-agent"),
      agentType: boundedText(event.agent_type, 80) || "unknown",
      alreadyContinued: event.stop_hook_active === true,
      observationOnly: true,
    });
    writeState(identity, event, state);
    emit({});
    return;
  }

  if (eventName === "Stop") {
    const decision = loaded.integrity === "trusted" ? stopDecision(state, options, event) : null;
    recordEvent(identity, event, "stop", {
      mode: options.mode,
      decision: decision ? "continue" : "allow",
      continuationCount: state.continuationCount,
      capsuleIntegrity: loaded.integrity,
    });
    if (loaded.integrity !== "missing") writeState(identity, event, state);
    emit(decision || {});
    return;
  }

  emit({});
}

parseInput();
