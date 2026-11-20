// Exact existing synthetic experience fixture, reused without weakening validators.
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  experienceDigest,
  REVIEW_DIMENSIONS,
  validateExperienceEvidence,
} from "../../../scripts/sounding-line/product-experience.mjs";
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
