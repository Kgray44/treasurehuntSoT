---
title: Sounding Line Effective Authority
audience: engineering
status: current-on-protected-mainline-acceptance
canonical_for: sounding-line-effective-authority-human-index
last_reviewed: 2026-08-11
machine_source: testing/sounding-line-authority.json
---

# Sounding Line Effective Authority

`testing/sounding-line-authority.json` is the sole machine-readable authority
source. This document is a discoverability projection and must agree with that
source; it does not independently define policy.

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
