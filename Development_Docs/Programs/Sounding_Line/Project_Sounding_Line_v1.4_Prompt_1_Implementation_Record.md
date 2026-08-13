---
title: Project Sounding Line v1.4 Prompt 1 Implementation Record
audience: engineering
status: shadow-foundation-complete
canonical_for: sounding-line-v14-prompt-1-implementation
last_reviewed: 2026-08-13
---

# Project Sounding Line v1.4 Prompt 1 Implementation Record

## Base and authority boundary

The implementation branch is `codex/sounding-line-v1.4-mainline-throughput`,
created from fetched `origin/main` `0055d012a121a8950b7fa70d371d5eafc6223d10`.
The current v1.3 planner, finalizer, protected binding, workflows, protected
context, and `RELEASE_GO` rules are unchanged. No authority workflow was
dispatched.

## Implemented foundation

- `scripts/sounding-line/v14/foundation.mjs` implements versioned fingerprints,
  deterministic canonical digests, complete/incomplete contract closure,
  explicit dispositions, immutable lineage, legacy reconstruction, conservative
  impact classification, current-vs-shadow comparison, prepared manifests,
  tree identities, and cleanup validation.
- `scripts/sounding-line/v14-shadow-plan.mjs` is the local-only shadow command.
- `scripts/sounding-line/v14/synthetic-tree.mjs` is the local synthetic-tree
  primitive. `prepared-benchmark.mjs` measures a local immutable-copy transport
  prototype.
- `testing/impact-map.json` adds eight truthful contract-to-suite mappings
  already declared by the governed suite registry. `testing/v14/contract-map-debt.json`
  records the remaining 19 unprotected contracts as fail-closed debt instead of
  assigning speculative coverage.
- `tests/sounding-line/v14/foundation.test.mjs` provides focused proof for
  fingerprints, dispositions, lineage, legacy reconstruction, impact fallback,
  shadow comparison, layer corruption, tree equality/train conflict, and cleanup
  provenance.

This materially addresses SL14-EP-001, SL14-EP-002, SL14-SI-001, SL14-SI-002,
SL14-SE-001, SL14-LE-001, SL14-LE-002, SL14-IM-001, SL14-IM-002, SL14-PL-001,
SL14-PL-002, SL14-TI-001, SL14-MT-001, SL14-MT-002, SL14-PB-002, and SL14-SM-001.

## Contract-map coverage

Prompt 0 baseline: 475 contracts, 448 mappings, 27 unmapped.

Prompt 1: 475 contracts, 456 mappings, 19 unmapped, and 19 explicit
`NO_CURRENT_TEST_PROTECTOR` debt entries. The remaining debt is intentionally
not represented as false readiness; any affected debt contract expands shadow
selection.

## Prepared-layer measurement

The committed benchmark report is
`Project_Sounding_Line_v1.4_Prompt_1_Prepared_Layer_Benchmark.json`.

It measured local filesystem-copy identity/restore/verification only: dependency
input (1 file, 381,300 bytes) took 4.51 ms normal copy, 3.62 ms create, 3.23 ms
restore, and 1.49 ms verification; Prisma input (121 files, 724,944 bytes) took
228.85 ms normal copy, 264.86 ms create, 221.69 ms restore, and 43.53 ms
verification. Both content verifications passed. These measurements do not make
any npm-ci, compression, GitHub cache, artifact transfer, or hosted-runner
throughput claim.

## Intentional Prompt 2+ work

The final amendment must select field names, policy-specific semantic closures,
the always-fresh spine, release-candidate closure, receipt persistence and
signing, workflow transport, GitHub tree equality, train scheduling, cache
attestation, dashboard telemetry, self-hosted trust/cleanup, and any authority
cutover. Prompt 1 deliberately does not wire any shadow output into current
acceptance.
