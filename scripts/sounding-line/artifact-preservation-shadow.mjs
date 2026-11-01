import { canonicalJson, digest } from "./evidence.mjs";
import { planArtifactInvalidation } from "./artifact-dependency-graph.mjs";
import { artifactLogicalKey, artifactContextKey, validateArtifactManifest } from "./artifact-evidence-registry.mjs";

// This joins independently reconstructed source closures with retained bytes.
// It deliberately produces no capability/token and cannot authorize capture skips.
export function planArtifactPreservationShadow({ original, current, manifest, prNumber, spentReviewOrdinals = {} }) {
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0 || [721, 776].includes(prNumber))
    throw new Error("SOUNDING_LINE_ARTIFACT_SHADOW_ORDINARY_SCOPE_REQUIRED");
  if (
    !Array.isArray(current?.requiredCoverage) ||
    !Array.isArray(current?.artifactDefinitions) ||
    current.requiredCoverage.length > 8192 ||
    current.artifactDefinitions.length > 8192 ||
    new Set(current.requiredCoverage.map(artifactLogicalKey)).size !== current.requiredCoverage.length
  )
    throw new Error("SOUNDING_LINE_ARTIFACT_SHADOW_CURRENT_COVERAGE_MISMATCH");
  validateArtifactManifest(manifest, {
    expectedCoverage: original.requiredCoverage,
    spentReviewOrdinals,
    requireComplete: false,
  });
  if (manifest.graphDigest !== original.graph.graphDigest)
    throw new Error("SOUNDING_LINE_ARTIFACT_SHADOW_ORIGINAL_GRAPH_MISMATCH");
  const invalidation = planArtifactInvalidation({
    base: original.graph,
    candidate: current.graph,
    contexts: current.contexts,
  });
  const outcomes = new Map(invalidation.outcomes.map((value) => [value.id, value]));
  const artifacts = new Map(manifest.artifacts.map((value) => [value.id, value]));
  const contexts = new Map();
  for (const receipt of manifest.completedContexts) {
    const selected = receipt.artifactIds.map((id) => artifacts.get(id));
    contexts.set(artifactContextKey(selected[0].logicalKey), { receipt, selected });
  }
  const definitions = new Map(
    current.artifactDefinitions.map((value) => [artifactLogicalKey(value.logicalKey), value]),
  );
  if (definitions.size !== current.artifactDefinitions.length || definitions.size !== current.requiredCoverage.length)
    throw new Error("SOUNDING_LINE_ARTIFACT_SHADOW_CURRENT_COVERAGE_MISMATCH");
  for (const key of current.requiredCoverage)
    if (!definitions.has(artifactLogicalKey(key)))
      throw new Error("SOUNDING_LINE_ARTIFACT_SHADOW_CURRENT_COVERAGE_MISMATCH");
  const plans = current.contexts.map((context) => {
    const interval = outcomes.get(context.id);
    const prior = contexts.get(artifactContextKey(context.requiredCoverage[0]));
    let reason = "NO_COMPLETED_CONTEXT";
    if (prior) {
      const runtime = manifest.runtimeAttestations.find(
        (value) => value.attestationDigest === prior.receipt.runtimeAttestationDigest,
      );
      reason =
        runtime?.mutableStateClass !== "TASK_OWNED_ISOLATED_PER_CONTEXT"
          ? "UNATTESTED_SHARED_RUNTIME"
          : interval.disposition !== "UNCHANGED_COMPLETE_CLOSURE"
            ? interval.disposition
            : "EXACT_CONTEXT_BYTE_AND_DEFINITION_IDENTITY";
      if (reason === "EXACT_CONTEXT_BYTE_AND_DEFINITION_IDENTITY") {
        const priorKeys = new Map(prior.selected.map((value) => [artifactLogicalKey(value.logicalKey), value]));
        if (
          priorKeys.size !== context.requiredCoverage.length ||
          context.requiredCoverage.some((key) => {
            const logical = artifactLogicalKey(key),
              artifact = priorKeys.get(logical),
              definition = definitions.get(logical);
            return (
              !artifact ||
              !definition ||
              definition.contextId !== context.id ||
              artifact.definitionFingerprint !== definition.definitionFingerprint ||
              artifact.dependencyClosureDigest !== interval.originalClosureDigest ||
              definition.dependencyClosureDigest !== interval.currentClosureDigest
            );
          })
        )
          reason = "CONTEXT_DEFINITION_OR_COVERAGE_CHANGED";
      }
    }
    const wouldPreserve = reason === "EXACT_CONTEXT_BYTE_AND_DEFINITION_IDENTITY";
    return {
      contextId: context.id,
      disposition: wouldPreserve ? "WOULD_PRESERVE_COMPLETE_CONTEXT" : "FRESH",
      reason,
      interval,
      // Never rewrite an original identity into the current candidate identity.
      originalContext: wouldPreserve ? prior.receipt : null,
      originalArtifacts: wouldPreserve ? prior.selected : [],
      differentialReviewRequired: true,
      reuseAuthorized: false,
    };
  });
  const body = {
    version: 2,
    mode: "SHADOW",
    originalManifestDigest: manifest.manifestDigest,
    plans,
    qualification: false,
    reuseAuthorized: false,
  };
  return JSON.parse(canonicalJson({ ...body, shadowDigest: digest(body) }));
}
