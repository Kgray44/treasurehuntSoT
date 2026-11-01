---
title: Sounding Line modernization PR A0 protected merge transaction integrity
audience: engineering-owner
status: proposed-inactive
canonical_for: sounding-line-modernization-pr-a0-merge-transaction
last_reviewed: 2026-10-26
---

# PR A0: Protected Merge Transaction Integrity

This is a mandatory input to Sounding Line modernization PR A. The [PR #776 incident](SL-INC-PR776-20261026_Protected_Decision_Missing.md) exposed a pre-merge acceptance-ordering failure. A0 prevents recurrence; it does not grant post-merge acceptance for #776 or change current release authority. Implementation and GitHub protection changes require their normal authorized, protected review.

## Required transaction contract

1. A required decision job may satisfy branch protection **only** with a successful conclusion for the exact current PR head and protected base. `skipped`, `neutral`, missing, stale, cancelled, and failed results must fail closed. An always-running gate or equivalent enforceable mechanism must publish an explicit failure when qualification did not run.
2. Draft-to-ready transitions must remain unmergeable until that exact-head/exact-base qualification succeeds. A result created while draft, or before the ready transition, cannot be laundered into readiness through a skipped required job.
3. Audit all administrator, automation, ruleset, branch-protection, and merge-queue bypass paths against live GitHub settings. Correct every path through separately authorized GitHub protection changes; workflow YAML alone is insufficient proof. Record the before/after settings and effective actor permissions.
4. Merge automation must independently retrieve and verify the successful required decision, its trusted app/workflow identity, exact PR head, exact protected base, and current protection state immediately before merge. It must abort on any change, ambiguity, or non-success; it cannot rely on a green aggregate badge or a skipped job.
5. Focused regression tests must reproduce the #776 order: a draft-triggered skipped decision, a ready transition, an administrator/automation merge attempt before active qualification, and a base advance before custody starts. Demonstrate that no premature merge occurs, that the exact active qualification can later succeed or fail honestly, and that failure remains recorded. Include `neutral`, stale-head, stale-base, and missing-check cases.
6. Before claiming A0 complete, inspect and record the actual GitHub required-check app, strictness, administrator enforcement, rulesets, bypass actors, and merge automation permissions. Verify a protected test transaction against those effective settings. Keep this proof separate from workflow-source tests.

PR A should carry the smallest implementation that enforces these invariants and its focused race tests. Do not use A0 to rerun the entire Parallax capture, alter the 48-state deferral, or invent a historical `RELEASE_GO`. The proposed 51-browser-file post-merge diagnostic is a separately budgeted technical-confidence option and is not an A0 completion criterion.
