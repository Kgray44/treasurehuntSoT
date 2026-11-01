import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import "./homeport-journey-migration.test.mjs";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  R8_FORMAT,
  R8_FORMAT_OVERLAY_PATHS,
  r8FormatEvidencePlan,
} from "../../scripts/sounding-line/experience-r8-format.mjs";
import { CROSSDECK_R8 } from "../../scripts/sounding-line/experience-r8.mjs";
import {
  buildEvidenceObligations,
  trackedEntries,
  verificationObligationGroups,
} from "../../scripts/sounding-line/ordinary.mjs";
import { validateExceptionSubmissionEvidence } from "../../scripts/sounding-line/experience-exception.mjs";
import { verifyTrustedExperienceAttestation } from "../../scripts/sounding-line/experience-attestation.mjs";
import {
  affectedConsumers,
  classifyExperience,
  experienceDigest,
  planProductExperience,
  pr776ContinuationReviewBindings,
  validatePR776HostedReviewContext,
  validateRoomsSurfaceNavigation,
  repairDisposition,
  REVIEW_DIMENSIONS,
  sourceSnapshot,
  validateExperienceContract,
  validateExperienceEvidence,
  baselineScopeDigest,
  mergeExperienceContracts,
} from "../../scripts/sounding-line/product-experience.mjs";
import {
  experienceDatabaseUrl,
  experienceChangedPaths,
  roleSetupAuthenticationResume,
} from "../../scripts/sounding-line/experience-browser.mjs";

test("experience and obligation readers preserve real Git output larger than the default buffer", async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "experience-large-diff-"));
  assert(root.startsWith(path.resolve(tmpdir()) + path.sep));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (args, options = {}) => execFileSync("git", args, { cwd: root, encoding: "utf8", ...options }).trim();
  git(["init", "--quiet"]);
  const emptyTree = git(["mktree"], { input: "" });
  const blob = git(["hash-object", "-w", "--stdin"], { input: "synthetic fixture\n" });
  const expected = Array.from({ length: 8192 }, (_, i) => `file-${String(i).padStart(5, "0")}-${"x".repeat(180)}.txt`);
  const populatedTree = git(["mktree"], { input: expected.map((name) => `100644 blob ${blob}\t${name}\n`).join("") });
  assert(Buffer.byteLength(expected.join("\n") + "\n") > 1024 * 1024);
  // This reproduces the faulty calling boundary without a product plan/browser.
  assert.throws(() => git(["diff", "--name-only", "--no-renames", emptyTree, populatedTree]), { code: "ENOBUFS" });
  const actual = experienceChangedPaths(root, emptyTree, populatedTree);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, expected.length);
  assert.throws(() => git(["ls-tree", "-rz", populatedTree]), { code: "ENOBUFS" });
  assert.deepEqual(
    trackedEntries(root, populatedTree),
    expected.map((file) => ({ path: file, type: "blob", blob })),
  );
  const plan = {
    mode: "ordinary",
    candidateSha: populatedTree,
    safetyPaths: [],
    lintPaths: [],
    selected: { unitTests: [], browserTests: [] },
    migrationRequired: false,
    buildRequired: false,
  };
  const obligations = await buildEvidenceObligations(root, plan);
  assert.equal(obligations.length, verificationObligationGroups(plan).length);
  const privacy = obligations.find((entry) =>
    entry.commandLabels.some((label) => label.includes("private-content/scan")),
  );
  assert(privacy);
  assert.deepEqual(
    privacy.fingerprint.semanticClosureMembers,
    expected.map((file) => `${file}@${blob}`),
  );
  assert.throws(() => experienceChangedPaths(root, "missing-revision", populatedTree));
});

test("authentication reuse recognizes only canonical login and a bounded same-origin return", () => {
  const steps = [
    { action: "fill", role: "textbox", name: "Email or Player name", value: "synthetic@example.test" },
    { action: "fill", role: "textbox", name: "Password", value: "synthetic" },
    { action: "click", role: "button", name: "Sign in" },
    { action: "wait", role: "navigation", name: "Setup ready" },
    { action: "click", role: "button", name: "Register this context" },
  ];
  for (const route of ["/sign-in", "/player/sign-in"])
    assert.deepEqual(
      roleSetupAuthenticationResume({ entryPoint: `${route}?returnTo=%2Fsetup%3Fcontext%3Downed`, steps }),
      { stepCount: 3, entryPoint: "/setup?context=owned" },
    );
  assert.equal(
    roleSetupAuthenticationResume({
      entryPoint: "/sign-in?returnTo=%2Fsetup",
      steps: [{ ...steps[0], name: "Unrecognized login" }, ...steps.slice(1)],
    }),
    null,
  );
  for (const target of [
    "https://outside.invalid/setup",
    "//outside.invalid/setup",
    "/\\outside.invalid",
    "/%2foutside.invalid",
    "/setup\u0000",
    "/sign-in",
    "/player/sign-in",
  ])
    assert.equal(
      roleSetupAuthenticationResume({ entryPoint: `/sign-in?returnTo=${encodeURIComponent(target)}`, steps }),
      null,
    );
  for (const entryPoint of [
    "/sign-in",
    "/custom-login?returnTo=%2Fsetup",
    "/sign-in?returnTo=%2Fsetup&returnTo=%2Fother",
    "/sign-in?returnTo=%2Fsetup&return=%2Fother",
    "//outside.invalid/sign-in?returnTo=%2Fsetup",
  ])
    assert.equal(roleSetupAuthenticationResume({ entryPoint, steps }), null);
  assert.equal(steps.length, 5);
});

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

