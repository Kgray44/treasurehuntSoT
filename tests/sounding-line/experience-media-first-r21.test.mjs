// Synthetic review provenance only; no media capture, grant or provider writes.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { CURRENT_R20, R20_SCOPE } from "../../scripts/sounding-line/experience-current-r20.mjs";
import { REVIEW_DIMENSIONS } from "../../scripts/sounding-line/product-experience.mjs";
import { PAIRED_CASES, PAIRED_CONTRACTS } from "../../scripts/sounding-line/experience-paired.mjs";
import {
  R21_ID,
  R21_MEDIA_PROTOCOL,
  r21ReviewProvenanceBinding,
  validateR21MediaFirstReview,
} from "../../scripts/sounding-line/experience-media-first-r21.mjs";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const now = new Date("2026-10-20T14:11:00Z");
function fixture() {
  const created = Date.parse("2026-10-20T13:59:00Z").toString(16).padStart(12, "0");
  const reviewer = `${created.slice(0, 8)}-${created.slice(8)}-7222-b444-555555555555`;
  const plan = {
    sourceDigest: "c".repeat(64),
    contractDigest: R20_SCOPE.approvedContractDigest,
    contractIds: [...CURRENT_R20.contractIds],
    contextCount: 38,
    paired: { browserContexts: 6 },
    exception: {
      id: R21_ID,
      version: 21,
      recordDigest: "e".repeat(64),
      independentReviewOrdinal: 11,
      currentSourceAdmission: {
        kind: "CROSSDECK_CURRENT_SOURCE_ADMISSION_1",
        sourceDigest: "c".repeat(64),
        reviewProtocol: structuredClone(R21_MEDIA_PROTOCOL),
        scopeAdjudication: structuredClone(R20_SCOPE),
      },
    },
  };
  const artifacts = plan.contractIds.flatMap((contractId, index) =>
    ["screenshot", "recording"].map((type) => ({
      id: `current-${index}-${type}`,
      contractId,
      type,
      device: "MOBILE",
      state: "READY",
    })),
  );
  const dimensions = (contractId) =>
    Object.fromEntries(
      REVIEW_DIMENSIONS.map((dimension) => [
        dimension,
        {
          observation: `Synthetic media observation for ${contractId} ${dimension}; no product judgment is claimed.`,
          evidenceIds: artifacts
            .filter((artifact) => artifact.contractId === contractId)
            .map((artifact) => artifact.id),
        },
      ]),
    );
  const evidence = {
    captureArtifactId: 12345678901,
    artifacts,
    reviews: plan.contractIds.map((contractId) => ({
      contractId,
      reviewerContext: reviewer,
      builderContext: R21_MEDIA_PROTOCOL.consumerOwnerContext,
      independence: "SEPARATE_CONTEXT",
      sourceInspectionOrder: "EXPERIENCE_BEFORE_SOURCE",
      status: "ACCEPTED",
      dimensions: dimensions(contractId),
    })),
    mediaFirstReview: {
      kind: R21_MEDIA_PROTOCOL.kind,
      reviewerContext: reviewer,
      reviewerTaskPath: "/root/new_media_first_critic",
      builderContext: R21_MEDIA_PROTOCOL.consumerOwnerContext,
      criticCreation: {
        reviewerContext: reviewer,
        createdAtUtc: "2026-10-20T13:59:00Z",
        initialHistory: "NONE",
        selectionVerifiedByContext: R21_MEDIA_PROTOCOL.consumerOwnerContext,
      },
      sourceInspectionStartedAt: "2026-10-20T14:04:00Z",
      canonicalJudgmentsCompletedAt: "2026-10-20T14:10:00Z",
    },
  };
  const first = {
    kind: R21_MEDIA_PROTOCOL.firstPassKind,
    reviewerContext: reviewer,
    reviewerTaskPath: evidence.mediaFirstReview.reviewerTaskPath,
    builderContext: evidence.mediaFirstReview.builderContext,
    criticCreation: structuredClone(evidence.mediaFirstReview.criticCreation),
    sourceDigest: plan.sourceDigest,
    contractDigest: plan.contractDigest,
    captureArtifactId: evidence.captureArtifactId,
    exposureBeforeFreeze: structuredClone(R21_MEDIA_PROTOCOL.exposureBeforeFreeze),
    criticSelection: structuredClone(R21_MEDIA_PROTOCOL.criticSelection),
    genericContexts: 32,
    pairedContexts: 6,
    contexts: 38,
    mediaInspectionStartedAt: "2026-10-20T14:00:00Z",
    observationsFrozenAt: "2026-10-20T14:03:00Z",
    contractObservations: plan.contractIds.map((contractId) => ({ contractId, dimensions: dimensions(contractId) })),
    pairedObservations: PAIRED_CASES.map(({ id: caseId }) => ({
      caseId,
      contexts: Object.fromEntries(
        ["DESKTOP", "MOBILE"].map((device) => {
          const media = ["screenshot", "trace"].map((type) => ({
            id: `${caseId}-${device}-${type}`,
            contractId: PAIRED_CONTRACTS[0],
            device,
            state: `PAIRED_${caseId}`,
            type,
          }));
          artifacts.push(...media);
          return [
            device,
            {
              observation: `Synthetic ${device} paired media observation for ${caseId}.`,
              evidenceIds: media.map((a) => a.id),
            },
          ];
        }),
      ),
    })),
  };
  const seal = () => {
    const content = JSON.stringify(first, null, 2) + "\n";
    evidence.mediaFirstReview.frozenFirstPass = {
      encoding: R21_MEDIA_PROTOCOL.firstPassEncoding,
      content,
      bytes: Buffer.byteLength(content),
      sha256: sha(content),
    };
  };
  seal();
  return { plan, evidence, first, seal, validate: () => validateR21MediaFirstReview(plan, evidence, now) };
}
const rejected = (mutate, code, reseal = true) => {
  const f = fixture();
  mutate(f);
  if (reseal) f.seal();
  assert.throws(f.validate, code);
};
export { fixture as mediaFirstFixture };

