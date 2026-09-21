# Project Harborlight Phase 4 - Secure the Harbor Design Record

Status: implementation candidate. Base: `origin/main` `3699f5e7c638d950aab3b55169b603121b57c85b`; branch: `codex/project-harborlight-phase4-secure-the-harbor`.

Phase 4 adds durable moderation cases, private evidence metadata, actions, sanctions, appeals, restoration receipts, trusted scanner receipts, operational schedules, and shared-rate-limit state. It preserves the accepted Phase 1-3 Community aggregates and does not copy Chronicle prose, private media, credentials, provider keys, or private object locations.

The case state machine is explicit: `OPEN`, `TRIAGED`, `ASSIGNED`, `INVESTIGATING`, `AWAITING_INFORMATION`, `ACTION_REQUIRED`, `ACTIONED`, `APPEAL_PENDING`, `RESOLVED`, `CLOSED`, `DUPLICATE`, and `DISMISSED`. Every transition is revision-checked, reason-coded, correlated, and recorded. Cases deduplicate only same-subject/same-reason reports; reporter receipts reveal neither case membership nor other reporter information.

Production-facing Harbor features remain fail-closed. A release can be published or restored only with a current provider-bound digest-matching clean receipt. Quarantine changes database eligibility before asynchronous storage work. `INTERNAL_ONLY` remains the default rollout posture; no code path defaults to general availability.

Sounding Line owns the shared test planner, policy, and global resource control plane. This branch avoids its policy files and provides a Harborlight-owned handoff fragment instead.

## Data ownership and retention

`CommunityModerationCase` is the durable decision aggregate. Reports remain
independent receipts, with an optional current-case pointer and a preserved
case/report link. Case subjects intentionally retain scalar `subjectType` and
`subjectId`: the pair is polymorphic, so `src/community/moderation-subject.ts`
is the only resolver. It returns a bounded tombstone when a source is removed;
it never substitutes another live record. All non-polymorphic Phase 4 links
have Prisma relations and database foreign keys. Historical case evidence,
actions, sanctions, appeals, appeal events, and restoration receipts use
`RESTRICT`; an optional report case pointer and optional scan-receipt link use
`SET NULL` so retention is not defeated by casual deletion.

Evidence stores a checksum, kind, bounded safe snapshot, access class, actor,
and correlation identifier. It does not store bytes, source object keys,
private descriptions, credentials, raw scanner replies, or a public URL.
Reading evidence records an access event. Scan receipts likewise persist only
provider identity/version, bounded definition evidence, checksum, length,
media type, result, expiry, and correlation.

## Authorization and state machines

Routes derive the actor from the canonical account identity and database role
assignments; callers cannot supply their own role. A moderator cannot action a
subject they own, action a subject not attached to the case, review their own
action, review their own appeal, or review an appeal filed by them. Every case
write checks its expected revision. An idempotency replay must match the
original case, subject, action, and reason exactly.

Case states are: `OPEN -> TRIAGED -> ASSIGNED/INVESTIGATING/ACTION_REQUIRED`,
then `ACTIONED`, `APPEAL_PENDING`, `RESOLVED`, or `CLOSED` according to the
explicit transition matrix. Appeals are separately constrained from
`SUBMITTED` through review to `UPHELD`, `OVERTURNED`,
`PARTIALLY_OVERTURNED`, `WITHDRAWN`, or `CLOSED`. Overturning lifts an active
sanction but does not automatically re-expose content: governed restoration
still requires current checksum-matching clean evidence.

## Operations

`CommunityOutboxEvent` is the work contract. A worker atomically claims each
eligible event by owner and lease, heartbeats its lease while a handler runs,
uses bounded deterministic exponential backoff, and moves repeated failures to
the terminal/dead-letter state. A graceful shutdown releases only its own
claims; an ungraceful stop is recovered by lease expiry. Schedulers only enqueue
durable work for reconciliation, expiry, retention, backup, and orphan review;
they never delete or restore objects directly.

The database rate limiter hashes scope plus account/network/subject/action
dimensions before persistence. It uses a transaction and conditional increment,
provides retry-after, rolls windows deterministically, and fails closed for
high-risk calls when unavailable. The in-memory adapter is development-only and
must be selected explicitly.

## Provider configuration, deployment, and rollback

Use `COMMUNITY_BINARY_SCANNER_PROVIDER=clamav` only with the accepted Sealed
Hold transport configuration. A missing, malformed, timed-out, stale, or
digest/length-mismatching receipt is not clean. Use the local storage bridge
only with isolated roots outside the repository; production object stores must
be selected through the accepted Sealed Hold adapter and must never expose a
storage key to a public response. Alert status is `ALERTING_NOT_CONFIGURED`
until an external destination is both configured and verified.

Deploy schema changes in order, then start workers with a unique owner and
bounded concurrency. Rollback stops new worker intake, leaves durable events
for lease recovery, and keeps database quarantine eligibility in force. Do not
roll back by deleting moderation records, scan receipts, or restoration
receipts. Investigations begin with case and outbox correlation IDs, provider
health, lease age, dead-letter count, and reconciliation dry-run output.
