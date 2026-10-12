---
title: Spatial Assistant floating controls correction
audience: engineering
status: current
canonical_for: spatial-assistant-floating-controls-correction
last_reviewed: 2026-10-12
---

# Floating assistance controls

The Creator can drag the floating title, resize from all four edges and corners, or use focused handles with arrow keys and Shift for larger steps. Account-scoped browser preferences retain window geometry across docking and reopening; reset restores defaults. Bounds keep the complete window reachable after viewport changes. The conversation scrolls above the bottom composer; compact window layouts keep the composer and title controls reachable. Scene dimensions and authored content remain independent of these presentation changes.

The isolated owner preview had a configured shared Windows credential but global assistance was disabled by default. Standard assistance was enabled through the existing audited Admiralty preview/execute flow after the owner requested testing, retaining existing quota and spending enforcement. This preview activation does not change default product policy or store credentials in source. No paid inference was initiated for the correction.

## Focused verification

Source `efca482a6644345868b0d5af33d4e25a031c3432`, protected base `81fa477c5099b259e0d3bd8e8e0e6e52a7dc02bb`, has 13 passing geometry/layout tests and five passing isolated production-browser journeys. Compilation, TypeScript, lint, formatting and documentation validation pass. The [local receipt](evidence/floating-controls/local-efca482a/floating-run.json) binds the unpaid synthetic provider and generated-schema equivalence; its existing loaded Prisma client was preserved to avoid replacing the Windows DLL used by the owner preview. [Geometry observations](evidence/floating-controls/local-efca482a/floating-observations.json) and actual screenshots/recordings preserve all eight pointer drags, keyboard controls, reload/dock restore, constrained screens and unchanged persisted scene.

The first browser run exposed shell-header interception and landscape composer clipping. Bounds now remain below the shell header, and the assistant uses its actual available height for compact composition. The new persisted-scene assertion starts from an explicitly saved baseline. Existing protected experience journeys are preserved and a separate floating-control journey is added.

Independent review, protected capture/review attestation, ordinary qualification and landed smoke are separate gates for [PR #719](https://github.com/Kgray44/treasurehuntSoT/pull/719). The owner accepted the earlier A1 presentation; this correction does not invent a new owner acceptance, live-model evaluation, physical touch/AR proof or Player Lens refit.

This is an ergonomic correction within the completed Spatial Assistant capability. The owning feature fragment requires no semantic capability change. Product features, current status, feature status and the Creator/Studio guides were reviewed; the guides and changelog describe the new controls.

After successful movement or resizing, the title provides visible feedback and a polite accessibility announcement. The final local run at `217925d2` passed the same five browser journeys after that addition; its [current receipt](evidence/floating-controls/final-local/floating-run.json) preserves exact source identity. Product source is unchanged by the subsequent contract-only successor `45887480`. The [initial independent local review](evidence/floating-controls/initial-independent-local-review.json) covers all 17 dimensions without blockers; current protected packet inspection remains required.
