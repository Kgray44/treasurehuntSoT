---
title: Project Admiralty Brightwork Wave 5 Owner Contract
audience: engineering-security-operations
status: current
canonical_for: project-admiralty-brightwork-wave-5-owner-contract
last_reviewed: 2026-09-04
---

# Project Admiralty Brightwork Wave 5 owner contract

Brightwork Wave 5 adds one narrow, real, owner-owned configuration capability:
the Harborlight Community outbox runtime policy. Admiralty continues to
orchestrate authorization, preview, recent privileged assurance, and safe audit
projection; it does not own Community worker behavior, deployment configuration,
credentials, provider actions, or release control.

This record supersedes the older Phase 3 `BLOCKED_BY_MISSING_OWNER_CONTRACT`
disposition only for this newly published Harborlight policy. The Phase 3
registry remains an accurate record of the previously accepted source state.

## Configuration inventory

`src/admiralty/configuration-registry.ts` is the executable source-bound
inventory for every setting projected by `/admin/configuration`. Its management
vocabulary is `RUNTIME_EDITABLE`, `POLICY_EDITABLE`,
`FEATURE_FLAG_EDITABLE`, `PROVIDER_SAFE_EDITABLE`, `DEPLOYMENT_MANAGED`,
`SECRET_REFERENCE_ONLY`, `IMMUTABLE_SECURITY`, `EXTERNAL_OWNER`, and
`OBSERVE_ONLY`.

The current inventory has three `POLICY_EDITABLE` entries, four
`DEPLOYMENT_MANAGED` entries, and eight `SECRET_REFERENCE_ONLY` entries. No
current source-backed entry is classified as runtime editable, feature-flag
editable, provider-safe editable, immutable security, external owner, or
observe-only; those classes remain reserved for a future owner contract rather
than simulated by an Admiralty control.

| Stable ID   | Setting                             | Class                 | Owner             | Chartroom disposition                                     |
| ----------- | ----------------------------------- | --------------------- | ----------------- | --------------------------------------------------------- |
| ADM-CFG-001 | Runtime environment                 | DEPLOYMENT_MANAGED    | Platform delivery | Safe label only; deployment rollback                      |
| ADM-CFG-002 | Database provider                   | SECRET_REFERENCE_ONLY | Platform delivery | Provider identity only; no connection material            |
| ADM-CFG-003 | Google sign-in reference            | SECRET_REFERENCE_ONLY | Wayfarer          | Presence only; owner deployment action                    |
| ADM-CFG-004 | GitHub sign-in reference            | SECRET_REFERENCE_ONLY | Wayfarer          | Presence only; owner deployment action                    |
| ADM-CFG-005 | Transactional email reference       | SECRET_REFERENCE_ONLY | Wayfarer          | Presence only; health contract remains pending            |
| ADM-CFG-006 | Private storage reference           | SECRET_REFERENCE_ONLY | Sealed Hold       | Reference only; no credentials or object paths            |
| ADM-CFG-007 | Private scanner reference           | SECRET_REFERENCE_ONLY | Sealed Hold       | Reference only; no scanner credentials                    |
| ADM-CFG-008 | Private worker deployment state     | DEPLOYMENT_MANAGED    | Sealed Hold       | Non-editable deployment state                             |
| ADM-CFG-009 | Community storage reference         | SECRET_REFERENCE_ONLY | Harborlight       | Reference only; no storage credentials                    |
| ADM-CFG-010 | Community scanner reference         | SECRET_REFERENCE_ONLY | Harborlight       | Reference only; no scanner credentials                    |
| ADM-CFG-011 | Community worker deployment state   | DEPLOYMENT_MANAGED    | Harborlight       | Non-editable process enablement                           |
| ADM-CFG-012 | Community rate-limit provider       | DEPLOYMENT_MANAGED    | Harborlight       | Non-editable fail-closed provider selection               |
| ADM-CFG-013 | Accept new Community outbox work    | POLICY_EDITABLE       | Harborlight       | Part of the governed policy command                       |
| ADM-CFG-014 | Community jobs per batch            | POLICY_EDITABLE       | Harborlight       | Bounded 1–25; part of the governed policy command         |
| ADM-CFG-015 | Idle Community worker poll interval | POLICY_EDITABLE       | Harborlight       | Bounded 1–60 seconds; part of the governed policy command |

## Governed policy operation

`COMMUNITY_OUTBOX_RUNTIME_POLICY_UPDATE` is implemented by
`src/community/operational-policy.ts` and mediated by the thin Admiralty port
at `src/admiralty/ports/harborlight-runtime-policy-command.ts`.

- The policy is revision-bound, durable, and read by the real Community worker
  before it claims work. When dispatch is paused, expired leases can still be
  released but new work is not claimed.
- Inputs are a boolean dispatch state, batch size `1..25`, poll interval
  `1000..60000` milliseconds, an 8–240 character reason, the expected revision,
  and a request-specific idempotency key.
- `CONFIG_OPERATE`, server-side CSRF validation, a current session, and recent
  privileged reauthentication are required for execution. Support Access does
  not delegate this authority.
- Preview reports the current and resulting bounded policy. Execute performs an
  atomic revision check, persists an owner receipt and a redacted administrative
  audit event, and returns the correlation identity. A stale revision or reused
  key with a different request fails without a partial update.
- A revert is a new previewed change using the resulting revision. It is never a
  hidden environment-variable write.

`RELEASE_EXPIRED_OUTBOX_CLAIMS` is the sole safe Harborlight job operation. It
requires `JOBS_OPERATE` and recent privileged assurance, releases only already
expired claims, and neither reads payloads nor retries, cancels, requeues,
creates, or claims jobs.

## Authority and surface boundaries

`/admin/configuration` requires `CONFIG_OBSERVE`; policy execution additionally
requires `CONFIG_OPERATE`. `/admin/operations` requires `JOBS_OBSERVE`; lease
recovery additionally requires `JOBS_OPERATE`. Ordinary Player, Captain, and
Creator identities have no Admiralty role capability; an operator with an
unrelated capability, such as `MODERATION_OPERATOR`, cannot reach or execute a
Configuration action. Unauthorized administrative routes remain non-revealing.

Provider cards distinguish configured, code-supported, health, freshness, live
validation, capability, and safe owner action. The current action is a bounded
fresh projection read, not a synthetic provider control. Releases remain an
explicit external deployment-owner handoff: Admiralty reports build evidence and
does not offer deploy, rollback, restart, retry, or cancellation actions.

## Verification boundary

The Wave 5 task-owned synthetic journey creates a real policy record, verifies
the worker pauses before claiming a new event, rejects a stale preview without
mutation, records the safe audit receipt, and applies a governed revert. It also
exercises expired-lease recovery, role filtering, desktop and mobile navigation,
no-horizontal-overflow, and serious/critical accessibility checks. It does not
claim live provider, production deployment, or owner-acceptance proof.
