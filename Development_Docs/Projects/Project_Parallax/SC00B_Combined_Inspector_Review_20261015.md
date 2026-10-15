---
title: SC-00B combined Spatial Inspector candidate review
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc00b-combined-inspector-review
last_reviewed: 2026-10-15
---

# SC-00B combined Spatial Inspector candidate review

The isolated integration probe `166e0ffeeb670b71745d3dc3353f2855420d5199` combines the SC-00B contextual Inspector and rail with the active SC-00 room/group selection and SC-02 typed elements from root source `e073eaa29f71965c316b459d4f9f08773232c9d6`. It preserves the root Canvas selection and rendering paths, current Library workspace, room editor, and canonical authoring commands. [The capability matrix](SC00B_Property_Capability_Matrix.md) reconciles earlier controls with the combined probe.

The production Chromium journey passed in a task-owned server with an isolated SQLite database and synthetic Creator. It captured eleven selection contexts at each of Guided, Standard, and Engineering, plus a 390 px phone Scene settings view. The test asserted typed light depth, group context safety, Timeline access for a playback-bound audio element, no page errors, and no serious or critical axe finding in the phone Inspector. The [observations](evidence/sc-00b/combined-166e0ffe/observations.json), [browser runtime receipt](evidence/sc-00b/combined-166e0ffe/browser-runtime.json), and [suite receipt](evidence/sc-00b/combined-166e0ffe/browser-suite-profile.json) preserve that boundary. Four focused component suites passed 22 tests; TypeScript and targeted lint passed. Screenshots are actual rendered application captures; the model and room are synthetic.

## Owner review captures

The Inspector scrolls independently, so each full-page image records the visible panel viewport at selection time. Technical controls below the fold remain reachable by scrolling and need owner inspection during acceptance.

| Selection | Guided | Standard | Engineering |
| --- | --- | --- | --- |
| Parchment note | [view](evidence/sc-00b/combined-166e0ffe/parchment-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/parchment-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/parchment-engineering.png) |
| Furniture asset | [view](evidence/sc-00b/combined-166e0ffe/furniture-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/furniture-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/furniture-engineering.png) |
| Light | [view](evidence/sc-00b/combined-166e0ffe/light-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/light-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/light-engineering.png) |
| Playback-bound spatial audio | [view](evidence/sc-00b/combined-166e0ffe/timeline-audio-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/timeline-audio-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/timeline-audio-engineering.png) |
| Interaction volume | [view](evidence/sc-00b/combined-166e0ffe/interaction-trigger-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/interaction-trigger-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/interaction-trigger-engineering.png) |
| Editable Environment | [view](evidence/sc-00b/combined-166e0ffe/environment-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/environment-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/environment-engineering.png) |
| Furniture room feature | [view](evidence/sc-00b/combined-166e0ffe/room-feature-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/room-feature-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/room-feature-engineering.png) |
| Exclusion zone | [view](evidence/sc-00b/combined-166e0ffe/exclusion-zone-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/exclusion-zone-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/exclusion-zone-engineering.png) |
| Selected group | [view](evidence/sc-00b/combined-166e0ffe/group-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/group-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/group-engineering.png) |
| Scene settings | [view](evidence/sc-00b/combined-166e0ffe/scene-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/scene-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/scene-engineering.png) |
| Empty selection | [view](evidence/sc-00b/combined-166e0ffe/empty-selection-guided.png) | [view](evidence/sc-00b/combined-166e0ffe/empty-selection-standard.png) | [view](evidence/sc-00b/combined-166e0ffe/empty-selection-engineering.png) |

[Phone Scene settings](evidence/sc-00b/combined-166e0ffe/scene-phone.png) confirms the rail and Inspector remain operable at 390 px. The earlier SC-00B branch retains separate mouse, keyboard, light-theme, reduced-motion, invalid-selection, live-scale-preview, and exact-source Product Experience evidence for its older three-entity source. Those receipts do not qualify this combined source.

## Visual observations and remaining boundary

- Typed light fields now distinguish the depths: color, type, intensity and range in Guided; falloff and pulse in Standard; technical direction guidance in Engineering. The same typed schema patch handles edits in every depth.
- Group selection shows collective viewport actions in Guided and numeric group transforms in Standard/Engineering. It no longer exposes a stale individual object's accessibility field. Spatial context retains member and group actions.
- Room editing has a clearer visual shell around construction, exclusion and add-feature tools. The Environment/room feature panel remains dense in Guided, with numeric room dimensions high in the viewport. This needs further design review; the screenshots are not owner acceptance.
- The combined probe has no final SC-01 Scene Manager host. Atmosphere, particles, projected effects, phenomenon, every support-surface state, mixed-selection edge cases, and source-bound invalid/preview states still need specific combined-source inspection. The browser pass does not establish these contexts or physical room accuracy.
- The SC-00B probe is not merged to protected main. Integration against the advancing root source, independent visual review, exact final-source browser and Product Experience replay, documentation gates, protected qualification, and owner visual acceptance remain open.
