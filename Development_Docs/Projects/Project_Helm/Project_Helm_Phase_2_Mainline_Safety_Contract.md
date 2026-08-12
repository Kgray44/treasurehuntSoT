---
title: Project Helm Phase 2 Mainline Safety Contract
audience: product-engineering
status: current
canonical_for: project-helm-phase-2-mainline-safety-contract
last_reviewed: 2026-08-10
---

# Project Helm Phase 2 mainline safety contract

After Phase 2, Captain Library and Console provide derived operational status,
safe crew state, truthful member-scoped presence and synchronization,
current readiness facts, Needs Attention, a canonical-event projection, and a
read-only live progress summary.

The change preserves Phase 1 Captain-only and Captain + Player relationships,
ordinary Player-safe perspective, existing Captain command endpoints,
invitations, Player Library, history, and artifact semantics. It introduces the
minimal additive `MembershipPresenceDevice` Platform source and paired SQLite/
MySQL migrations; it does not introduce a duplicate Chronicle event source,
shadow Voyage state, or progression mutation from a read. The legacy aggregate
`TaleSession.lastHeartbeatAt` remains compatibility-only, while member display
and summary derive from authenticated membership/device evidence.

Intentionally unfinished: Phase 3 command redesign/Action Rail/interactive
progress actions, approval and hint workflow redesign, and Phase 4 preflight,
recovery, provider fallback, and reconciliation operations.

If Helm stops after this phase, Captain operation remains substantially more
informative and useful: it reports what is known, what is unknown, what needs
attention, who is ready and connected, current safe progress, and recent safe events without
requiring any future phase for that correctness.
