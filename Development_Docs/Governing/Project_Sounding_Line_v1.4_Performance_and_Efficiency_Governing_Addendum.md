---
title: Project Sounding Line v1.4 Performance and Efficiency Governing Addendum
audience: engineering
status: final-calibrated
canonical_for: sounding-line-v14-performance-efficiency-addendum
last_reviewed: 2026-08-16
---

# PROJECT SOUNDING LINE v1.4

# PERFORMANCE & EFFICIENCY GOVERNING ADDENDUM

## 1. Status, scope, and interpretation

This is a **final-calibrated v1.4 governing addendum**. It introduces no
Sounding Line version and is not v1.5. It records the measured, already-active
v1.4 operating model: fast, safe, minimum-sufficient, fail-closed mainline
qualification.

The machine-readable authority source remains
`testing/sounding-line-authority.json`; the human projection remains
`Sounding_Line_Effective_Authority.md`. This document does not itself change
authority version, protected checks, planner behavior, release authority, or
branch protection. It records the permanent performance rules that future
v1.4 implementation and maintenance work MUST preserve.

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

| Stage / version                                       | Fresh evidence | Preserved evidence | Active waves      | Critical worker           | Authority result | Wall time                              | Evidence state |
| ----------------------------------------------------- | -------------: | -----------------: | ----------------- | ------------------------- | ---------------- | -------------------------------------- | -------------- |
| v1.3 ordinary mainline baseline                       |            N/A |                N/A | legacy            | legacy                    | PASS             | 19m40s / 1180s                         | MEASURED       |
| Early live v1.4                                       |             38 |                  0 | 6                 | `browser.helm`            | FAIL             | ~23m55s                                | MEASURED       |
| Corrected MSES live v1.4, run `31890545401`           |              2 |                 36 | 1 meaningful wave | `browser.access-sentinel` | PASS             | 11m32s / 692s                          | MEASURED       |
| Active-wave optimized topology                        |              2 |                 36 | 1                 | `browser.access-sentinel` | projected        | ~9m19s mechanical; ~9m30s conservative | PROJECTED      |
| Final max-speed hosted calibration, run `31904810987` |              2 |                 59 | 1 meaningful wave | `browser.access-sentinel` | PASS             | 6m05s                                  | MEASURED       |

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
maintenance repair could be blocked by unrelated pre-existing repository-wide
formatting drift. The maintenance static path is now scoped to the sealed
affected authoritative surface while retaining type safety and fail-closed
rejection for unknown or outside-scope paths. It MUST NOT weaken static
validation, permit affected files to escape validation, or convert unknown
formatting state into success.

## 12. Separation from Project Trim

Project Trim governs Minimum Sufficient Context and Codex context/inference
efficiency. Sounding Line governs verification, evidence, acceptance,
release/merge authority, and mainline performance. The concepts are
complementary--Minimum Sufficient Context and Minimum Sufficient Evidence--but
their authorities are separate. Project Trim is not a prerequisite for Sounding
Line correctness and MUST NOT override Sounding Line evidence requirements.

## 13. POST-IMPLEMENTATION CALIBRATION

This bounded section records the final protected hosted canary and train proof.
All durations below are measured GitHub wall-clock intervals.

| Calibration field                             | Final value                                          |
| --------------------------------------------- | ---------------------------------------------------- |
| Final max-speed candidate SHA                 | `0fcddfe44e98ecd85151d9f01c4fe573838cbaac` (PR #113) |
| Final authoritative canary run                | `31904810987`                                        |
| Final Tideglass fresh obligations             | 2                                                    |
| Final Tideglass preserved/rebound obligations | 59 PRESERVED / 0 REBOUND                             |
| Final active waves                            | 1 meaningful wave                                    |
| Final dispatch-to-RELEASE_GO                  | 6m05s                                                |
| Final dispatch-to-Mainline-Decision           | 7m50s                                                |
| Final dispatch-to-merge-ready                 | 7m50s                                                |
| Final three-car concurrent qualification      | 15m04s (`31919895809`)                               |
| Serial-equivalent three-car time              | 18m15s                                               |
| Measured train throughput improvement         | 3m11s / 17.4%                                        |
| v1.4 <=15m ceiling                            | PASS                                                 |
| v1.4 <=10m objective                          | PASS                                                 |
| v1.4 5-7m preferred range                     | PASS (PR #113: 6m05s)                                |

**FINAL POST-ADDENDUM CALIBRATION: COMPLETE.** PR #113 earned ordinary
`V14_CANDIDATE → RELEASE_GO → Mainline Decision → normal protected merge` with
no owner or administrator exception. Its authoritative run began at
`2026-08-15T19:45:22Z`, concluded at `2026-08-15T19:51:27Z`, and its protected
binding completed at `2026-08-15T19:53:12Z`.

### Train closure evidence

Three independent ordinary successor cars were admitted and concurrently
qualified in train run `31919895809`: #136 Deepwater (3 FRESH / 58 PRESERVED),
#137 Tideglass (4 FRESH / 57 PRESERVED), and #138 Drydock (8 FRESH / 53
PRESERVED). The run completed in 15m04s, a measured 3m11s (17.4%) improvement
over three serial 6m05s qualifications. This throughput measure is the
concurrent qualification interval; it excludes the later authority-support
repair time, which was closure defect remediation rather than ordinary product
train throughput.

Each car subsequently landed by its ordinary protected path with an exact
predicted-tree match: #136 at `a42be8f09927403d4357ef77452a272abbd938b2`,
#137 at `e54ac2545a11323512a000abf6857319b9e3c3e9`, and #138 at
`2b7182fe0a8bab535efc69327b5cfb6a96a721d5`. GitHub synthetic merge-ref
propagation exposed two authority-support defects during suffix closure; their
bounded protected repairs did not alter product candidates. The repaired
suffix path then proved normal rebinding and landing through runs
`31920866017` and `31921634429`. No blanket restart occurred: only suffixes
whose protected authority base changed were requalified.

## 14. Related records

- [Sounding Line Effective Authority](Sounding_Line_Effective_Authority.md)
- [Project Sounding Line v1.4 Ratified Requirement Traceability](../Programs/Sounding_Line/Project_Sounding_Line_v1.4_Ratified_Requirement_Traceability.md)
- [Project Sounding Line Performance Budget Report](../Programs/Sounding_Line/Project_Sounding_Line_Performance_Budget_Report.md)
- `testing/sounding-line-authority.json` (machine-readable authority source)
