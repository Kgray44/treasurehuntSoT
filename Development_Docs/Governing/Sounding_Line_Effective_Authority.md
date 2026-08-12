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

The v1.2 target architecture requires minimum sufficient evidence, semantic
evidence preservation, and record-only closure. Unsupported optimization paths
fail closed and are tracked in the canonical runtime remediation backlog.
