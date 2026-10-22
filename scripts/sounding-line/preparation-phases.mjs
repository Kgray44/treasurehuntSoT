import {
  closeSync,
  linkSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PREPARATION_CHANNEL = "SOUNDING_LINE_PREPARATION_CHANNEL";
export const PREPARATION_PROFILE = "SOUNDING_LINE_PREPARATION_PROFILE";
export const PREPARATION_PHASES = Object.freeze({
  ADMISSION: 120000,
  PLANNING: 120000,
  STAGING: 120000,
  FIXTURE_PRISMA: 120000,
  FIXTURE_BOOTSTRAP: 120000,
  FIXTURE_SEED: 120000,
  FIXTURE_PREPARER: 120000,
  PRODUCTION_BUILD: 900000,
  BROWSER_STARTUP: 120000,
  BROWSER_FIXTURE: 900000,
  CAPTURE: 900000,
  CLEANUP: 120000,
  PROFILE_RESULT: 120000,
  VALIDATION: 120000,
  RETENTION: 120000,
  PUBLICATION: 120000,
  COMPLETE: 120000,
});
export const PREPARATION_PHASE_ORDER = Object.freeze(Object.keys(PREPARATION_PHASES));
export const PREPARATION_MAX_EVENTS = 256;
export const PREPARATION_EVENT_BYTES = 4096;
export const PREPARATION_JOB_MS = 40 * 60000;
export const PREPARATION_TAIL_MS = 120000;
export const PREPARATION_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PREPARATION_DIRECTORY = "artifacts/sounding-line/preparation-supervision";

const sha = /^[a-f0-9]{40}$/u;
const digest = /^[a-f0-9]{64}$/u;
const decimal = /^[1-9][0-9]{0,15}$/u;
const fail = () => {
  throw new Error("SOUNDING_LINE_PREPARATION_PHASE_INVALID");
};
export function validPreparationBinding(value) {
  return (
    value &&
    Object.keys(value).sort().join() ===
      ["version", "repository", "base", "candidate", "runId", "attempt", "nonce"].sort().join() &&
    value?.version === 1 &&
    /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value.repository ?? "") &&
    sha.test(value.base ?? "") &&
    sha.test(value.candidate ?? "") &&
    decimal.test(value.runId ?? "") &&
    decimal.test(value.attempt ?? "") &&
    /^[a-f0-9-]{36}$/u.test(value.nonce ?? "")
  );
}
export function preparationEventName(sequence) {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > PREPARATION_MAX_EVENTS) fail();
  return String(sequence).padStart(6, "0") + ".json";
}
export function preparationProductEnvironment(environment) {
  const result = { ...environment };
  delete result.GH_TOKEN;
  delete result.GITHUB_TOKEN;
  delete result[PREPARATION_CHANNEL];
  delete result[PREPARATION_PROFILE];
  return result;
}

// Only protected controllers call this. Product children lose this channel.
// Immutable transport records are not the public checkpoint artifact.
export function emitPreparationPhase(
  phase,
  { step = 0, sourceDigest, contractDigest, planDigest, environment = process.env } = {},
) {
  if (environment[PREPARATION_CHANNEL] === undefined) return;
  if (!Object.hasOwn(PREPARATION_PHASES, phase)) fail();
  const channel = path.resolve(environment[PREPARATION_CHANNEL]);
  const parent = path.join(realpathSync(PREPARATION_ROOT), PREPARATION_DIRECTORY);
  const relative = path.relative(parent, channel);
  if (!/^session-[A-Za-z0-9_-]+[\\/]transport$/u.test(relative) || realpathSync(channel) !== channel) fail();
  const profile = Number(environment[PREPARATION_PROFILE] ?? 0);
  if (!Number.isInteger(profile) || profile < 0 || profile > 64 || !Number.isInteger(step) || step < 0 || step > 16)
    fail();
  const lock = path.join(channel, "writer.lock");
  let descriptor;
  try {
    descriptor = openSync(lock, "wx");
    const state = JSON.parse(readFileSync(path.join(channel, "state.json"), "utf8"));
    if (!validPreparationBinding(state.binding)) fail();
    const digests = { ...state.digests };
    for (const [key, value] of Object.entries({ sourceDigest, contractDigest, planDigest })) {
      if (value === undefined) continue;
      if (!digest.test(value) || (digests[key] !== null && digests[key] !== value)) fail();
      digests[key] = value;
    }
    const sequence = state.sequence + 1;
    const event = { ...state.binding, sequence, phase, profile, step, ...digests };
    const bytes = JSON.stringify(event) + "\n";
    if (Buffer.byteLength(bytes) > PREPARATION_EVENT_BYTES) fail();
    const eventPending = path.join(channel, "event." + sequence + ".pending");
    writeFileSync(eventPending, bytes, { flag: "wx" });
    linkSync(eventPending, path.join(channel, preparationEventName(sequence)));
    unlinkSync(eventPending);
    const pending = path.join(channel, "state." + sequence + ".pending");
    writeFileSync(pending, JSON.stringify({ ...state, sequence, digests }) + "\n", { flag: "wx" });
    renameSync(pending, path.join(channel, "state.json"));
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
      unlinkSync(lock);
    }
  }
}
