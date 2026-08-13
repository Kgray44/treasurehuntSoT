---
title: Project Bridgewatch Phase 3 Design Record
audience: engineering
status: current
canonical_for: project-bridgewatch-phase-3-design
last_reviewed: 2026-08-12
---

# Project Bridgewatch Phase 3 - Keep the Watch

## Authority, entry, and preflight proof

This is the final governed implementation phase of Project Bridgewatch. It
extends the accepted Phase 2 service; it neither starts nor implies a Phase 4.
The governing source order remains: explicit accepted project/phase records,
Sounding Line evidence, GitHub, optional reporter activity, then Bridgewatch's
own observation history.

The named `Project_Bridgewatch_Governing_Document_v1.1.pdf` was not present in
the fetched repository, the Phase 2 worktree, or the available local project
and attachment locations at preflight. Phase 2 recorded the same absence. The
detailed Phase 3 task authority supplied with this implementation is therefore
the operative v1.1 requirement text for this branch; this record does not
claim that an unavailable PDF was read and must be reconciled if an accepted
copy later supplies a contradictory requirement.

| Field                                  | Recorded value                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Canonical checkout                     | `C:\Users\kkids\Documents\Codex_TreasureHunt`                                |
| Phase 3 worktree                       | `C:\Users\kkids\Documents\treasurehuntSoT-bridgewatch-phase3-keep-the-watch` |
| Initial Phase 3 branch                 | `codex/project-bridgewatch-phase3-keep-the-watch-1`                          |
| Upstream                               | `origin/main`                                                                |
| Starting `origin/main` / base          | `191a964488d0df71f8dcb91c5b8372fc73b6b32e`                                   |
| Starting ahead / behind                | `0 / 0`                                                                      |
| Worktree staged / unstaged / untracked | none / none / none                                                           |
| Phase 2 protected merge ancestor       | `9b950a5fd603be27c813f9298b0b14888fbce6cf` (verified ancestor)               |
| Phase 2 frozen candidate               | `20b0b065e290201405cb78e1503fac102575232f`                                   |
| Phase 2 authority                      | Sounding Line run `31598563933`, `RELEASE_GO`, 38 clean mandatory receipts   |
| Starting capacity                      | C: 392.63 GB free (`NORMAL` under the v1.3 capacity policy)                  |

The preferred un-suffixed Phase 3 branch could not be used because the
registered `codex/project-bridgewatch-phase2-wire-the-signals` worktree owns
the historical Phase 2 branch. The numbered suffix is task-owned and tracks
the freshly fetched protected main without modifying the old worktree.

### Current-main reconciliation

`origin/main` had advanced from the task preparation SHA through the accepted
Bridgewatch Phase 2 merge, the accepted Sounding Line protected-binding and
explicit-finalization changes, catalog reconciliation, Helm integration, and
the accepted Drydock Phase 3 merge. The direct post-Phase-2 Bridgewatch changes
are its accepted receipt/integration records and later formatting only; there
is no Migration 3 or competing history implementation in main. The current
mainline also contains the Phase 2 registry, telemetry, Sounding Line status
projection, migration 1 and 2, and private Fastify dashboard, so Phase 3 is
based on current main rather than the retained Phase 2 branch.

### Candidate reconciliation

Before candidate qualification, a fresh fetch advanced protected `origin/main`
to `4edc8de5e30e9748700c19b466061f9b9a97f268` through the accepted Admiralty
Phase 2 integration and associated Sounding Line serialization, resource,
registry, and policy changes. The 37 intervening commits contained no
`bridgewatch/` implementation, SQLite migration, Project Bridgewatch record,
or Bridgewatch Feature Catalog change. They did change shared testing metadata,
so Phase 3 was rebased cleanly onto that exact main identity and its generated
test registry was regenerated. The changed Bridgewatch ownership/impact/suite
entries remain additive and policy validation passed afterward. Candidate
qualification must use this reconciled base and a new frozen SHA, not the
original `191a...` starting identity.

### Current candidate reconciliation

The original exact-candidate authority (`a6e90d44...`) was preserved as a
historical external failure: its only failed seam was the independently owned
Helm browser journey. The Helm correction then protected-merged at
`770404dd11cdfc1b86658a488979c43c22ed1711`; Deepwater's ordered record-only
closure subsequently protected-merged at
`582f32a35d918ae892bd2feae766c00043038f39`. After the lane's explicit release,
this Phase 3 work was replayed onto that current main on owned branch
`codex/project-bridgewatch-phase3-keep-the-watch-4`.

The replay retained the accepted migrations and resolved only generated
documentation/catalog provenance: the document index was regenerated and the
obsolete old-base Feature Catalog stamp was intentionally discarded in favor
of a fresh `features:sync` at the eventual frozen candidate. No competing
Bridgewatch migration or history implementation entered main. The new base is
an ancestor of the candidate; all implementation and qualification evidence
below applies to this post-Helm, post-Deepwater candidate path.

### Concurrent-work snapshot

