---
title: Project Sounding Line Phase 4 Dual Run Comparison Specification
audience: engineering
status: planned
canonical_for: sounding-line-phase-4-dual-run
last_reviewed: 2026-07-29
---

# Phase 4 Dual-Run Comparison Specification

## Purpose and preconditions

Dual run compares the legacy harness with a Sounding Line release candidate on
the same source, policy, fixture family, declared environment, and release
scope. It is an observation program, not a preparation test. Neither runner may
become authoritative while a mandatory difference is unexplained. The legacy
harness stays authoritative throughout the required observation window.

## Comparison record

Each paired run records selection, results, skips, retries, failure diagnosis,
root/cascade reporting, environment, coverage, contract evidence, duration,
resource safety, artifacts, cleanup, and final decision. It records source,
policy, dependency-lock, fixture, and evidence-manifest identities so a pair
cannot be compared across materially different inputs.

Allowed differences are concurrent order; task-owned ports and paths; one root
failure with blocked dependents; retained retry evidence; stricter cleanup or
policy findings; and certified setup reuse. All allowed differences require an
explicit normalized explanation.

Unacceptable differences are missing mandatory tests or contracts, unexplained
case-count loss, a product failure disappearing, weaker privacy/authorization/
migration/lifecycle/accessibility/provider proof, different authoritative state,
cross-run contamination, incomplete cleanup, or weaker final decision. Any is
a dual-run failure and blocks authority advancement.

## Observation and adjudication

The future gate must observe focused, subsystem, and release-shaped pairs over
an approved minimum window containing representative browser, database, build,
restart, and applicable external-provider scenarios. The final duration and
sample threshold are acceptance parameters owned by release governance; one
passing run cannot change authority. A disagreement creates a retained issue
with owner, root/cascade classification, evidence links, remediation, and a
fresh comparison after repair. No real dual-run gate is executed by this work.
