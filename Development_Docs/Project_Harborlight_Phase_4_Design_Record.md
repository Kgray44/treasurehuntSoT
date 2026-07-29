# Project Harborlight Phase 4 - Secure the Harbor Design Record

Status: implementation candidate. Base: `origin/main` `3699f5e7c638d950aab3b55169b603121b57c85b`; branch: `codex/project-harborlight-phase4-secure-the-harbor`.

Phase 4 adds durable moderation cases, private evidence metadata, actions, sanctions, appeals, restoration receipts, trusted scanner receipts, operational schedules, and shared-rate-limit state. It preserves the accepted Phase 1-3 Community aggregates and does not copy Chronicle prose, private media, credentials, provider keys, or private object locations.

The case state machine is explicit: `OPEN`, `TRIAGED`, `ASSIGNED`, `INVESTIGATING`, `AWAITING_INFORMATION`, `ACTION_REQUIRED`, `ACTIONED`, `APPEAL_PENDING`, `RESOLVED`, `CLOSED`, `DUPLICATE`, and `DISMISSED`. Every transition is revision-checked, reason-coded, correlated, and recorded. Cases deduplicate only same-subject/same-reason reports; reporter receipts reveal neither case membership nor other reporter information.

Production-facing Harbor features remain fail-closed. A release can be published or restored only with a current provider-bound digest-matching clean receipt. Quarantine changes database eligibility before asynchronous storage work. `INTERNAL_ONLY` remains the default rollout posture; no code path defaults to general availability.

Sounding Line owns the shared test planner, policy, and global resource control plane. This branch avoids its policy files and provides a Harborlight-owned handoff fragment instead.