test("editorial deferral cannot exempt an unbound contract or a new functional blocker", () => {
  const f = experienceFixture();
  f.evidence.reviews[0].findings.push({
    id: "NEW-FUNCTIONAL-BLOCKER",
    classification: "MAJOR_EXPERIENCE_DEFECT",
    contractId: f.contract.id,
    observation: "Synthetic unreadable current passage remains a functional blocker.",
    evidenceIds: ["MOBILE-READY"],
    disposition: "FUNCTIONAL_RESOLVED_EDITORIAL_DEFERRED",
  });
  assert.throws(() => f.validate(), /R20_ADJUDICATION_TRUSTED_SCOPE_REQUIRED/u);
  f.evidence.reviews[0].findings[0].disposition = "UNRESOLVED";
  assert.throws(() => f.validate(), /BLOCKING_FINDING/u);
});

test("finite submission validates ordinary committed media without an evidence checkout and review needs all materialized bytes", async (t) => {
  const directory = mkdtempSync(path.join(tmpdir(), "exception-evidence-roots-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, "candidate");
  mkdirSync(root);
  const git = (cwd, ...args) =>
    execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const f = experienceFixture();
  f.plan.evidencePath = "candidate-review.json";
  for (const [file, bytes] of f.bytes) writeFileSync(path.join(root, file), bytes);
  writeFileSync(path.join(root, f.plan.evidencePath), JSON.stringify(f.evidence));
  git(root, "init", "-q");
  git(root, "config", "user.name", "Evidence Fixture");
  git(root, "config", "user.email", "fixture@example.invalid");
  git(root, "add", ".");
  git(root, "commit", "-qm", "synthetic media fixture");
  const candidateSha = git(root, "rev-parse", "HEAD");
  const missingEvidenceRoot = path.join(directory, "no-evidence-checkout");
  writeFileSync(path.join(root, f.evidence.artifacts[0].path), "dirty working copy is not committed evidence");
  assert.deepEqual(
    await validateExceptionSubmissionEvidence({
      root,
      plan: f.plan,
      mode: "ordinary",
      candidateSha,
      evidenceRoot: missingEvidenceRoot,
    }),
    f.evidence,
  );
  const full = path.join(directory, "full-evidence");
  git(directory, "clone", "--depth=1", pathToFileURL(root).href, full);
  assert.deepEqual(
    await validateExceptionSubmissionEvidence({ root, plan: f.plan, mode: "review", candidateSha, evidenceRoot: full }),
    f.evidence,
  );
  const sparse = path.join(directory, "sparse-evidence");
  git(directory, "clone", "--depth=1", "--no-checkout", pathToFileURL(root).href, sparse);
  git(sparse, "sparse-checkout", "set", "--no-cone", f.plan.evidencePath);
  git(sparse, "checkout", "--detach", candidateSha);
  await assert.rejects(
    () =>
      validateExceptionSubmissionEvidence({ root, plan: f.plan, mode: "review", candidateSha, evidenceRoot: sparse }),
    /ENOENT/u,
  );
  writeFileSync(path.join(full, f.evidence.artifacts[0].path), "changed media");
  await assert.rejects(
    () => validateExceptionSubmissionEvidence({ root, plan: f.plan, mode: "review", candidateSha, evidenceRoot: full }),
    /ARTIFACT_DIGEST_MISMATCH/u,
  );
});
test("trusted exception keeps eleven truthful and retains every substantive review gate", () => {
  const f = experienceFixture();
  f.plan.exception = {
    id: "PE-X-CROSSDECK-FINAL-VERIFY-20261015",
    recordDigest: "e".repeat(64),
    priorRepairRecaptureAttempts: 11,
    independentReviewOrdinal: 3,
  };
  f.evidence.exception = f.plan.exception;
  f.evidence.reviews[0].iterations = 11;
  f.evidence.reviews[0].independentReviewOrdinal = 3;
  assert.equal(f.validate().status, "PASS");
  f.evidence.reviews[0].iterations = 3;
  assert.throws(() => f.validate(), /HISTORY_OR_REVIEW_ORDINAL_CHANGED/u);
  f.evidence.reviews[0].iterations = 11;
  delete f.evidence.reviews[0].dimensions.hierarchy;
  assert.throws(() => f.validate(), /SUBSTANTIVE_REVIEW_MISSING/u);
});

test("R8 reconciliation validates original review and current replay against separate truthful tuples", () => {
  const f = experienceFixture();
  const originalException = {
    id: CROSSDECK_R8.id,
    recordDigest: CROSSDECK_R8.recordDigest,
    priorRepairRecaptureAttempts: 11,
    independentReviewOrdinal: 7,
  };
  f.evidence.captureArtifactId = R8_FORMAT.captureArtifact;
  f.evidence.reviewArtifactId = R8_FORMAT.reviewArtifact;
  f.evidence.baseSha = R8_FORMAT.baseSha;
  f.evidence.sourceDigest = R8_FORMAT.sourceDigest;
  f.evidence.contractDigest = R8_FORMAT.contractDigest;
  f.evidence.exception = originalException;
  const review = f.evidence.reviews[0];
  review.iterations = 11;
  review.independentReviewOrdinal = 7;
  review.packetDigest = experienceDigest({
    sourceDigest: R8_FORMAT.sourceDigest,
    contract: f.contract,
    artifacts: f.evidence.artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
  });
  const record = {
    version: 1,
    id: R8_FORMAT.id,
    status: "ACTIVE",
    exceptionId: CROSSDECK_R8.id,
    recordDigest: CROSSDECK_R8.recordDigest,
    overlay: R8_FORMAT_OVERLAY_PATHS.map((file) => ({
      path: file,
      oldMode: "100644",
      oldBlob: "a".repeat(40),
      newMode: "100644",
      newBlob: "b".repeat(40),
    })),
    captureSeal: R8_FORMAT.captureSeal,
    reviewSeal: R8_FORMAT.reviewSeal,
    reviewSubmission: R8_FORMAT.reviewSubmission,
    reviewArtifact: { id: R8_FORMAT.reviewArtifact, digest: R8_FORMAT.reviewDigest, runId: R8_FORMAT.reviewRun },
  };
  f.plan.baseSha = "c".repeat(40);
  f.plan.sourceDigest = "d".repeat(64);
  f.plan.contractDigest = R8_FORMAT.contractDigest;
  f.plan.exception = {
    ...originalException,
    nonExecutingReconciliation: {
      version: 1,
      id: R8_FORMAT.id,
      recordDigest: experienceDigest(record),
      originalBaseSha: R8_FORMAT.baseSha,
      originalSourceDigest: R8_FORMAT.sourceDigest,
      originalPublicationCandidateSha: R8_FORMAT.publicationCandidateSha,
      currentBaseSha: f.plan.baseSha,
      currentSourceDigest: f.plan.sourceDigest,
      overlay: record.overlay,
      captureSeal: record.captureSeal,
      reviewSeal: record.reviewSeal,
      reviewSubmission: record.reviewSubmission,
      reviewArtifact: record.reviewArtifact,
    },
  };
  const result = f.validate();
  assert.equal(result.sourceDigest, f.plan.sourceDigest);
  assert.equal(result.reviewedSourceDigest, R8_FORMAT.sourceDigest);
  assert.equal(r8FormatEvidencePlan(f.plan).candidateSha, R8_FORMAT.publicationCandidateSha);
  delete review.dimensions.hierarchy;
  assert.throws(() => f.validate(), /SUBSTANTIVE_REVIEW_MISSING/u);
  review.dimensions.hierarchy = review.dimensions.composition;
  f.evidence.sourceDigest = f.plan.sourceDigest;
  assert.throws(() => f.validate(), /EVIDENCE_SOURCE_MISMATCH/u);
  f.evidence.sourceDigest = R8_FORMAT.sourceDigest;
  assert.throws(
    () =>
      validateExperienceEvidence({
        plan: f.plan,
        evidence: f.evidence,
        root: "unused",
        automatedOnly: true,
        readArtifact: ({ file }) => f.bytes.get(file),
      }),
    /EVIDENCE_BINDING_MISSING/u,
  );
  const replay = structuredClone(f.evidence);
  replay.baseSha = f.plan.baseSha;
  replay.sourceDigest = f.plan.sourceDigest;
  replay.exception = f.plan.exception;
  assert.equal(
    validateExperienceEvidence({
      plan: f.plan,
      evidence: replay,
      root: "unused",
      automatedOnly: true,
      readArtifact: ({ file }) => f.bytes.get(file),
    }).status,
    "PASS",
  );
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
test("ordinary automatic repair stops at three even when prior work made progress", () => {
  const findings = [{ id: "focus", classification: "ACCESSIBILITY_DEFECT", disposition: "OPEN" }];
  assert.equal(repairDisposition({ findings, iterations: 2, previousBlockingCount: 2 }).action, "REPAIR_AND_RECAPTURE");
  assert.equal(repairDisposition({ findings, iterations: 3, previousBlockingCount: 2 }).action, "BLOCK_WITH_EVIDENCE");
  assert.equal(repairDisposition({ findings, iterations: 11, previousBlockingCount: 2 }).action, "BLOCK_WITH_EVIDENCE");
});

test("final verification action does not waive the current acceptance cap for truthful eleven-attempt history", () => {
  const fixture = experienceFixture();
  fixture.evidence.reviews[0].iterations = 11;
  assert.equal(repairDisposition({ findings: [], iterations: 11 }).action, "VERIFY_FINAL_EVIDENCE");
  assert.throws(() => fixture.validate(), /PRODUCT_EXPERIENCE_REVIEW_UNRESOLVED/u);
});

test("ordinary accepted reviews retain their existing one-through-three boundary", () => {
  for (const iterations of [1, 2, 3]) {
    const fixture = experienceFixture();
    fixture.evidence.reviews[0].iterations = iterations;
    assert.equal(fixture.validate().status, "PASS");
  }
  const fixture = experienceFixture();
  fixture.evidence.reviews[0].iterations = 4;
  assert.throws(() => fixture.validate(), /PRODUCT_EXPERIENCE_REVIEW_UNRESOLVED/u);
});

const isolatedContinuationContexts = new WeakSet();
function continuationFixture(
  t,
  {
    candidateOnly = false,
    changeRecord,
    changePrevious,
    changeCandidateHistory = false,
    unrelatedCandidate = false,
  } = {},
) {
  if (!isolatedContinuationContexts.has(t)) {
    isolatedContinuationContexts.add(t);
    const names = [
      "GITHUB_ACTIONS",
      "GITHUB_EVENT_PATH",
      "GITHUB_EVENT_NAME",
      "GITHUB_REPOSITORY",
      "GITHUB_SHA",
      "GITHUB_REF",
      "SOUNDING_LINE_PR_NUMBER",
    ];
    const saved = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    for (const name of names) delete process.env[name];
    t.after(() => {
      for (const name of names) {
        if (saved[name] === undefined) delete process.env[name];
        else process.env[name] = saved[name];
      }
    });
  }
  const f = experienceFixture();
  const root = mkdtempSync(path.join(tmpdir(), "experience-continuation-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "testing"));
  mkdirSync(path.join(root, "src/lens"), { recursive: true });
  mkdirSync(path.join(root, "Development_Docs/Engineering"), { recursive: true });
  const registry = {
    contracts: [f.contract],
    experiencePolicy: {
      version: 1,
      evidencePath: "Development_Docs/Testing/Product_Experience/candidate-review.json",
      attestationPolicy: { required: true, trustedReviewActors: ["Fixture"] },
    },
  };
  const saveRegistry = () => writeFileSync(path.join(root, "testing/contracts.json"), JSON.stringify(registry));
  saveRegistry();
  writeFileSync(path.join(root, "src/lens/Lens.tsx"), "export const Lens = () => <main>Lens</main>;\n");
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "fixture@example.invalid"]);
  git(root, ["config", "user.name", "Fixture"]);
  const commit = (message) => {
    git(root, ["add", "."]);
    git(root, ["commit", "--quiet", "-m", message]);
    return git(root, ["rev-parse", "HEAD"]);
  };
  const ancestorCandidate = commit("prior blocked candidate");
  const previous = {
    status: "BLOCKED",
    iterations: 3,
    repairAction: "BLOCK_WITH_EVIDENCE",
    contractId: f.contract.id,
    candidateSha: ancestorCandidate,
    baseSha: ancestorCandidate,
    sourceDigest: "b".repeat(64),
    contractDigest: experienceDigest([f.contract]),
    findings: ["landmark", "heading"].map((id) => ({
      id,
      contractId: f.contract.id,
      classification: "ACCESSIBILITY_DEFECT",
      disposition: "UNRESOLVED",
    })),
  };
  changePrevious?.(previous);
  const historyPath = "Development_Docs/Engineering/blocked-review.json";
  const historyBytes = Buffer.from(JSON.stringify(previous));
  writeFileSync(path.join(root, historyPath), historyBytes);
  const record = {
    id: "fixture-review-4",
    repository: "Kgray44/treasurehuntSoT",
    prNumber: 766,
    contractId: f.contract.id,
    ancestorCandidate,
    blockedReview: { path: historyPath, sha256: createHash("sha256").update(historyBytes).digest("hex") },
  };
  changeRecord?.(record);
  if (!candidateOnly) registry.experiencePolicy.reviewContinuation = record;
  saveRegistry();
  const baseSha = commit("protected continuation authority");
  if (unrelatedCandidate) git(root, ["checkout", "--quiet", "--orphan", "unrelated-candidate"]);
  if (candidateOnly) registry.experiencePolicy.reviewContinuation = record;
  saveRegistry();
  if (changeCandidateHistory) writeFileSync(path.join(root, historyPath), "candidate rewrote historical review\n");
  writeFileSync(path.join(root, "src/lens/Lens.tsx"), "export const Lens = () => <main>Repaired Lens</main>;\n");
  const candidateSha = commit("current repaired candidate");
  const plan = (options = {}) =>
    planProductExperience({
      root,
      baseSha,
      candidateSha,
      prNumber: 766,
      changedPaths: ["src/lens/Lens.tsx"],
      ...options,
    });
  const install = (value = plan()) => {
    Object.assign(f.plan, value);
    for (const key of ["baseSha", "sourceDigest", "contractDigest"]) f.evidence[key] = f.plan[key];
    const review = f.evidence.reviews[0];
    review.packetDigest = experienceDigest({
      sourceDigest: f.plan.sourceDigest,
      contract: value.contracts[0],
      artifacts: f.evidence.artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
    });
    review.iterations = 4;
    if (value.reviewContinuation) {
      const c = value.reviewContinuation;
      review.continuation = {
        id: c.id,
        policyDigest: c.policyDigest,
        prNumber: c.prNumber,
        previousReviewSha256: c.previousReviewSha256,
        iterations: 4,
        baseSha: value.baseSha,
        sourceDigest: value.sourceDigest,
      };
      review.findings = c.previousFindings.map((finding) => ({
        ...finding,
        contractId: f.contract.id,
        observation: "The prior semantic defect is evidenced in the preserved third review",
        evidenceIds: ["MOBILE-READY"],
        disposition: "RESOLVED",
        repairEvidenceIds: ["MOBILE-READY"],
        resolution: "Current rendered and keyboard evidence demonstrates the corrected semantics",
      }));
    }
    return f;
  };
  return { ...f, root, planCurrent: plan, install, baseSha, candidateSha, record };
}

test("protected continuation permits only cumulative fourth review with retained resolved findings", (t) => {
  const f = continuationFixture(t);
  const current = f.install();
  assert.equal(current.validate().status, "PASS");
  const review = current.evidence.reviews[0];
  for (const iterations of [1, 3, 5]) {
    review.iterations = iterations;
    assert.throws(() => current.validate(), /REVIEW_UNRESOLVED/u);
  }
  review.iterations = 4;
  review.findings[0].disposition = "UNRESOLVED";
  assert.equal(repairDisposition({ findings: review.findings, iterations: 4 }).action, "BLOCK_WITH_EVIDENCE");
  assert.throws(() => current.validate(), /BLOCKING_FINDING/u);
});

test("candidate policy cannot grant a continuation and another PR retains the default cap", (t) => {
  for (const options of [{ candidateOnly: true }, {}]) {
    const f = continuationFixture(t, options);
    const plan = f.planCurrent(options.candidateOnly ? {} : { prNumber: 767 });
    assert.equal(plan.reviewContinuation, undefined);
    assert.throws(() => f.install(plan).validate(), /REVIEW_UNRESOLVED/u);
  }
  const wrongContract = continuationFixture(t, {
    changeRecord: (r) => {
      r.contractId = "another-contract";
    },
  });
  assert.equal(wrongContract.planCurrent().reviewContinuation, undefined);
  assert.throws(() => wrongContract.install().validate(), /REVIEW_UNRESOLVED/u);
});

test("continuation requires exact protected historical bytes and matching prior contract", (t) => {
  const wrongHash = continuationFixture(t, {
    changeRecord: (r) => {
      r.blockedReview.sha256 = "0".repeat(64);
    },
  });
  assert.throws(() => wrongHash.planCurrent(), /REVIEW_CONTINUATION_HISTORY_MISMATCH/u);
  const rewritten = continuationFixture(t, { changeCandidateHistory: true });
  assert.throws(() => rewritten.planCurrent(), /REVIEW_CONTINUATION_HISTORY_MISMATCH/u);
  const wrongContract = continuationFixture(t, {
    changePrevious: (p) => {
      p.contractId = "another-contract";
    },
  });
  assert.throws(() => wrongContract.planCurrent(), /REVIEW_CONTINUATION_HISTORY_INVALID/u);
  const unrelated = continuationFixture(t, { unrelatedCandidate: true });
  assert.throws(
    () => unrelated.planCurrent(),
    (error) => error.status === 1 && error.message.includes("--is-ancestor"),
  );
});

test("fourth review cannot drop or downgrade prior findings or borrow stale current binding", (t) => {
  const f = continuationFixture(t);
  for (const mutate of [
    (r) => {
      r.findings.pop();
    },
    (r) => {
      r.findings[0].classification = "MINOR_POLISH";
    },
    (r) => {
      r.findings.push({ ...r.findings[0], classification: "MINOR_POLISH" });
    },
    (r) => {
      r.continuation.previousReviewSha256 = "0".repeat(64);
    },
    (r) => {
      r.continuation.sourceDigest = "0".repeat(64);
    },
    (r) => {
      r.continuation.baseSha = "0".repeat(40);
    },
    (r) => {
      delete r.continuation;
    },
  ]) {
    const current = f.install();
    mutate(current.evidence.reviews[0]);
    assert.throws(() => current.validate(), /REVIEW_CONTINUATION_BINDING_MISMATCH/u);
  }
  const current = f.install();
  delete current.evidence.reviews[0].findings[0].repairEvidenceIds;
  assert.throws(() => current.validate(), /REPAIR_EVIDENCE_MISSING/u);
});

test("continuation uses ambient preparation PR context and checks actual hosted source identities", (t) => {
  const f = continuationFixture(t);
  const eventPath = path.join(f.root, "hosted-event.json");
  Object.assign(process.env, {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: f.record.repository,
    GITHUB_SHA: f.baseSha,
    GITHUB_REF: "refs/heads/main",
    SOUNDING_LINE_PR_NUMBER: "766",
  });
  const inputs = { pr_number: "766", base_sha: f.baseSha, candidate_sha: f.candidateSha };
  writeFileSync(eventPath, JSON.stringify({ inputs }));
  assert.equal(f.planCurrent({ prNumber: undefined }).reviewContinuation.prNumber, 766);
  for (const change of [{ pr_number: "767" }, { base_sha: "0".repeat(40) }, { candidate_sha: "0".repeat(40) }]) {
    writeFileSync(eventPath, JSON.stringify({ inputs: { ...inputs, ...change } }));
    assert.throws(() => f.planCurrent(), /REVIEW_CONTINUATION_CONTEXT_MISMATCH/u);
  }
  process.env.GITHUB_EVENT_NAME = "pull_request_target";
  const pull = {
    number: 766,
    base: { sha: f.baseSha, repo: { full_name: f.record.repository } },
    head: { sha: f.candidateSha },
  };
  writeFileSync(eventPath, JSON.stringify({ pull_request: pull }));
  assert.equal(f.planCurrent().reviewContinuation.prNumber, 766);
  process.env.GITHUB_REPOSITORY = "another/repository";
  assert.throws(() => f.planCurrent(), /REVIEW_CONTINUATION_CONTEXT_MISMATCH/u);
});

test("valid fourth content review still requires the unmodified real trusted-artifact loader", async (t) => {
  const f = continuationFixture(t);
  const current = f.install();
  assert.equal(current.validate().status, "PASS");
  await assert.rejects(
    verifyTrustedExperienceAttestation({ root: f.root, plan: current.plan, evidence: current.evidence }),
    /TRUSTED_ATTESTATION_REQUIRED/u,
  );
});

test("new campaign or claimed owner metadata cannot rebase truthful aggregate eleven under current authority", () => {
  const fixture = experienceFixture();
  const review = fixture.evidence.reviews[0];
  review.iterations = 11;
  review.reviewCampaign = { currentIterations: 1, historicalAggregateIterations: 11, priorHistoryPreserved: true };
  review.proceduralException = { id: "PROPOSED_INACTIVE", ownerApproved: true };
  assert.throws(() => fixture.validate(), /PRODUCT_EXPERIENCE_REVIEW_UNRESOLVED/u);
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
test("fresh automated replay rechecks accessibility, timing and consumer continuity", () => {
  const fixture = experienceFixture();
  fixture.evidence.reviews = [];
  const verify = () =>
    validateExperienceEvidence({
      root: "unused",
      plan: fixture.plan,
      evidence: fixture.evidence,
      automatedOnly: true,
      readArtifact: ({ file }) => fixture.bytes.get(file),
    });
  assert.equal(verify().status, "PASS");
  fixture.evidence.journeys[0].accessibility.overflow = true;
  assert.throws(verify, /ACCESSIBILITY_OR_RESPONSIVE_DEFECT/u);
  fixture.evidence.journeys[0].accessibility.overflow = false;
  fixture.evidence.journeys[0].continuity[0].atOutcomes = ["d".repeat(64)];
  assert.throws(verify, /CROSS_PROJECT_JOURNEY_FAILED/u);
});
test("dynamic HTTP actions select plausible static endpoints without unrelated suffix widening", () => {
  const snapshot = {
    contents: new Map([
      ["src/app/api/invitations/accept/route.ts", "export const POST=true"],
      ["src/app/api/invitations/decline/route.ts", "export const POST=true"],
      ["src/ceremony/InvitationCeremony.tsx", "fetch(`/api/invitations/${action}`);"],
    ]),
  };
  for (const action of ["accept", "decline"])
    assert.deepEqual(affectedConsumers([`src/app/api/invitations/${action}/route.ts`], [snapshot]).surfaces, [
      "src/ceremony/InvitationCeremony.tsx",
    ]);
});

// Model/source checks only; this does not consume a product review or run a browser.
const pr776HistoryUrl = new URL(
  "../../Development_Docs/Engineering/Product_Experience_PR776_Review3_20261025.original.json",
  import.meta.url,
);
function pr776BindingsFixture() {
  const registry = JSON.parse(readFileSync(new URL("../../testing/contracts.json", import.meta.url), "utf8"));
  const record = registry.experiencePolicy.pr776ReviewContinuation;
  const bytes = readFileSync(pr776HistoryUrl);
  return { record, bytes, ids: record.reviewOrdinals.map((row) => row.contractId) };
}
test("PR776 fixed successor preserves all32 prior rows and requires nine fourth plus23 second reviews", () => {
  const f = pr776BindingsFixture();
  const binding = pr776ContinuationReviewBindings(f.record, f.bytes, f.ids);
  assert.equal(binding.reviews.length, 32);
  assert.equal(binding.reviews.filter((row) => row.iterations === 4).length, 9);
  assert.equal(binding.reviews.filter((row) => row.iterations === 2).length, 23);
  assert.equal(binding.reviews.filter((row) => row.previousStatus === "ACCEPTED").length, 30);
  assert.deepEqual(binding.reviews.flatMap((row) => row.previousFindings.map((finding) => finding.id)).sort(), [
    "PR776-FINAL-MOBILE-SURFACES-OBSCURE-ROOM",
    "PR776-FINAL-WORKSPACE-CREATION-CONTRAST",
  ]);
});
test("PR776 successor rejects rewritten history, fifth/reset scope and omitted/added contracts", () => {
  const f = pr776BindingsFixture();
  const changed = Buffer.from(f.bytes);
  changed[changed.length - 2] ^= 1;
  assert.throws(() => pr776ContinuationReviewBindings(f.record, changed, f.ids), /HISTORY_MISMATCH/u);
  for (const value of [1, 3, 5]) {
    const record = structuredClone(f.record);
    record.reviewOrdinals[0].requiredIterations = value;
    assert.throws(() => pr776ContinuationReviewBindings(record, f.bytes, f.ids), /CONTINUATION_INVALID/u);
  }
  for (const ids of [f.ids.slice(1), [...f.ids, "unrelated-contract"], [...f.ids.slice(1), f.ids[1]]])
    assert.throws(() => pr776ContinuationReviewBindings(f.record, f.bytes, ids), /HISTORY_INVALID/u);
});
test("PR776 fourth/second validator keeps all17 dimensions, current packets and unresolved finding rejection", () => {
  const history = pr776BindingsFixture();
  const binding = pr776ContinuationReviewBindings(history.record, history.bytes, history.ids);
  for (const row of binding.reviews) {
    const f = experienceFixture();
    f.contract.id = row.contractId;
    f.plan.contractIds = [row.contractId];
    f.plan.pr776ReviewContinuation = binding;
    for (const entry of [...f.evidence.artifacts, ...f.evidence.journeys, ...f.evidence.reviews])
      entry.contractId = row.contractId;
    const review = f.evidence.reviews[0];
    review.iterations = row.iterations;
    review.packetDigest = experienceDigest({
      sourceDigest: f.plan.sourceDigest,
      contract: f.contract,
      artifacts: f.evidence.artifacts.map(({ id, sha256 }) => ({ id, sha256 })),
    });
    review.continuation = {
      id: row.id,
      policyDigest: row.policyDigest,
      prNumber: row.prNumber,
      previousReviewSha256: row.previousReviewSha256,
      iterations: row.iterations,
      baseSha: f.plan.baseSha,
      sourceDigest: f.plan.sourceDigest,
    };
    review.findings = row.previousFindings.map((finding) => ({
      ...finding,
      contractId: row.contractId,
      disposition: "RESOLVED",
      observation: "The preserved prior blocker is represented without downgrading its classification",
      evidenceIds: ["MOBILE-READY"],
      repairEvidenceIds: ["MOBILE-READY"],
      resolution: "Synthetic validator fixture resolves the historical finding with current fixture evidence",
    }));
    assert.equal(f.validate().status, "PASS");
    const dimension = REVIEW_DIMENSIONS[0],
      judgment = review.dimensions[dimension];
    delete review.dimensions[dimension];
    assert.throws(() => f.validate(), /SUBSTANTIVE_REVIEW_MISSING/u);
    review.dimensions[dimension] = judgment;
    const packet = review.packetDigest;
    review.packetDigest = "0".repeat(64);
    assert.throws(() => f.validate(), /REVIEW_PACKET_MISMATCH/u);
    review.packetDigest = packet;
    for (const iterations of [1, 3, 5]) {
      review.iterations = iterations;
      assert.throws(() => f.validate(), /REVIEW_(?:CONTINUATION_BINDING_MISMATCH|UNRESOLVED)/u);
    }
    review.iterations = row.iterations;
    if (review.findings.length) {
      review.findings[0].disposition = "OPEN";
      assert.throws(() => f.validate(), /BLOCKING_FINDING/u);
    }
    review.status = "BLOCKED";
    assert.throws(() => f.validate());
  }
});
test("Rooms fixed navigation validates only one Desktop overlay close while retaining all mobile states", () => {
  const contract = {
    id: "parallax.rooms-and-surfaces.experience",
    experience: { roles: ["CREATOR"], devices: ["DESKTOP", "MOBILE"], motion: {} },
  };
  const journey = {
    id: "creator-named-rooms-surface-snap-and-return",
    roles: ["CREATOR"],
    steps: [
      {},
      {},
      {},
      {},
      {},
      { action: "assert", state: "SURFACE_SNAPPED" },
      { action: "click", role: "button", name: "Toggle spatial overlays", devices: ["DESKTOP"], kind: "navigation" },
      { action: "click", role: "combobox", name: "Environment" },
    ],
  };
  assert.deepEqual(validateRoomsSurfaceNavigation(contract, journey), { index: 6 });
  for (const mutate of [
    (c, j) => {
      j.steps[6].devices = ["MOBILE"];
    },
    (c, j) => {
      j.steps[6].devices = ["DESKTOP", "MOBILE"];
    },
    (c, j) => {
      j.steps[6].state = "ROOM_OFFICE";
    },
    (c, j) => {
      j.steps[6].when = true;
    },
    (c, j) => {
      j.steps[6].name = "Arbitrary control";
    },
    (c, j) => {
      j.steps[5].state = "OTHER";
    },
    (c, j) => {
      j.steps[7].name = "Other";
    },
    (c, j) => {
      j.steps.push({ devices: ["DESKTOP"] });
    },
    (c) => {
      c.experience.roles = ["PLAYER"];
    },
    (c) => {
      c.id = "other-contract";
    },
  ]) {
    const c = structuredClone(contract),
      j = structuredClone(journey);
    mutate(c, j);
    assert.throws(() => validateRoomsSurfaceNavigation(c, j), /ROOMS_SURFACE_NAVIGATION_INVALID/u);
  }
});

test("legacy Reach positive and cap stay fourth even without a per-row ordinal property", (t) => {
  const f = continuationFixture(t),
    plan = f.planCurrent();
  delete plan.reviewContinuation.iterations;
  const current = f.install(plan);
  assert.equal(current.validate().status, "PASS");
  for (const count of [1, 3, 5]) {
    current.evidence.reviews[0].iterations = count;
    assert.throws(() => current.validate(), /REVIEW_(?:CONTINUATION_BINDING_MISMATCH|UNRESOLVED)/u);
  }
});
test("PR776 hosted continuation rejects fork heads and wrong context while dispatch stays exact", () => {
  const record = pr776BindingsFixture().record,
    base = "a".repeat(40),
    head = "b".repeat(40);
  const env = {
    GITHUB_EVENT_NAME: "pull_request_target",
    GITHUB_REPOSITORY: record.repository,
    GITHUB_SHA: base,
    GITHUB_REF: "refs/heads/main",
  };
  const event = {
    pull_request: {
      number: 776,
      base: { sha: base, repo: { full_name: record.repository } },
      head: { sha: head, repo: { full_name: record.repository } },
    },
  };
  assert.doesNotThrow(() => validatePR776HostedReviewContext(record, base, head, env, event));
  for (const mutate of [
    (e, v) => {
      v.pull_request.head.repo.full_name = "another-owner/fork";
    },
    (e, v) => {
      v.pull_request.base.repo.full_name = "another-owner/fork";
    },
    (e, v) => {
      v.pull_request.head.sha = "c".repeat(40);
    },
    (e) => {
      e.GITHUB_REF = "refs/heads/untrusted";
    },
    (e, v) => {
      v.pull_request.number = 777;
    },
  ]) {
    const e = structuredClone(env),
      v = structuredClone(event);
    mutate(e, v);
    assert.throws(() => validatePR776HostedReviewContext(record, base, head, e, v), /CONTEXT_MISMATCH/u);
  }
  const dispatch = { ...env, GITHUB_EVENT_NAME: "workflow_dispatch" };
  const input = { inputs: { pr_number: "776", candidate_sha: head, base_sha: base } };
  assert.doesNotThrow(() => validatePR776HostedReviewContext(record, base, head, dispatch, input));
  input.inputs.candidate_sha = "c".repeat(40);
  assert.throws(() => validatePR776HostedReviewContext(record, base, head, dispatch, input), /CONTEXT_MISMATCH/u);
});
