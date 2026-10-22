---
title: Capture preparation supervisor repair
audience: engineering
status: prepared-awaiting-protected-qualification
canonical_for: capture-preparation-supervisor-repair-20261022
last_reviewed: 2026-10-22
---

# Capture preparation supervisor repair

## Source and evidence boundary

This separate infrastructure candidate starts at accepted protected main
1a7653c3d6f3476b38f789c9b7a017b4e529243c, including the landed #791 immutable
recognition read repair. The sealed Studio handoff
Capture_Observability_Handoff_20261022.md is 8,426 bytes, SHA-256
8673eb83c4e6179d4e780e653d077cecedc94c7540006116833cee854d21deb9.
Studio run 39835375376/1 remains cancelled. Its internal cause is UNKNOWN;
finite-slot consumption is UNPROVEN. Retained plan/encrypted-index archives
are preserved unopened. This candidate establishes future supervision; it does
not diagnose that historical cancellation or authorize a consumer retry.

## Owned execution and live progress

The existing protected capture CLI remains the actual PID-owned admission and
lease holder. An asynchronous outer controller launches it through the accepted
creation-owned Windows Job Object / Linux subreaper supervisor. Synchronous setup
or profile waits inside the child cannot block the outer watchdog. Existing
capture arguments, contract coverage, viewport behavior, acceptance assertions,
raw retention and canonical publication checks remain in place.

Trusted controllers emit source-bound, contiguous phase events into an owned
session directory. Events bind repository, full base/candidate SHAs, run,
attempt, random session nonce, sequence and stable source/contract/plan digests.
Only closed phase names, integer ordinals and validated digests enter public
checkpoints. Transport reads use one fixed 4,097-byte buffer and same-handle/path
identity checks; payloads above 4,096 bytes fail. The 256-event cap exceeds the
current six supported profiles' conservative 76-event envelope; the largest
profile has six preparers. Unknown, repeated, reordered and stale events fail.
Transport files and raw error prose are never uploaded as public progress.

Each valid advance is published to a distinct, non-required commit-status
context containing run, attempt and session nonce. Publication is one fixed
GitHub API request with a five-second deadline and no retry. It supplies progress
only; Mainline Decision, protection and capture authority remain separate.
The narrowly scoped workflow permission is statuses:write for the preparation
job's trusted controllers. The original trusted CLI retains that same job token;
this is not an outer-controller-only credential. Product setup, server, browser
and fixture descendants lose both GH_TOKEN/GITHUB_TOKEN and the phase descriptors.

## Finite budgets and truthful finalization

The outer execution budget debits the existing 40-minute job's elapsed age and
reserves two minutes for finalization/uploads. No job ceiling is raised. Phase
budgets are 120 seconds except production build, browser fixture and capture,
which are 900 seconds. Setup/build values follow the existing bounded setup
path; browser readiness remains 120 seconds and the inner browser runtime remains
15 minutes. Previously unbounded planning, staging, validation, retention and
publication now have proposed 120-second envelopes. Those are reviewable policy
bounds, not measured runtime guarantees. A future legitimate workload exceeding
them fails visibly; this repair provides no automatic retry or parameter sweep.

Only a new validated phase may advance a deadline. The monotonic phase and
absolute deadlines are checked around reads, publication and successful exit;
late queued events cannot renew an expired phase. There is no heartbeat extension.
Cancellation remains observed through cleanup and terminal publication. A late
failure publishes a distinct failure observation and preserves any earlier
provider observation; cancellation during terminal-file writing leaves an
immutable terminal-correction.json beside the original. Readers must give this
correction precedence over terminal.json when determining the final outcome.
Progress success is
never qualification or consumer acceptance.

The existing owned stop path has two-second graceful and three-second force
budgets plus bounded verification. An observer closes within 5.5 seconds. PASS
requires a zero child exit, COMPLETE phase, reaped owned tree, closed streams,
closed observer and successful progress publication. Failures retain fixed,
redacted reasons and the original terminal/phase checkpoints. A failed RETENTION
progress write is held separately while the original raw sealing/retention still
runs; original replay failure priority and retention errors are preserved.
Pre-controller dependency installation remains a separate existing workflow step;
its elapsed time is debited when the controller starts.

## Local development evidence and next gate

The first nine synthetic supervisor cases passed on Windows Node 24.18.0
(declared hosted Node 24.19.0 differs). A later 13-case run passed 12 and exposed
a test-control placement error: replacement was rejected at the earlier identity
check before its expected read. The original failed receipt is preserved; moving
the mutation after the handle stat made the focused growth/replacement case pass.
The other new cases proved phase expiry, cancellation during cleanup/publication,
final absolute expiry and durable truthful failure. The synthetic publication
regression proved progress failure still retains verified raw output and preserves
the original replay error. These are development receipts, not hosted proof.

Local evidence is retained under the owned D:/CodexTemp directory
studio-capture-preparation-observability-20261022-01a13d1d, including immutable
recipes, source claims, stdout/stderr and cleanup results. No product capture,
custody, grant, encrypted consumer archive or real-provider write is used by
these fixtures. The historical recognition comparison is not repeated.

Exact independent review and normal protected qualification must precede merge.
The changed workflow cannot approve itself. After normal installation and exact
landed-tree verification, one inert installed-main workflow probe must exercise
an advancing child and a deliberately silent synchronous child with a detached
listener. It checks owned descendants, streams, port reuse, environment stripping
and the expected PHASE_TIMEOUT receipt. An independent observer must retrieve
source-bound progress from the provider before completion. The producer summary
alone cannot establish that fact. No consumer capture is authorized here.

This infrastructure bug fix changes no completed product capability or feature
availability. Feature Catalog: NO CHANGE REQUIRED.
