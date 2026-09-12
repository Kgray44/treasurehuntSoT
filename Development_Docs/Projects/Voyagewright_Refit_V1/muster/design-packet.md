---
title: Muster Refit Design Packet
audience: product-engineering
status: current
canonical_for: voyagewright-refit-v1-muster
last_reviewed: 2026-09-12
---

# Muster experience

## Identity and authority

- Area: Muster / waiting room; registry ID: muster.
- Treatment: MAJOR_STRATEGY_RETHINK.
- Lifecycle: IMPLEMENTATION_ITERATING.
- Branch: refit-v1/muster.
- Worktree: D:/CodexWorktrees/treasurehunt-refit-v1-muster.
- Protected-main baseline: a8b72f37 (Refit setup integrated).
- Routes: /captain/voyages/[playthroughId]/muster and /player/playthroughs/[playthroughId].
- Owner direction and concept approval: attached goal-objective.md and image-3.png, 2026-09-12.
- Owner acceptance: absent. No merge or final Sounding Line validation authorized.

## Current experience and preservation

The existing rooms provide Captain and Player projections, canonical invitation acceptance/readiness, lifecycle commands, Player presence, and live reconciliation. Their separate list/card layouts do not provide the approved illustrated composition or Crew Chat.

Preserve the real global header, One Voyage membership and launch contract, Helm authority commands, destructive confirmations, Player privacy, role and participation separation, effective motion preferences, and automatic Player handoff after launch. Preserve unrelated pages and the shared port-3000 runtime.

## Approved visual contract

The supplied complete mockup is the implementation target, not inspiration. Reproduce its full-bleed warm lantern room and moonlit harbor, upper-left title, teal glass crew cards and dashed open seat, lower-left Crew Chat, tall right parchment, inset cover, compact details/readiness/action area, and substantial atmospheric negative space. All identities, messages, Chronicle details, readiness and buttons remain real UI.

Assets: image-1.png environment; image-2.png island cover/fallback; image-3.png approved full mockup; image-4.png blank parchment. Original attachments are retained as references under the task attachment directory; implementation copies live under public/images/muster. The parchment is an independent decorative layer replaceable without component redesign.

Exact quote: “Not all who wait are idle - some are simply gathering a better story.” Preserve centered gold italic serif styling, thin horizontal rules, and compass ornament.

## Behavior and data

One shared role-aware room derives Captain authority and Player participation independently from canonical records. Captain-only never adds a Player to readiness totals. Launch availability follows existing One Voyage rules, including its at-least-one-ready contract when membership rows exist. Readiness is currently established by canonical invitation/participation actions; this task does not invent a readiness toggle.

Crew Chat is Voyage-scoped, persisted, plain text, current-member/Captain authorized on every access, length/rate bounded and idempotent on retries. Use the existing Voyage event bus and polling reconciliation. Show recent history, sender identity/time, reconnect/error states and unread messages while preserving older-message scroll position.

Only task-owned synthetic records may be used for development proof. Seeded Forever Treasure cover changes are narrowly identified and must not overwrite unrelated Chronicle media or immutable published content.

## Responsive, motion and accessibility

Desktop most closely follows the mockup. Tablet rebalances crew and parchment. Mobile stacks identity, crew, parchment and chat while retaining all actions and decoration. Use semantic headings, keyboard forms, visible focus, labeled controls, safe plain text and state announcements. Atmospheric glow and arrivals respect browser and product reduced-motion settings; the static scene remains complete.

## Preview and focused proof

Persistent preview origin: http://127.0.0.1:3128. Database, assets, build output and browser sessions are task-owned. Focused proof covers Captain-only, Captain+Player, Player-only, readiness states, chat send/receive/persistence/authorization, specific/fallback covers, desktop/mobile/overflow, reduced motion and runtime errors.

Final broad validation and owner acceptance are deferred. Continue only the owner's named Muster deltas and leave the preview running.

## Iteration history

| Iteration | Date       | Request                                                                            | Result                                               | Owner response     |
| --------- | ---------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------ |
| 1         | 2026-09-12 | Owner-approved full Muster implementation                                          | Preview ready; [focused proof](iteration-1-proof.md) | Pending inspection |
| 2         | 2026-09-12 | Smooth options, fixed room artwork, invitation action card, published-source audit | [Delta and source mapping](iteration-2-delta.md)     | Pending inspection |
| 3         | 2026-09-12 | Lower chat and quote; remove composer scrollbar and resize grip                    | [Positioning proof](iteration-3-delta.md)            | Pending inspection |
