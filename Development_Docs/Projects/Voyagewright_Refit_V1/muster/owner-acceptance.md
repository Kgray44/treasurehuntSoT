---
title: Muster Owner Acceptance
audience: product-engineering
status: current
canonical_for: voyagewright-refit-v1-muster-owner-acceptance
last_reviewed: 2026-09-12
---

# Muster owner acceptance

The owner explicitly accepted the currently running Refit implementation on **2026-09-12**, in the final-acceptance objective attached to this task (`bda8c74e-c460-4c2e-9070-688e5c96c0a6/goal-objective.md`). This supersedes the iteration stop boundary. The owner authorized final validation, one product PR, normal Sounding Line qualification, protected merge and landed-tree smoke; no other Refit area is in scope.

## Accepted identity

- Area: `muster`; [design packet](design-packet.md).
- Branch: `refit-v1/muster` in the existing owned Refit worktree.
- Accepted implementation: `11509df7c686806d58989223804f13aa0c3aa0b1`, preserving the first implementation and all accepted iteration 2/3 changes, including the narrow composer correction.
- Decision: **OWNER_ACCEPTED**; next state **FINAL_VALIDATION**.
- Canonical surfaces: `/captain/voyages/[playthroughId]/muster` and `/player/playthroughs/[playthroughId]` (shared role-aware waiting-room projection).
- Accepted visual reference: the current implementation, originally based on supplied `image-3.png`; its current visual decisions take precedence over reinterpretation of that mockup.
- Exact changed-product and asset SHA-256 identities: [accepted reference manifest](accepted-reference/manifest.json).
- Captured reference states: [Captain desktop](accepted-reference/captain-desktop.png), [Player desktop](accepted-reference/player-desktop.png), [tablet](accepted-reference/captain-tablet.png), [tablet chat](accepted-reference/captain-tablet-chat.png), [mobile](accepted-reference/captain-mobile.png), [mobile chat](accepted-reference/captain-mobile-chat.png). These capture the accepted synthetic review state, including owner-made membership/chat changes; they are not frozen production data.

## Do-not-regress contract

Preserve the exact environment/crop and stationary artwork; Captain and Player composition; real crew and invited-member cards; authorized Invite Crew action; operational persistent Crew Chat and its design; parchment, source-bound Chronicle identity/cover, readiness and role controls; measured options disclosure; quote wording, gold italic typography, rules and ornament; current lower-stage chat/quote placement; and responsive behavior. No discretionary visual changes or generic component substitutions are authorized. A correction requires an evidenced defect from final validation and focused reproof.

Preserve every owner-review fixture, including terminal and lifecycle proof states, with its invitations, memberships, published edition and chat. The task-owned SQLite backup and final validation database are separate; no real user data is involved. Fixture construction scripts remain development-only.

Owner acceptance proves design approval. It does not itself prove test success, Sounding Line PASS, protected merge or release. [Final validation and integration](final-validation.md) records those separate gates.
