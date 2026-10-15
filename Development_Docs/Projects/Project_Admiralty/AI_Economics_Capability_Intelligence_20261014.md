---
title: Admiralty AI economics and capability intelligence
audience: engineering-administrator
status: current
canonical_for: admiralty-ai-economics-implementation
last_reviewed: 2026-10-14
---

# AI economics and capability intelligence

This increment extends the existing Admiralty AI Usage & Quotas workspace and
Parallax execution/accounting owners. It does not introduce another execution
engine, identity, billing gateway, ledger, or scene acceptance authority.

## Source and availability

Protected main inspected: `602f83efdb16b7ea75980f07fa3a3d976c496860`.
The working reconstruction and independent environment lifecycle exist on
`codex/parallax-studio-overhaul`, inspected at
`a5eeb5b42561042cea7e799a3b0d54c1b03c1006`, 201 commits ahead of that main.
Development uses an owned D: worktree and a dependent feature branch,
`codex/admiralty-ai-economics-spatial`. The shared primary checkout and the
separate Spatial Studio inspection runtime are preserved. The dependency is
not silently represented as accepted mainline functionality.

The same prerequisite commit is already published by
[Spatial Studio PR #722](https://github.com/Kgray44/treasurehuntSoT/pull/722) on
`codex/parallax-surface-orientation`. The Admiralty PR targets that published
branch. The local `codex/parallax-studio-overhaul` name refers to the same
inspected commit; no second copy of the prerequisite is published for this task.

Current qualification is preparatory. Focused real-SQLite tests and an actual
production-browser journey have passed; the first independent experience
review requires bounded repair and recapture. Final source-bound review,
protected qualification, dependency integration and owner acceptance are not
established by those development receipts.

## Canonical boundaries

| Responsibility                        | Existing owner and extension                                                                         |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Account/session/Creator authorization | Wayfarer and ordinary Studio access checks                                                           |
| Administrative authority              | Admiralty server capability checks; economics and AI policy mutation require Administrator authority |
| Admission and reservations            | `src/parallax/ai-ledger.ts`, one database control-row lock                                           |
| Capability semantics                  | `src/parallax/ai-capabilities.ts`, versioned registry independent of model identity                  |
| Provider execution                    | Existing OpenAI adapter and Assistant/room perception services; no automatic paid retries added      |
| Attempt reconciliation                | Child `AIProviderAttempt` receipts roll into the existing logical-operation ledger                   |
| Room acceptance                       | `applyRoomPerception` commits the canonical save and acceptance receipt atomically                   |
| Assistant Apply                       | Existing exact-proposal canonical save transaction records Apply                                     |
| Later editing and undo                | Canonical save compares accepted room geometry or the exact pre-Apply document checksum              |
| Configuration                         | Existing Parallax quota command, preview, privileged assurance, confirmation and durable audit       |

An HTTP success, generated proposal, preview, temporary artifact, ordinary open,
or provider settlement never establishes room acceptance. Owner feedback may
record preview/rejection only. It cannot call an administrative acceptance
endpoint. A room save after acceptance changes its outcome only when room
geometry changes. A document matching an exact pre-Apply checksum records that
edit as undone; unrelated later edits do not imply undo.

## Accounting contract

`AIUsageLedger` remains one row per logical operation. Provider attempts have
individual IDs, sequence, model/provider, immutable pricing snapshot, usage,
status, failure classification, exposure and reconciliation timestamps. An
explicit owner retry reserves additional exposure under the same control-row
lock. It does not increment the logical-operation count. No unresolved attempt
may be retried through that seam. Both initial calls and retries respect rate,
concurrency, spending and capability ceilings.

Money uses integer USD nanodollars: one dollar is 1,000,000,000 units. Public
economics JSON serializes monetary integers as strings; display preserves
fractional cents. Cost basis distinguishes provider-confirmed billing,
reported-usage calculation, conservative estimates, no charge, and unknown
usage. Missing usage is never a zero-cost settlement. Missing token dimensions
remain null in receipts; incomplete cache breakdowns use explicitly estimated
upper-rate arithmetic until reconciliation. Reported image/audio input tokens
are retained where supplied and are part of aggregate input usage, rather than
invented image counts or a second charge.

Undispatched expiry can release capacity with no charge. Dispatched failure,
cancellation or timeout retains exposure until provider evidence reconciles it.
Reconciliation updates the original attempt and logical totals, rejects response
identity/quantity conflicts, and never silently revises confirmed billing.
Known failed-attempt cost includes failed attempts inside an otherwise useful
logical operation. Unexpected cost above reserved exposure disables subsequent
paid admission and creates a durable owner-policy revision.

Pricing versions have model identity, revision, effective UTC instant, service
tier, source and input/cached/write/output rates. Admission snapshots the
effective version. Pricing edits add immutable versions through the existing
audited policy command; historical receipts are never repriced from current
configuration. The development reference prices in the task brief are not
production pricing constants. Existing configured rates are calculation inputs,
not evidence that a provider invoice has been verified.

## Policy contract

Existing combined allowances and access defaults remain in force. Optional
capability defaults and person overrides configure effective access, monthly
operation/spending ceilings and permitted model profiles. Advanced access still
requires the existing global and individual advanced grant. Expired individual
policies inherit current platform defaults without deleting history.

A person-specific allowance may increase a capability default while remaining
inside the combined account and global hard ceilings. It cannot re-enable a
globally disabled capability or bypass the permitted model-profile boundary.

The People dossier displays effective origin, used, remaining and permitted
profiles. Reservations and unresolved exposure consume the applicable ceilings;
settlement replaces reserved exposure with observed or explicitly estimated
cost. Lowering a policy does not erase usage or reprice dispatched work. Global
hard limits remain authoritative. Policy changes use the existing revision CAS,
session-bound preview, reauthentication, idempotency and audit receipt. No
deployment secrets or environment variables are edited by the interface.

## Administrative experience and definitions

Enter through **Admiralty → AI Usage & Quotas**. Overview leads with observed
cost, confirmed/calculated/estimated coverage, useful recorded results, failures
and unresolved exposure. Quality & Outcomes declares different room acceptance
and Assistant Apply semantics. People & Allowances links to the canonical
dossier. Capabilities describes ownership and outcome definitions. Operation
History offers bounded cursor pages, filters and safe attempt inspection.
Its visible controls filter provider, model, capability, person, outcome, cost
evidence and recorded application source version. Sort by newest, oldest or
highest observed cost; unknown costs remain distinguishable from zero amounts.
The visible configuration disclosure retains the existing quota/model commands
and adds capability and versioned-pricing controls.
Policy confirmation leads with a readable current/proposed changed-values table;
complete snapshots remain in a disclosure. The separate daily activity chart
names its current UTC month and explains that economics/history filters do not
scope it. Model comparisons retain all six columns in a keyboard-accessible
horizontal scroll region on narrow screens.

Date ranges select operations by initiation time in UTC. Later acceptance updates
that request cohort. Acceptance rate is successful reconstruction operations
divided by initiated operations with recorded outcomes; unavailable historical
outcomes are excluded and reported. Cost per accepted room divides all observed
reconstruction cost by distinct accepted owned rooms. Repeated attempts that
produce one accepted room therefore remain economically visible. Assistant
rates distinguish currently applied operations, explicit rejection and verified
undo. Exact mean/median use fully cost-settled logical operations, including
verified no-charge cancellations, and report the sample.
Empty denominators are unavailable, never fabricated zero-percent success.

Models are compared within capability semantics. Low recorded acceptance after
at least ten reconstruction operations produces an investigation signal; it
does not diagnose a cause, blame a person, or change permissions automatically.
The top-consumer projection is bounded to 25 people. Daily trends and the
thirty-day observed run rate disclose coverage and unknown-cost limitations.

History never returns private photographs, raw prompts, retained proposals,
provider keys, or private scene content. Administrator projections use explicit
safe selects, private/no-store responses and server authorization. Monetary
aggregations and bounded record pages do not add provider calls or AI work.

## Synthetic qualification

`scripts/admiralty/ai-economics-fixture.ts` is used only by isolated tests. Creator
A has 40 reconstructions and 2 accepted rooms; B has 10 and 10; C has ordinary
edits; D has an advanced grant; E includes provider failure, retry, cancellation
and unresolved cost. Production projections never insert sample records.

Focused coverage includes fractional precision, historical pricing, missing
dimensions, retry totals, delayed and duplicate reconciliation, unknown exposure,
capability inheritance/denial, simultaneous admissions, genuine outcome
distinctions, private projection fields, pagination and Administrator authority.
The actual browser journey exercises natural Admiralty entry, cost/quality
inspection, a canonical person allowance preview/assurance/confirm, model
configuration discovery, desktop/mobile layouts, accessibility, empty, loading,
error and recovery states. Independent critique and repaired captures are
required before a visual-completion claim.

The protected-main experience plan currently stops at
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity`.
Planning against the prerequisite also identifies uncovered consumers in the
broader spatial/administrative graph. These are qualification gates, not waived
obligations or successful Mainline Decisions. Protected-base journey objects are
preserved; the existing daily chart remains directly accessible. Re-plan and
obtain authenticated capture/review evidence and ordinary Sounding Line after
the Spatial Studio prerequisite is integrated.

Focused lint passes on the changed implementation. Two touched prerequisite
files retain 22 pre-existing lint findings, reproduced from the prerequisite
commit: the non-React `useEnvironmentDefinition` name triggers hook rules in the
Studio route and its lifecycle test, and the existing lifecycle test uses `any`.
Those inherited findings are retained separately from this increment's checks.

Provider-confirmed billing remains unavailable without genuine provider billing
evidence. The server reconciliation seam accepts such evidence from trusted
execution/billing adapters; this increment supplies no invoice-feed adapter and
no administrative control for asserting a billed amount. MySQL schema validation
does not claim execution against a production MySQL server. Browser emulation
does not establish physical mobile, assistive-technology or owner acceptance.

Documentation classification: this is current human engineering evidence under
`Development_Docs`. Active execution context remains in
`.agents/admiralty-ai-economics.md`; product guide, current status, feature status,
changelog, navigation and the completed-feature catalog are reviewed separately.
