---
title: Muster Refit Iteration Delta 3
audience: product-engineering
status: current
canonical_for: voyagewright-refit-v1-muster-iteration-3
last_reviewed: 2026-09-12
---

# Muster iteration delta 3

The owner's 2026-09-12 follow-up requests only lower placement of Crew Chat and the quote/ornament, preserving the approved composition. A subsequent screenshot requests removal of the message textarea's narrow-view scrollbar and resize grip. This remains `IMPLEMENTATION_ITERATING`; no owner acceptance, merge or broad acceptance was performed.

## Positioning and composer

Desktop uses one `--muster-lower-shift: 20px` token. `useMusterStage` records the approved closed-stage height after initial layout/font loading and recalibrates only for viewport resizing. Its calculation excludes the options disclosure's expanded height before applying the existing parchment minimum. Subsequent parchment, options and chat content changes cannot resize that coordinate system. Chat and quote use their existing horizontal coordinates and independent bottom edges within it. Neither the scene's document height nor element dimensions, typography, spacing or decoration changes.

Tablet and mobile retain their existing grid/stack flow. Their message textarea hides the native scrollbar and resize grip; overflow remains scrollable by keyboard/touch and Shift+Enter still inserts a newline. Chat history scrolling is unchanged. The same scoped composer correction applies on desktop.

## Focused evidence

Evidence remains in ignored `.runtime/muster/delta3`: `before.json`, `focused-proof.json`, three desktop screenshots and `narrow-composer.png`. At widths 1280, 1536 and 1920, all measured horizontal positions and dimensions are unchanged, with exactly 20 px downward translation for chat and quote. Scene/footer geometry remains unchanged; chat and visible ornament clear the footer. Repeated disclosure toggles and temporary longer parchment copy leave both anchors and the environment fixed. Chat feedback does not move the quote.

A 390 px view confirms no composer scrollbar or resize grip, retained multiline typing and keyboard scrolling of long drafts, and no horizontal overflow. The browser reports no runtime errors. Existing focused Captain, Player, chat and Chronicle-source tests pass (20 tests across four files). Browser draft/text probes are transient; no fixture records or messages were changed by this delta.

This document is current engineering evidence. Product features and affected guides were reviewed; this is local positioning/composer polish without a feature catalog capability change. [Delta 2](iteration-2-delta.md) retains the canonical parchment field mapping and fixture URLs. [Design packet](design-packet.md) retains the approved visual contract.