test("R21 accepts a byte-frozen independent media phase followed by seven explicit canonical judgments", () => {
  const f = fixture(),
    before = JSON.stringify(f.evidence);
  assert.equal(f.validate().frozenFirstPassSha256, f.evidence.mediaFirstReview.frozenFirstPass.sha256);
  assert.equal(JSON.stringify(f.evidence), before);
});
test("R21 accepts reordered provenance fields while retaining the exact frozen observation bytes", () => {
  const f = fixture(),
    original = f.evidence.mediaFirstReview.frozenFirstPass.content,
    binding = r21ReviewProvenanceBinding(f.plan, f.evidence);
  f.evidence.mediaFirstReview.criticCreation = Object.fromEntries(
    Object.entries(f.evidence.mediaFirstReview.criticCreation).reverse(),
  );
  f.validate();
  assert.equal(f.evidence.mediaFirstReview.frozenFirstPass.content, original);
  assert.deepEqual(r21ReviewProvenanceBinding(f.plan, f.evidence), binding);
});

test("R21 rejects source/contract/fixture/history exposure even when the canonical order flag claims media-first", () => {
  for (const field of Object.keys(R21_MEDIA_PROTOCOL.exposureBeforeFreeze))
    rejected((f) => {
      f.first.exposureBeforeFreeze[field] = true;
    }, /IDENTITY_OR_EXPOSURE_CHANGED/u);
  for (const mutate of [
    (f) => {
      f.evidence.mediaFirstReview.sourceInspectionStartedAt = "2026-10-20T13:59:00Z";
    },
    (f) => {
      f.evidence.mediaFirstReview.sourceInspectionStartedAt = f.first.observationsFrozenAt;
    },
    (f) => {
      f.first.mediaInspectionStartedAt = "2026-10-20T13:25:00Z";
    },
    (f) => {
      f.first.observationsFrozenAt = "invalid";
    },
    (f) => {
      f.evidence.mediaFirstReview.canonicalJudgmentsCompletedAt = "2026-10-20T14:12:00Z";
    },
    (f) => {
      f.evidence.mediaFirstReview.canonicalJudgmentsCompletedAt = "2026-10-20T14:03:30Z";
    },
  ])
    rejected(mutate, /MEDIA_BEFORE_SOURCE_CHRONOLOGY_REQUIRED/u);
});

