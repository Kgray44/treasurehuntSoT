import { randomBytes } from "node:crypto";
import { mkdtempSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";

const profileByTest = new Map([
  ["tests/e2e/admiralty-phase1.spec.ts", "admiralty-phase1"],
  ["tests/e2e/chronicle-platform.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/admiralty-phase2.spec.ts", "admiralty-phase2"],
  ["tests/e2e/admiralty-phase3.spec.ts", "admiralty-phase3"],
  ["tests/e2e/harborlight-phase2.spec.ts", "harborlight-phase2"],
  ["tests/e2e/harborlight-phase3.spec.ts", "harborlight-phase3"],
  ["tests/e2e/harborlight-phase4.spec.ts", "harborlight-phase4"],
  ["tests/e2e/homeport-phase3.spec.ts", "homeport-phase3"],
  ["tests/e2e/lanternwake-journal.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/lanternwake-phase2.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-accessibility-viewports.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-lifecycle-extended.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-lifecycle.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-performance.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/sealed-hold-phase4.spec.ts", "sealed-hold-phase4"],
  ["tests/e2e/phase3-player-event-matrix.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-player-motion.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-replay-resilience.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-visual-checkpoints.spec.ts", "lanternwake-phase3"],
]);

export const browserSuiteProfiles = Object.freeze({
  generic: Object.freeze({
    id: "generic",
    bootstrap: true,
    seed: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    environment: Object.freeze({
      GM_USERNAME: "kato",
      GM_PASSWORD: "development-captain-only",
    }),
    preparers: Object.freeze([
      Object.freeze({ runtime: "tsx", script: "scripts/migrate-legacy-companion.ts" }),
      Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" }),
    ]),
    fixtureArguments: [],
  }),
  "sc07-community": Object.freeze({
    id: "sc07-community",
    bootstrap: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    preparers: Object.freeze([
      Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" }),
      Object.freeze({ runtime: "tsx", script: "scripts/sounding-line/prepare-sc07-experience.ts" }),
    ]),
    fixtureArguments: [],
  }),
  "harborlight-phase2": Object.freeze({
    id: "harborlight-phase2",
    bootstrap: true,
    seed: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    environment: Object.freeze({
      COMMUNITY_BINARY_SCANNER_PROVIDER: "synthetic-test",
      FOREVER_VALIDATION_NODE_ENV: "test",
    }),
    browserProject: "harborlight-phase2",
    preparers: [
      Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" }),
      Object.freeze({ runtime: "tsx", script: "scripts/sounding-line/prepare-harborlight-fixture.ts" }),
    ],
    fixtureArguments: [],
  }),
  "harborlight-phase3": Object.freeze({
    id: "harborlight-phase3",
    bootstrap: true,
    seed: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    environment: Object.freeze({
      COMMUNITY_BINARY_SCANNER_PROVIDER: "synthetic-test",
      FOREVER_VALIDATION_NODE_ENV: "test",
    }),
    browserProject: "harborlight-phase3",
    preparers: [
      Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" }),
      Object.freeze({ runtime: "tsx", script: "scripts/sounding-line/prepare-harborlight-fixture.ts" }),
    ],
    fixtureArguments: [],
  }),
  "harborlight-phase4": Object.freeze({
    id: "harborlight-phase4",
    bootstrap: true,
    seed: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    environment: Object.freeze({
      COMMUNITY_BINARY_SCANNER_PROVIDER: "synthetic-test",
      FOREVER_VALIDATION_NODE_ENV: "test",
    }),
    browserProject: "harborlight-phase4",
    preparers: [
      Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" }),
      Object.freeze({ runtime: "tsx", script: "scripts/sounding-line/prepare-harborlight-fixture.ts" }),
    ],
    fixtureArguments: [],
  }),
  "homeport-phase3": Object.freeze({
    id: "homeport-phase3",
    bootstrap: true,
    seed: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    browserProject: "chromium",
    browserArguments: Object.freeze(["--grep", "Journey N: history search opens a version-pinned detail and returns"]),
    homeportPhase3Runtime: true,
    preparers: [Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" })],
    fixtureArguments: [],
  }),
  "lanternwake-phase3": Object.freeze({
    id: "lanternwake-phase3",
    bootstrap: true,
    seed: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    environment: Object.freeze({
      GM_USERNAME: "kato",
      GM_PASSWORD: "development-captain-only",
      PLAYER_ACCESS_CODE: "development-moonwake",
      // The Phase 3 performance proof opens a second, mobile Chromium
      // context against this declared task-owned browser endpoint.
      FOREVER_PHASE3_PERFORMANCE_BASE_URL: "http://127.0.0.1:3200",
      SOUNDING_LINE_BROWSER_PORT: "3200",
    }),
    preparers: Object.freeze([
      Object.freeze({ runtime: "tsx", script: "scripts/migrate-legacy-companion.ts" }),
      Object.freeze({ runtime: "tsx", script: "scripts/migrate-legacy-companion.ts", arguments: ["--verify"] }),
      Object.freeze({ runtime: "tsx", script: "scripts/verify-platform-backfill.ts", arguments: ["--prepare"] }),
      Object.freeze({ runtime: "tsx", script: "prisma/seed.ts", arguments: ["--ensure"] }),
      Object.freeze({ runtime: "tsx", script: "scripts/verify-platform-backfill.ts", arguments: ["--verify"] }),
      Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" }),
    ]),
    fixtureArguments: ["tests/e2e/phase3-readonly-setup.setup.ts"],
    fixtureProject: "phase3-readonly-setup",
  }),
  "sealed-hold-phase4": Object.freeze({
    id: "sealed-hold-phase4",
    bootstrap: true,
    taskOwnedProductionHttp: true,
    validationIsolation: true,
    cookieAdapter: "isolated-loopback",
    preparers: [Object.freeze({ runtime: "node", script: "scripts/sounding-line/prepare-validation-isolation.mjs" })],
    fixtureArguments: [],
  }),
  "admiralty-phase1": Object.freeze({
    id: "admiralty-phase1",
    dedicatedRunner: "scripts/admiralty/run-phase1-journeys.mjs",
  }),
  "admiralty-phase2": Object.freeze({
    id: "admiralty-phase2",
    dedicatedRunner: "scripts/admiralty/run-phase2-journeys.mjs",
  }),
  "admiralty-phase3": Object.freeze({
    id: "admiralty-phase3",
    dedicatedRunner: "tests/admiralty/phase3/run-journeys.mjs",
  }),
});

export function suiteBrowserProfileId(browserTest) {
  return profileByTest.get(browserTest) ?? "generic";
}

export function resolveBrowserSuiteDispatches(browserTests) {
  const groups = new Map();
  for (const browserTest of browserTests) {
    const profileId = suiteBrowserProfileId(browserTest);
    const profile = browserSuiteProfiles[profileId];
    if (!profile) throw new Error(`SOUNDING_LINE_SUITE_FIXTURE_CONTRACT_UNSATISFIED:${browserTest}:${profileId}`);
    const group = groups.get(profileId) ?? { ...profile, browserTests: [] };
    group.browserTests.push(browserTest);
    groups.set(profileId, group);
  }
  return [...groups.values()].map((group) => ({ ...group, browserTests: group.browserTests.sort() }));
}

export function sealedHoldBrowserFixtureEnvironment(profileId, root, env = process.env) {
  if (profileId !== "sealed-hold-phase4") return {};
  const storageParent = env.SOUNDING_LINE_SEALED_HOLD_STORAGE_ROOT ?? env.RUNNER_TEMP ?? "";
  if (!isAbsolute(storageParent)) throw new Error("Sealed Hold browser proof requires an owned storage directory.");
  const physicalRoot = realpathSync(root);
  const physicalParent = realpathSync(storageParent);
  const fromRepository = relative(physicalRoot, physicalParent);
  if (
    !fromRepository ||
    (!isAbsolute(fromRepository) && fromRepository !== ".." && !fromRepository.startsWith(".." + sep))
  )
    throw new Error("Sealed Hold browser storage must be outside the repository.");
  return {
    NODE_ENV: "test",
    PRIVATE_CONTENT_STORAGE_PROVIDER: "local",
    PRIVATE_CONTENT_PROVIDER_ROOT: mkdtempSync(join(physicalParent, "sealed-hold-browser-")),
    PRIVATE_CONTENT_KEY_PROVIDER: "local",
    PRIVATE_CONTENT_LOCAL_MASTER_KEY: randomBytes(32).toString("hex"),
    PRIVATE_CONTENT_SCANNER_PROVIDER: "synthetic",
  };
}

export function isolatedBrowserFixtureCredentials(profileId) {
  if (profileId === "sc07-community")
    return { SC07_EXPERIENCE_PASSWORD: `synthetic-${randomBytes(24).toString("base64url")}` };
  return profileId === "generic"
    ? { PHASE2_LEGACY_ACCESS_CODE: `synthetic-${randomBytes(24).toString("base64url")}` }
    : {};
}
