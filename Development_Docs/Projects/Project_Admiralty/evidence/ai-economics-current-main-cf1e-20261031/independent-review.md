---
title: Admiralty AI economics cf1e development review
status: preserved-development-evidence
last_reviewed: 2026-10-31
---

# Admiralty AI economics current-main development review

Protected base `cf1e5ad78b3e2b633d4ed691f396a4bab0191217`; candidate
`1f97ca2891fb614d2113abe790e61cc2569f08fe`. The experience planner
classified the change as cross-project experience with 15 selected contracts,
37 browser test paths, and source digest
`e7b5051d1ab3b7c3734a3a9d2175928e892bb78e2264bb85f5b8b5e452928064`.
The task-owned development runner passed the Admiralty browser journey and the
existing Parallax owner-availability case from the same frozen build. Neither
is protected Sounding Line acceptance.

An independent reviewer in `/root/admiralty_visual_review` inspected seven
fresh screenshots before reading new source. At 390px,
`browser/allowance-preview-detail-mobile.png` shows full Current and Proposed
values in stacked cards. `browser/allowance-preview-320-mobile.png` shows the
same values at 320px, including complete long policy origins. The desktop
`browser/allowance-preview-desktop.png` retains the complete three-column
table. The earlier clipped-preview blocker remains resolved, with no new
blocking visual issue in the reviewed captures.

The reviewer also observed separate cost and unresolved exposure on desktop
and mobile, the UTC-day quality sample and exact table, and an error state
that names the last loaded period and offers Retry. The review is based on
static screenshots. The 320px image is a viewport segment; live keyboard,
touch, screen-reader semantics, reduced-motion timing, and the local video
were not independently inspected. Synthetic fixtures do not establish live
provider billing or production behavior. The browser assertions and
accessibility scan are supporting development evidence, not a substitute for
protected qualification or owner product acceptance.

The original `browser-journey.webm` is retained. A local Chromium decoding
attempt yielded blank extracted frames despite valid video metadata, so those
generated frames were excluded from this evidence set. No motion or transition
claim is inferred from that attempt.
