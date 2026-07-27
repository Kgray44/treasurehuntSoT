# Project Lanternwake Phase 5 PageFlip Lifecycle Specification

Status: **FROZEN IMPLEMENTATION CONTRACT**

## Ownership

`PageFlipBook` is the only physical-page owner. It owns pointer/touch drag, keyboard/control intent, programmatic turn, page index, orientation, double/single-page behavior, clone identity, and curl transforms. GSAP may prepare a scene before a turn or react after a committed turn; Motion may animate tabs/controls/layout; CSS may render paper, edge light, and nonessential hover material. None may write the StPageFlip transform node.

## Lifecycle

An intent is normalized as `control-next`, `control-previous`, `keyboard-next`, `keyboard-previous`, `imperative-next`, `imperative-previous`, `imperative-turn-to`, `imperative-flip-to`, `runtime-gesture`, or `runtime-initialization`. Public semantic outcomes are `turn-start`, `turn-commit`, `turn-settle`, `turn-cancel`, and `turn-failed`. The DOM browser event `forever:page-turn-lifecycle` reports a versioned detail object with book/mount IDs, runtime and boundary generation, source/request, from/to/current page, phase/outcome, reason, and runtime/reduced/fallback status.

`turn-commit` is the only valid page-turn audio boundary. A rejected/no-op/cancelled turn has no commit audio. Queued intent uses one latest valid destination; a newer intent explicitly cancels a displaced one.

## Mode and recovery

Full uses the approved physical timing; gentle uses the same logical book with shortened timing; reduced bypasses curl and exposes exactly one readable static page. On mode/orientation/content update, the component captures current page, focus memory, identity/revision, orientation, and pending intent. It then restores the nearest valid page, one clone generation, focus, and queued intent. A removed page clamps to the nearest readable index and announces its resulting page through existing controls.

Runtime import/init/readiness failures enter readable fallback. The fallback never restarts the journal opening, retains current page/navigation, and emits a lifecycle failure. Twenty-cycle behavior must return PageFlip counts and clone records to baseline.

## Source/clone integrity

The hidden React source is `aria-hidden`, `inert`, excluded from target registration, and stripped of cinematic authority. The visible primary clone alone can be target-eligible when its instance/generation/page/orientation/lifecycle/current-page identities match. Temporary, stale, unproven, detached, and noncurrent clones are inaccessible and ineligible. IDs are namespaced deterministically; duplicate accessible content is forbidden.

## Consumer requirements

Physical Journal, Side Quest Ledger, completed archive, and future Ship's Log pagination must pass stable page IDs and a content revision. Chapter tabs activate at turn commit, never request a competing curl. Filter updates retain a compatible runtime; if recreation is required, focus and page identity recover under this contract. Reduced mode keeps all page controls available by keyboard and does not mount a second accessible copy.
