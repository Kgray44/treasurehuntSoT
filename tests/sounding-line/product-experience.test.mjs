import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  affectedConsumers,
  classifyExperience,
  experienceDigest,
  planProductExperience,
  repairDisposition,
  REVIEW_DIMENSIONS,
  sourceSnapshot,
  validateExperienceContract,
  validateExperienceEvidence,
  baselineScopeDigest,
  mergeExperienceContracts,
} from "../../scripts/sounding-line/product-experience.mjs";
import { experienceDatabaseUrl } from "../../scripts/sounding-line/experience-browser.mjs";

const fixturePng = await sharp({ create: { width: 390, height: 844, channels: 4, background: "#123456" } })
  .png()
  .toBuffer();
export function experienceFixture() {
  const contract = {
    id: "phone-lens",
    authority: "one-voyage",
    owners: ["crossdeck", "parallax"],
    experience: {
      persona: "A Player continuing a Voyage",
      objective: "Use my phone as a Chronicle Lens while continuing on desktop",
      visibleOutcome: "The phone presents a Lens with the released spatial clue and an accessible fallback",
      integrationOwner: "Crossdeck and Parallax experience integration",
      systems: ["crossdeck", "parallax"],
      sourcePaths: ["src/lens", "src/services/lens.ts"],
      entryPoint: "/voyage",
      states: ["READY", "UNAVAILABLE"],
      devices: ["DESKTOP", "MOBILE"],
      roles: ["PLAYER", "CHRONICLE_LENS"],
      roleSetup: Object.fromEntries(
        ["PLAYER", "CHRONICLE_LENS"].map((role) => [
          role,
          { witness: { role: "region", name: role, text: `Verified fixture role ${role}` } },
        ]),
      ),
      accessibility: "Keyboard reachable actions with stable focus and reduced motion",
      fallback: "Unsupported cameras offer the equivalent accessible clue",
      navigation: "Pair contextually and return to the same Voyage",
      designTarget: "A clear clue-focused composition with one primary action",
      references: [{ family: "Journal", path: "reference.png" }],
      browserTests: ["tests/e2e/lens.spec.ts"],
      limitations: ["Physical camera tracking requires device qualification"],
      continuity: {
        objective: "Same canonical Voyage and account before and after pairing",
        checks: [{ id: "voyage", role: "region", name: "Current Voyage", attribute: "data-voyage-id" }],
      },
      journeys: [
        {
          id: "lens",
          roles: ["PLAYER", "CHRONICLE_LENS"],
          outcome: "Released clue is presented in the role-appropriate phone Lens",
          steps: [
            { action: "click", role: "button", name: "Use phone as Lens" },
            {
              action: "assert",
              kind: "outcome",
              role: "region",
              name: "Chronicle Lens",
              path: "/lens",
              text: "Released clue",
              meaning: "The paired phone receives the intended released clue",
            },
            { action: "click", role: "link", name: "Return to Voyage" },
            { action: "assert", role: "region", name: "Current Voyage", path: "/voyage", returnPath: true },
          ],
        },
      ],
    },
  };
  const png = fixturePng;
  const bytes = new Map();
  const artifacts = [];
  for (const device of contract.experience.devices) {
    for (const state of contract.experience.states) {
      const id = `${device}-${state}`;
      bytes.set(id + ".png", png);
      artifacts.push({
        id,
        path: id + ".png",
        sha256: createHash("sha256").update(png).digest("hex"),
        contractId: contract.id,
        type: "screenshot",
        origin: "ACTUAL_APPLICATION",
        device,
        state,
      });
    }
  }
  const recording = Buffer.alloc(150);
  recording.set([26, 69, 223, 163]);
  recording.write("webm", 8);
  bytes.set("interaction.webm", recording);
  artifacts.push({
    id: "recording",
    path: "interaction.webm",
    sha256: createHash("sha256").update(bytes.get("interaction.webm")).digest("hex"),
    contractId: contract.id,
    type: "recording",
    origin: "ACTUAL_APPLICATION",
  });
  const plan = {
    applicable: true,
    baseSha: "a".repeat(40),
    sourceDigest: "b".repeat(64),
    contractDigest: experienceDigest([contract]),
    contracts: [contract],
    contractIds: [contract.id],
  };
  const evidence = {
    version: 1,
    baseSha: plan.baseSha,
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    artifacts,
    ownerAcceptance: "NOT_CLAIMED",
    journeys: contract.experience.devices.flatMap((device) =>
      contract.experience.roles.map((role) => ({
        id: "lens",
        contractId: contract.id,
        device,
        role,
        motionMode: "REDUCED",
        status: "PASS",
        entryPoint: "/voyage",
        outcome: contract.experience.journeys[0].outcome,
        visibleActions: 3,
        returnPathVerified: true,
        roleVerified: true,
        continuity: [{ id: "voyage", before: "c".repeat(64), atOutcomes: ["c".repeat(64)], after: "c".repeat(64) }],
        accessibility: { keyboard: true, focus: true, reducedMotion: true, motionPreferenceVerified: true },
      })),
    ),
    reviews: [
      {
        contractId: contract.id,
        builderContext: "builder",
        reviewerContext: "reviewer",
        independence: "SEPARATE_CONTEXT",
        sourceInspectionOrder: "EXPERIENCE_BEFORE_SOURCE",
        packetDigest: experienceDigest({
          sourceDigest: plan.sourceDigest,
          contract,
          artifacts: artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
        }),
        dimensions: Object.fromEntries(
          REVIEW_DIMENSIONS.map((dimension) => [
            dimension,
            {
              observation: `${dimension}: the evidenced clue and return flow satisfy the contract`,
              evidenceIds: ["MOBILE-READY"],
            },
          ]),
        ),
        status: "ACCEPTED",
        iterations: 1,
        findings: [],
      },
    ],
  };
  return {
    contract,
    plan,
    evidence,
    bytes,
    validate: (value = evidence) =>
      validateExperienceEvidence({
        plan,
        evidence: value,
        root: "unused",
        readArtifact: ({ file }) => bytes.get(file),
      }),
  };
}
test("representative complete cross-project experience passes required outcome and review gate", () => {
  const fixture = experienceFixture();
  validateExperienceContract(fixture.contract);
  assert.equal(fixture.validate().status, "PASS");
});
for (const [name, mutation, rejection] of [
  [
    "A: persisted role without promised Lens",
    (value) => {
      value.journeys[0].outcome = "Role persisted";
    },
    /SEMANTIC_JOURNEY_FAILED/u,
  ],
  [
    "B: ordinary workflow hidden behind account setup",
    (value) => {
      value.journeys[0].entryPoint = "/account/devices";
    },
    /SEMANTIC_JOURNEY_FAILED/u,
  ],
  [
    "C: API succeeds but no accessible product realization",
    (value) => {
      value.journeys = [];
    },
    /VISUAL_EVIDENCE_INCOMPLETE/u,
  ],
  [
    "D: screenshot-only compliance",
    (value) => {
      value.reviews = [];
    },
    /VISUAL_EVIDENCE_INCOMPLETE/u,
  ],
  [
    "E: producer and consumer disconnected",
    (value) => {
      value.journeys[0].continuity = "New unrelated Voyage";
    },
    /CROSS_PROJECT_JOURNEY_FAILED/u,
  ],
  [
    "F: detected hand mislabeled undetected when pointing ineligible",
    (value) => {
      value.reviews[0].findings.push({
        id: "reach-stages",
        classification: "MAJOR_EXPERIENCE_DEFECT",
        contractId: "phone-lens",
        observation: "Valid detected landmarks are displayed as no hand because eligibility failed",
        evidenceIds: ["MOBILE-READY"],
        disposition: "OPEN",
      });
    },
    /BLOCKING_FINDING/u,
  ],
  [
    "G: selectable mode does not deliver advertised result",
    (value) => {
      value.journeys[0].status = "FAIL";
    },
    /SEMANTIC_JOURNEY_FAILED/u,
  ],
  [
    "review in builder context",
    (value) => {
      value.reviews[0].reviewerContext = "builder";
    },
    /INDEPENDENT_REVIEW_REQUIRED/u,
  ],
  [
    "source identity missing",
    (value) => {
      delete value.sourceDigest;
    },
    /EVIDENCE_SOURCE_MISMATCH/u,
  ],
  [
    "source identity stale",
    (value) => {
      value.sourceDigest = "f".repeat(64);
    },
    /EVIDENCE_SOURCE_MISMATCH/u,
  ],
  [
    "rendered artifact rewritten",
    (value) => {
      value.artifacts[0].sha256 = "f".repeat(64);
    },
    /ARTIFACT_DIGEST_MISMATCH/u,
  ],
  [
    "review rubber stamp",
    (value) => {
      value.reviews[0].dimensions.composition.observation = "Pass";
    },
    /SUBSTANTIVE_REVIEW_MISSING/u,
  ],
  [
    "recording absent for cross-project flow",
    (value) => {
      value.artifacts = value.artifacts.filter((artifact) => artifact.type !== "recording");
    },
    /RECORDING_REQUIRED/u,
  ],
  [
    "mobile failure state missing",
    (value) => {
      value.artifacts = value.artifacts.filter((artifact) => artifact.id !== "MOBILE-UNAVAILABLE");
    },
    /STATE_CAPTURE_MISSING/u,
  ],
  [
    "owner acceptance inferred",
    (value) => {
      value.ownerAcceptance = "PRODUCT_ACCEPTED";
    },
    /OWNER_ACCEPTANCE_UNAUTHORIZED/u,
  ],
])
  test(name, () => {
    const fixture = experienceFixture();
    mutation(fixture.evidence);
    assert.throws(() => fixture.validate(), rejection);
  });

