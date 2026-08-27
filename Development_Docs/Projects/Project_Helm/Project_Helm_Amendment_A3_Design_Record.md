---
title: Project Helm Amendment A3 Design Record
audience: product-engineering
status: current
canonical_for: project-helm-amendment-a3-design-record
last_reviewed: 2026-08-27
---

# Project Helm Amendment A3 design record

## Scope

Amendment A3, **Ready the Room**, completes the governed pre-launch room after
accepted A1 Crew lifecycle and A2 Captain succession. It makes the existing
authoritative state legible to Captain-only, Captain + Player, and ordinary
Player audiences without starting original Helm P3 **Give the Orders**.

## Ownership and invariants

`TaleSession`, `PlaythroughMembership`, `Invitation`,
`MembershipPresenceDevice`, and the A2 authority receipts remain the only
sources of Voyage, membership, invitation, presence, and Captaincy truth. A3
adds no schema, event stream, readiness authority, or progression store.

The Player Waiting Room reads the existing Player-safe projection. The new
Captain Muster reads the existing Captain operational projection. Both call
only existing scoped lifecycle, invitation, launch, transfer, relinquishment,
and cancellation routes. Client refresh, event listening, and animation
reconcile projections; they never infer access or mutate shared state.

## Product decisions

- A Captain-only Voyage has no Player membership. It states that fact plainly,
  keeps **Leave Waiting Room** distinct from membership exit, and can launch
  directly when the canonical Voyage state permits launch.
- A participating Captain remains an ordinary Player. The Player room replaces
  misleading "Awaiting Captain" language with clear Captain readiness and an
  in-room **Begin Voyage** control when the existing readiness gate permits it.
- Crew cards use safe display name/alias, initials-only avatar placeholder,
  Captain and self markers, invitation and membership state, readiness,
  presence, and synchronization. Figurehead is intentionally not implemented.
- Invitation, removal, cancellation, transfer, relinquishment, takeover,
  continuation, and leave controls retain their existing authorization,
  CSRF, expected-version, and idempotency boundaries. A3 only places the
  already-authorized controls where their source projection makes them useful.
- Terminal membership rows remain readable to current Crew so a removal,
  departure, or cancellation is explained rather than looking like a vanished
  person. Private account, device, draft, progression, and Story data remain
  absent from the projections.

## Accessibility and recovery

Both rooms provide live reconciliation summaries, explicit refresh/reconnect
actions, keyboard-reachable controls, semantic headings, responsive card grids,
and the established reduced-motion path. A Captain-only event subscription may
be unavailable because it has no Player membership; bounded polling remains the
safe refresh fallback.

## Boundaries

This amendment does not redesign Captain commands, create Figurehead avatars,
alter progression semantics beyond permitting a true zero-membership
Captain-only launch, or begin Helm P3/P4/P5. Deployment, live-Voyage proof,
production MySQL execution, and owner acceptance remain separate.

## Related records

- [Project Helm index](README.md)
- [A3 test plan](Project_Helm_Amendment_A3_Test_Plan.md)
- [A3 validation record](Project_Helm_Amendment_A3_Validation_Record.md)
- [A3 integration manifest](Project_Helm_Amendment_A3_Integration_Manifest.md)
