---
title: Sounding Line Effective Authority
audience: engineering
status: current-on-protected-mainline-acceptance
canonical_for: sounding-line-effective-authority-human-index
last_reviewed: 2026-08-14
machine_source: testing/sounding-line-authority.json
---

# Sounding Line Effective Authority

`testing/sounding-line-authority.json` is the sole machine-readable authority
source. This document is a discoverability projection and must agree with that
source; it does not independently define policy.

Project Sounding Line Version 1.4.1 is the effective repository-wide verification authority on protected main. It is a normal forward service-track improvement to v1.4: stable governed test identity and pre-merge trusted-main candidate qualification. The v1.4 cross-part amendment remains additive to the Part I/II Version 1.2 and Part III Version 1.3 amendments; those part amendments remain effective as listed in the machine-readable index.

The Version 1.4 activation is a corrective, owner-authorized protected merge following PR #90. PR #90 integrated the accepted implementation tree but did not flip the authority version. Accordingly, the ratified atomic-one-merge activation requirement is recorded as **not satisfied historically**; protected history is preserved and the evidence requirements are not waived. The permanent deviation and corrective-activation record is `Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_v1.4_Corrective_Authority_Activation_Record.md`.

Project Sounding Line is the effective repository-wide verification authority.
Its Part I, Part II, and Part III Version 1.0 baselines, Version 1.1 amendments,
Part I/II/III Version 1.2 amendments, and the accepted Part III Version 1.3
workspace-lifecycle amendment form one additive governing chain. The current
amendments are located in this directory.

`Sounding Line / Mainline Decision` remains the one protected mainline
authority. Runtime conformance is mandatory evidence inside that decision.
Future repository-changing projects inherit this authority automatically;
project-specific documents may add proof but cannot replace Sounding Line's
planner, generic worker, evidence, finalizer, or protected-release authority.

Authoritative mainline or release-candidate execution is explicit finalization
for one qualified frozen candidate. Development uses incremental local or
focused hosted evidence, and a failed authoritative attempt returns to focused
repair before requalification. Focused execution never emits `RELEASE_GO` and
never substitutes for the Mainline Decision. This boundary is already governed
by Part III Version 1.2 Sections 6 and 8 and is operationalized by
`.agents/testing-workflow.md`; no additional broad amendment is required.

## Corrective activation boundary

The corrective candidate declares the exact authority index that becomes effective only when that tree lands on protected main. Before that merge, it may be accepted only through an explicit `V13_CUTOVER` plan on the recorded corrective ref and exact recorded v1.3 base. The exception is identity-bound and unavailable on every other ref; `CURRENT` v1.4 execution remains protected-main-only. This prevents v1.4 from authorizing its own activation while leaving no mixed-version execution path after activation.

## v1.4.1 service-track qualification

The active registry uses persistent `stableId` values from
`testing/governed-test-identities.json`; source line, source path, and display
title are diagnostics, not identity. Legacy generated IDs remain historical
aliases. `scripts/sounding-line/validate-test-identities.mjs` fails closed for
missing, duplicate, silently disappeared, cyclic, unknown, or P34-unresolvable
identities.

Pre-merge execution has three identities: `CURRENT` validates protected main;
`CANDIDATE` qualifies an ordinary frozen subject; and `MAINTENANCE` qualifies a
narrow verification-only subject. For either pre-merge identity, the planner,
classifier, policy, registry, workers' governing controls, and finalizer load
from a separately checked-out protected-main authority source. Candidate code
is subject matter only. A mixed product plus verification change is
`INELIGIBLE_MIXED_SCOPE` and must take the ordinary candidate lane. Maintenance
success is an internal `MAINTENANCE_GO`; the protected check remains the single
`Sounding Line / Mainline Decision` contract.

## Protected merge binding

GitHub evaluates required checks on the current synthetic pull-request merge
identity, while explicit authoritative acceptance is earned only by the frozen
candidate head. `protectedMergeBinding` in the machine-readable authority index
therefore permits a lightweight **protected merge binding** stage. It verifies
the exact pull-request head, current base, two-parent synthetic merge
composition, sealed finalizer plan/receipt/evidence digests, and clean mandatory
receipts before satisfying the unchanged `Sounding Line / Mainline Decision`
context on that merge identity.

The binding stage is not a test runner and cannot issue `RELEASE_GO`. It
consumes only an already sealed authoritative finalizer result. When main has
advanced, it performs the fail-closed semantic path classification declared in
the authority index: unrelated documentation/testing-infrastructure changes may
carry forward product evidence, while Helm-owned, product, dependency, or
unclassified changes require reconciliation and new candidate authority.

## Record-only closure

The protected binding also supplies a distinct **record-only** finalization path
for a documentation/metadata closure whose exact three-dot candidate diff is
limited to the machine-readable authority index allowlist: CHANGELOG.md,
current engineering records under Development_Docs, and current Markdown under
docs. Empty, renamed, deleted, binary, unclassified, product, Prisma,
dependency, configuration, workflow, Sounding Line runtime, test, security, or
runtime-asset changes are refused before record evidence is run.

The path executes from the protected synthetic merge so its classifier is
already accepted mainline tooling, while its sealed plan, receipt, and
finalizer source identity remain the exact candidate SHA. It requires one
referenced merged implementation PR whose candidate is an ancestor of the
closure, a completed successful explicit Sounding Line authority run for that
implementation candidate, its valid sealed full-mainline RELEASE_GO, and the
two successful protected Sounding Line / Mainline Decision checks attached to
that implementation candidate. It then records only policy/inventory, generated-record consistency,
documentation index/validation, Feature Catalog synchronization/validation,
changed-file whitespace/diff formatting checks. It never starts browser,
product-unit, build, migration, Prisma, or unrelated product proof.

The finalizer remains the only release-decision emitter. The binding validates
the record-only plan shape, the classified path set, the prior implementation
ancestry, the evidence set, the sealed finalizer result, and the exact
two-parent merge before publishing the unchanged protected context. Unsupported
or ambiguous candidates fail closed.
