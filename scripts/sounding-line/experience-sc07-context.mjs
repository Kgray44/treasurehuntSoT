import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

export const SC07_CONTRACT = "harborlight.sc07.creator-community.experience";
export const SC07_PROFILE = "sc07-community";

const bindings = {
  name: new Set(["pendingTitle", "approvedTitle"]),
  path: new Set(["pendingReviewPath", "approvedPublicPath"]),
  text: new Set(["pendingChecksum", "approvedChecksum", "publisherCredit"]),
  value: new Set([
    "publisherEmail",
    "moderatorEmail",
    "installerEmail",
    "password",
    "submissionSlug",
    "pendingTitle",
    "savedOption",
    "unsupportedOption",
    "licenseKey",
  ]),
};

export function resolveSc07ReplayContext(journey, setup, fixture, password) {
  const bind = (step) => {
    const result = { ...step };
    for (const [field, keys] of Object.entries(bindings)) {
      const token = field + "FromFixture";
      if (!Object.hasOwn(step, token)) continue;
      const key = step[token];
      if (
        Object.hasOwn(step, field) ||
        !keys.has(key) ||
        (field === "value" && !["fill", "select"].includes(step.action)) ||
        (key === "password" && step.action !== "fill")
      )
        throw new Error("SC07_EXPERIENCE_INVALID_FIXTURE_BINDING");
      const value = key === "password" ? password : fixture?.[key];
      if (typeof value !== "string" || !value.trim() || value.length > 2048)
        throw new Error("SC07_EXPERIENCE_FIXTURE_VALUE_MISSING");
      if (field === "path") {
        const expected =
          key === "pendingReviewPath" ? /^\/admin\/community\/[a-z0-9-]+$/u : /^\/community\/[a-z0-9-]+$/u;
        if (!expected.test(value)) throw new Error("SC07_EXPERIENCE_INVALID_FIXTURE_PATH");
      }
      delete result[token];
      result[field] = value;
    }
    return result;
  };
  return {
    journey: { ...journey, steps: journey.steps.map(bind) },
    setup: setup && { ...setup, steps: setup.steps.map(bind) },
  };
}

export async function readSc07ReplayFixture(root, candidate, environment = process.env) {
  const databaseUrl = environment.DATABASE_URL ?? "";
  const database = databaseUrl.startsWith("file:") ? databaseUrl.slice(5) : "";
  const ownedRoot = path.resolve(root, "artifacts/sounding-line", SC07_PROFILE + "-" + candidate.slice(0, 12));
  if (
    environment.SOUNDING_LINE_SUITE_PROFILE !== SC07_PROFILE ||
    environment.FOREVER_VALIDATION_ISOLATION !== "1" ||
    !path.isAbsolute(database) ||
    path.dirname(path.resolve(database)) !== ownedRoot ||
    !/^validation-isolated-\d{8}-\d{9}-[a-f0-9]{32}\.db$/u.test(path.basename(database))
  )
    throw new Error("SC07_EXPERIENCE_OWNED_FIXTURE_REQUIRED");
  const sidecar = database + ".sc07-experience.json";
  if ((await realpath(sidecar)) !== path.resolve(sidecar)) throw new Error("SC07_EXPERIENCE_FIXTURE_PATH_CHANGED");
  const evidence = JSON.parse(await readFile(sidecar, "utf8"));
  if (evidence.candidate !== candidate || !evidence.devices?.DESKTOP || !evidence.devices?.MOBILE)
    throw new Error("SC07_EXPERIENCE_FIXTURE_SOURCE_MISMATCH");
  return evidence.devices;
}
