// Production access is deliberately unavailable until a protected installation
// supplies approved recipient, independent reviewer and verifier access routes.
export { openVerifiedPrivateCaptureView } from "./experience-private-publication.mjs";

import assert from "node:assert/strict";
import { createPrivateCaptureFixtureRealm } from "./experience-private-publication.mjs";
import {
  closeAuthenticatedPrivateCapturePacket,
  isAuthenticatedPrivateCapturePacket,
} from "./experience-private-provider.mjs";
import {
  artifactBytes,
  experienceDigest,
  validateExperienceArtifacts,
  validateExperienceEvidence,
} from "./product-experience.mjs";
import { validatePairedEvidence } from "./experience-paired.mjs";
import { verifyTrustedExperienceAttestation } from "./experience-attestation.mjs";
import { createReviewSubmission } from "./experience-prepare.mjs";
import { exceptionStore, trustedExceptions, sealedReviewIdentity } from "./experience-exception.mjs";

function snapshotOptions(options) {
  const result = { ...options };
  for (const key of ["plan", "evidence", "binding", "reviewBinding"]) {
    if (result[key] === undefined) continue;
    result[key] = structuredClone(result[key]);
    const queue = [result[key]],
      seen = new Set();
    while (queue.length) {
      const value = queue.pop();
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      if (seen.size >= 100000) throw new Error("PRIVATE_CAPTURE_ADAPTER_CONTEXT_LIMIT");
      seen.add(value);
      queue.push(...Object.values(value));
      Object.freeze(value);
    }
  }
  return Object.freeze(result);
}

function validateBinding(binding, plan) {
  for (const key of ["baseSha", "candidateSha", "sourceDigest", "contractDigest"])
    assert.equal(binding[key], plan[key], "PRIVATE_CAPTURE_ADAPTER_PLAN_SOURCE_MISMATCH");
  assert.equal(binding.controllerSha, plan.baseSha, "PRIVATE_CAPTURE_ADAPTER_CONTROLLER_MISMATCH");
  assert.equal(binding.planDigest, experienceDigest(plan), "PRIVATE_CAPTURE_ADAPTER_PLAN_DIGEST_MISMATCH");
}
function validateInnerSource(manifest, plan) {
  for (const key of ["baseSha", "sourceDigest", "contractDigest"])
    assert.equal(manifest[key], plan[key], "PRIVATE_CAPTURE_ADAPTER_INNER_SOURCE_MISMATCH");
  assert.equal(
    experienceDigest(manifest.exception ?? null),
    experienceDigest(plan.exception ?? null),
    "PRIVATE_CAPTURE_ADAPTER_INNER_EXCEPTION_MISMATCH",
  );
}
function validatePolicyRun(packet, plan) {
  assert(
    plan.attestationPolicy?.required && Array.isArray(plan.attestationPolicy.trustedReviewActors),
    "PRIVATE_CAPTURE_ADAPTER_POLICY_REQUIRED",
  );
  assert(
    plan.attestationPolicy.trustedReviewActors.includes(packet.run.actor.login),
    "PRIVATE_CAPTURE_ADAPTER_POLICY_ACTOR_NOT_APPROVED",
  );
  if (plan.exception) assert.equal(packet.run.run_attempt, 1, "PRIVATE_CAPTURE_ADAPTER_EXCEPTION_ATTEMPT_INVALID");
}

