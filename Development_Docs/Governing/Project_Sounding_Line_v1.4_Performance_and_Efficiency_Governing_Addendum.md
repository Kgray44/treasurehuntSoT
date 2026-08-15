---
title: Project Sounding Line v1.4 Performance and Efficiency Governing Addendum
audience: engineering
status: draft-awaiting-final-calibration
canonical_for: sounding-line-v14-performance-efficiency-addendum
last_reviewed: 2026-08-15
---

# PROJECT SOUNDING LINE v1.4

# PERFORMANCE & EFFICIENCY GOVERNING ADDENDUM

## 1. Status, scope, and interpretation

This is a **draft v1.4 governing addendum**, awaiting final hosted calibration
and separately authorized protected-main acceptance. It introduces no Sounding
Line version and is not v1.5. Once accepted, it clarifies and hardens the
already intended v1.4 operating model: fast, safe, minimum-sufficient,
fail-closed mainline qualification.

The machine-readable authority source remains
`testing/sounding-line-authority.json`; the human projection remains
`Sounding_Line_Effective_Authority.md`. This document does not itself change
authority version, protected checks, planner behavior, release authority, or
branch protection. It records the permanent performance rules that future
v1.4 implementation and maintenance work MUST preserve once this addendum is
accepted.

The terms `MUST`, `MUST NOT`, `SHOULD`, and `MAY` are normative. A measurement
labelled **MEASURED** is historical fact, **PROJECTED** is an estimate, and
**PENDING** is not evidence of a completed result.

## 2. Historical basis and calibration record

v1.4 operationalization exposed a gap between the intended semantic planner
and the live hosted wrapper. A Tideglass-only candidate changing
`tests/tideglass/canonicalization.test.ts` had an exact mapping to
`unit.tideglass`, but the wrapper seeded all 38 legacy mainline obligations as
fresh and consequently ran unrelated heavy suites including `browser.helm`.
That defeated Minimum Sufficient Evidence (MSES), produced an early live v1.4
failure at approximately 23m55s, and was slower than the v1.3 ordinary
mainline baseline.

The corrected live MSES path demonstrated that the same semantic interval can
select two fresh obligations--`unit.tideglass` and
`browser.access-sentinel`--while preserving 36 obligations, preserving
`browser.helm`, and executing one meaningful wave. Authoritative GitHub
Actions run `31890545401` completed successfully in 692 seconds (11m32s).
It is the measured source for this addendum.

| Stage / version                             | Fresh evidence | Preserved evidence | Active waves      | Critical worker           | Authority result | Wall time                              | Evidence state |
| ------------------------------------------- | -------------: | -----------------: | ----------------- | ------------------------- | ---------------- | -------------------------------------- | -------------- |
| v1.3 ordinary mainline baseline             |            N/A |                N/A | legacy            | legacy                    | PASS             | 19m40s / 1180s                         | MEASURED       |
| Early live v1.4                             |             38 |                  0 | 6                 | `browser.helm`            | FAIL             | ~23m55s                                | MEASURED       |
| Corrected MSES live v1.4, run `31890545401` |              2 |                 36 | 1 meaningful wave | `browser.access-sentinel` | PASS             | 11m32s / 692s                          | MEASURED       |
| Active-wave optimized topology              |              2 |                 36 | 1                 | `browser.access-sentinel` | projected        | ~9m19s mechanical; ~9m30s conservative | PROJECTED      |
| Final max-speed hosted calibration          |            TBD |                TBD | TBD               | TBD                       | TBD              | PENDING                                | PENDING        |

The approximately 133 seconds (2m13s) between the completed active work and
the old hosted closure was dormant-wave traversal. Removing that latency is a
topology correction, not a reduction in governed evidence.

## 3. Performance is a correctness property

For ordinary mainline qualification, a green result alone is insufficient.
Sounding Line MUST measure dispatch-to-authoritative-decision wall time,
including hosted infrastructure, and MUST retain the material timing evidence.

- The preferred optimized range is 5-7 minutes where the selected evidence
  permits it.
- The primary v1.4 objective is at most 10 minutes from dispatch to the
  authoritative decision.
- The absolute ordinary-mainline ceiling is at most 15 minutes.
- The historical v1.3 comparison baseline is 19m40s.

An ordinary candidate exceeding 15 minutes is a material v1.4 performance
regression unless its sealed plan records a candidate-specific, evidence-based
reason that makes the ceiling physically unattainable. A successful test result
MUST NOT conceal an unexplained performance regression. Legitimate causes,
such as wider semantic impact, invalidated evidence, migration change, risk
floor, dependency identity change, or external queue delay, MUST be recorded.

## 4. Minimum Sufficient Evidence

