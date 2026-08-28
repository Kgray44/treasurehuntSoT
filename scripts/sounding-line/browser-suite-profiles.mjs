const profileByTest = new Map([
  ["tests/e2e/admiralty-phase1.spec.ts", "admiralty-phase1"],
  ["tests/e2e/chronicle-platform.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/admiralty-phase2.spec.ts", "admiralty-phase2"],
  ["tests/e2e/admiralty-phase3.spec.ts", "admiralty-phase3"],
  ["tests/e2e/harborlight-phase2.spec.ts", "harborlight-phase2"],
  ["tests/e2e/harborlight-phase3.spec.ts", "harborlight-phase3"],
  ["tests/e2e/harborlight-phase4.spec.ts", "harborlight-phase4"],
  ["tests/e2e/phase3-accessibility-viewports.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-lifecycle-extended.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-lifecycle.spec.ts", "lanternwake-phase3"],
  ["tests/e2e/phase3-replay-resilience.spec.ts", "lanternwake-phase3"],
]);

export const browserSuiteProfiles = Object.freeze({
  generic: Object.freeze({
    id: "generic",
    bootstrap: true,
    seed: true,
    taskOwnedProductionHttp: true,
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