test("H: backend-only work selects no screenshots and preserves focused validation", () => {
  const consumers = affectedConsumers(
    ["src/services/internal.ts"],
    [
      {
        contents: new Map([
          ["src/services/internal.ts", "export const compactAudit = true;"],
          ["src/lens/Lens.tsx", "export function Lens() { return <div>Lens</div>; }"],
        ]),
      },
    ],
  );
  const result = classifyExperience({
    changedPaths: ["src/services/internal.ts"],
    consumers,
    contracts: [experienceFixture().contract],
  });
  assert.equal(result.classification, "BACKEND_ONLY");
  assert.equal(result.applicable, false);
  assert.deepEqual(result.contractIds, []);
});
test("shared service changes select transitive UI consumers and complete integration contract", () => {
  const snapshot = {
    contents: new Map([
      ["src/services/lens.ts", "export const lens = true;"],
      ["src/lens/project.ts", 'import { lens } from "../services/lens"; export { lens };'],
      ["src/lens/Lens.tsx", 'import { lens } from "./project"; export function Lens() { return <div>{lens}</div>; }'],
    ]),
  };
  const consumers = affectedConsumers(["src/services/lens.ts"], [snapshot]);
  assert.deepEqual(consumers.surfaces, ["src/lens/Lens.tsx"]);
  assert.equal(
    classifyExperience({ changedPaths: ["src/services/lens.ts"], consumers, contracts: [experienceFixture().contract] })
      .classification,
    "CROSS_PROJECT_EXPERIENCE",
  );
});
test("removed import on candidate cannot hide a base consumer", () => {
  const base = {
    contents: new Map([
      ["src/services/lens.ts", "export const lens = true;"],
      ["src/lens/Lens.tsx", 'import { lens } from "../services/lens";'],
    ]),
  };
  const candidate = {
    contents: new Map([
      ["src/services/lens.ts", "export const lens = false;"],
      ["src/lens/Lens.tsx", "export const empty = true;"],
    ]),
  };
  assert.deepEqual(affectedConsumers(["src/services/lens.ts"], [base, candidate]).surfaces, ["src/lens/Lens.tsx"]);
});
test("HTTP projection changes select consuming UI", () => {
  const snapshot = {
    contents: new Map([
      ["src/app/api/lens/route.ts", "export const GET = () => null;"],
      ["src/lens/Lens.tsx", 'fetch("/api/lens");'],
    ]),
  };
  assert.deepEqual(affectedConsumers(["src/app/api/lens/route.ts"], [snapshot]).surfaces, ["src/lens/Lens.tsx"]);
});
test("repair loop consumes blocking findings and stops when progress is absent", () => {
  const findings = [{ id: "focus", classification: "ACCESSIBILITY_DEFECT", disposition: "OPEN" }];
  assert.equal(repairDisposition({ findings, iterations: 0 }).action, "REPAIR_AND_RECAPTURE");
  assert.equal(repairDisposition({ findings, iterations: 1, previousBlockingCount: 1 }).action, "BLOCK_WITH_EVIDENCE");
  assert.equal(
    repairDisposition({ findings: [{ ...findings[0], disposition: "RESOLVED" }], iterations: 2 }).action,
    "VERIFY_FINAL_EVIDENCE",
  );
});
test("baseline debt is accountable and cannot excuse a completion claim or new regression", () => {
  const fixture = experienceFixture();
  fixture.contract.experience.baselineDebt = [
    {
      id: "lens-debt",
      fingerprint: "baseline-v1",
      status: "RENDERED_CONFIRMED",
      baselineArtifacts: [
        {
          path: "MOBILE-READY.png",
          sha256: fixture.evidence.artifacts.find((artifact) => artifact.id === "MOBILE-READY").sha256,
        },
      ],
      repairOwner: "Spatial Experience Refit",
      repairPath: "Known Lens realization repair",
    },
  ];
  fixture.plan.debt = [{ id: "lens-debt", contractId: "phone-lens", scopeUnchanged: true }];
  fixture.evidence.reviews[0].packetDigest = experienceDigest({
    sourceDigest: fixture.plan.sourceDigest,
    contract: fixture.contract,
    artifacts: fixture.evidence.artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
  });
  fixture.evidence.reviews[0].findings = [
    {
      id: "lens-existing",
      classification: "MAJOR_EXPERIENCE_DEFECT",
      contractId: "phone-lens",
      observation: "The existing fallback remains limited by the documented baseline",
      evidenceIds: ["MOBILE-READY"],
      disposition: "UNCHANGED_BASELINE_DEBT",
      debtId: "lens-debt",
      baselineFingerprint: "baseline-v1",
    },
  ];
  assert.equal(fixture.validate().status, "PASS");
  fixture.plan.debt[0].scopeUnchanged = false;
  assert.throws(() => fixture.validate(), /BASELINE_DEBT_NOT_EXEMPT/u);
  fixture.plan.debt[0].scopeUnchanged = true;
  fixture.evidence.completionClaims = ["phone-lens"];
  assert.throws(() => fixture.validate(), /BASELINE_DEBT_NOT_EXEMPT/u);
  delete fixture.evidence.completionClaims;
  fixture.evidence.reviews[0].findings[0].baselineFingerprint = "regressed";
  assert.throws(() => fixture.validate(), /BASELINE_DEBT_NOT_EXEMPT/u);
});
function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}
test("trusted base classification and contracts survive candidate exemption edits", () => {
  const root = mkdtempSync(path.join(tmpdir(), "experience-trust-"));
  try {
    mkdirSync(path.join(root, "testing"));
    mkdirSync(path.join(root, "src/lens"), { recursive: true });
    const registry = {
      contracts: [experienceFixture().contract],
      experiencePolicy: {
        version: 1,
        evidencePath: "Development_Docs/Testing/Product_Experience/candidate-review.json",
      },
    };
    writeFileSync(path.join(root, "testing/contracts.json"), JSON.stringify(registry));
    writeFileSync(path.join(root, "src/lens/Lens.tsx"), "export const Lens = () => <main>Lens</main>;\n");
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "fixture@example.invalid"]);
    git(root, ["config", "user.name", "Fixture"]);
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "base"]);
    const baseSha = git(root, ["rev-parse", "HEAD"]);
    writeFileSync(path.join(root, "testing/contracts.json"), JSON.stringify({ contracts: [] }));
    writeFileSync(path.join(root, "src/lens/Lens.tsx"), "export const Lens = () => <main>Generic page</main>;\n");
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", "candidate exemption"]);
    const candidateSha = git(root, ["rev-parse", "HEAD"]);
    const plan = planProductExperience({
      root,
      baseSha,
      candidateSha,
      changedPaths: ["src/lens/Lens.tsx", "testing/contracts.json"],
    });
    assert.equal(plan.applicable, true);
    assert.deepEqual(plan.contractIds, ["phone-lens"]);
    assert.equal(sourceSnapshot(root, candidateSha).contents.get("src/lens/Lens.tsx").includes("Generic page"), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("fresh tasks automatically discover workflow and governing authority", () => {
  const guidance = readFileSync(new URL("../../AGENTS.md", import.meta.url), "utf8");
  assert.match(guidance, /product-experience-workflow\.md/u);
  const workflow = readFileSync(new URL("../../.agents/product-experience-workflow.md", import.meta.url), "utf8");
  assert.match(workflow, /Sounding Line/u);
  assert.match(workflow, /independent/u);
});

test("stable but disconnected desktop and phone Voyages fail cross-context continuity", () => {
  const fixture = experienceFixture();
  for (const run of fixture.evidence.journeys.filter((run) => run.device === "MOBILE"))
    run.continuity[0] = { id: "voyage", before: "d".repeat(64), atOutcomes: ["d".repeat(64)], after: "d".repeat(64) };
  assert.throws(() => fixture.validate(), /CROSS_DEVICE_CONTINUITY_FAILED/u);
});
test("consumer destination identity must match even when the return restores the original Voyage", () => {
  const fixture = experienceFixture();
  fixture.evidence.journeys[0].continuity[0].atOutcomes = ["d".repeat(64)];
  assert.throws(() => fixture.validate(), /CROSS_PROJECT_JOURNEY_FAILED/u);
});
test("experience DB provisioning matches the existing owned isolation contract", () => {
  const url = experienceDatabaseUrl(process.cwd(), "a".repeat(40), "generic", new Date("2026-10-11T12:34:56.123Z"));
  assert.match(
    url,
    /artifacts\/sounding-line\/generic-aaaaaaaaaaaa\/validation-isolated-20261011-123456123-[a-f0-9]{32}\.db$/u,
  );
});
test("adding roles preserves their verifiable setup without replacing trusted setup", () => {
  const baseline = experienceFixture().contract;
  const proposed = structuredClone(baseline);
  proposed.experience.roleSetup.MODERATOR = {
    witness: { role: "region", name: "Moderator", text: "Verified moderator fixture" },
  };
  assert.ok(mergeExperienceContracts([baseline], [proposed])[0].experience.roleSetup.MODERATOR);
  proposed.experience.roleSetup.PLAYER.witness.text = "Unrelated shared identity";
  assert.throws(() => mergeExperienceContracts([baseline], [proposed]), /TRUSTED_OBLIGATION_CHANGED/u);
});
test("baseline scope includes used assets and side-effect styles, while unused assets stay unrelated", () => {
  const snapshot = {
    entries: [
      { path: "src/lens/Lens.tsx", blob: "a" },
      { path: "src/lens/theme.css", blob: "b" },
      { path: "public/lens.png", blob: "c" },
      { path: "public/unrelated.png", blob: "d" },
    ],
    contents: new Map([
      ["src/lens/Lens.tsx", 'import "./theme.css"; const image="/lens.png";'],
      ["src/lens/theme.css", "body{}"],
    ]),
  };
  const original = baselineScopeDigest(snapshot, ["src/lens/Lens.tsx"]);
  for (const file of ["src/lens/theme.css", "public/lens.png"]) {
    const changed = structuredClone(snapshot);
    changed.entries.find((entry) => entry.path === file).blob = "changed";
    assert.notEqual(baselineScopeDigest(changed, ["src/lens/Lens.tsx"]), original);
  }
  const unused = structuredClone(snapshot);
  unused.entries.find((entry) => entry.path === "public/unrelated.png").blob = "changed";
  assert.equal(baselineScopeDigest(unused, ["src/lens/Lens.tsx"]), original);
});
test("unused public assets and backend paths inside UI ownership do not force visual proof", () => {
  const snapshot = {
    entries: [{ path: "public/unused.png", blob: "a" }],
    contents: new Map([
      ["src/lens/Lens.tsx", "export const Lens = true;"],
      ["src/lens/maintenance.ts", "export const cleanup = true;"],
    ]),
  };
  for (const file of ["public/unused.png", "src/lens/maintenance.ts"])
    assert.equal(
      classifyExperience({
        changedPaths: [file],
        consumers: affectedConsumers([file], [snapshot]),
        contracts: [experienceFixture().contract],
      }).applicable,
      false,
    );
});
test("HTTP endpoint selection distinguishes dynamic sibling endpoints", () => {
  const snapshot = {
    contents: new Map([
      ["src/app/api/voyage/[id]/lens/route.ts", "export const GET=true"],
      ["src/app/api/voyage/[id]/audit/route.ts", "export const GET=true"],
      ["src/lens/Lens.tsx", "fetch(`/api/voyage/${id}/lens`);"],
    ]),
  };
  assert.deepEqual(affectedConsumers(["src/app/api/voyage/[id]/audit/route.ts"], [snapshot]).surfaces, []);
  assert.deepEqual(affectedConsumers(["src/app/api/voyage/[id]/lens/route.ts"], [snapshot]).surfaces, [
    "src/lens/Lens.tsx",
  ]);
});
