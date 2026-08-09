---
title: Project Tideglass Phase 1 Test Plan
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-1-test-plan
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 1 test plan

## Acceptance strategy

Tideglass is verified at the lowest valid tier through pure canonicalization/comparator tests and a read-only service port. There is no browser or route. All fixtures are synthetic and tracked; no private Chronicle snapshot is used. Sounding Line owns the authoritative suite, source binding, plan, and acceptance decision. Raw Vitest is diagnostic evidence only.

The suite is registered as `unit.tideglass`, owner `tideglass`, risk `HIGH`, mutation class `READ_ONLY`, and parallel safety `READ_ONLY_PARALLEL`. Its four contracts cover exact immutable edition identity, semantic determinism, safe projection, and read-only invariance.

## Frozen fixture matrix

| Fixture | Required proof                                                             | Test location              |
| ------- | -------------------------------------------------------------------------- | -------------------------- |
| F01     | Property order does not create meaning                                     | `canonicalization.test.ts` |
| F02     | Storage keys, filenames, timestamps, and set order disappear               | `canonicalization.test.ts` |
| F03     | Description/cover changes are presentation metadata                        | `canonicalization.test.ts` |
| F04     | Chapter addition is structural                                             | `comparison.test.ts`       |
| F05     | Stable chapter reorder is a move                                           | `canonicalization.test.ts` |
| F06     | Stable block authored-field change is semantic and value-redacted          | `canonicalization.test.ts` |
| F07     | Recreated equal-text block remains remove/add                              | `comparison.test.ts`       |
| F08     | Explicit mapping alone produces replacement                                | `comparison.test.ts`       |
| F09     | Added choice branch is branching intelligence                              | `comparison.test.ts`       |
| F10     | Stable edge target change is rewired                                       | `comparison.test.ts`       |
| F11     | Alternate terminal block is an ending addition                             | `comparison.test.ts`       |
| F12     | Completion/provider change is completion intelligence                      | `comparison.test.ts`       |
| F13     | Artifact recipient change is artifact intelligence                         | `comparison.test.ts`       |
| F14     | Location/provider change is world intelligence and coordinate-redacted     | `comparison.test.ts`       |
| F15     | Caption addition is accessibility intelligence                             | `comparison.test.ts`       |
| F16     | Static fallback addition is accessibility intelligence                     | `comparison.test.ts`       |
| F17     | Player/Captain requirement changes are setup intelligence                  | `comparison.test.ts`       |
| F18     | Platform/provider requirement changes are compatibility intelligence       | `comparison.test.ts`       |
| F19     | Accepted lossless historical representation has no false change            | `canonicalization.test.ts` |
| F20     | Unknown historical section is partial while safe metadata still compares   | `canonicalization.test.ts` |
| F21     | Duplicate stable identity is unavailable, never arbitrarily matched        | `comparison.test.ts`       |
| F22     | Same exact edition is a complete no-change result                          | `service-security.test.ts` |
| F23     | Reverse add/remove is directional with a distinct comparison ID            | `comparison.test.ts`       |
| F24     | Cross-Chronicle exact IDs fail closed                                      | `service-security.test.ts` |
| F25     | Unauthorized historical edition fails without enumeration                  | `service-security.test.ts` |
| F26     | Shuffled input produces byte-stable semantic output under fixed anchors    | `canonicalization.test.ts` |
| F27     | Complex Voyage spans branch, location, artifact, accessibility, and ending | `comparison.test.ts`       |

## Contract and security coverage

Additional cases prove strict request and snapshot parsing, explicit semantic/policy versions, exact stored-byte checksum verification, independent source/target authorization, missing-ID non-enumeration, redacted retained editions, malformed IDs, client-supplied `mode=creator` denial, oversized input rejection, invalid schema safety, cancellation, and safe failure messages.

Projection tests place sentinel values in storage keys, accepted answers, Creator notes, Captain instructions, and raw coordinates. Neither diagnostic nor public-safe output may contain them. The public-safe foundation must also omit entity IDs and semantic paths.

## Determinism and invariance

- Repeat the same semantic comparison 100 times and assert byte-equal canonical output, record IDs/order, and digest.
- Prove graph add/remove symmetry and direction-distinct identity.
- Prove deterministic receipt identity does not include correlation ID or timing.
- Fingerprint synthetic published rows, a live Voyage with its progression/membership/inventory/events, Wayfarer history, and Community releases before and after service execution.

## Performance review

Use ten chapters, 500 blocks, approximately 490 graph edges, 50 assets, 40 artifacts, and 40 locations. Change facts in four domains. Record normalization, comparison, and total operation duration. The Phase 1 test has a deliberately generous 5,000 ms review bound to detect accidental pathological behavior; it is not a Phase 4 production service-level objective.

## Validation order

1. Raw focused Tideglass tests for rapid repair, marked diagnostic only.
2. TypeScript, formatting, lint, policy, documentation, Feature Catalog, and isolated schema validation.
3. Governed Sounding Line `unit.tideglass` family and subsystem gate.
4. Reconcile against current `origin/main`.
5. Governed Sounding Line mainline-candidate gate from the exact candidate source.