Ordinary `V14_CANDIDATE` qualification MUST begin from the changed semantic
interval, not from the legacy exhaustive mainline matrix. Fresh execution MAY
contain only direct semantic impact, real execution dependencies, explicitly
required safety sentinels, applicable risk-floor obligations, and conservative
fallback required by genuinely unknown scope.

The exhaustive legacy universe remains available when governance explicitly
requires it, including applicable `release-candidate` qualification. It MUST
NOT silently become the initial evidence set for ordinary mainline work.
Ordinary mainline and release-candidate qualification are intentionally
different selection regimes.

Every ledger obligation considered for a candidate MUST have an auditable
disposition: `FRESH`, `PRESERVED`, `REBOUND`, `INVALIDATED`, or
`CONSERVATIVE_FALLBACK`. Selection rationale MUST retain, where applicable,
`DIRECT_IMPACT`, `DEPENDENCY`, `REQUIRED_SENTINEL`, `RISK_FLOOR`,
`SEMANTICALLY_UNCHANGED`, and `MAPPING_DEBT`. An obligation omitted from fresh
execution MUST NOT disappear; its preservation or exclusion basis MUST remain
explainable in the sealed authority record.

Unknown mapping, contract, ownership, or evidence identity MUST remain
fail-closed. MSES means the minimum evidence that is **provably sufficient**,
not the evidence that is convenient.

## 5. Live evidence preservation and rebinding

When an obligation is semantically unchanged across the exact candidate
interval and its governing fingerprint, policy, schema, toolchain, and other
identity requirements remain valid, accepted evidence SHOULD be preserved or
rebound rather than re-executed. Preservation machinery that exists in policy
or code but is ignored by the hosted ordinary-candidate path is a performance
defect.

A preserved or rebound result MUST retain its exact identity and provenance;
it is not permission to reuse evidence across a semantically different test or
an invalidated policy boundary. If the proof is incomplete, the planner MUST
invalidate or broaden conservatively.

## 6. Execution topology and hosted lanes

A later execution wave is justified only when a real evidence dependency must
complete first or a governed exclusive resource requires serialization. Project
taxonomy, historical grouping, naming, and convenience are not valid reasons
for a later wave. Independent obligations MUST execute in the earliest safe
wave.

Hosted capacity MAY exceed the depth selected by a particular plan. The
sealed plan's active maximum wave MUST determine actual traversal. A plan with
only wave 0 work MUST NOT walk unused waves merely because the static hosted
graph can support them.

An empty static lane MUST complete without emitting a governed test receipt,
inventing evidence, weakening a barrier, or making a skipped aggregate job
poison the overall result. `NO_WORK_REQUIRED` and `WORK_FAILED` are distinct
governed states and MUST remain distinct.

## 7. Dependency preparation, caching, and trust

Large dependency environments SHOULD be reused when their immutable identity
is unchanged rather than rebuilt and transferred for every ordinary candidate.
Reusable preparation MUST be keyed by applicable immutable inputs, including
lockfile, runtime and Node identity, operating-system/platform identity,
preparation-policy identity, and other governed toolchain inputs.

An unchanged exact identity MAY use verified reuse. A changed identity MUST
cause deterministic trusted regeneration. An expected artifact that is absent,
corrupt, expired, or identity-incompatible MUST fail closed; silent mutable
fallback is forbidden.

Caching is an optimization, not a new authority source. Cached or prepared
inputs MUST remain digest-bound and independently verified before use. A warm
cache MAY save time, but it MUST NOT alter what evidence or authority is
trusted. Reuse MUST supply immutable inputs only; databases, server instances,
browser profiles, ports, writable workspaces, and other mutable resources
remain task-owned.

Trusted workflows SHOULD fetch only Git identities and history needed to prove
candidate identity, protected base, ancestry, changed interval, predicted
integration identity, and other explicitly governed predicates. Fetching every
remote branch or tag is not itself a trust guarantee; a narrower fetch is
preferred when it proves the same governed predicates.

## 8. Preparation ownership, isolation, and workers

Each expensive preparation activity MUST have one authoritative owner within a
governed worker path. This includes dependency restoration, Prisma/client
generation, migration, seed, fixture creation, browser provisioning,
production-build preparation, and server initialization. Downstream execution
MAY consume the prepared result but MUST NOT repeat it unless candidate-specific
isolation or correctness requires repetition.

Optimization MUST NOT collapse isolation. Browser and database work requiring
task-owned runtimes MUST retain task-owned databases, servers, browser contexts,
profiles, ports, and writable fixture state. Reusable preparation MAY provide
immutable inputs or task-local clones; it MUST NOT create shared mutable test
state.

Logical governed receipts, not physical runner count, are the authority unit.
Where isolation and governance permit, deterministic batching or shared
immutable preparation MAY reduce physical worker startup while retaining
independent logical receipt identities.