Registered worktrees at preflight included the canonical checkout; the retained
Bridgewatch Phase 2 checkout; this Phase 3 checkout; active/retained Homeport,
Admiralty, Deepwater, Drydock, Helm, Shipwright, Tideglass, Wakebook, OAuth,
and Sounding Line worktrees; and the Sounding Line record-only worktrees under
`D:\CodexWorktrees`. Registration is evidence of a checkout, not proof that a
lane is running. The active Bridgewatch branches are the retained Phase 2
branch and this Phase 3 branch. Active Sounding Line branches are the workflow
retirement and record-only closure/reconciliation/probe lanes. Feature Catalog,
project-record, and Sounding Line status-projection paths are shared policy or
record seams and will be touched only by named-path changes after fresh
reconciliation. No other worktree, lock, process, database, or branch is owned
by this phase.

At preflight, 41 worktrees were registered and 23 had a hydrated root
`node_modules` directory, exceeding the current six-heavy-worktree ceiling
before this phase began. Bridgewatch Phase 3 will not mutate, remove, or slim
another lane. Its direct implementation authority requires a single isolated,
lockfile-exact dependency hydration in this Phase 3 worktree for focused tests;
it is task-owned temporary data and will be removed during its cleanup evidence.
No additional worktree is hydrated, and no shared port or validation lock is
claimed by this exception.

## Frozen Phase 3 architecture

### 1. Migration and durable data

Migration 3 extends, never rewrites, migrations 1 and 2. It adds only these
Bridgewatch-owned tables:

| Table           | Purpose                                                                | Retention                                               |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- |
| `events`        | typed, deduplicated, normalized meaningful transitions                 | detailed operational rows default to 30 days            |
| `snapshots`     | bounded normalized program projection and digest                       | default to 30 days; identical digests are not persisted |
| `daily_rollups` | deterministic one-program-day coarse history generated before deletion | default to 90 days                                      |

`project_history`, `phase_history`, `milestone_history`, `completion_records`,
accepted branch/PR identities, final decisions, and integrated main SHAs remain
durable and are never retention targets. `workers`, `test_runs`, and
`test_nodes` remain Phase 2 current/operational projections; Phase 3 never
deletes their accepted historical meaning through a broad table operation.

`events` has an immutable ID, unique deterministic `dedupe_key`, kind, source,
optional project/phase IDs, entity type and ID, source occurrence time,
Bridgewatch observation time, bounded prior/current safe state, bounded summary,
and safe evidence references. `snapshots` has capture time, schema version,
digest, and a bounded normalized payload. `daily_rollups` has a deterministic
UTC day/scope identity and a bounded safe summary. Timestamp, project/phase,
event-kind, and rollup-day indexes are added only for the exposed queries.

### 2. Event and snapshot model

Events are derived by comparing prior and current normalized source state, not
by parsing commits, prompts, logs, or arbitrary payloads. The first observation
may establish a baseline; repeated identical polling emits no event. State
changes emit one event with a SHA-256-derived identity over the stable source,
entity, transition, and authoritative occurrence time. Both source time and
observation time are retained; skew is displayed rather than silently reordered.

The supported event families are project, phase, and milestone state changes;
PR open/merge/close/check/mergeability changes; worker start/blocked/stale/
finish; Sounding Line run/root-failure/decision changes; main advancement;
external-gate changes; and normalized source-state changes. Routine heartbeat
refreshes, routine passing test nodes, unchanged GitHub polls, raw commits, and
raw source payloads are deliberately excluded.

Snapshots capture only normalized project, phase, milestone, PR, branch, main,
worker, and Sounding Line state needed for safe comparison and rollups. They
never contain raw GitHub responses, logs, prompts, commands, secrets, cookies,
private Chronicle data, media, or application data. The default cadence is
60 seconds, configurable, with digest suppression. Freshness remains a
separate current-source concern, so a skipped identical snapshot does not claim
that collection stopped.

### 3. Recent-change and trend semantics

`GET /api/history` is the new bounded program-history contract; Phase 2
`/api/activity` remains worker activity. History accepts valid ISO timestamps,
project, phase, and event-kind filters, fixed maximum page size, a deterministic
cursor, and descending observed-time/ID ordering. Its default window is the
last 12 hours and its maximum range is the configured detailed-retention span.

The homepage summarizes accepted lifecycle/phase/milestone movement, blockers
and root failures, main advancement, PR movement, significant Sounding Line
decisions, and worker state transitions in priority order. It never derives
percentage progress from activity, branch commits, test counts, or elapsed time.
Browser-local `bridgewatch:last-seen:v1` stores only the last successful view
timestamp. A missing, invalid, unavailable, or unreasonably future value falls
back to the 12-hour range and never changes server truth or acknowledges an
event.

Project detail shows current state first, then an authoritative timestamped
phase timeline, milestones, accepted mainline entries, PR transitions, final
decisions, blockers, and limitations. Durations appear only for valid explicit
start/end pairs. The completed archive supports chronological completion/
integration/name ordering and retains original branch, PR, final SHA, receipt,
and decision even when a branch disappears or a project later changes name.
Program trends are restrained durable-history counts: projects completed,
phases accepted/completed, and accepted integrations over time. No ETA, risk
score, global completion percentage, or guessed timestamp is produced.

