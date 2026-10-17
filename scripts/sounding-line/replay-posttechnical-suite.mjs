// A separate finite technical diagnostic. Never a consumer lease or acceptance.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  constants as fsConstants,
  closeSync,
  fstatSync,
  openSync,
  readSync,
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browserReceiptPaths } from "./browser-diagnostics.mjs";
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const POSTTECHNICAL_WORKLOAD = freeze({
  version: 1,
  originalDecisionSha256: "64606358a5501e2c2914bee8c31271446adafa7a9bc195b95cc435b2f97f6c85",
  candidate: "7681d297f281ab03f30b4224b8288b7c942024c6",
  candidateTree: "471d8540d803344d1c7d7794fb641d47c3d01817",
  base: "24fb189a90435ccb6021b63fd6953603ae090bc0",
  nodeExecutable: "/opt/hostedtoolcache/node/24.19.0/x64/bin/node",
  toolchain: {
    node: "24.19.0",
    platform: "linux",
    architecture: "x64",
    git: "2.55.0",
    fingerprint: "f5e6aa391b70b6782861f0f258016e7379f945da686b9f73fa6f41eae105c847",
  },
  groups: [
    [
      "preflight.b6afec1badc6d034b0aaa5a0",
      "b6afec1badc6d034b0aaa5a098c0e3214fc0c665d0a6541d574a892d18a6bd55",
      "preflight",
      1,
    ],
    [
      "preflight.06bb2802ffe5ab9677efa486",
      "06bb2802ffe5ab9677efa486eb75cdf846f61d99eff8d95660bd087c41194f22",
      "preflight",
      1,
    ],
    [
      "preflight.bda79721781de0679d88e863",
      "bda79721781de0679d88e863e3367778e579eb45e2a187fc30d794e4df888b69",
      "preflight",
      1,
    ],
    ["unit.ec44b847ef34e9468316e089", "ec44b847ef34e9468316e0890a989cd133d5e316538278c3e040b52e01c243b8", "unit", 2],
    [
      "preflight.626397032f8030d2781f7950",
      "626397032f8030d2781f79505f0d0cc0d6261f0520de05fc07e83e3510c2a81d",
      "preflight",
      1,
    ],
    [
      "migration.881c319da844d6391aac0892",
      "881c319da844d6391aac089298f4fa677f00636a197e89cbde4ab8785d7e6fa3",
      "migration",
      1,
    ],
    [
      "preflight.5c44e89d1d31b9475b1430ea",
      "5c44e89d1d31b9475b1430eaa80618ce5ad8b0c0d71ff4e4c1f60ef87badc4f3",
      "preflight",
      1,
    ],
    [
      "browser.fa32375190b1fd871df03c93",
      "fa32375190b1fd871df03c93c2a3f841462ed03d1b5d479c78a3959f844c1099",
      "browser",
      4,
    ],
  ],
  commands: [
    ["npm", 2, "bf785277bc5ac2d0874834afdbec26249919a306fa066f9088135a011cafbbc0"],
    ["npx", 3, "396a24253b2d97ad1f5d6b7de928ec0aca6e23fbb22922ba7df80bc0f8e6ad6a"],
    ["npx", 3, "83735fdf295335323490e2aa2499457373a933275e2d2e3ed99cf2a929270644"],
    ["npx", 119, "7b25b9bde4ff65e99dc96373e5bf8eabee88694421bdc9e09374bb398edb37b9"],
    ["npx", 102, "4ab211fea9a74a9934504ca121f49d191885135f93e89b3978d2630b01d5b682"],
    ["NODE", 2, "412f48ed6906becdbb61320291f22167989cb808e5cbb199a89becce0a29ec0d"],
    ["npx", 5, "3b53de2cc8fcc1bcac0b8c20a830e1ddb90764738970c3e0802e510eda71569e"],
    ["NODE", 14, "a896fd85c7da12b095c88a9dbdd0b2bcbd352a9a444577a4e578bbcbcdbe0ee3"],
    ["npx", 460, "cf29b10a81c10ad4f39dabeddbf7eb9aaf1cdc662c528a1afd071d9768e0888f"],
    ["npx", 43, "62093b11a1b186a67764ad9b0da17e4280ca3253520c41ecf4633cc08c528c62"],
    ["npm", 2, "181eacc1e8a2ab6260924ce0032e94c3db46ac8f605698e1b201a18620eac7c9"],
    ["npx", 5, "8b26fde2bfbec1ba48c14215021ab038585564f914ad6671edfc665872512f4b"],
  ],
  orderedTuplesSha256: "642fa37ed3e710f7df5e975caf177331bd3c8c8df0de81ec3d0c2eb8ae7259de",
  groupIdsSha256: "03c76e3eeab4f949ae308dd201e61e1ea34bc68a6f4200359d228e188330b230",
  unit: [215, "c4ec20fd97bc3823fa81be8313c373441e2d675cb092d812be3093016254745a"],
  browser: [6, "06eb1aa7002ea5d18e886e254ca18b81412fb2854b1ec3afd06c05979c538051", 38],
});
export const POSTTECHNICAL_CASES = freeze([
  {
    project: "chromium",
    spec: "tests/e2e/crossdeck-experience-refit.spec.ts",
    sourceLine: 51,
    sourceColumn: 7,
    titlePath: ["complete multi-device experience · no-preference"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/crossdeck-experience-refit.spec.ts",
    sourceLine: 51,
    sourceColumn: 7,
    titlePath: ["complete multi-device experience · reduce"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/crossdeck-phase1.spec.ts",
    sourceLine: 18,
    sourceColumn: 7,
    titlePath: ["crossdeck.desktop-phone-pair"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/crossdeck-phase1.spec.ts",
    sourceLine: 18,
    sourceColumn: 7,
    titlePath: ["crossdeck.phone-disconnect"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/crossdeck-phase2.spec.ts",
    sourceLine: 27,
    sourceColumn: 7,
    titlePath: ["crossdeck.surface-handoff"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/crossdeck-phase2.spec.ts",
    sourceLine: 27,
    sourceColumn: 7,
    titlePath: ["crossdeck.phone-disconnect"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/crossdeck-refit-recovery.spec.ts",
    sourceLine: 72,
    sourceColumn: 5,
    titlePath: ["recover pairing and transfers while preserving shared-screen privacy"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 255,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey A: anonymous gateway account lifecycle"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 277,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey B: authenticated gateway identity"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 289,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey C: gateway to Community Harbor"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 304,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey D: gateway to Explore Chronicles"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 320,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey E: Player workspace navigation"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 342,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey F: Captain workspace navigation"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 360,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey G: Creator workspace navigation"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 378,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey H: workspace switcher continuity"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 403,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey I: authenticated account-menu hierarchy"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 433,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey J: anonymous mobile navigation"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 452,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey K: authenticated mobile parity"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 474,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey L: keyboard navigation"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 507,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey M: route-change lifecycle"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 529,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey N: active-state matrix"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 582,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey O: compact surface exit"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 593,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey P: immersive Player exit"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 630,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey Q: permission-restricted destination"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 642,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey R: current-user context unavailable"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 662,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey S: 200 percent zoom"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 681,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey T: reduced motion"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/homeport-phase2.spec.ts",
    sourceLine: 696,
    sourceColumn: 7,
    titlePath: ["Project Homeport Phase 2 browser journeys", "Journey U: Phase 1 regression continuity"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 37,
    sourceColumn: 7,
    titlePath: ["guided absolute experience, held-out check, playground, recovery and private export on laptop"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 37,
    sourceColumn: 7,
    titlePath: ["guided absolute experience, held-out check, playground, recovery and private export on mobile"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 101,
    sourceColumn: 5,
    titlePath: ["relative movement uses separate setup, check and cursor claims"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 116,
    sourceColumn: 5,
    titlePath: ["posture rejection preserves detection and lets the current target recover"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 252,
    sourceColumn: 5,
    titlePath: [
      "photographic video through the actual worker tracks noise, motion, partial occlusion and a second hand, then cleans up",
    ],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 306,
    sourceColumn: 7,
    titlePath: ["worker NONE has bounded lifecycle and recovery"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 306,
    sourceColumn: 7,
    titlePath: ["worker MODEL_UNAVAILABLE has bounded lifecycle and recovery"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 324,
    sourceColumn: 5,
    titlePath: ["camera denial has a useful retry and conventional demonstration"],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 339,
    sourceColumn: 5,
    titlePath: [
      "viewport changes invalidate the fit and preserve camera availability; safe return excludes external URLs",
    ],
  },
  {
    project: "chromium",
    spec: "tests/e2e/reach-laboratory.spec.ts",
    sourceLine: 357,
    sourceColumn: 5,
    titlePath: ["photographic worker completes nine real-landmark holds and five independent checks"],
  },
]);
export const POSTTECHNICAL_OUTPUTS = freeze({
  requiredFixedRelativeFilesOnWholeTechnicalSuccess: [
    "artifacts/crossdeck/refit-no-preference/01-chronicle.png",
    "artifacts/crossdeck/refit-no-preference/02-connect-in-chronicle.png",
    "artifacts/crossdeck/refit-no-preference/03-phone-sign-in.png",
    "artifacts/crossdeck/refit-no-preference/04-journal-companion.png",
    "artifacts/crossdeck/refit-no-preference/04-phone-connected.png",
    "artifacts/crossdeck/refit-no-preference/05-real-chronicle-lens.png",
    "artifacts/crossdeck/refit-no-preference/06-dedicated-chart.png",
    "artifacts/crossdeck/refit-no-preference/07-artifact.png",
    "artifacts/crossdeck/refit-no-preference/08-letter.png",
    "artifacts/crossdeck/refit-no-preference/09-receive-offer.png",
    "artifacts/crossdeck/refit-no-preference/09-transfer-pending.png",
    "artifacts/crossdeck/refit-no-preference/10-chart-received.png",
    "artifacts/crossdeck/refit-no-preference/10-delivery-acknowledged.png",
    "artifacts/crossdeck/refit-no-preference/11-offline.png",
    "artifacts/crossdeck/refit-no-preference/12-reconnected.png",
    "artifacts/crossdeck/refit-no-preference/13-recovered-chart.png",
    "artifacts/crossdeck/refit-no-preference/14-medium-chronicle.png",
    "artifacts/crossdeck/refit-no-preference/15-phone-landscape.png",
    "artifacts/crossdeck/refit-no-preference/16-return-to-chronicle.png",
    "artifacts/crossdeck/refit-no-preference/16-voyage-continued.png",
    "artifacts/crossdeck/refit-no-preference/17-access-ended.png",
    "artifacts/crossdeck/refit-no-preference/observations.json",
    "artifacts/crossdeck/refit-no-preference/desktop-trace.zip",
    "artifacts/crossdeck/refit-no-preference/phone-trace.zip",
    "artifacts/crossdeck/refit-reduce/01-chronicle.png",
    "artifacts/crossdeck/refit-reduce/02-connect-in-chronicle.png",
    "artifacts/crossdeck/refit-reduce/03-phone-sign-in.png",
    "artifacts/crossdeck/refit-reduce/04-journal-companion.png",
    "artifacts/crossdeck/refit-reduce/04-phone-connected.png",
    "artifacts/crossdeck/refit-reduce/05-real-chronicle-lens.png",
    "artifacts/crossdeck/refit-reduce/06-dedicated-chart.png",
    "artifacts/crossdeck/refit-reduce/07-artifact.png",
    "artifacts/crossdeck/refit-reduce/08-letter.png",
    "artifacts/crossdeck/refit-reduce/09-receive-offer.png",
    "artifacts/crossdeck/refit-reduce/09-transfer-pending.png",
    "artifacts/crossdeck/refit-reduce/10-chart-received.png",
    "artifacts/crossdeck/refit-reduce/10-delivery-acknowledged.png",
    "artifacts/crossdeck/refit-reduce/11-offline.png",
    "artifacts/crossdeck/refit-reduce/12-reconnected.png",
    "artifacts/crossdeck/refit-reduce/13-recovered-chart.png",
    "artifacts/crossdeck/refit-reduce/14-medium-chronicle.png",
    "artifacts/crossdeck/refit-reduce/15-phone-landscape.png",
    "artifacts/crossdeck/refit-reduce/16-return-to-chronicle.png",
    "artifacts/crossdeck/refit-reduce/16-voyage-continued.png",
    "artifacts/crossdeck/refit-reduce/17-access-ended.png",
    "artifacts/crossdeck/refit-reduce/observations.json",
    "artifacts/crossdeck/refit-reduce/desktop-trace.zip",
    "artifacts/crossdeck/refit-reduce/phone-trace.zip",
    "artifacts/crossdeck/refit-recovery/01-pairing-before-cancel.png",
    "artifacts/crossdeck/refit-recovery/02-expired-code-refused.png",
    "artifacts/crossdeck/refit-recovery/02-phone-connected.png",
    "artifacts/crossdeck/refit-recovery/02-paired-phone.png",
    "artifacts/crossdeck/refit-recovery/03-unavailable-purposes.png",
    "artifacts/crossdeck/refit-recovery/04-private-note-confirmation.png",
    "artifacts/crossdeck/refit-recovery/05-canceled-transfer.png",
    "artifacts/crossdeck/refit-recovery/06-declined-transfer.png",
    "artifacts/crossdeck/refit-recovery/07-shared-empty-state.png",
    "artifacts/crossdeck/refit-recovery/08-send-authorized-crew-chart.png",
    "artifacts/crossdeck/refit-recovery/08-crew-receive-pending.png",
    "artifacts/crossdeck/refit-recovery/08-crew-transfer-pending.png",
    "artifacts/crossdeck/refit-recovery/09-crew-delivery-acknowledged.png",
    "artifacts/crossdeck/refit-recovery/09-restricted-crew-chart-received.png",
    "artifacts/crossdeck/refit-recovery/10-authorized-personal-return.png",
    "artifacts/crossdeck/refit-recovery/11-current-surface-revoked.png",
    "artifacts/crossdeck/refit-recovery/observations.json",
    "artifacts/crossdeck/refit-recovery/desktop-trace.zip",
    "artifacts/crossdeck/refit-recovery/phone-trace.zip",
    "artifacts/crossdeck-device-lab/crossdeck.desktop-phone-pair-D1.json",
    "artifacts/crossdeck-device-lab/crossdeck.phone-disconnect-D1.json",
    "artifacts/crossdeck-phase2/crossdeck.surface-handoff-D1.json",
    "artifacts/crossdeck-phase2/crossdeck.phone-disconnect-D1.json",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-A-gateway-anonymous-desktop.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-E-account-menu-anonymous.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-B-gateway-authenticated-desktop.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-F-account-menu-authenticated.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-K-community-shell.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-G-global-nav-public.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-H-player-navigation.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-I-captain-navigation.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-J-creator-navigation.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-M-workspace-switcher.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-C-gateway-anonymous-mobile.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-L-mobile-drawer.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-D-gateway-authenticated-mobile.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-N-compact-exit.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-O-immersive-exit.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-T-permission-return.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-P-context-unavailable.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-Q-zoom-gateway.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-R-zoom-account-menu.png",
    "artifacts/validation/homeport-phase2/sounding-line-evidence/HP-P2-EV-S-reduced-motion.png",
  ],
  requiredRecursiveBasenamesOnWholeTechnicalSuccess: [
    {
      directory: "test-results",
      basename: "connected-mobile.png",
      count: 2,
      kind: "nonemptyPNG",
      spec: "tests/e2e/crossdeck-phase1.spec.ts",
    },
    {
      directory: "test-results",
      basename: "crossdeck-continuity.png",
      count: 2,
      kind: "nonemptyPNG",
      spec: "tests/e2e/crossdeck-phase2.spec.ts",
    },
    {
      directory: "test-results",
      basename: "worker-performance.json",
      count: 1,
      kind: "regularJSON",
      spec: "tests/e2e/reach-laboratory.spec.ts",
    },
    {
      directory: "test-results",
      basename: "photographic-calibration-performance.json",
      count: 1,
      kind: "regularJSON",
      spec: "tests/e2e/reach-laboratory.spec.ts",
    },
  ],
  requestedGeneratedVideoRules: [
    {
      directory: "artifacts/crossdeck/refit-no-preference",
      extension: ".webm",
      requestedContexts: 2,
      completedSuccessExpectedNonemptyFiles: 2,
      observationFile: "artifacts/crossdeck/refit-no-preference/observations.json",
      observationRecordingJsonPointers: ["/recordings/desktop", "/recordings/phone"],
      bindingRule:
        "Resolve eachobservationsrecording path toactualcontainedregularWebM inthisexactdirectory; no alias,outsidepath,duplicate orzerosizefile. recordingrequestsareunconditional; originalrelativeMedia enforcementispaired-only andmustnotbeusedasproof.",
    },
    {
      directory: "artifacts/crossdeck/refit-reduce",
      extension: ".webm",
      requestedContexts: 2,
      completedSuccessExpectedNonemptyFiles: 2,
      observationFile: "artifacts/crossdeck/refit-reduce/observations.json",
      observationRecordingJsonPointers: ["/recordings/desktop", "/recordings/phone"],
      bindingRule:
        "Resolve eachobservationsrecording path toactualcontainedregularWebM inthisexactdirectory; no alias,outsidepath,duplicate orzerosizefile. recordingrequestsareunconditional; originalrelativeMedia enforcementispaired-only andmustnotbeusedasproof.",
    },
    {
      directory: "artifacts/crossdeck/refit-recovery",
      extension: ".webm",
      requestedContexts: 2,
      completedSuccessExpectedNonemptyFiles: 2,
      observationFile: "artifacts/crossdeck/refit-recovery/observations.json",
      observationRecordingJsonPointers: ["/recordings/desktop", "/recordings/phone"],
      bindingRule:
        "Resolve eachobservationsrecording path toactualcontainedregularWebM inthisexactdirectory; no alias,outsidepath,duplicate orzerosizefile. recordingrequestsareunconditional; originalrelativeMedia enforcementispaired-only andmustnotbeusedasproof.",
    },
  ],
});
export const POSTTECHNICAL_POLICY = freeze({
  version: 1,
  id: "CROSSDECK-ORDINARY6-POSTTECHNICAL-DIAGNOSTIC-20261017",
  namespace: "sounding-line-diagnostics/CROSSDECK-ORDINARY6-POSTTECHNICAL-DIAGNOSTIC-20261017",
  slot: "attempt-1",
  repository: "Kgray44/treasurehuntSoT",
  actor: "Kgray44",
  expiry: "2026-10-22T23:59:59Z",
  workflow: ".github/workflows/sounding-line-replay-posttechnical-diagnostic.yml",
  title: "Sounding Line posttechnical diagnostic 1 ordinary6",
  outputInventoryDigest: "530475b5e340f325abcc43b350c935e3d2b5d376f52385835c96532036182d01",
  outputs: POSTTECHNICAL_OUTPUTS,
  originalPlanDigest: "7ab280abc31b8f23977c15eebe347de45774bd2875e1b287400dfe4b95123cec",
  priorRun: 39012427540,
  priorClaim: "0f2a0ce5b7b1493f1a11d9de734d1bbce4a5b08b",
  priorReceiptDigest: "f764737c5522afaab7f7669abf15e875fffd04338b831060072f8d813cf9c48b",
  casesDigest: "845b5547ff3d571a0428170f2db4eca7841f59d58a6c05a556ca6117d9ecc5ad",
  reportLimit: 16 * 1024 * 1024,
  leaseLimit: 65536,
  workerMs: 55 * 60 * 1000,
  commandMs: 15 * 60 * 1000,
  logLimit: 16 * 1024 * 1024,
  evidenceFiles: 1024,
  evidenceBytes: 256 * 1024 * 1024,
  evidenceFileBytes: 64 * 1024 * 1024,
  evidenceEnvelopeBytes: 512 * 1024 * 1024,
  evidenceDepth: 64,
  evidenceNameBytes: 4096,
  sourceExceptionBytes: 16 * 1024 * 1024,
  sourceExceptionRecords: 128,
  evidenceKeyDigest: "f82684218e386d09e9120d0c7b54722e5833e5c18a3d7a8a73d94b9afead48bc",
  setup: [
    ["npm", ["ci", "--ignore-scripts"]],
    ["npx", ["--no-install", "prisma", "generate", "--schema", "prisma/schema.sqlite.prisma"]],
    ["npx", ["--no-install", "playwright", "install", "--with-deps", "chromium"]],
  ],
  workload: POSTTECHNICAL_WORKLOAD,
});
export const posttechnicalHash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
export const posttechnicalDigest = (value) => posttechnicalHash(JSON.stringify(canonical(value)));
export const posttechnicalPolicyDigest = posttechnicalDigest(POSTTECHNICAL_POLICY);
export function posttechnicalFail(code) {
  const error = new Error(`POSTTECHNICAL_DIAGNOSTIC_${code}`);
  error.posttechnicalCode = code;
  throw error;
}
export function posttechnicalRequire(value, code) {
  if (!value) posttechnicalFail(code);
}
const requireValue = posttechnicalRequire,
  P = POSTTECHNICAL_POLICY,
  W = POSTTECHNICAL_WORKLOAD;
const sha = (value) => typeof value === "string" && /^[a-f0-9]{40}$/u.test(value);
const uuid = (value) => typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value);
const git = (root, args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 20000,
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
  });
export function assertPosttechnicalRuntime(runtime) {
  requireValue(
    runtime.node === "24.19.0" &&
      runtime.platform === "linux" &&
      runtime.architecture === "x64" &&
      runtime.git === "2.55.0" &&
      runtime.executable === W.nodeExecutable,
    "RUNTIME_CHANGED",
  );
}
export function posttechnicalRuntime() {
  return {
    node: process.versions.node,
    platform: process.platform,
    architecture: process.arch,
    git: execFileSync("git", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trim()
      .replace(/^git version /u, ""),
    executable: process.execPath,
  };
}
export function posttechnicalSnapshot(root) {
  const directory = path.join(root, ".git");
  requireValue(lstatSync(directory).isDirectory() && realpathSync(directory) === directory, "SOURCE_CHANGED");
  return {
    head: git(root, ["rev-parse", "HEAD"]).trim(),
    tree: git(root, ["rev-parse", "HEAD^{tree}"]).trim(),
    index: posttechnicalHash(readFileSync(path.join(directory, "index"))),
    refs: posttechnicalHash(git(root, ["for-each-ref", "--format=%(refname) %(objectname)"])),
    status: git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
  };
}
export function assertPosttechnicalSources(marker) {
  const candidate = posttechnicalSnapshot(marker.candidate),
    installer = posttechnicalSnapshot(marker.installer);
  requireValue(
    candidate.head === W.candidate &&
      candidate.tree === W.candidateTree &&
      installer.head === marker.installerSha &&
      candidate.status === "" &&
      installer.status === "" &&
      ["head", "tree", "index", "refs"].every(
        (key) => candidate[key] === marker.sources.candidate[key] && installer[key] === marker.sources.installer[key],
      ),
    "SOURCE_CHANGED",
  );
}
export function posttechnicalPrivatePaths(workspace) {
  requireValue(path.isAbsolute(workspace) && realpathSync(workspace) === workspace, "PRIVATE_PATH_INVALID");
  const directory = path.join(workspace, "private");
  requireValue(
    lstatSync(directory).isDirectory() &&
      !lstatSync(directory).isSymbolicLink() &&
      realpathSync(directory) === directory &&
      (lstatSync(directory).mode & 0o077) === 0,
    "PRIVATE_PATH_INVALID",
  );
  return {
    directory,
    input: path.join(directory, "worker-input.json"),
    started: path.join(directory, "worker-started.json"),
    result: path.join(directory, "worker-result.json"),
    lease: path.join(directory, "suite-lease.json"),
    suiteStarted: path.join(directory, "suite-started.json"),
    suiteTerminal: path.join(directory, "suite-terminal.json"),
    report: path.join(directory, "playwright-report.json"),
    browserRuntime: path.join(directory, "browser-runtime.original.json"),
    browserProfile: path.join(directory, "browser-profile.original.json"),
  };
}
export function securePosttechnicalRead({ file, root, maximum, privateMode = false, readImpl = readSync }) {
  requireValue(
    path.isAbsolute(file) &&
      path.isAbsolute(root) &&
      realpathSync(root) === root &&
      file.startsWith(root + path.sep) &&
      file.length <= 4096,
    "EVIDENCE_PATH_INVALID",
  );
  const parents = [];
  let current = root;
  for (const component of path.relative(root, path.dirname(file)).split(path.sep).filter(Boolean)) {
    requireValue(component !== ".." && component !== ".", "EVIDENCE_PATH_INVALID");
    current = path.join(current, component);
    const stat = lstatSync(current);
    requireValue(
      stat.isDirectory() && !stat.isSymbolicLink() && realpathSync(current) === current,
      "EVIDENCE_PATH_INVALID",
    );
    parents.push([current, stat.dev, stat.ino]);
  }
  const flags = fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK;
  let descriptor;
  try {
    descriptor = openSync(file, flags);
    const before = fstatSync(descriptor);
    requireValue(
      before.isFile() &&
        before.nlink === 1 &&
        before.size <= maximum &&
        (!privateMode || (before.mode & 0o077) === 0) &&
        realpathSync(file) === file,
      "EVIDENCE_PATH_INVALID",
    );
    const namedBefore = lstatSync(file);
    requireValue(
      !namedBefore.isSymbolicLink() && namedBefore.dev === before.dev && namedBefore.ino === before.ino,
      "EVIDENCE_PATH_INVALID",
    );
    const bytes = Buffer.alloc(before.size);
    let offset = 0;
    while (offset < bytes.length) {
      const read = readImpl(descriptor, bytes, offset, bytes.length - offset, offset);
      requireValue(read > 0, "EVIDENCE_PATH_INVALID");
      offset += read;
    }
    requireValue(readImpl(descriptor, Buffer.alloc(1), 0, 1, offset) === 0, "EVIDENCE_PATH_INVALID");
    const after = fstatSync(descriptor),
      namedAfter = lstatSync(file);
    requireValue(
      after.isFile() &&
        after.nlink === 1 &&
        after.dev === before.dev &&
        after.ino === before.ino &&
        after.size === before.size &&
        after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs &&
        !namedAfter.isSymbolicLink() &&
        namedAfter.dev === after.dev &&
        namedAfter.ino === after.ino &&
        realpathSync(file) === file &&
        parents.every(([directory, dev, ino]) => {
          const stat = lstatSync(directory);
          return (
            stat.isDirectory() &&
            !stat.isSymbolicLink() &&
            stat.dev === dev &&
            stat.ino === ino &&
            realpathSync(directory) === directory
          );
        }),
      "EVIDENCE_PATH_INVALID",
    );
    return bytes;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
export function readPosttechnicalPrivate(file, maximum = P.leaseLimit) {
  return JSON.parse(securePosttechnicalRead({ file, root: path.dirname(file), maximum, privateMode: true }));
}
export function writePosttechnicalPrivate(file, value) {
  const bytes = JSON.stringify(value, null, 2) + "\n";
  requireValue(Buffer.byteLength(bytes) <= P.leaseLimit, "PRIVATE_FILE_INVALID");
  writeFileSync(file, bytes, { flag: "wx", mode: 0o600 });
}
export function validatePosttechnicalCommand(ordinal, command, args) {
  const expected = W.commands[ordinal - 1];
  requireValue(
    expected &&
      Array.isArray(args) &&
      args.every((value) => typeof value === "string") &&
      (command === process.execPath ? "NODE" : command) === expected[0] &&
      args.length === expected[1] &&
      posttechnicalDigest(args) === expected[2],
    "COMMAND_CHANGED",
  );
  return { executable: expected[0], arguments: args };
}
export function validatePosttechnicalManifest(groups, plan) {
  requireValue(
    plan.candidateSha === W.candidate &&
      plan.candidateTree === W.candidateTree &&
      plan.baseSha === W.base &&
      plan.mode === "ordinary" &&
      plan.selected.unitTests.length === W.unit[0] &&
      posttechnicalDigest(plan.selected.unitTests) === W.unit[1] &&
      plan.selected.browserTests.length === W.browser[0] &&
      posttechnicalDigest(plan.selected.browserTests) === W.browser[1],
    "PLAN_CHANGED",
  );
  requireValue(
    groups.length === W.groups.length && posttechnicalDigest(groups.map((group) => group.id)) === W.groupIdsSha256,
    "GROUPS_CHANGED",
  );
  const tuples = [];
  let ordinal = 0;
  groups.forEach((group, index) => {
    const expected = W.groups[index];
    requireValue(
      group.id === expected[0] &&
        group.commandDigest === expected[1] &&
        group.kind === expected[2] &&
        group.commands.length === expected[3],
      "GROUPS_CHANGED",
    );
    group.commands.forEach(([command, args]) => tuples.push(validatePosttechnicalCommand(++ordinal, command, args)));
  });
  requireValue(ordinal === 12 && posttechnicalDigest(tuples) === W.orderedTuplesSha256, "COMMAND_CHANGED");
  return tuples;
}
const suiteFiles = [...new Set(POSTTECHNICAL_CASES.map((entry) => entry.spec))];
export function posttechnicalSuiteArguments({ candidate, lease, originalArguments }) {
  validatePosttechnicalCommand(8, process.execPath, originalArguments);
  const separator = originalArguments.indexOf("--");
  return [
    ...originalArguments.slice(1, separator),
    "--workspace",
    candidate,
    "--posttechnical-diagnostic",
    lease,
    "--",
    ...originalArguments.slice(separator + 1),
  ];
}
export function validatePosttechnicalLease({
  marker,
  root,
  candidateSha,
  argv,
  leasePath,
  environment,
  parentPid,
  now = new Date(),
}) {
  const workspace = environment.GITHUB_WORKSPACE,
    paths = posttechnicalPrivatePaths(workspace);
  requireValue(
    leasePath === paths.lease &&
      marker.version === 1 &&
      marker.policyDigest === posttechnicalPolicyDigest &&
      marker.diagnosticId === P.id &&
      sha(marker.reservation) &&
      uuid(marker.nonce) &&
      marker.coordinatorPid === parentPid &&
      Number.isSafeInteger(parentPid) &&
      parentPid > 1 &&
      marker.candidate === path.join(workspace, "candidate") &&
      root === marker.candidate &&
      candidateSha === W.candidate &&
      marker.installer === path.join(workspace, "installer") &&
      sha(marker.installerSha) &&
      marker.originalDecisionDigest === W.originalDecisionSha256 &&
      marker.commandOrdinal === 8 &&
      environment.POSTTECHNICAL_SUITE_LEASE === marker.nonce &&
      environment.GITHUB_ACTIONS === "true" &&
      environment.GITHUB_JOB === "posttechnical-diagnostic" &&
      environment.GITHUB_REPOSITORY === P.repository &&
      environment.GITHUB_REF === "refs/heads/main" &&
      environment.GITHUB_SHA === marker.installerSha &&
      environment.GITHUB_RUN_ID === String(marker.runId) &&
      environment.GITHUB_RUN_ATTEMPT === "1" &&
      environment.GITHUB_EVENT_NAME === "workflow_dispatch" &&
      environment.GITHUB_ACTOR === P.actor &&
      environment.GITHUB_TRIGGERING_ACTOR === P.actor &&
      environment.GITHUB_WORKFLOW_REF === `${P.repository}/${P.workflow}@refs/heads/main` &&
      environment.CI === "true" &&
      now <= new Date(P.expiry) &&
      !Object.entries(environment).some(
        ([key, value]) => value && /^SOUNDING_LINE_(?:EXCEPTION_|R\d+_(?:LOCAL|TECHNICAL|READINESS)_)/u.test(key),
      ) &&
      JSON.stringify(argv) ===
        JSON.stringify(
          posttechnicalSuiteArguments({
            candidate: root,
            lease: leasePath,
            originalArguments: marker.originalArguments,
          }),
        ),
    "SUITE_BINDING_CHANGED",
  );
  return paths;
}
export function scrubPosttechnicalSuiteEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([key]) =>
        !/^POSTTECHNICAL_/u.test(key) &&
        !/^GITHUB_(?:OUTPUT|ENV|PATH|STEP_SUMMARY|STATE)$/u.test(key) &&
        !/^(?:GH_TOKEN|GITHUB_TOKEN|NODE_OPTIONS|GIT_)/u.test(key) &&
        !/^SOUNDING_LINE_(?:EXCEPTION_|R\d+_)/u.test(key),
    ),
  );
}
export async function requirePosttechnicalDiagnosticSuite({
  root,
  candidateSha,
  options,
  browserTests,
  argv,
  environment = process.env,
}) {
  requireValue(
    options["posttechnical-diagnostic"] &&
      !Object.keys(options).some(
        (key) => !["profile", "candidate", "database-url", "workspace", "posttechnical-diagnostic"].includes(key),
      ) &&
      JSON.stringify(browserTests) === JSON.stringify(suiteFiles),
    "SUITE_INVOCATION_CHANGED",
  );
  const admittedPaths = posttechnicalPrivatePaths(environment.GITHUB_WORKSPACE);
  requireValue(options["posttechnical-diagnostic"] === admittedPaths.lease, "PRIVATE_PATH_INVALID");
  assertPosttechnicalRuntime(posttechnicalRuntime());
  const marker = readPosttechnicalPrivate(admittedPaths.lease);
  const paths = validatePosttechnicalLease({
    marker,
    root,
    candidateSha,
    argv,
    leasePath: options["posttechnical-diagnostic"],
    environment,
    parentPid: process.ppid,
  });
  requireValue(
    fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/u, "") === marker.installer,
    "INSTALLER_CHANGED",
  );
  try {
    process.kill(marker.coordinatorPid, 0);
  } catch {
    posttechnicalFail("COORDINATOR_EXITED");
  }
  assertPosttechnicalSources(marker);
  requireValue(!existsSync(paths.report), "REPORT_ALREADY_EXISTS");
  writePosttechnicalPrivate(paths.suiteStarted, {
    version: 1,
    diagnosticId: P.id,
    policyDigest: posttechnicalPolicyDigest,
    reservation: marker.reservation,
    coordinatorPid: marker.coordinatorPid,
    suitePid: process.pid,
    commandOrdinal: 8,
  });
  // Validation is complete. The private permission never reaches app descendants.
  delete process.env.POSTTECHNICAL_SUITE_LEASE;
  process.umask(0o077);
  return {
    marker,
    paths,
    environment: {
      PLAYWRIGHT_JSON_OUTPUT_NAME: paths.report,
      PLAYWRIGHT_HTML_OPEN: "never",
      PLAYWRIGHT_HTML_OUTPUT_DIR: path.join(paths.directory, "html-report"),
    },
    browserArguments: ["--workers", "1", "--retries", "0", "--repeat-each", "1", "--reporter", "list,html,json"],
  };
}
export function validatePosttechnicalBrowserReport(report, { candidate }) {
  requireValue(
    path.isAbsolute(candidate) && report?.config?.rootDir === path.join(candidate, "tests/e2e"),
    "REPORT_SCOPE_CHANGED",
  );
  const project = report.config?.projects?.find((entry) => entry.name === "chromium");
  requireValue(
    report.config?.workers === 1 &&
      project?.retries === 0 &&
      project?.repeatEach === 1 &&
      Array.isArray(report.errors) &&
      report.errors.length === 0 &&
      report.stats?.expected === 38 &&
      report.stats?.skipped === 0 &&
      report.stats?.unexpected === 0 &&
      report.stats?.flaky === 0,
    "REPORT_SCOPE_CHANGED",
  );
  const identities = [];
  let media = 0;
  const walk = (suite, parents = [], wrapper = false) => {
    // Playwright's file wrapper is excluded; nested describe titles are retained.
    const titles = wrapper || !suite.title ? parents : [...parents, suite.title];
    for (const spec of suite.specs ?? []) {
      requireValue(Array.isArray(spec.tests) && spec.tests.length === 1, "REPORT_SCOPE_CHANGED");
      const entry = spec.tests[0],
        result = entry.results?.[0];
      requireValue(
        entry.projectName === "chromium" &&
          entry.expectedStatus === "passed" &&
          entry.status === "expected" &&
          (entry.repeatEachIndex ?? 0) === 0 &&
          Array.isArray(entry.results) &&
          entry.results.length === 1 &&
          result?.retry === 0 &&
          result.status === "passed" &&
          Array.isArray(result.errors) &&
          result.errors.length === 0 &&
          !result.error,
        "REPORT_CASE_FAILED",
      );
      requireValue(
        typeof spec.file === "string" &&
          !path.isAbsolute(spec.file) &&
          !spec.file.includes("\\") &&
          spec.file.split("/").every((part) => part && part !== "." && part !== ".."),
        "REPORT_SCOPE_CHANGED",
      );
      const matching = suiteFiles.filter(
        (known) =>
          spec.file === path.posix.basename(known) &&
          path.resolve(report.config.rootDir, spec.file) === path.join(candidate, known),
      );
      requireValue(matching.length === 1, "REPORT_SCOPE_CHANGED");
      identities.push({
        project: entry.projectName,
        spec: matching[0],
        sourceLine: spec.line,
        sourceColumn: spec.column,
        titlePath: [...titles, spec.title],
      });
      media += (result.attachments ?? []).filter(
        (attachment) =>
          /^(?:image|video)\//u.test(attachment.contentType ?? "") ||
          /(?:trace\.zip|\.png|\.webm)$/u.test(attachment.path ?? ""),
      ).length;
    }
    for (const child of suite.suites ?? []) walk(child, titles);
  };
  for (const suite of report.suites ?? []) walk(suite, [], true);
  requireValue(
    identities.length === 38 &&
      new Set(identities.map(posttechnicalDigest)).size === 38 &&
      posttechnicalDigest(identities) === P.casesDigest,
    "REPORT_IDENTITIES_CHANGED",
  );
  return {
    actualCases: 38,
    actualSuites: 6,
    retries: 0,
    repetitions: 1,
    workers: 1,
    identityDigest: posttechnicalDigest(identities),
    mediaAttachments: media,
    status: "PASS",
    qualification: false,
  };
}
export function capturePosttechnicalSuiteEvidence({ context, root, environment = process.env, status }) {
  const paths = context.paths,
    reports = browserReceiptPaths(root, environment);
  requireValue(reports?.binding, "BROWSER_SCOPE_MISSING");
  const result = {
    status: "FAIL",
    actualCases: null,
    actualSuites: null,
    browserAuthorityCaptureLaunches: null,
    mediaAttachments: null,
    qualification: false,
    cleanup: "UNKNOWN",
  };
  let runtime = null,
    profile = null,
    report = null;
  for (const [source, target, label] of [
    [reports.runtime, paths.browserRuntime, "runtimeDigest"],
    [reports.profile, paths.browserProfile, "profileDigest"],
  ]) {
    if (!existsSync(source)) continue;
    const bytes = readFileSync(source);
    requireValue(bytes.length <= P.leaseLimit, "BROWSER_RECEIPT_TOO_LARGE");
    writeFileSync(target, bytes, { flag: "wx", mode: 0o600 });
    result[label] = posttechnicalHash(bytes);
    if (label === "runtimeDigest") runtime = JSON.parse(bytes);
    else profile = JSON.parse(bytes);
  }
  if (existsSync(paths.report)) {
    report = readPosttechnicalPrivate(paths.report, P.reportLimit);
    result.reportDigest = posttechnicalHash(readFileSync(paths.report));
    let actual = 0,
      media = 0;
    const walk = (suite) => {
      for (const spec of suite.specs ?? [])
        for (const entry of spec.tests ?? [])
          for (const item of entry.results ?? []) {
            if (["passed", "failed", "timedOut", "interrupted"].includes(item.status)) actual++;
            media += (item.attachments ?? []).filter(
              (attachment) =>
                /^(?:image|video)\//u.test(attachment.contentType ?? "") ||
                /(?:trace\.zip|\.png|\.webm)$/u.test(attachment.path ?? ""),
            ).length;
          }
      for (const child of suite.suites ?? []) walk(child);
    };
    for (const suite of report.suites ?? []) walk(suite);
    result.actualCases = actual;
    result.mediaAttachments = media;
  }
  if (runtime?.lifecycle) {
    result.browserAuthorityCaptureLaunches = runtime.lifecycle.capture === "NOT_STARTED" ? 0 : 1;
    result.cleanup = runtime.lifecycle.cleanup?.status ?? "UNKNOWN";
  }
  try {
    requireValue(
      status === "PASS" &&
        profile?.status === "PASS" &&
        profile.profile === "generic" &&
        runtime?.lifecycle?.cleanup?.status === "PASS" &&
        runtime.failureCategory === null,
      "BROWSER_CLEANUP_FAILED",
    );
    Object.assign(result, validatePosttechnicalBrowserReport(report, { candidate: root }));
    result.browserAuthorityCaptureLaunches = 1;
    result.cleanup = "PASS";
  } finally {
    writePosttechnicalPrivate(paths.suiteTerminal, result);
  }
  return result;
}