## 9. Access-sentinel case study

In run `31890545401`, `browser.access-sentinel` appeared to consume roughly
5.5 minutes of worker wall time. Its governed suite receipt was roughly 160
seconds, while the three exact Playwright cases themselves took roughly 36
seconds. The balance was infrastructure: checkout, dependency restoration and
verification/copy, Prisma generation, migrations, seed, browser provisioning,
and isolated-runtime preparation.

This establishes that optimizing test count alone is insufficient. Sounding
Line MUST optimize the complete critical path and preserve the sentinel's three
governed cases. It is the rationale for the preparation-ownership and
immutable-reuse rules in this addendum; it does not claim that any currently
in-progress sentinel optimization is complete.

Heavy universal sentinels MUST have a documented governing purpose. When one
dominates ordinary-mainline wall time, Sounding Line SHOULD review whether its
freshness is necessary for the semantic interval, whether its evidence can be
safely preserved, whether preparation can be improved, and whether its cases
are safely concurrent. It MUST NOT weaken sentinel coverage merely to improve a
graph metric.

## 10. Measurement and regression accountability

Hosted performance records SHOULD retain, where obtainable: GitHub queue
delay, runner startup, checkout/fetch, runtime bootstrap, dependency
preparation and verification, publication/retrieval, resource preparation,
suite execution, barriers, finalization, and protected binding. Reporting only
test execution time is inadequate when infrastructure dominates wall time.

Future v1.4 changes MUST NOT reintroduce the following without a separately
justified governing change:

- force-all-legacy-suites-fresh ordinary-mainline behavior;
- unconditional exhaustive ordinary qualification or blanket invalidation;
- unnecessary six-wave traversal or fresh unrelated browser work;
- duplicate expensive preparation or per-candidate rebuild for unchanged
  reusable identity;
- trust based solely on mutable cache state;
- optimistic treatment of unknown semantic scope;
- weakened access-sentinel coverage or protected-main authority; or
- owner or administrator exceptions as a routine ordinary-merge mechanism.

## 11. Maintenance static-gate isolation

v1.4 operationalization exposed a deferred issue: a narrow verification
maintenance repair can be blocked by unrelated pre-existing repository-wide
formatting drift. Future maintenance optimization SHOULD scope static validation
to the affected authoritative surface when that is the correct governed scope.
It MUST NOT weaken static validation, permit affected files to escape
validation, or convert unknown formatting state into success.

## 12. Separation from Project Trim

Project Trim governs Minimum Sufficient Context and Codex context/inference
efficiency. Sounding Line governs verification, evidence, acceptance,
release/merge authority, and mainline performance. The concepts are
complementary--Minimum Sufficient Context and Minimum Sufficient Evidence--but
their authorities are separate. Project Trim is not a prerequisite for Sounding
Line correctness and MUST NOT override Sounding Line evidence requirements.

## 13. POST-IMPLEMENTATION CALIBRATION

This bounded section is the only section intended for the final
post-optimization documentation update. Until a final protected hosted canary
and three-car train proof complete, all values below remain pending.

| Calibration field                             | Final value               |
| --------------------------------------------- | ------------------------- |
| Final max-speed candidate SHA                 | PENDING                   |
| Final authoritative canary run                | PENDING                   |
| Final Tideglass fresh obligations             | PENDING                   |
| Final Tideglass preserved/rebound obligations | PENDING                   |
| Final active waves                            | PENDING                   |
| Final dispatch-to-RELEASE_GO                  | PENDING                   |
| Final dispatch-to-Mainline-Decision           | PENDING                   |
| Final dispatch-to-merge-ready                 | PENDING                   |
| Final three-car train elapsed                 | PENDING                   |
| Serial-equivalent three-car time              | PENDING                   |
| Measured train throughput improvement         | PENDING                   |
| v1.4 <=15m ceiling                            | PENDING FINAL CALIBRATION |
| v1.4 <=10m objective                          | PENDING FINAL CALIBRATION |
| v1.4 5-7m preferred range                     | PENDING FINAL CALIBRATION |

**FINAL POST-ADDENDUM CALIBRATION: PENDING FINAL MAX-SPEED HOSTED CANARY.**

## 14. Related records

- [Sounding Line Effective Authority](Sounding_Line_Effective_Authority.md)
- [Project Sounding Line v1.4 Ratified Requirement Traceability](../Programs/Sounding_Line/Project_Sounding_Line_v1.4_Ratified_Requirement_Traceability.md)
- [Project Sounding Line Performance Budget Report](../Programs/Sounding_Line/Project_Sounding_Line_Performance_Budget_Report.md)
- `testing/sounding-line-authority.json` (machine-readable authority source)
