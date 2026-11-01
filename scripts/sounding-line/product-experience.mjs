import { bindPR776ControllerReconciliation } from "./experience-pr776-controller-reconciliation.mjs";
import {
  isReviewedEvidenceAdoption,
  historicalReviewedPlan,
  validateReviewedIdentity,
  reviewedEvidenceAdoption,
} from "./experience-reviewed-adoption.mjs";
import { REVIEW_DIMENSIONS } from "./experience-review-dimensions.mjs";
import { inheritSourceFailure, sourceDiagnosticGit } from "./source-diagnostics.mjs";
import { readSourceSnapshotBatches } from "./source-snapshot-batches.mjs";
import { createHash } from "node:crypto";
import { resolveHomeportSourceAmendment, validateHomeportAmendedRegistration } from "./homeport-source-amendment.mjs";
import { execFileSync } from "node:child_process";
import { r8FormatEvidencePlan, validateR8FormatEvidenceIdentity } from "./experience-r8-format.mjs";
import { R20_DEFERRED_DISPOSITION, validateScopedR20Finding } from "./experience-scope-adjudication.mjs";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { bindExperienceException, validateExceptionEvidence } from "./experience-exception.mjs";
import { planPairedEvidence, validatePairedEvidence } from "./experience-paired.mjs";
import { isCurrentAdmissionPlan } from "./experience-current-admission.mjs";

// This module is loaded alongside the protected-main Sounding Line verifier.
// Candidate declarations can add obligations, never remove trusted obligations.
export { REVIEW_DIMENSIONS } from "./experience-review-dimensions.mjs";
export const FINDING_CLASSES = [
  "CRITICAL_PRODUCT_DEFECT",
  "MAJOR_EXPERIENCE_DEFECT",
  "VISUAL_NONCONFORMITY",
  "INTERACTION_DEFECT",
  "CROSS_PROJECT_INTEGRATION_DEFECT",
  "ACCESSIBILITY_DEFECT",
  "PERFORMANCE_OR_SMOOTHNESS_DEFECT",
  "MINOR_POLISH",
  "SUBJECTIVE_DESIGN_OPPORTUNITY",
  "EVIDENCE_INSUFFICIENT",
  "ACCEPTED_REFERENCE_QUALITY",
];
const nonblocking = new Set(["MINOR_POLISH", "SUBJECTIVE_DESIGN_OPPORTUNITY", "ACCEPTED_REFERENCE_QUALITY"]);
const sourceFile = /\.(?:[cm]?[jt]sx?|css|json)$/u;
const testFile = /(?:\.test|\.spec)\.[cm]?[jt]sx?$/u;
const uiFile = /(?:\.tsx$|\.(?:css|scss)$|^public\/)/u;
const sha = /^[a-f0-9]{40}$/u;
const digestPattern = /^[a-f0-9]{64}$/u;
const normalize = (file) => file.replaceAll("\\", "/");
export const experienceDigest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const fail = (code, detail = "", cause) => {
  throw inheritSourceFailure(cause, new Error(`PRODUCT_EXPERIENCE_${code}${detail ? `:${detail}` : ""}`));
};
const meaningful = (value) => typeof value === "string" && value.trim().length >= 12;
const list = (value) => Array.isArray(value) && value.length > 0;
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function validScreenshot(bytes, minimumHeight = 400) {
  try {
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
    let offset = 8;
    let header;
    let ended = false;
    const data = [];
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset);
      if (size > bytes.length - offset - 12) return false;
      const type = bytes.subarray(offset + 4, offset + 8).toString();
      if (crc32(bytes.subarray(offset + 4, offset + 8 + size)) !== bytes.readUInt32BE(offset + 8 + size)) return false;
      if (type === "IHDR") header = bytes.subarray(offset + 8, offset + 8 + size);
      if (type === "IDAT") data.push(bytes.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
      if (type === "IEND") {
        ended = true;
        break;
      }
    }
    if (
      !ended ||
      offset !== bytes.length ||
      !header ||
      header.length !== 13 ||
      header[8] !== 8 ||
      ![2, 6].includes(header[9]) ||
      header[12] !== 0
    )
      return false;
    const width = header.readUInt32BE(0);
    const height = header.readUInt32BE(4);
    if (width < 320 || height < minimumHeight || width > 10000 || height > 50000) return false;
    return (
      inflateSync(Buffer.concat(data), { maxOutputLength: 128 * 1024 * 1024 }).length ===
      (width * (header[9] === 6 ? 4 : 3) + 1) * height
    );
  } catch {
    return false;
  }
}