// Generated fixture keys and explicit synthetic HTTP transport only. Production
// entry points above remain disabled; no caller JSON can supply trusted access.
export function createAuthenticatedPrivateCaptureFixtureAdapters({
  publicKey,
  privateKey,
  provider,
  reviewRoot,
  actors,
  reviewerActors,
  verifierActors,
  limits,
  fixtureCheckpoint = async () => {},
}) {
  if (
    ![reviewerActors, verifierActors].every(
      (list) => Array.isArray(list) && list.length && list.every((actor) => /^[A-Za-z0-9-]+$/u.test(actor)),
    )
  )
    throw new Error("PRIVATE_CAPTURE_ADAPTER_ROLES_REQUIRED");
  reviewerActors = Object.freeze([...reviewerActors]);
  verifierActors = Object.freeze([...verifierActors]);
  assert.equal(typeof fixtureCheckpoint, "function");
  let activePacket;
  const realm = createPrivateCaptureFixtureRealm({
    publicKey,
    limits,
    loadArtifact: async (options) => {
      if (activePacket) throw new Error("PRIVATE_CAPTURE_ADAPTER_CONCURRENT_VIEW");
      activePacket = await provider.retrieve(options);
      if (!isAuthenticatedPrivateCapturePacket(activePacket))
        throw new Error("PRIVATE_CAPTURE_ADAPTER_AUTHENTICATED_PACKET_REQUIRED");
      return activePacket;
    },
  });
  const access = realm.approveFixtureAccess({ privateKey, actors, reviewRoot });
  let busy = false;
  async function withView(
    { artifactId, binding, root, baselineRoot = root, plan, evidence, signal, actor, mode },
    action,
  ) {
    if (busy) throw new Error("PRIVATE_CAPTURE_ADAPTER_CONCURRENT_VIEW");
    busy = true;
    let view, primary, result;
    try {
      assert(
        (mode === "review" ? reviewerActors : verifierActors).includes(actor),
        "PRIVATE_CAPTURE_ADAPTER_ACTOR_NOT_APPROVED",
      );
      assert.equal(evidence.captureArtifactId, artifactId, "PRIVATE_CAPTURE_ADAPTER_ARTIFACT_MISMATCH");
      view = await realm.openView({ artifactId, expectedBinding: binding, approvedAccess: access, signal });
      validatePolicyRun(activePacket, plan);
      const provenance = {
        id: activePacket.artifact.id,
        digest: activePacket.archiveDigest,
        runId: activePacket.run.id,
        runAttempt: activePacket.run.run_attempt,
      };
      assert.notEqual(actor, activePacket.run.actor.login, "PRIVATE_CAPTURE_ADAPTER_INDEPENDENT_ACTOR_REQUIRED");
      await closeAuthenticatedPrivateCapturePacket(activePacket);
      activePacket = null;
      validateBinding(binding, plan);
      validateInnerSource(view.evidence, plan);
      validateExperienceArtifacts({ root, plan, evidence: view.evidence, readArtifact: view.readArtifact });
      validatePairedEvidence({ root, plan, evidence: view.evidence, read: (file) => view.readArtifact({ file }) });
      const readArtifact = ({ root: requestedRoot, revision, file }) => {
        // Only explicit base-revision reads made by the original validator may
        // use the baseline reader. Missing current files never fall back to Git.
        if (revision === plan.baseSha && requestedRoot === baselineRoot)
          return artifactBytes({ root: baselineRoot, revision: plan.baseSha, file });
        return view.readArtifact({ file });
      };
      const identity = (capture) =>
        experienceDigest({
          artifacts: capture.artifacts.map(({ id, sha256, type, contractId, state, device, role, motionMode }) => ({
            id,
            sha256,
            type,
            contractId,
            state,
            device,
            role,
            motionMode,
          })),
          journeys: capture.journeys,
          pairedEvidence: capture.pairedEvidence ?? null,
        });
      assert.equal(identity(view.evidence), identity(evidence), "PRIVATE_CAPTURE_ADAPTER_CAPTURE_MISMATCH");
      validateExperienceEvidence({ root, baselineRoot, revision: plan.candidateSha, plan, evidence, readArtifact });
      signal?.throwIfAborted();
      result = await action({ capture: view.evidence, readArtifact, provenance });
      await fixtureCheckpoint("action-complete");
    } catch (error) {
      primary = error;
      throw error;
    } finally {
      const failures = [];
      if (activePacket) {
        try {
          await closeAuthenticatedPrivateCapturePacket(activePacket);
        } catch (error) {
          failures.push(error);
        }
        activePacket = null;
      }
      if (view)
        try {
          await view.close();
          await fixtureCheckpoint("view-close-complete");
        } catch (error) {
          failures.push(error);
        }
      busy = false;
      if (failures.length)
        throw new AggregateError(
          [...(primary ? [primary] : []), ...failures],
          "PRIVATE_CAPTURE_ADAPTER_CLEANUP_FAILED",
          { cause: primary ?? failures[0] },
        );
    }
    signal?.throwIfAborted();
    return result;
  }
  return Object.freeze({
    review: (options) => {
      options = snapshotOptions(options);
      return withView({ ...options, mode: "review" }, async () => {
        let exceptionFields = {};
        if (options.plan.exception) {
          if (typeof options.custodyRequest !== "function") throw new Error("PRIVATE_CAPTURE_ADAPTER_CUSTODY_REQUIRED");
          const record = trustedExceptions(options.root, options.plan.baseSha).find(
            (value) => value.id === options.plan.exception.id,
          );
          const store = exceptionStore({ record, request: options.custodyRequest });
          const prepare = await store.read("prepare"),
            seal = await store.read(`review${record.remainingIndependentReviewOrdinal}`);
          assert.equal(
            experienceDigest(seal?.reviewIdentity),
            experienceDigest(sealedReviewIdentity(options.plan, options.evidence)),
          );
          exceptionFields = {
            exception: options.plan.exception,
            exceptionPreparationReservation: prepare.commitSha,
            exceptionReviewSeal: seal.commitSha,
          };
        }
        return createReviewSubmission({
          baseSha: options.plan.baseSha,
          plan: options.plan,
          evidence: options.evidence,
          submittedBy: options.actor,
          exceptionFields,
        });
      });
    },
    verify: (options) => {
      options = snapshotOptions(options);
      return withView({ ...options, mode: "verify" }, async ({ capture, provenance }) =>
        verifyTrustedExperienceAttestation({
          root: options.root,
          plan: options.plan,
          evidence: options.evidence,
          custodyRequest: options.custodyRequest,
          loadArtifact: async (request) => {
            if (request.kind === "capture") {
              assert.equal(request.artifactId, options.artifactId, "PRIVATE_CAPTURE_ADAPTER_ARTIFACT_MISMATCH");
              return { ...capture, trustedArtifact: provenance };
            }
            assert.equal(request.kind, "review");
            assert(options.reviewBinding, "PRIVATE_CAPTURE_ADAPTER_REVIEW_BINDING_REQUIRED");
            let reviewView, primaryReviewError;
            try {
              reviewView = await realm.openView({
                artifactId: request.artifactId,
                expectedBinding: options.reviewBinding,
                approvedAccess: access,
                signal: options.signal,
                kind: "review",
              });
              validateBinding(options.reviewBinding, options.plan);
              validatePolicyRun(activePacket, options.plan);
              validateInnerSource(reviewView.evidence, options.plan);
              const review = JSON.parse(reviewView.readArtifact({ file: "private/review/review.json" }));
              assert(
                reviewerActors.includes(activePacket.run.actor.login),
                "PRIVATE_CAPTURE_ADAPTER_REVIEW_ACTOR_NOT_APPROVED",
              );
              assert.equal(
                review.submittedBy,
                activePacket.run.actor.login,
                "PRIVATE_CAPTURE_ADAPTER_REVIEW_ACTOR_MISMATCH",
              );
              validateInnerSource(review, options.plan);
              assert.equal(experienceDigest(reviewView.evidence.artifacts), experienceDigest(capture.artifacts));
              const trustedArtifact = {
                id: activePacket.artifact.id,
                digest: activePacket.archiveDigest,
                runId: activePacket.run.id,
                runAttempt: activePacket.run.run_attempt,
              };
              await closeAuthenticatedPrivateCapturePacket(activePacket);
              activePacket = null;
              return { ...review, trustedArtifact };
            } catch (error) {
              primaryReviewError = error;
              throw error;
            } finally {
              if (reviewView)
                try {
                  await reviewView.close();
                } catch (cleanupError) {
                  throw new AggregateError(
                    [...(primaryReviewError ? [primaryReviewError] : []), cleanupError],
                    "PRIVATE_CAPTURE_ADAPTER_REVIEW_CLEANUP_FAILED",
                    { cause: primaryReviewError ?? cleanupError },
                  );
                }
            }
          },
        }),
      );
    },
  });
}