test("R21 excludes the old critic and exposed builder/maintenance/coordinator contexts", () => {
  for (const context of [...R21_MEDIA_PROTOCOL.excludedReviewerContexts, "critic-without-context-id"])
    rejected((f) => {
      f.evidence.mediaFirstReview.reviewerContext = context;
    }, /DISTINCT_UNEXPOSED_CRITIC_REQUIRED/u);
  for (const taskPath of R21_MEDIA_PROTOCOL.excludedReviewerTaskPaths)
    rejected((f) => {
      f.evidence.mediaFirstReview.reviewerTaskPath = taskPath;
    }, /DISTINCT_UNEXPOSED_CRITIC_REQUIRED/u);
  rejected((f) => {
    f.evidence.mediaFirstReview.criticCreation.createdAtUtc = "2026-10-19T14:00:00Z";
  }, /DISTINCT_UNEXPOSED_CRITIC_REQUIRED/u);
  rejected((f) => {
    f.evidence.mediaFirstReview.criticCreation.initialHistory = "SOURCE_CONTEXT";
  }, /DISTINCT_UNEXPOSED_CRITIC_REQUIRED/u);
  rejected((f) => {
    f.first.criticSelection.distinctFromAllPreviousCritics = false;
  }, /IDENTITY_OR_EXPOSURE_CHANGED/u);
  rejected((f) => {
    f.first.criticSelection.inheritedSourceOrBuilderContext = true;
  }, /IDENTITY_OR_EXPOSURE_CHANGED/u);
  rejected((f) => {
    delete f.evidence.reviews[0].status;
  }, /SEVEN_EXPLICIT_JUDGMENTS/u);
  rejected((f) => {
    f.evidence.reviews[0].status = "SCOPED_PASS";
  }, /SEVEN_EXPLICIT_JUDGMENTS/u);
  rejected((f) => {
    f.evidence.reviews[0].reviewerContext = "01a16000-2222-7222-b444-555555555555";
  }, /SEVEN_EXPLICIT_JUDGMENTS/u);
  rejected((f) => {
    f.evidence.reviews[0].sourceInspectionOrder = "SOURCE_BEFORE_EXPERIENCE";
  }, /SEVEN_EXPLICIT_JUDGMENTS/u);
});

test("R21 preserves exact original first-pass bytes and rejects historical reports/captures as replacements", () => {
  rejected(
    (f) => {
      f.evidence.mediaFirstReview.frozenFirstPass.content += " ";
    },
    /FROZEN_BYTES_CHANGED/u,
    false,
  );
  rejected(
    (f) => {
      f.evidence.mediaFirstReview.frozenFirstPass.bytes++;
    },
    /FROZEN_BYTES_CHANGED/u,
    false,
  );
  rejected(
    (f) => {
      f.evidence.mediaFirstReview.frozenFirstPass.sha256 = "0".repeat(64);
    },
    /FROZEN_BYTES_CHANGED/u,
    false,
  );
  rejected(
    (f) => {
      f.evidence.mediaFirstReview.frozenFirstPass.encoding = "base64";
    },
    /ORIGINAL_FIRST_PASS_REQUIRED/u,
    false,
  );
  for (const digest of R21_MEDIA_PROTOCOL.forbiddenHistoricalObservationDigests)
    rejected(
      (f) => {
        f.evidence.mediaFirstReview.frozenFirstPass.sha256 = digest;
      },
      /ORIGINAL_FIRST_PASS_REQUIRED/u,
      false,
    );
  for (const captureArtifactId of R21_MEDIA_PROTOCOL.forbiddenHistoricalCaptureIds)
    rejected((f) => {
      f.evidence.captureArtifactId = captureArtifactId;
      f.first.captureArtifactId = captureArtifactId;
    }, /IDENTITY_OR_EXPOSURE_CHANGED/u);
  rejected((f) => {
    f.first.sourceDigest = "a".repeat(64);
  }, /IDENTITY_OR_EXPOSURE_CHANGED/u);
});