### 4. GitHub branch health

Branch health is derived only from GitHub-authoritative observed branches and
pull-request heads: head/default SHA, ahead/behind comparison when available,
last commit time, PR association, and PR lifecycle. The default policy is a
configurable 5-behind-main attention threshold, seven-day active-branch stale
threshold, and three-day review-branch stale threshold. A merged/complete
historical branch is explicitly excluded from stale-work alerts. Unknown
comparison state remains `UNMEASURED`; ahead count is context, never a progress
denominator. Meaningful behind/reconciled/PR transitions are retained as events,
not every poll.

### 5. Attention, failure, and fallback behavior

Historical intelligence may add one deduplicated AMBER condition for a stale
active/review branch, materially behind active branch, aging PR/external gate,
or recurring independent root-failure classification. It never replaces
Sounding Line root-versus-cascade authority or creates duplicate cards for the
same root condition.

History persistence errors set a persistent local Bridgewatch warning and leave
the current cached/source projection available. GitHub and Sounding Line
outages retain their last known normalized state with stale/unavailable status;
no inferred completion is emitted. Reporter absence remains `UNMEASURED`.

### 6. Retention, pruning, backup, and rebuild

`BRIDGEWATCH_EVENT_RETENTION_DAYS=30` and
`BRIDGEWATCH_ROLLUP_RETENTION_DAYS=90` are validated positive numeric defaults.
Snapshot retention follows detailed operational history. Pruning has an
inspection/dry-run mode, an explicit table allowlist, a durable-table canary,
and transactional ordering: identify expired transient rows, materialize
idempotent daily rollups, verify durable tables are absent from all deletion
plans, delete only allowlisted rows, verify integrity, then optionally compact.
Compaction is manual or threshold-triggered after material pruning; it is never
continuous and is documented as briefly blocking SQLite work.

Current projection recollection is an upsert of current normalized sources. It
must not erase accepted phase history, completion records, historical events,
or final main identities. A private SQLite backup is an online/task-owned
backup operation into an operator-selected writable data path, with restore
tested in an isolated path before any deployment claim.

### 7. API, UI, privacy, and performance

Human routes remain GET/HEAD only. The only POST routes remain the existing
strict machine activity telemetry endpoints. The coherent additions are history,
per-project history/trends, program trends, completed archive, branch health,
and a bounded maintenance inspection projection; no source-control, project,
test, release, deployment, or acknowledgement control is added.

The static dashboard remains dark-first, compact, keyboard-accessible, and
reduced-motion safe. It adds a concise since-last-check panel, history/archive/
trend/branch surfaces, semantic timeline text equivalents, 390x844 no-overflow
layout, and a wide control-room grid that increases useful density without
stretching cards. DOM chronological ordering, visible focus, status text, full
SHA labels, and accessible timestamps are requirements.

The target budgets are steady RSS at or below 150 MB where practical (review at
256 MB), idle CPU about 1% or less, warm private-network response below one
second, visual readiness below two seconds, visible normalized update within
one to two seconds, and normal retained SQLite size below 250 MB. A synthetic
fixture represents dozens of projects, completed phases, hundreds of
milestones, 30 detailed days, 90 rollup days, PRs, workers, and test nodes;
empty-database measurements alone are invalid.

### 8. Configuration and deployment

New non-secret, typed configuration covers snapshot cadence, detailed event
retention, rollup retention, history page size/range, branch stale thresholds,
and branch behind-main threshold. Every number is bounded and validated. The
existing GitHub, telemetry, and dashboard credentials remain server-only.

Deployment stays one private service: access proxy -> NGINX -> loopback
Fastify/Node -> SQLite in a writable data directory outside the read-only
release checkout. The deployment runbook will include a non-root systemd unit,
restart bounds, private environment file, health/readiness, TLS/private access
guidance, dashboard authentication fallback, daily backup, and restore steps.
It does not add a deployment button or make systemd mandatory for Windows.

## Test and closure contract

Phase 3 changes a persistence schema, private API, historical reader, and
responsive dashboard. It therefore adds migration/fresh-install/upgrade,
event/snapshot/idempotency, retention/rollup/durable-canary, history API,
branch/no-progress, outage/failure, backup/restore, realistic performance, and
browser accessibility/mobile/wide-screen tests in the same branch. Focused
Bridgewatch evidence is used while implementing. The protected Sounding Line
mainline decision is invoked once only after qualification, exact-candidate
freeze, fresh-main reconciliation, and resource cleanup; it is not a debugger.

At final closure, the authoritative project records, registry, Feature Catalog
fragment, documentation index/navigation, Phase 3 validation/performance/
deployment/integration records, Phase 3 receipt if required, and final Project
Bridgewatch Completion Receipt are updated only with tested, accepted truth.
The final record retains optional future extensions such as multi-repository
federation, Grafana/Sentry links, deployment-state sources, owner groups, web
push, and configurable dashboards as optional, not as a Phase 4.