function git(root, args, options = {}) {
  return sourceDiagnosticGit("PRODUCT_EXPERIENCE", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
}
export function revisionJson(root, revision, file, optional = false) {
  const present = git(root, ["ls-tree", revision, "--", file]).trim();
  if (!present && optional) return null;
  try {
    return JSON.parse(git(root, ["show", `${revision}:${file}`]));
  } catch (cause) {
    fail("REGISTRY_INVALID", file, cause);
  }
}
export const sourceSnapshotReadsPath = (file) =>
  sourceFile.test(file) &&
  !testFile.test(file) &&
  (/^(?:src|app|components|lib|styles)\//u.test(file) || file.endsWith(".json"));
export function sourceSnapshot(root, revision) {
  const entries = git(root, ["ls-tree", "-rz", revision])
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const [metadata, file] = entry.split("\t");
      const [mode, type, blob] = metadata.split(" ");
      return { path: file, mode, type, blob };
    })
    .filter((entry) => entry.type === "blob");
  const sources = entries.filter((entry) => sourceSnapshotReadsPath(entry.path));
  const contents = readSourceSnapshotBatches(sources, (args, options) => git(root, args, options));
  return { entries, contents };
}
function resolveImport(importer, specifier, files) {
  const target = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier))
      : null;
  if (!target) return null;
  return (
    [
      target,
      ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json"].flatMap((extension) => [
        target + extension,
        `${target}/index${extension}`,
      ]),
    ].find((file) => files.has(file)) ?? null
  );
}
export function affectedConsumers(changedPaths, snapshots) {
  const reverse = new Map();
  const ui = new Set();
  const unresolved = new Set();
  for (const snapshot of snapshots) {
    const files = new Set(snapshot.contents.keys());
    const endpoints = [...files].filter((file) => /^src\/app\/api\/.*\/route\.[jt]s$/u.test(file));
    const assets = snapshot.entries?.filter((entry) => entry.path.startsWith("public/")) ?? [];
    for (const [file, contents] of snapshot.contents) {
      if (uiFile.test(file)) ui.add(file);
      for (const asset of assets) {
        if (contents.includes("/" + asset.path.slice(7))) {
          if (!reverse.has(asset.path)) reverse.set(asset.path, new Set());
          reverse.get(asset.path).add(file);
        }
      }
      const imports =
        /(?:import\s+(?:[^"'()]+?\s+from\s+)?|export\s+(?:[^"']+?\s+from\s+)?|require\s*\(|import\s*\()\s*["']([^"']+)["']/gu;
      for (const match of contents.matchAll(imports)) {
        const dependency = resolveImport(file, match[1], files);
        if (dependency) {
          if (!reverse.has(dependency)) reverse.set(dependency, new Set());
          reverse.get(dependency).add(file);
        } else if (match[1].startsWith("@/") || match[1].startsWith(".")) unresolved.add(file);
      }
      // Bridge HTTP projections to consumers rather than treating services as isolated backend files.
      const apiUrls = [...contents.matchAll(/["'`](\/api\/[^"'`\s]*)/gu)].map(
        (match) => match[1].replace(/\$\{[^}]+\}/gu, "parameter").split("?")[0],
      );
      for (const endpoint of endpoints) {
        const url = endpoint.replace(/^src\/app/u, "").replace(/\/route\.[jt]s$/u, "");
        const pattern = new RegExp(
          "^" +
            url
              .split("/")
              .map((segment) =>
                segment.startsWith("[")
                  ? segment.includes("...")
                    ? ".+"
                    : "[^/]+"
                  : segment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
              )
              .join("/") +
            "$",
          "u",
        );
        if (
          apiUrls.some((apiUrl) => {
            const clientPattern = new RegExp(
              "^" +
                apiUrl
                  .split("/")
                  .map((segment) =>
                    segment === "parameter" ? "[^/]+" : segment.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"),
                  )
                  .join("/") +
                "$",
              "u",
            );
            return pattern.test(apiUrl) || clientPattern.test(url.replace(/\[[^\]]+\]/gu, "parameter"));
          })
        ) {
          if (!reverse.has(endpoint)) reverse.set(endpoint, new Set());
          reverse.get(endpoint).add(file);
        }
      }
    }
  }
  const affected = new Set(changedPaths.map(normalize).filter((file) => !testFile.test(file)));
  const queue = [...affected];
  for (let index = 0; index < queue.length; index++) {
    for (const consumer of reverse.get(queue[index]) ?? []) {
      if (!affected.has(consumer)) {
        affected.add(consumer);
        queue.push(consumer);
      }
    }
  }
  const globalStyle = changedPaths.some((file) => /(?:globals?\.css|(?:^|\/)tokens\.[jt]s|^styles\/)/u.test(file));
  if (globalStyle) for (const file of ui) affected.add(file);
  return {
    paths: [...affected].sort(),
    surfaces: [...affected].filter((file) => ui.has(file)).sort(),
    uncertainty: [...affected].filter((file) => unresolved.has(file)).sort(),
    globalStyle,
  };
}
function matches(file, prefixes) {
  return prefixes.some((prefix) => file === prefix || file.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"));
}

// Placement already closes surfaces on narrow viewports; do not reopen them.
export function validateRoomsSurfaceNavigation(contract, journey) {
  if (
    contract.id !== "parallax.rooms-and-surfaces.experience" &&
    journey.id !== "creator-named-rooms-surface-snap-and-return"
  )
    return null;
  const conditional = journey.steps.flatMap((step, index) => (Object.hasOwn(step, "devices") ? [index] : []));
  if (!conditional.length) return null;
  const experience = contract.experience;
  const expected = {
    action: "click",
    role: "button",
    name: "Toggle spatial overlays",
    devices: ["DESKTOP"],
    kind: "navigation",
  };
  if (
    contract.id !== "parallax.rooms-and-surfaces.experience" ||
    journey.id !== "creator-named-rooms-surface-snap-and-return" ||
    JSON.stringify(experience.roles) !== '["CREATOR"]' ||
    JSON.stringify(journey.roles) !== '["CREATOR"]' ||
    experience.devices?.length !== 2 ||
    !["DESKTOP", "MOBILE"].every((device) => experience.devices.includes(device)) ||
    !experience.motion ||
    conditional.length !== 1 ||
    conditional[0] !== 6 ||
    Object.keys(journey.steps[6]).sort().join(",") !== Object.keys(expected).sort().join(",") ||
    Object.entries(expected).some(
      ([key, value]) => experienceDigest(journey.steps[6][key]) !== experienceDigest(value),
    ) ||
    journey.steps[5]?.action !== "assert" ||
    journey.steps[5]?.state !== "SURFACE_SNAPPED" ||
    journey.steps[7]?.action !== "click" ||
    journey.steps[7]?.role !== "combobox" ||
    journey.steps[7]?.name !== "Environment" ||
    journey.steps.some((step) => ["when", "contextValue", "contextName"].some((key) => Object.hasOwn(step, key)))
  )
    fail("ROOMS_SURFACE_NAVIGATION_INVALID");
  return { index: 6 };
}

// Reload is a single saved-Scene proof step, not a general navigation action.
export function validateRoomReloadJourney(contract, journey) {
  const reloads = journey.steps.flatMap((step, index) => (step.action === "reload" ? [index] : []));
  const containsNativeSummary = (value) =>
    value &&
    typeof value === "object" &&
    (Object.hasOwn(value, "nativeSummary") || Object.values(value).some(containsNativeSummary));
  const mobileDisclosures = journey.steps.flatMap((step, index) => (containsNativeSummary(step) ? [index] : []));
  if (!reloads.length && !mobileDisclosures.length) return null;
  const experience = contract.experience;
  if (
    contract.id !== "parallax.parametric-room-correction.experience" ||
    journey.id !== "creator-adds-generic-room-feature-and-saves" ||
    experience.roles?.length !== 1 ||
    experience.roles[0] !== "CREATOR" ||
    journey.roles?.length !== 1 ||
    journey.roles[0] !== "CREATOR" ||
    experience.devices?.length !== 2 ||
    !["DESKTOP", "MOBILE"].every((device) => experience.devices.includes(device)) ||
    !experience.motion
  )
    fail("JOURNEY_RELOAD_SCOPE_INVALID");
  if (reloads.length !== 1 || Object.keys(journey.steps[reloads[0]]).length !== 1) fail("JOURNEY_RELOAD_STEP_INVALID");
  const deviceSteps = journey.steps.flatMap((step, index) => (Object.hasOwn(step, "devices") ? [index] : []));
  if (deviceSteps.length || mobileDisclosures.length) {
    const edits = journey.steps.flatMap((step, index) =>
      step.action === "click" && step.role === "button" && step.name === "Edit room features" ? [index] : [],
    );
    if (
      mobileDisclosures.length !== 2 ||
      deviceSteps.length !== 2 ||
      edits.length !== 2 ||
      !(edits[0] < reloads[0] && reloads[0] < edits[1]) ||
      !deviceSteps.every((index, offset) => index === edits[offset] - 1) ||
      deviceSteps.some((index) => {
        const step = journey.steps[index];
        return (
          Object.keys(step).sort().join(",") !== "action,devices,kind,nativeSummary" ||
          step.action !== "click" ||
          step.kind !== "navigation" ||
          step.nativeSummary !== "View & audio" ||
          !Array.isArray(step.devices) ||
          step.devices.length !== 1 ||
          step.devices[0] !== "MOBILE"
        );
      })
    )
      fail("JOURNEY_RELOAD_STEP_INVALID");
  }
  const containsTemplate = (value) =>
    typeof value === "string"
      ? /\{\{|\}\}/u.test(value)
      : value && typeof value === "object"
        ? Object.values(value).some(containsTemplate)
        : false;
  if (
    journey.steps.some(
      (step, index) =>
        Object.keys(step).some(
          (key) =>
            key === "when" || (key === "devices" && !mobileDisclosures.includes(index)) || key.startsWith("context"),
        ) || containsTemplate(step),
    )
  )
    fail("JOURNEY_RELOAD_STEP_INVALID");
  return { index: reloads[0], ...(mobileDisclosures.length ? { mobileDisclosureIndices: mobileDisclosures } : {}) };
}

// Native disclosure evidence belongs only to the two finite ROOM navigation declarations.
export function validateRoomNativeDisclosures(contract, journey, run, device) {
  const scope = validateRoomReloadJourney(contract, journey);
  if (!scope?.mobileDisclosureIndices) return;
  const expected = device === "MOBILE" ? scope.mobileDisclosureIndices : [];
  const observed = run.nativeDisclosures ?? [];
  const identity = (value, open) =>
    value &&
    Object.keys(value).sort().join(",") === "firstChild,open,parentTagName,tagName,text" &&
    value.tagName === "SUMMARY" &&
    value.parentTagName === "DETAILS" &&
    value.firstChild === true &&
    value.text === "View & audio" &&
    value.open === open;
  if (
    !Array.isArray(observed) ||
    observed.length !== expected.length ||
    observed.some(
      (row, index) =>
        !row ||
        Object.keys(row).sort().join(",") !== "after,before,keyboard,nativeSummary,step" ||
        row.step !== expected[index] ||
        row.nativeSummary !== "View & audio" ||
        row.keyboard !== "Enter" ||
        !identity(row.before, false) ||
        !identity(row.after, true),
    )
  )
    fail("NATIVE_DISCLOSURE_EVIDENCE_INVALID");
}

// Confirmation is the existing Scene Manager Save outcome, not a general status selector.
export function validateSceneSavedConfirmation(contract, journey) {
  const containsConfirmation = (value) =>
    value &&
    typeof value === "object" &&
    (Object.hasOwn(value, "confirmation") || Object.values(value).some(containsConfirmation));
  const reserved = journey.steps.flatMap((step, index) => (containsConfirmation(step) ? [index] : []));
  if (!reserved.length) return null;
  const experience = contract.experience;
  if (
    contract.id !== "parallax.scene-manager.experience" ||
    journey.id !== "creator-shared-environment-independent-scenes" ||
    experience.roles?.length !== 1 ||
    experience.roles[0] !== "CREATOR" ||
    journey.roles?.length !== 1 ||
    journey.roles[0] !== "CREATOR" ||
    experience.devices?.length !== 2 ||
    !["DESKTOP", "MOBILE"].every((device) => experience.devices.includes(device)) ||
    !experience.motion
  )
    fail("SCENE_SAVE_CONFIRMATION_SCOPE_INVALID");
  const expected = {
    action: "assert",
    role: "region",
    name: "Active Scene information",
    text: "The Letter Study",
    path: "/studio/parallax",
    state: "RENAMED",
    kind: "outcome",
    meaning: "The renamed Scene saves independently.",
    feedbackBoundary: true,
    confirmation: "Scene saved.",
  };
  const step = journey.steps[reserved[0]];
  if (
    reserved.length !== 1 ||
    Object.keys(step).length !== Object.keys(expected).length ||
    Object.entries(expected).some(([key, value]) => !Object.hasOwn(step, key) || step[key] !== value)
  )
    fail("SCENE_SAVE_CONFIRMATION_STEP_INVALID");
  return { index: reserved[0] };
}

export function validateExperienceContract(contract) {
  const experience = contract.experience;
  if (!experience || typeof experience !== "object") fail("CONTRACT_MISSING", contract.id);
  for (const key of [
    "persona",
    "objective",
    "visibleOutcome",
    "integrationOwner",
    "accessibility",
    "fallback",
    "navigation",
    "designTarget",
  ])
    if (!meaningful(experience[key])) fail("CONTRACT_FIELD_INVALID", `${contract.id}.${key}`);
  if (typeof experience.entryPoint !== "string" || !experience.entryPoint.startsWith("/"))
    fail("ENTRY_POINT_INVALID", contract.id);
  for (const key of [
    "systems",
    "sourcePaths",
    "states",
    "devices",
    "roles",
    "references",
    "journeys",
    "browserTests",
    "limitations",
  ])
    if (!Array.isArray(experience[key]) || (key !== "limitations" && !experience[key].length))
      fail("CONTRACT_FIELD_INVALID", `${contract.id}.${key}`);
  for (const journey of experience.journeys) {
    if (!journey.id || !meaningful(journey.outcome) || !list(journey.steps)) fail("JOURNEY_INVALID", contract.id);
    validateRoomReloadJourney(contract, journey);
    validateRoomsSurfaceNavigation(contract, journey);
    validateSceneSavedConfirmation(contract, journey);
    if (!journey.steps.some((step) => step.action === "click")) fail("NATURAL_JOURNEY_REQUIRED", journey.id);
    if (!journey.steps.some((step) => step.action === "assert" && step.kind === "outcome"))
      fail("SEMANTIC_OUTCOME_REQUIRED", journey.id);
    for (const step of journey.steps) {
      if (step.action === "reload") continue;
      if (!new Set(["click", "fill", "assert", "keyboard"]).has(step.action))
        fail("JOURNEY_ACTION_INVALID", journey.id);
      if (
        step.action !== "keyboard" &&
        !Object.hasOwn(step, "nativeSummary") &&
        (!step.role || typeof step.name !== "string")
      )
        fail("VISIBLE_CONTROL_REQUIRED", journey.id);
      if (
        step.action === "assert" &&
        step.kind === "outcome" &&
        (!meaningful(step.meaning) || !meaningful(step.text) || !step.path)
      )
        fail("SEMANTIC_OUTCOME_REQUIRED", journey.id);
      if (step.returnPath && (step.action !== "assert" || !step.path))
        fail("RETURN_PATH_PREDICATE_REQUIRED", journey.id);
    }
    if (!journey.steps.some((step) => step.returnPath)) fail("RETURN_PATH_REQUIRED", journey.id);
    if (!list(journey.roles) || journey.roles.some((role) => !experience.roles.includes(role)))
      fail("JOURNEY_ROLE_COVERAGE_INVALID", journey.id);
    if (experience.motion && !journey.steps.some((step) => step.action === "assert" && step.feedbackBoundary))
      fail("MOTION_BOUNDARY_REQUIRED", journey.id);
  }
  if (experience.roles.some((role) => !experience.journeys.some((journey) => journey.roles.includes(role))))
    fail("ROLE_JOURNEY_MISSING", contract.id);
  for (const role of experience.roles.filter((role) => role !== "ANONYMOUS")) {
    const witness = experience.roleSetup?.[role]?.witness;
    if (!witness?.role || typeof witness.name !== "string" || !meaningful(witness.text))
      fail("ROLE_WITNESS_REQUIRED", `${contract.id}.${role}`);
  }
  if (
    experience.systems.length > 1 &&
    (!meaningful(experience.continuity?.objective) || !list(experience.continuity?.checks))
  )
    fail("CROSS_PROJECT_CONTINUITY_REQUIRED", contract.id);
  if (
    experience.motion &&
    (!meaningful(experience.motion.measurement) ||
      !Number.isFinite(experience.motion.feedbackBudgetMs) ||
      experience.motion.feedbackBudgetMs <= 0)
  )
    fail("MOTION_BOUNDARY_REQUIRED", contract.id);
  return contract;
}
export function classifyExperience({ changedPaths, consumers, contracts }) {
  const normalized = changedPaths.map(normalize);
  const affected = contracts.filter(
    (contract) =>
      contract.experience &&
      (matchesAny(consumers.surfaces, contract.experience.sourcePaths) ||
        matchesAny(normalized, contract.experience.projectionPaths ?? [])),
  );
  const visible = consumers.surfaces.length > 0 || affected.length > 0;
  let classification = "BACKEND_ONLY";
  if (normalized.every((file) => /\.(?:md|pdf|csv|txt)$/u.test(file) || file.startsWith("Development_Docs/")))
    classification = "DOCUMENTATION_ONLY";
  else if (
    normalized.every(
      (file) =>
        /^(?:scripts|tests|testing|\.agents|\.github)\//u.test(file) || file === "AGENTS.md" || file === "package.json",
    )
  )
    classification = "INTERNAL_TOOLING";
  if (visible)
    classification = affected.some((contract) => contract.experience.spatial)
      ? "MAJOR_SPATIAL_EXPERIENCE"
      : affected.some((contract) => contract.experience.systems.length > 1)
        ? "CROSS_PROJECT_EXPERIENCE"
        : /navigation|ProductShell|layout\.tsx/u.test(consumers.surfaces.join(" "))
          ? "NAVIGATION_INFORMATION_ARCHITECTURE"
          : normalized.some((file) => /motion|animation/u.test(file))
            ? "INTERACTION_MOTION"
            : normalized.every((file) => !uiFile.test(file))
              ? "USER_FACING_DATA_PROJECTION"
              : normalized.some((file) => /page\.tsx$/u.test(file))
                ? "PAGE_SURFACE_DESIGN"
                : "LOCAL_UI_CHANGE";
  return {
    classification,
    applicable: visible,
    contractIds: affected.map((contract) => contract.id).sort(),
    affectedSurfaces: consumers.surfaces,
    transitivePaths: consumers.paths,
    uncertainty: consumers.uncertainty,
  };
}
function matchesAny(files, prefixes) {
  return files.some((file) => matches(file, prefixes));
}
function registryBindings(root, baseSha, policy, contract) {
  if (!policy.screenRegistry) return;
  const experience = contract.experience;
  const screens = revisionJson(root, baseSha, policy.screenRegistry).screens;
  const journeys = revisionJson(root, baseSha, policy.journeyRegistry).journeys;
  for (const id of experience.homeportScreenIds ?? [])
    if (!screens.some((entry) => entry.screenId === id)) fail("HOMEPORT_SCREEN_UNKNOWN", id);
  for (const id of experience.homeportJourneyIds ?? [])
    if (!journeys.some((entry) => entry.journeyId === id)) fail("HOMEPORT_JOURNEY_UNKNOWN", id);
  const references = revisionJson(root, baseSha, policy.referenceRegistry).curatedExperienceReferences ?? [];
  for (const reference of experience.references) {
    if (!references.some((entry) => entry.path === reference.path && entry.sourceSha === reference.sourceSha))
      fail("ACCEPTED_REFERENCE_UNKNOWN", reference.path);
    const bytes = artifactBytes({ root, revision: baseSha, file: reference.path });
    if (!validScreenshot(bytes)) fail("ACCEPTED_REFERENCE_INVALID", reference.path);
  }
}

export function productSourceDigest(snapshot) {
  const files = new Set(snapshot.contents.keys());
  const closure = new Set([...files].filter((file) => /^(?:src|app|components|lib)\//u.test(file)));
  const queue = [...closure];
  for (let index = 0; index < queue.length; index++) {
    for (const match of (snapshot.contents.get(queue[index]) ?? "").matchAll(
      /(?:import\s+(?:[^"'()]+?\s+from\s+)?|export\s+(?:[^"']+?\s+from\s+)?|require\s*\(|import\s*\()\s*["']([^"']+)["']/gu,
    )) {
      const dependency = resolveImport(queue[index], match[1], files);
      if (dependency && !closure.has(dependency)) {
        closure.add(dependency);
        queue.push(dependency);
      }
    }
  }
  return experienceDigest(
    snapshot.entries
      .filter(
        (entry) =>
          /^(?:src|app|components|lib|styles|public|prisma|scripts|tests)\//u.test(entry.path) ||
          /^testing\/(?:contracts|suites|impact-map)\.json$/u.test(entry.path) ||
          closure.has(entry.path) ||
          /^(?:package(?:-lock)?\.json|next\.config\.|playwright\.config\.)/u.test(entry.path),
      )
      .map(({ path: file, blob, mode }) => ({ path: file, blob, mode }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
}
// One reviewed Homeport transition. This is not a general contract override.
export function bindSC00AHomeportMigration({
  root,
  baseSha,
  candidateSha,
  prNumber,
  trustedRegistry,
  candidateRegistry,
}) {
  const originalRecord = trustedRegistry.experiencePolicy?.journeyMigration;
  let record = originalRecord;
  if (!record) return null;
  if (experienceDigest(record) !== "a816a0a7d804594f5f2d29960be6be3497c73b6edd48317d6552309ec4cbf236")
    fail("HOMEPORT_MIGRATION_RECORD_INVALID");
  const trusted = trustedRegistry.contracts.find((contract) => contract.id === record.contractId);
  const proposed = candidateRegistry.contracts.find((contract) => contract.id === record.contractId);
  const oldJourney = trusted?.experience?.journeys.find((journey) => journey.id === record.journeyId);
  const newJourney = proposed?.experience?.journeys.find((journey) => journey.id === record.journeyId);
  if (!oldJourney || !newJourney || experienceDigest(oldJourney) === experienceDigest(newJourney)) return null;
  const amendment = trustedRegistry.experiencePolicy?.journeyMigrationSourceAmendment;
  record = resolveHomeportSourceAmendment(originalRecord, amendment);
  if (Date.now() >= Date.parse(record.expiresAt)) fail("HOMEPORT_MIGRATION_EXPIRED");
  if (
    experienceDigest(trusted) !== record.oldContractDigest ||
    experienceDigest(oldJourney) !== record.oldJourneyDigest ||
    experienceDigest(proposed) !== record.newContractDigest ||
    experienceDigest(newJourney) !== record.newJourneyDigest
  )
    fail("HOMEPORT_MIGRATION_CONTRACT_MISMATCH");
  let event;
  if (process.env.GITHUB_ACTIONS === "true") {
    event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    const dispatched = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
    const pull = event.pull_request;
    prNumber ??= dispatched ? event.inputs?.pr_number : pull?.number;
    if (
      process.env.GITHUB_REPOSITORY !== record.repository ||
      process.env.GITHUB_REF !== "refs/heads/main" ||
      process.env.GITHUB_SHA !== baseSha ||
      process.env.GITHUB_WORKFLOW_REF !==
        `${record.repository}/.github/workflows/sounding-line-ordinary.yml@refs/heads/main` ||
      (dispatched
        ? String(event.inputs?.pr_number) !== String(record.prNumber) ||
          event.inputs?.base_sha !== baseSha ||
          event.inputs?.candidate_sha !== candidateSha
        : process.env.GITHUB_EVENT_NAME !== "pull_request_target" ||
          pull?.number !== record.prNumber ||
          pull?.base?.repo?.full_name !== record.repository ||
          pull?.base?.sha !== baseSha ||
          pull?.head?.sha !== candidateSha)
    )
      fail("HOMEPORT_MIGRATION_EVENT_MISMATCH");
  }
  if (String(prNumber) !== String(record.prNumber)) fail("HOMEPORT_MIGRATION_PR_MISMATCH");
  const live = JSON.parse(
    execFileSync("gh", ["api", `repos/${record.repository}/pulls/${record.prNumber}`], {
      encoding: "utf8",
      timeout: 15000,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }),
  );
  if (
    live.number !== record.prNumber ||
    live.state !== "open" ||
    live.merged !== false ||
    live.base?.ref !== "main" ||
    live.base?.repo?.full_name !== record.repository ||
    live.head?.repo?.full_name !== record.repository ||
    live.base?.sha !== baseSha ||
    live.head?.sha !== candidateSha
  )
    fail("HOMEPORT_MIGRATION_LIVE_SOURCE_MISMATCH");
  git(root, ["merge-base", "--is-ancestor", record.acceptedSource, baseSha]);
  git(root, ["merge-base", "--is-ancestor", baseSha, candidateSha]);
  git(root, ["merge-base", "--is-ancestor", record.reviewedAncestor, candidateSha]);
  if (amendment) {
    git(root, ["merge-base", "--is-ancestor", originalRecord.acceptedSource, record.acceptedSource]);
    git(root, ["merge-base", "--is-ancestor", originalRecord.reviewedAncestor, record.reviewedAncestor]);
    git(root, ["merge-base", "--is-ancestor", record.acceptedSource, record.reviewedAncestor]);
  }
  if (git(root, ["rev-parse", `${record.reviewedAncestor}^{tree}`]).trim() !== record.reviewedTree)
    fail("HOMEPORT_MIGRATION_REVIEWED_SOURCE_MISMATCH");
  const inventory = (revision) =>
    new Map(
      git(root, ["ls-tree", "-rz", revision])
        .split("\0")
        .filter(Boolean)
        .map((line) => {
          const [metadata, file] = line.split("\t");
          return [file, metadata];
        }),
    );
  const baseline = inventory(baseSha),
    candidate = inventory(candidateSha),
    reviewed = inventory(record.reviewedAncestor);
  const expected = new Map(record.approvedChanges.map(({ path: file, mode, blob }) => [file, `${mode} blob ${blob}`]));
  const changes = git(root, ["diff", "--name-only", "--no-renames", record.acceptedSource, record.reviewedAncestor])
    .trim()
    .split(/\r?\n/u)
    .sort();
  if (
    experienceDigest(changes) !== experienceDigest([...expected.keys()].sort()) ||
    [...expected].some(([file, metadata]) => reviewed.get(file) !== metadata)
  )
    fail("HOMEPORT_MIGRATION_REVIEWED_SOURCE_MISMATCH");
  const retainedProofs = new Map();
  for (const proof of [...originalRecord.immutableProofs, ...(amendment ? [record.immutableProofs[1]] : [])]) {
    const bytes = artifactBytes({ root, revision: baseSha, file: proof.path });
    if (
      baseline.get(proof.path)?.startsWith("100644 blob ") !== true ||
      candidate.get(proof.path) !== baseline.get(proof.path) ||
      bytes.length !== proof.bytes ||
      createHash("sha256").update(bytes).digest("hex") !== proof.sha256 ||
      !bytes.equals(artifactBytes({ root, revision: candidateSha, file: proof.path }))
    )
      fail("HOMEPORT_MIGRATION_HISTORY_MISMATCH");
    retainedProofs.set(proof.path, bytes);
  }
  const proofs = record.immutableProofs.map((proof) => retainedProofs.get(proof.path));
  const original = JSON.parse(proofs[0]),
    approved = JSON.parse(proofs[1]);
  if (amendment)
    validateHomeportAmendedRegistration(
      JSON.parse(retainedProofs.get(originalRecord.immutableProofs[1].path)),
      approved,
      amendment,
    );
  const approvedBlob = createHash("sha1").update(`blob ${proofs[1].length}\0`).update(proofs[1]).digest("hex");
  if (expected.get("testing/contracts.json") !== `100644 blob ${approvedBlob}`)
    fail("HOMEPORT_MIGRATION_REVIEWED_SOURCE_MISMATCH");
  const approvedHomeport = approved.contracts.find((contract) => contract.id === record.contractId);
  const patched = JSON.parse(JSON.stringify(original));
  for (const field of record.permittedExperienceFields) patched.experience[field] = approvedHomeport.experience[field];
  if (experienceDigest(original) !== record.oldContractDigest || experienceDigest(patched) !== record.newContractDigest)
    fail("HOMEPORT_MIGRATION_UNAPPROVED_FIELD");
  if (!artifactBytes({ root, revision: baseSha, file: record.reviewPath }).equals(proofs[2]))
    fail("HOMEPORT_MIGRATION_HISTORY_MISMATCH");
  const approvedContracts = new Map(trustedRegistry.contracts.map((contract) => [contract.id, contract]));
  approvedContracts.set(record.contractId, approvedHomeport);
  for (const id of record.approvedAdditiveContractIds) {
    const addition = approved.contracts.find((contract) => contract.id === id);
    if (
      !addition ||
      (approvedContracts.has(id) && experienceDigest(approvedContracts.get(id)) !== experienceDigest(addition))
    )
      fail("HOMEPORT_MIGRATION_REGISTRATION_MISMATCH");
    approvedContracts.set(id, addition);
  }
  const approvedRegistration = { ...trustedRegistry, contracts: [...approvedContracts.values()] };
  const registryIdentity = (value) =>
    experienceDigest({ ...value, contracts: [...value.contracts].sort((a, b) => a.id.localeCompare(b.id)) });
  if (
    new Set(candidateRegistry.contracts.map((contract) => contract.id)).size !== candidateRegistry.contracts.length ||
    registryIdentity(candidateRegistry) !== registryIdentity(approvedRegistration) ||
    candidate.get("testing/contracts.json")?.startsWith("100644 blob ") !== true
  )
    fail("HOMEPORT_MIGRATION_REGISTRATION_MISMATCH");
  for (const pin of record.browserFixtureAndVisualPins) {
    const bytes = artifactBytes({ root, revision: candidateSha, file: pin.path });
    if (
      candidate.get(pin.path)?.startsWith("100644 blob ") !== true ||
      createHash("sha256").update(bytes).digest("hex") !== pin.sha256
    )
      fail("HOMEPORT_MIGRATION_BROWSER_FIXTURE_MISMATCH", pin.path);
  }
  for (const [file, metadata] of expected) {
    if (file !== "testing/contracts.json" && candidate.get(file) !== metadata)
      fail("HOMEPORT_MIGRATION_APPROVED_SOURCE_CHANGED", file);
  }
  for (const file of new Set([...baseline.keys(), ...candidate.keys()])) {
    if (baseline.get(file) === candidate.get(file) || expected.has(file)) continue;
    if (file === record.reviewPath && candidate.get(file)?.startsWith("100644 blob ")) continue;
    const tail = file.startsWith(record.publicationRoot) ? file.slice(record.publicationRoot.length) : "";
    if (
      tail &&
      tail.length <= 1024 &&
      /^[A-Za-z0-9_./-]+$/u.test(tail) &&
      !tail.split("/").some((part) => !part || part === "." || part === "..") &&
      !baseline.has(file) &&
      candidate.get(file)?.startsWith("100644 blob ")
    )
      continue;
    fail("HOMEPORT_MIGRATION_UNAPPROVED_TAIL", file);
  }
  return approvedHomeport;
}

export function mergeExperienceContracts(trustedContracts, candidateContracts) {
  const known = new Map(trustedContracts.map((contract) => [contract.id, contract]));
  const merged = trustedContracts.map((contract) => {
    const candidate = candidateContracts.find((entry) => entry.id === contract.id && entry.experience);
    if (!candidate) return contract;
    const baseline = contract.experience;
    const proposed = candidate.experience;
    if (JSON.stringify(proposed.baselineDebt ?? []) !== JSON.stringify(baseline.baselineDebt ?? []))
      fail("CANDIDATE_BASELINE_DEBT_FORBIDDEN", contract.id);
    const experience = { ...baseline };
    for (const key of [
      "systems",
      "sourcePaths",
      "projectionPaths",
      "states",
      "devices",
      "roles",
      "browserTests",
      "limitations",
      "homeportScreenIds",
      "homeportJourneyIds",
    ])
      experience[key] = [...new Set([...(baseline[key] ?? []), ...(proposed[key] ?? [])])];
    experience.roleSetup = { ...(baseline.roleSetup ?? {}) };
    for (const [role, setup] of Object.entries(proposed.roleSetup ?? {})) {
      if (baseline.roleSetup?.[role] && experienceDigest(setup) !== experienceDigest(baseline.roleSetup[role]))
        fail("TRUSTED_OBLIGATION_CHANGED", `${contract.id}.roleSetup.${role}`);
      experience.roleSetup[role] = setup;
    }
    for (const key of ["motion", "continuity", "pairedEvidence"]) {
      if (!baseline[key] && proposed[key]) experience[key] = proposed[key];
      else if (baseline[key] && proposed[key] && experienceDigest(baseline[key]) !== experienceDigest(proposed[key]))
        fail("TRUSTED_OBLIGATION_CHANGED", `${contract.id}.${key}`);
    }
    for (const key of ["journeys", "references"]) {
      const idKey = key === "journeys" ? "id" : "path";
      experience[key] = [...baseline[key]];
      for (const addition of proposed[key] ?? []) {
        const existing = baseline[key].find((entry) => entry[idKey] === addition[idKey]);
        if (existing && experienceDigest(existing) !== experienceDigest(addition))
          fail("TRUSTED_OBLIGATION_CHANGED", `${contract.id}.${addition[idKey]}`);
        if (!existing) experience[key].push(addition);
      }
    }
    return { ...contract, experience };
  });
  for (const addition of candidateContracts.filter((contract) => contract.experience && !known.has(contract.id))) {
    if (addition.experience.baselineDebt?.length) fail("CANDIDATE_BASELINE_DEBT_FORBIDDEN", addition.id);
    merged.push(addition);
  }
  return merged;
}
export function baselineScopeDigest(snapshot, sourcePaths) {
  // A defect exemption is tied to its implementation and all imported inputs.
  const files = new Set(snapshot.contents.keys());
  const scope = new Set(
    snapshot.entries.filter((entry) => matches(entry.path, sourcePaths)).map((entry) => entry.path),
  );
  const queue = [...scope];
  for (let index = 0; index < queue.length; index++) {
    const contents = snapshot.contents.get(queue[index]) ?? "";
    for (const asset of snapshot.entries.filter((entry) => entry.path.startsWith("public/")))
      if (contents.includes("/" + asset.path.slice(7)) && !scope.has(asset.path)) {
        scope.add(asset.path);
        queue.push(asset.path);
      }
    for (const match of contents.matchAll(/(?:from\s*|import\s*(?:\(|)|require\s*\()\s*["']([^"']+)["']/gu)) {
      const dependency = resolveImport(queue[index], match[1], files);
      if (dependency && !scope.has(dependency)) {
        scope.add(dependency);
        queue.push(dependency);
      }
    }
  }
  // Shared presentation/runtime inputs affect every debt surface.
  return experienceDigest(
    snapshot.entries
      .filter(
        (entry) =>
          scope.has(entry.path) ||
          /globals?\.css$|tokens\.[jt]s$|^package(?:-lock)?\.json$|^next\.config\./u.test(entry.path),
      )
      .map(({ path: file, blob, mode }) => ({ path: file, blob, mode }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  );
}
function protectedReviewContinuation({ root, baseSha, candidateSha, prNumber, policy, contracts }) {
  const record = policy.reviewContinuation;
  if (!record || String(prNumber) !== String(record.prNumber)) return null;
  const contract = contracts.find((value) => value.id === record.contractId);
  if (!contract) return null;
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(record.repository ?? "") ||
    !Number.isSafeInteger(record.prNumber) ||
    record.prNumber < 1 ||
    !/^[a-z0-9-]+$/u.test(record.id ?? "") ||
    !sha.test(record.ancestorCandidate ?? "") ||
    !record.blockedReview?.path?.startsWith("Development_Docs/Engineering/") ||
    !digestPattern.test(record.blockedReview.sha256 ?? "")
  )
    fail("REVIEW_CONTINUATION_INVALID");
  // This is installed-base authority, never a candidate declaration or a new round.
  const bytes = artifactBytes({ root, revision: baseSha, file: record.blockedReview.path });
  if (
    createHash("sha256").update(bytes).digest("hex") !== record.blockedReview.sha256 ||
    !bytes.equals(artifactBytes({ root, revision: candidateSha, file: record.blockedReview.path }))
  )
    fail("REVIEW_CONTINUATION_HISTORY_MISMATCH");
  const previous = JSON.parse(bytes.toString());
  if (
    previous.status !== "BLOCKED" ||
    previous.iterations !== 3 ||
    previous.repairAction !== "BLOCK_WITH_EVIDENCE" ||
    previous.contractId !== contract.id ||
    previous.candidateSha !== record.ancestorCandidate ||
    !sha.test(previous.baseSha ?? "") ||
    !digestPattern.test(previous.sourceDigest ?? "") ||
    !digestPattern.test(previous.contractDigest ?? "") ||
    !list(previous.findings) ||
    previous.findings.some(
      (finding) =>
        !finding.id ||
        finding.contractId !== contract.id ||
        nonblocking.has(finding.classification) ||
        !FINDING_CLASSES.includes(finding.classification) ||
        finding.disposition !== "UNRESOLVED",
    ) ||
    new Set(previous.findings.map((finding) => finding.id)).size !== previous.findings.length
  )
    fail("REVIEW_CONTINUATION_HISTORY_INVALID");
  git(root, ["merge-base", "--is-ancestor", record.ancestorCandidate, candidateSha]);
  if (process.env.GITHUB_ACTIONS === "true") {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
    const pull = event.pull_request;
    const dispatched = process.env.GITHUB_EVENT_NAME === "workflow_dispatch";
    if (
      process.env.GITHUB_REPOSITORY !== record.repository ||
      process.env.GITHUB_SHA !== baseSha ||
      process.env.GITHUB_REF !== "refs/heads/main" ||
      (dispatched
        ? String(event.inputs?.pr_number) !== String(record.prNumber) ||
          event.inputs?.candidate_sha !== candidateSha ||
          event.inputs?.base_sha !== baseSha
        : process.env.GITHUB_EVENT_NAME !== "pull_request_target" ||
          pull?.number !== record.prNumber ||
          pull?.base?.repo?.full_name !== record.repository ||
          pull?.base?.sha !== baseSha ||
          pull?.head?.sha !== candidateSha)
    )
      fail("REVIEW_CONTINUATION_CONTEXT_MISMATCH");
  }
  return {
    id: record.id,
    policyDigest: experienceDigest(record),
    prNumber: record.prNumber,
    contractId: contract.id,
    previousReviewSha256: record.blockedReview.sha256,
    iterations: 4,
    previousFindings: previous.findings.map(({ id, classification }) => ({ id, classification })),
  };
}

// One installed PR776 successor. This grants no new capture or owner acceptance.
export function pr776ContinuationReviewBindings(record, bytes, contractIds) {
  if (experienceDigest(record) !== "6872d2bfbd1133216fed8dc7ed25a4f18efbff79ee8709e7b35b8a26754dcf19")
    fail("PR776_REVIEW_CONTINUATION_INVALID");
  if (createHash("sha256").update(bytes).digest("hex") !== record.blockedReview.sha256)
    fail("PR776_REVIEW_CONTINUATION_HISTORY_MISMATCH");
  const previous = JSON.parse(bytes.toString());
  const rows = [...(previous.reviews ?? [])].sort((a, b) =>
    a.contractId < b.contractId ? -1 : a.contractId > b.contractId ? 1 : 0,
  );
  if (
    previous.status !== "BLOCKED" ||
    previous.candidate !== record.ancestorCandidate ||
    previous.base !== "5d7d603e9e8120d8d3f4d6c21d462523a90c7cb5" ||
    previous.sourceDigest !== "1fad1275ae9a44edb2f3dca481c6b2ca44b2e4dbfc53e24f53b074249d73e1bf" ||
    previous.contractDigest !== "6915ee386ab7bad948fb0b74c8d678caf00e1bcd9ad61247e45b07ee8fc62c51" ||
    previous.captureRun !== 40147115864 ||
    rows.length !== 32 ||
    new Set(rows.map((row) => row.contractId)).size !== 32 ||
    experienceDigest([...contractIds].sort()) !==
      experienceDigest(record.reviewOrdinals.map((row) => row.contractId)) ||
    rows.some((row, index) => {
      const expected = record.reviewOrdinals[index];
      return (
        row.contractId !== expected.contractId ||
        row.iterations !== expected.previousIterations ||
        row.status !== expected.previousStatus ||
        expected.requiredIterations !== row.iterations + 1 ||
        ![2, 4].includes(expected.requiredIterations)
      );
    })
  )
    fail("PR776_REVIEW_CONTINUATION_HISTORY_INVALID");
  return {
    id: record.id,
    policyDigest: experienceDigest(record),
    prNumber: record.prNumber,
    previousReviewSha256: record.blockedReview.sha256,
    reviews: rows.map((row, index) => ({
      id: record.id,
      policyDigest: experienceDigest(record),
      prNumber: record.prNumber,
      contractId: row.contractId,
      previousReviewSha256: record.blockedReview.sha256,
      previousIterations: row.iterations,
      previousStatus: row.status,
      iterations: record.reviewOrdinals[index].requiredIterations,
      previousFindings: row.findings.map(({ id, classification }) => ({ id, classification })),
    })),
  };
}
export function validatePR776HostedReviewContext(record, baseSha, candidateSha, env, event) {
  const pull = event.pull_request;
  const dispatched = env.GITHUB_EVENT_NAME === "workflow_dispatch";
  if (
    env.GITHUB_REPOSITORY !== record.repository ||
    env.GITHUB_SHA !== baseSha ||
    env.GITHUB_REF !== "refs/heads/main" ||
    (dispatched
      ? String(event.inputs?.pr_number) !== "776" ||
        event.inputs?.candidate_sha !== candidateSha ||
        event.inputs?.base_sha !== baseSha
      : env.GITHUB_EVENT_NAME !== "pull_request_target" ||
        pull?.number !== 776 ||
        pull?.base?.repo?.full_name !== record.repository ||
        pull?.head?.repo?.full_name !== record.repository ||
        pull?.base?.sha !== baseSha ||
        pull?.head?.sha !== candidateSha)
  )
    fail("PR776_REVIEW_CONTINUATION_CONTEXT_MISMATCH");
}
function protectedPR776ReviewContinuation({ root, baseSha, candidateSha, prNumber, policy, contracts }) {
  const record = policy.pr776ReviewContinuation;
  if (!record || String(prNumber) !== "776") return null;
  const bytes = artifactBytes({ root, revision: baseSha, file: record.blockedReview?.path });
  const continuation = pr776ContinuationReviewBindings(
    record,
    bytes,
    contracts.map((contract) => contract.id),
  );
  if (!bytes.equals(artifactBytes({ root, revision: candidateSha, file: record.blockedReview.path })))
    fail("PR776_REVIEW_CONTINUATION_HISTORY_MISMATCH");
  git(root, ["merge-base", "--is-ancestor", record.ancestorCandidate, candidateSha]);
  if (process.env.GITHUB_ACTIONS === "true")
    validatePR776HostedReviewContext(
      record,
      baseSha,
      candidateSha,
      process.env,
      JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
    );
  return continuation;
}

function unboundProductExperiencePlan({
  root,
  baseSha,
  candidateSha,
  changedPaths,
  prNumber = process.env.SOUNDING_LINE_PR_NUMBER,
}) {
  const trustedRegistry = revisionJson(root, baseSha, "testing/contracts.json");
  const policy = trustedRegistry.experiencePolicy;
  if (!policy) return { applicable: false, classification: "TRUSTED_POLICY_NOT_YET_ACTIVATED", contractIds: [] };
  if (policy.version !== 1 || !policy.evidencePath?.startsWith("Development_Docs/")) fail("TRUSTED_POLICY_INVALID");
  const candidateRegistry = revisionJson(root, candidateSha, "testing/contracts.json");
  const trustedContracts = (trustedRegistry.contracts ?? []).filter((contract) => contract.experience);
  const migratedHomeport = bindSC00AHomeportMigration({
    root,
    baseSha,
    candidateSha,
    prNumber,
    trustedRegistry,
    candidateRegistry,
  });
  const effectiveTrusted = migratedHomeport
    ? trustedContracts.map((contract) => (contract.id === migratedHomeport.id ? migratedHomeport : contract))
    : trustedContracts;
  const contracts = mergeExperienceContracts(effectiveTrusted, candidateRegistry.contracts ?? []).map(
    validateExperienceContract,
  );
  // Pure records/control-plane work must not scan the product graph or trigger captures.
  if (!changedPaths.some((file) => (sourceFile.test(file) || file.startsWith("public/")) && !testFile.test(file)))
    return {
      applicable: false,
      classification: classifyExperience({
        changedPaths,
        consumers: { paths: [], surfaces: [], uncertainty: [] },
        contracts: [],
      }).classification,
      contractIds: [],
    };
  const snapshots = [sourceSnapshot(root, baseSha), sourceSnapshot(root, candidateSha)];
  const consumers = affectedConsumers(changedPaths, snapshots);
  const intents = (trustedRegistry.contracts ?? []).filter(
    (contract) => contract.experienceIntent && matchesAny(consumers.surfaces, contract.experienceIntent.sourcePaths),
  );
  for (const intent of intents) {
    const complete = contracts.find((contract) => contract.id === intent.id);
    if (!complete) fail("EXPERIENCE_DESIGN_REQUIRED", `${intent.id}:${intent.experienceIntent.integrationOwner}`);
    if (
      intent.experienceIntent.systems.some((system) => !complete.experience.systems.includes(system)) ||
      !complete.experience.continuity
    )
      fail("INTEGRATION_SCOPE_REQUIRED", intent.id);
  }
  const result = classifyExperience({ changedPaths, consumers, contracts });
  // A change with unresolved dependencies cannot safely assert backend-only applicability.
  if (!result.applicable && consumers.uncertainty.length)
    fail("APPLICABILITY_INDETERMINATE", consumers.uncertainty.join(","));
  if (result.applicable && !result.contractIds.length) fail("UNREGISTERED_SURFACE", result.affectedSurfaces.join(","));
  if (!result.applicable) return result;
  const selected = contracts.filter((contract) => result.contractIds.includes(contract.id));
  const paired = planPairedEvidence(selected);
  const reviewContinuation = protectedReviewContinuation({
    root,
    baseSha,
    candidateSha,
    prNumber,
    policy,
    contracts: selected,
  });
  const pr776ReviewContinuation = protectedPR776ReviewContinuation({
    root,
    baseSha,
    candidateSha,
    prNumber,
    policy,
    contracts: selected,
  });
  for (const contract of selected) registryBindings(root, baseSha, policy, contract);
  const uncovered = consumers.surfaces.filter(
    (file) => !selected.some((contract) => matches(file, contract.experience.sourcePaths)),
  );
  if (uncovered.length) fail("UNREGISTERED_SURFACE", uncovered.join(","));
  return {
    ...result,
    contracts: selected,
    ...(reviewContinuation ? { reviewContinuation } : {}),
    ...(pr776ReviewContinuation ? { pr776ReviewContinuation } : {}),
    ...(paired
      ? {
          paired,
          candidateTree: git(root, ["rev-parse", `${candidateSha}^{tree}`]).trim(),
          genericContextCount: selected.reduce(
            (n, c) =>
              n +
              c.experience.devices.length *
                c.experience.journeys.reduce((m, j) => m + j.roles.length * (c.experience.motion ? 2 : 1), 0),
            0,
          ),
          contextCount:
            selected.reduce(
              (n, c) =>
                n +
                c.experience.devices.length *
                  c.experience.journeys.reduce((m, j) => m + j.roles.length * (c.experience.motion ? 2 : 1), 0),
              0,
            ) + paired.browserContexts,
        }
      : {}),
    evidencePath: policy.evidencePath,
    baseSha,
    candidateSha,
    sourceDigest: productSourceDigest(snapshots[1]),
    contractDigest: experienceDigest(selected),
    browserTests: [...new Set(selected.flatMap((contract) => contract.experience.browserTests))].sort(),
    attestationPolicy: policy.attestationPolicy,
    debt: selected.flatMap((contract) =>
      (contract.experience.baselineDebt ?? []).map((debt) => ({
        ...debt,
        contractId: contract.id,
        scopeUnchanged:
          list(debt.sourcePaths) &&
          baselineScopeDigest(snapshots[0], [...debt.sourcePaths, ...(contract.experience.projectionPaths ?? [])]) ===
            baselineScopeDigest(snapshots[1], [...debt.sourcePaths, ...(contract.experience.projectionPaths ?? [])]),
      })),
    ),
  };
}

export function planProductExperience(options) {
  const plan = unboundProductExperiencePlan(options);
  const exception = bindExperienceException({ ...options, plan });
  if (exception && (plan.reviewContinuation || plan.pr776ReviewContinuation))
    fail("REVIEW_CONTINUATION_EXCEPTION_CONFLICT");
  return bindPR776ControllerReconciliation({
    root: options.root,
    plan: exception ? { ...plan, exception } : plan,
    prNumber: options.prNumber ?? process.env.SOUNDING_LINE_PR_NUMBER,
  });
}

export function repairDisposition({ findings, iterations, previousBlockingCount, maxIterations = 3 }) {
  const blocking = findings.filter(
    (finding) =>
      !nonblocking.has(finding.classification) &&
      finding.disposition !== "RESOLVED" &&
      finding.disposition !== "UNCHANGED_BASELINE_DEBT",
  );
  if (!blocking.length) return { action: "VERIFY_FINAL_EVIDENCE", blockingIds: [] };
  return {
    action:
      iterations >= maxIterations || (iterations > 0 && previousBlockingCount <= blocking.length)
        ? "BLOCK_WITH_EVIDENCE"
        : "REPAIR_AND_RECAPTURE",
    blockingIds: blocking.map((finding) => finding.id),
    preserveRequirements: true,
  };
}
export function artifactBytes({ root, revision, file }) {
  if (typeof file !== "string" || path.posix.isAbsolute(file) || file.includes("\\") || file.split("/").includes(".."))
    fail("ARTIFACT_PATH_INVALID");
  if (revision) {
    const entry = git(root, ["ls-tree", revision, "--", file]).trim();
    if (!/^100(?:644|755) blob /u.test(entry)) fail("ARTIFACT_NOT_TRACKED_REGULAR_FILE", file);
    return git(root, ["show", `${revision}:${file}`], { encoding: null });
  }
  const rootPath = realpathSync(root);
  const resolved = realpathSync(path.join(rootPath, file));
  if (!resolved.startsWith(rootPath + path.sep)) fail("ARTIFACT_PATH_INVALID");
  return readFileSync(resolved);
}
export function validateExperienceArtifacts({ plan, evidence, root, revision, readArtifact = artifactBytes }) {
  if (!Array.isArray(evidence?.artifacts) || !evidence.artifacts.length) fail("VISUAL_EVIDENCE_INCOMPLETE");
  const artifacts = new Map();
  for (const artifact of evidence.artifacts) {
    if (artifacts.has(artifact.id) || !digestPattern.test(artifact.sha256 ?? "")) fail("ARTIFACT_IDENTITY_INVALID");
    const bytes = readArtifact({ root, revision, file: artifact.path });
    if (createHash("sha256").update(bytes).digest("hex") !== artifact.sha256)
      fail("ARTIFACT_DIGEST_MISMATCH", artifact.id);
    const pairedLandscape =
      plan?.paired?.contractIds?.includes(artifact.contractId) &&
      artifact.device === "MOBILE" &&
      ["PAIRED_crossdeck-pair-normal", "PAIRED_crossdeck-pair-reduced"].includes(artifact.state) &&
      path.posix.basename(artifact.path) === "15-phone-landscape.png" &&
      artifact.viewport?.width === 844 &&
      artifact.viewport?.height === 390;
    if (artifact.type === "screenshot" && !validScreenshot(bytes, pairedLandscape ? 390 : 400))
      fail("SCREENSHOT_INVALID", artifact.id);
    if (
      artifact.type === "recording" &&
      (bytes.length < 128 ||
        !bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])) ||
        !bytes.includes(Buffer.from("webm")))
    )
      fail("RECORDING_INVALID", artifact.id);
    if (!new Set(["screenshot", "recording", "trace"]).has(artifact.type) || artifact.origin !== "ACTUAL_APPLICATION")
      fail("ARTIFACT_ORIGIN_INVALID", artifact.id);
    artifacts.set(artifact.id, artifact);
  }
  return artifacts;
}
export function validateExperienceEvidence({
  plan,
  evidence,
  root,
  baselineRoot = root,
  revision,
  readArtifact = artifactBytes,
  automatedOnly = false,
}) {
  const currentPlan = plan;
  if (!automatedOnly) {
    if (isReviewedEvidenceAdoption(plan)) {
      validateReviewedIdentity(plan, evidence, { root: baselineRoot });
      plan = historicalReviewedPlan(plan);
    }
    validateR8FormatEvidenceIdentity(plan, evidence ?? {});
    plan = r8FormatEvidencePlan(plan);
  }
  if (!plan.applicable) return { status: "NOT_APPLICABLE", classification: plan.classification };
  if (!evidence || evidence.version !== 1) fail("EVIDENCE_MISSING");
  validateExceptionEvidence(plan, evidence, automatedOnly);
  if (
    evidence.baseSha !== plan.baseSha ||
    !sha.test(evidence.baseSha ?? "") ||
    evidence.sourceDigest !== plan.sourceDigest ||
    evidence.contractDigest !== plan.contractDigest
  )
    fail("EVIDENCE_SOURCE_MISMATCH");
  if (!list(evidence.artifacts) || (!automatedOnly && !list(evidence.reviews)) || !list(evidence.journeys))
    fail("VISUAL_EVIDENCE_INCOMPLETE");
  const artifacts = validateExperienceArtifacts({ plan, evidence, root, revision, readArtifact });
  validatePairedEvidence({
    root: baselineRoot,
    plan,
    evidence,
    read: (file) => readArtifact({ root, revision, file }),
  });
  for (const contract of plan.contracts) {
    const experience = contract.experience;
    const captures = evidence.artifacts.filter((artifact) => artifact.contractId === contract.id);
    for (const device of experience.devices)
      for (const state of experience.states)
        if (
          !captures.some(
            (artifact) => artifact.type === "screenshot" && artifact.device === device && artifact.state === state,
          )
        )
          fail("STATE_CAPTURE_MISSING", `${contract.id}.${device}.${state}`);
    if (
      (experience.motion || experience.systems.length > 1 || experience.recordingRequired) &&
      !captures.some((artifact) => artifact.type === "recording")
    )
      fail("RECORDING_REQUIRED", contract.id);
    for (const journey of experience.journeys) {
      const observed = evidence.journeys.filter((entry) => entry.contractId === contract.id && entry.id === journey.id);
      for (const device of experience.devices) {
        for (const role of journey.roles)
          for (const motionMode of experience.motion ? ["NORMAL", "REDUCED"] : ["REDUCED"]) {
            const run = observed.find(
              (entry) => entry.device === device && entry.role === role && entry.motionMode === motionMode,
            );
            if (run) validateRoomNativeDisclosures(contract, journey, run, device);
            if (
              !run ||
              run.status !== "PASS" ||
              run.entryPoint !== experience.entryPoint ||
              run.outcome !== journey.outcome ||
              run.visibleActions < 1 ||
              !run.returnPathVerified ||
              !run.accessibility?.keyboard ||
              !run.accessibility?.focus ||
              !run.accessibility?.motionPreferenceVerified ||
              (role !== "ANONYMOUS" && !run.roleVerified)
            )
              fail("SEMANTIC_JOURNEY_FAILED", `${contract.id}.${journey.id}.${device}`);
            if (run.accessibility?.overflow || run.accessibility?.axeSerious?.length) {
              const observed = {
                device,
                role,
                motionMode,
                overflow: Boolean(run.accessibility.overflow),
                axeSerious: [...(run.accessibility.axeSerious ?? [])].sort(),
              };
              const baseline = plan.debt?.find(
                (debt) =>
                  debt.contractId === contract.id &&
                  debt.scopeUnchanged &&
                  debt.status === "RENDERED_CONFIRMED" &&
                  debt.accessibilityObservations?.some(
                    (value) => experienceDigest(value) === experienceDigest(observed),
                  ),
              );
              if (
                !baseline ||
                evidence.completionClaims?.includes(contract.id) ||
                !evidence.reviews.some(
                  (review) =>
                    review.contractId === contract.id &&
                    review.findings?.some(
                      (finding) => finding.debtId === baseline.id && finding.disposition === "UNCHANGED_BASELINE_DEBT",
                    ),
                )
              )
                fail("ACCESSIBILITY_OR_RESPONSIVE_DEFECT", contract.id);
            }
            if (
              experience.continuity &&
              (!list(run.continuity) ||
                experience.continuity.checks.some(
                  (check) =>
                    !run.continuity.some(
                      (observation) =>
                        observation.id === check.id &&
                        digestPattern.test(observation.before ?? "") &&
                        list(observation.atOutcomes) &&
                        observation.atOutcomes.every((value) => value === observation.before) &&
                        observation.before === observation.after,
                    ),
                ))
            )
              fail("CROSS_PROJECT_JOURNEY_FAILED", contract.id);
            if (
              experience.motion &&
              (!Number.isFinite(run.feedbackMs) ||
                run.feedbackMs > experience.motion.feedbackBudgetMs ||
                run.measurement !== experience.motion.measurement)
            )
              fail("RESPONSIVENESS_FAILED", contract.id);
          }
      }
    }
    const review = evidence.reviews.find((entry) => entry.contractId === contract.id);
    if (experience.systems.length > 1)
      for (const journey of experience.journeys) {
        const runs = evidence.journeys.filter((entry) => entry.contractId === contract.id && entry.id === journey.id);
        for (const check of experience.continuity.checks)
          if (new Set(runs.map((run) => run.continuity?.find((entry) => entry.id === check.id)?.before)).size !== 1)
            fail("CROSS_DEVICE_CONTINUITY_FAILED", contract.id);
      }
    if (
      !automatedOnly &&
      (!review ||
        !review.builderContext ||
        !review.reviewerContext ||
        review.builderContext === review.reviewerContext ||
        review.independence !== "SEPARATE_CONTEXT" ||
        review.sourceInspectionOrder !== "EXPERIENCE_BEFORE_SOURCE")
    )
      fail("INDEPENDENT_REVIEW_REQUIRED", contract.id);
    if (automatedOnly) continue;
    if (
      review.packetDigest !==
      experienceDigest({
        sourceDigest: plan.sourceDigest,
        contract,
        artifacts: captures.map(({ id, sha256 }) => ({ id, sha256 })),
        ...(contract.experience.pairedEvidence ? { pairedEvidence: evidence.pairedEvidence } : {}),
      })
    )
      fail("REVIEW_PACKET_MISMATCH", contract.id);
    for (const dimension of REVIEW_DIMENSIONS) {
      const judgment = review.dimensions?.[dimension];
      if (
        !judgment ||
        !meaningful(judgment.observation) ||
        !list(judgment.evidenceIds) ||
        judgment.evidenceIds.some((id) => !captures.some((artifact) => artifact.id === id))
      )
        fail("SUBSTANTIVE_REVIEW_MISSING", `${contract.id}.${dimension}`);
    }
    if (!Array.isArray(review.findings)) fail("FINDINGS_MISSING", contract.id);
    for (const finding of review.findings) {
      if (
        !finding.id ||
        !FINDING_CLASSES.includes(finding.classification) ||
        !meaningful(finding.observation) ||
        finding.contractId !== contract.id ||
        !list(finding.evidenceIds) ||
        finding.evidenceIds.some((id) => !artifacts.has(id))
      )
        fail("FINDING_INVALID", contract.id);
      if (finding.disposition === R20_DEFERRED_DISPOSITION) {
        validateScopedR20Finding({
          plan: isReviewedEvidenceAdoption(currentPlan) ? historicalReviewedPlan(currentPlan) : currentPlan,
          finding,
          contractId: contract.id,
          artifacts: evidence.artifacts,
        });
        continue;
      }
      if (nonblocking.has(finding.classification)) continue;
      if (finding.disposition === "RESOLVED") {
        if (
          !list(finding.repairEvidenceIds) ||
          finding.repairEvidenceIds.some((id) => !captures.some((artifact) => artifact.id === id)) ||
          !meaningful(finding.resolution)
        )
          fail("REPAIR_EVIDENCE_MISSING", finding.id);
      } else if (finding.disposition === "UNCHANGED_BASELINE_DEBT") {
        const debt = (experience.baselineDebt ?? []).find((entry) => entry.id === finding.debtId);
        const trustedDebt = plan.debt?.find((entry) => entry.id === finding.debtId && entry.contractId === contract.id);
        if (
          !debt ||
          !trustedDebt?.scopeUnchanged ||
          debt.status !== "RENDERED_CONFIRMED" ||
          !list(debt.baselineArtifacts) ||
          !debt.repairOwner ||
          !debt.repairPath ||
          evidence.completionClaims?.includes(contract.id) ||
          finding.baselineFingerprint !== debt.fingerprint
        )
          fail("BASELINE_DEBT_NOT_EXEMPT", finding.id);
        for (const baseline of debt.baselineArtifacts) {
          const bytes = readArtifact({ root: baselineRoot, revision: plan.baseSha, file: baseline.path });
          if (createHash("sha256").update(bytes).digest("hex") !== baseline.sha256 || !validScreenshot(bytes))
            fail("BASELINE_EVIDENCE_INVALID", finding.id);
        }
      } else fail("BLOCKING_FINDING", finding.id);
    }
    const legacyContinuation = plan.reviewContinuation?.contractId === contract.id ? plan.reviewContinuation : null;
    const pr776Continuation = plan.pr776ReviewContinuation?.reviews.find((entry) => entry.contractId === contract.id);
    const continuation = legacyContinuation ?? pr776Continuation ?? null;
    const requiredReviewIterations = legacyContinuation ? 4 : pr776Continuation?.iterations;
    if (continuation) {
      const binding = {
        id: continuation.id,
        policyDigest: continuation.policyDigest,
        prNumber: continuation.prNumber,
        previousReviewSha256: continuation.previousReviewSha256,
        iterations: requiredReviewIterations,
        baseSha: plan.baseSha,
        sourceDigest: plan.sourceDigest,
      };
      if (
        experienceDigest(review.continuation ?? null) !== experienceDigest(binding) ||
        new Set(review.findings.map((finding) => finding.id)).size !== review.findings.length ||
        continuation.previousFindings.some(
          (previous) =>
            !review.findings.some(
              (finding) =>
                finding.id === previous.id &&
                finding.classification === previous.classification &&
                finding.disposition === "RESOLVED",
            ),
        )
      )
        fail("REVIEW_CONTINUATION_BINDING_MISMATCH", contract.id);
    } else if (review.continuation) fail("REVIEW_CONTINUATION_NOT_AUTHORIZED", contract.id);
    if (
      !Number.isInteger(review.iterations) ||
      (plan.exception
        ? review.iterations !==
          (isCurrentAdmissionPlan(plan) ? plan.exception.currentSourceAdmission.requiredReviewIterations : 11)
        : continuation
          ? review.iterations !== requiredReviewIterations
          : review.iterations < 1 || review.iterations > 3) ||
      review.status !== "ACCEPTED"
    )
      fail("REVIEW_UNRESOLVED", contract.id);
  }
  if (evidence.ownerAcceptance && evidence.ownerAcceptance !== "NOT_CLAIMED") fail("OWNER_ACCEPTANCE_UNAUTHORIZED");
  return {
    status: "PASS",
    contractIds: plan.contractIds,
    sourceDigest: currentPlan.sourceDigest,
    ...(!automatedOnly ? reviewedEvidenceAdoption(currentPlan) : {}),
    ...(currentPlan.exception?.nonExecutingReconciliation
      ? {
          reviewedBaseSha: plan.baseSha,
          reviewedSourceDigest: plan.sourceDigest,
          nonExecutingReconciliation: currentPlan.exception.nonExecutingReconciliation,
        }
      : {}),
    independence: automatedOnly ? "AUTOMATED_REPLAY_ONLY" : "SEPARATE_CONTEXT_RECORDED",
    ownerAcceptance: "NOT_CLAIMED",
  };
}
export function verifyProductExperience(root, candidateSha, plan) {
  const evidence = plan.applicable ? revisionJson(root, candidateSha, plan.evidencePath, true) : null;
  return validateExperienceEvidence({ plan, evidence, root, revision: candidateSha });
}