test("R21 requires all seven contracts and substantive same-contract current-media observations", () => {
  rejected((f) => {
    f.first.contractObservations.pop();
  }, /FIRST_PASS_CONTRACT_SCOPE_CHANGED/u);
  rejected((f) => {
    f.first.contractObservations[1] = structuredClone(f.first.contractObservations[0]);
  }, /FIRST_PASS_CONTRACT_SCOPE_CHANGED/u);
  rejected((f) => {
    delete f.first.contractObservations[0].dimensions.hierarchy;
  }, /FIRST_PASS_DIMENSIONS_REQUIRED/u);
  rejected((f) => {
    f.first.contractObservations[0].dimensions.hierarchy.observation = "ok";
  }, /CURRENT_MEDIA_OBSERVATIONS_REQUIRED/u);
  rejected((f) => {
    f.first.contractObservations[0].dimensions.hierarchy.evidenceIds = ["historical-screenshot"];
  }, /CURRENT_MEDIA_OBSERVATIONS_REQUIRED/u);
  rejected((f) => {
    f.first.contractObservations[0].dimensions.hierarchy.evidenceIds = ["current-1-screenshot"];
  }, /CURRENT_MEDIA_OBSERVATIONS_REQUIRED/u);
  rejected((f) => {
    for (const d of Object.values(f.first.contractObservations[0].dimensions)) d.evidenceIds = ["current-0-screenshot"];
  }, /TRANSITION_MEDIA_REQUIRED/u);
});

test("R21 requires media-first paired observations for every case and both devices", () => {
  rejected((f) => {
    f.first.pairedObservations.pop();
  }, /FIRST_PASS_PAIRED_SCOPE_CHANGED/u);
  rejected((f) => {
    delete f.first.pairedObservations[0].contexts.MOBILE;
  }, /PAIRED_CONTEXTS_REQUIRED/u);
  rejected((f) => {
    f.first.pairedObservations[0].contexts.MOBILE.evidenceIds =
      f.first.pairedObservations[0].contexts.DESKTOP.evidenceIds;
  }, /CURRENT_MEDIA_OBSERVATIONS_REQUIRED/u);
  rejected((f) => {
    f.first.pairedObservations[0].contexts.MOBILE.evidenceIds = ["current-0-screenshot"];
  }, /CURRENT_MEDIA_OBSERVATIONS_REQUIRED/u);
});

test("R21 media protocol cannot be supplied by an old allowance or a mismatched plan", () => {
  for (const mutate of [
    (f) => {
      f.plan.exception.version = 20;
    },
    (f) => {
      f.plan.exception.independentReviewOrdinal = 10;
    },
    (f) => {
      delete f.plan.exception.currentSourceAdmission.reviewProtocol;
    },
    (f) => {
      f.plan.exception.currentSourceAdmission.scopeAdjudication.historicalCaptureReuse = true;
    },
    (f) => {
      f.plan.sourceDigest = "a".repeat(64);
    },
    (f) => {
      f.plan.contextCount = 37;
    },
  ])
    rejected(mutate, /TRUSTED_PROTOCOL_REQUIRED/u);
});
