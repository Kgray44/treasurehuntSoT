---
title: Project Bridgewatch v1.2 Mission Control Realization Design Record
audience: engineering
status: active-implementation
canonical_for: project-bridgewatch-v1.2-mission-control-design
last_reviewed: 2026-08-16
---

# Project Bridgewatch v1.2 — Mission Control Realization and Intelligence Upgrade

## Purpose and boundary

This is a post-completion product-version amendment to Project Bridgewatch. It
does not reopen, renumber, or replace the accepted Phase 1 _Raise the Board_,
Phase 2 _Wire the Signals_, or Phase 3 _Keep the Watch_ records. It adds the
first-class `v1.2` version/increment model without fabricating a Bridgewatch
Phase 4.

Bridgewatch remains private, read-only, and observational. It may read its
configured repository, local Git metadata, bounded GitHub GET responses,
Sounding Line's existing projection, project records, documentation indexes,
and activity telemetry. It does not issue GitHub mutations, control Sounding
Line, run user-selected shell commands, edit lifecycle records, or manipulate
Voyagewright product state. Its only existing POST routes remain the narrowly
validated activity telemetry intake.

## Entity and persistence model

The canonical observation vocabulary is `Program`, `Project`,
`ProjectVersion`, `Phase`, `Milestone`, `Task`, `Worker`, `Branch`, `Commit`,
`PullRequest`, `SoundingLineRun`, `SoundingLinePlan`, `SoundingLineSuite`,
`SoundingLineTest`, `EvidenceReceipt`, `SourceObservation`,
`HistoricalEvent`, `ProgramSnapshot`, `ProjectSnapshot`, `ComparisonWindow`,
and `DiscoveryEvidence`.

Migration 4 adds normalized Bridgewatch-owned projections for discovered
projects, versions, entity links, evidence, source observations, pull-request
details, branch details, and Sounding Line run details. Existing migrations
and retained Phase 1–3 JSON history remain readable compatibility evidence;
they are never dropped or treated as a disposable cache. New relationships and
their provenance are rows with stable IDs and indexes, not a miscellaneous
all-purpose JSON document. Bounded detail payloads may still retain safe,
source-specific fields where a schema would otherwise invent facts.

`Project -> ProjectVersion -> Phase` is explicit. A phase without supported
version evidence remains project-scoped. A version can contain zero, one, or
many phases and may be a post-completion amendment. Version strings preserve
the authoritative spelling (`v1.4.1`, `R2`, `Amendment v1.1`, and so on); a
document revision is not automatically a project version.

## Evidence, confidence, and reconciliation

Facts have an owning source rather than one blanket overwrite rule. Accepted
completion/project records own accepted lifecycle, Sounding Line owns its
final decision and receipt state, GitHub owns remote PR/branch/main facts,
governing records own declared phase structure, and reporter data owns only
reported activity. The normal precedence is: accepted records; Sounding Line
final evidence; GitHub facts; governing declarations; document/catalog index;
project-bound branch/PR/commit inference; then reporter activity. A weaker
observation may fill an absent field but never replace an owned stronger fact.

Each relation keeps source path or URL, observed time, source time when known,
kind, digest, and confidence: `AUTHORITATIVE`, `CORROBORATED`,
`PROVISIONAL`, `AMBIGUOUS`, or `UNKNOWN`. Missing and operational conditions
are distinct: `UNKNOWN`, `NOT_RECORDED`, `NOT_APPLICABLE`, `NOT_CONFIGURED`,
`STALE`, `UNAVAILABLE`, and `NOT_YET_OBSERVED` are rendered as such.

Reconciliation is deterministic and idempotent. It upserts stable entity and
evidence identities, preserves previously accepted history, records a
meaningful transition once, and retains last-known-good source data after a
collector failure. It never concludes a lifecycle from commits, test counts,
or elapsed activity.

## Discovery and historical reconstruction

The static Phase 1–3 registry becomes retained bootstrap evidence, not the
only project source. A bounded discovery pass combines:

1. machine-readable documentation index, project status/catalog fragments,
   completion/design/governing records, and governed filenames;
2. fixed, read-only local Git ref queries for branch and historical-name
   evidence within the configured repository root;
3. cached, rate-limited GitHub PR, branch, commit, and workflow observations;
4. the existing Sounding Line projection; and
5. opt-in reporter activity.

Project binding is required before branch, PR, or version text becomes a
project fact. Ambiguous material is retained as `UNCLASSIFIED ACTIVITY`.
Explicit `Project Bridgewatch v1.2` material, including this branch and its
design record, is therefore discoverable as Bridgewatch `v1.2` without a
`bridgewatchVersion` registry constant. An unrelated dependency phrase such as
`update dependency to v1.2` cannot create a project version.

The same reconciliation backfills supportable historical start, candidate,
acceptance, merge, branch, PR, integrated-main, final-decision, and test/run
facts. It records the exact unavailable source whenever it cannot recover a
field. Historical snapshots and rollups retain their original fidelity:
`EXACT`, `ROLLUP`, `COARSE`, or `UNAVAILABLE`.

## Progress and source health semantics

Project cards show lifecycle separately from phase progress. Phase progress is
only `completed / declared total` when a governing source supplies a
denominator. Otherwise it states the known completed and active phases plus
that the total is unknown. Milestone percentages remain available only for
explicit weighted milestones; commits, branch divergence, PR count, elapsed
time, and worker activity never create progress.

Every source exposes `HEALTHY`, `STALE`, `DEGRADED`, `UNAVAILABLE`,
`NOT_CONFIGURED`, or `NOT_APPLICABLE`, along with configuration, reachability,
last attempt/success, cache age, next retry, safe failure reason, and GitHub
rate-limit/authentication state when available. An absent reporter says
`NOT_CONFIGURED`; zero active workers says `No active worker`.

## Information architecture and API contract

The static dashboard remains the low-dependency private client, but uses a
History API router and station navigation instead of one long scroll. Its
stations are Overview, Program, Projects, Operations, GitHub, Attention,
History, and Sources. Entity pages for projects, versions, phases, PRs,
branches, and Sounding Line runs use bounded detail requests and preserve
Back/Forward deep links. The dark technical visual language, readable detail
tables, visible focus, reduced motion, status text, and phone-safe wrapping
remain required.

New APIs are GET/HEAD-only, bounded, and mounted-aware: program, project
collections and profiles, version and phase profiles, pull requests, branches,
Sounding Line runs, history, comparison, and source health. Comparison accepts
validated `from` and `to` timestamps (`to` defaults to now) and reports exact
changed entities with their fidelity. Overview stays concise and does not load
all historical entities or PR detail.

## Windows runtime contract

The existing Linux unit remains optional deployment support. A Windows
PowerShell lifecycle helper owns only the Bridgewatch PID it starts, verifies
the configured loopback listener and health response, retains process identity
beside the Bridgewatch runtime data, supports status/restart, and refuses to
kill unrelated Node processes. The documented Homeport/Admiralty gateway keeps
`/bridgewatch` capability-gated, strips browser credentials, and permits only
the read-only mounted asset/API allowlist.

## Verification contract

Implementation proceeds with focused test-first unit/integration proof for
discovery, precedence, version/phase distinction, migration/retained history,
source health, comparison, profile routes, and browser navigation. A task-owned
database, port, and browser state are required. Broad package, documentation,
Feature Catalog, gateway, browser/accessibility, real-repository, and runtime
proof follow only after the coherent candidate is frozen. Sounding Line v1.4
is the one finalization authority for that exact candidate, never a debugging
loop.
