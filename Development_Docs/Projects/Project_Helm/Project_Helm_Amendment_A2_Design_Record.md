---
title: Project Helm Amendment A2 Design Record
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a2-design-record
last_reviewed: 2026-08-27
---

# Project Helm Amendment A2 design record

## Scope

Amendment A2, **Pass the Helm**, adds a bounded Captain-authority lifecycle after A1 Crew membership and before A3 or original Phase 3. It adds direct transfer, explicit relinquishment into **Succession Hold**, first-committed takeover, and ordinary Player **Continue Solo** forks. It does not begin A3, redesign original Phase 3 commands, or add a second Voyage progression source.

## Canonical ownership

`TaleSession` remains the sole shared Voyage source for edition identity, progression state, status, and Captain authority. Its additive `captainAuthorityState` is `ASSIGNED` or `VACANT`; `VACANT` is a governed hold, not cancellation, archive, or timeout. `PlaythroughMembership` remains the sole ordinary Player membership source. An authority change never creates, deletes, or changes a membership.

`VoyageCaptainAuthorityReceipt` records an idempotent, correlation-bound safe receipt for transfer, relinquishment, or takeover. `VoyageForkLineage` records the parent Voyage, child Voyage, requester, source concurrency version, source sequence, and idempotency/correlation keys. They are lifecycle evidence only, not a Helm event stream or an alternate progression log.

## Decisions and invariants

- Direct transfer requires the current Captain's active ordinary Player membership and another currently joined Player. The old Captain's membership remains unchanged while scoped authority moves atomically.
- Relinquishment clears Captain authority and enters Succession Hold without cancelling the shared Voyage. Shared progression and verification completion reject while authority is vacant.
- Takeover is restricted to a currently joined Player and uses a versioned `VACANT` claim. Only the first committed request receives authority; the other receives a stale-state result and must refresh.
- Continue Solo is deliberately not a shared-Voyage claim. It creates a new Captain + Player Voyage from the same immutable published edition and last committed shared state, records durable lineage, and does not change the parent Voyage. Different Players may fork the same source concurrently.
- Forks copy only allowlisted canonical progression entries and shared state. They do not copy other memberships, invitations, presence, journal reading preferences, private reflections, verification evidence, account/session data, Creator drafts, or other Player-private state.

## Product surfaces

Captain operational controls show **Transfer Captaincy** only for eligible Crew and keep **Relinquish Captaincy** visually and semantically separate from **Cancel Voyage for Everyone**. Player Library and Waiting Room project Succession Hold and provide **Take Captaincy**, **Continue Solo**, and **Leave Voyage**. All mutation routes require the existing scoped authority or ordinary Player identity plus CSRF, expected version, and idempotency key.

## Boundaries

This record establishes source and local/synthetic validation behavior only. It does not claim deployment, production-MySQL execution, live-Voyage proof, external provider proof, owner acceptance, A3, or original Phase 3 work.

## Related records

- [Project Helm index](README.md)
- [A2 test plan](Project_Helm_Amendment_A2_Test_Plan.md)
- [A2 validation record](Project_Helm_Amendment_A2_Validation_Record.md)
- [A2 integration manifest](Project_Helm_Amendment_A2_Integration_Manifest.md)
