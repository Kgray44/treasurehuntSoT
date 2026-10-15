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

A later task-owned replay at `e733a99aa70fac3eb6dc17d535610521c37da0af` passed **both** browser journeys. The second journey edited a typed light, reversed and restored the value through Undo/Redo, changed mode, verified the saved typed value after reload, edited a room feature, and verified that change after another reload. Its [runtime](evidence/sc-00b/replay-e733a99a/browser-runtime.json), [suite result](evidence/sc-00b/replay-e733a99a/browser-suite-profile.json), and [capture inventory](evidence/sc-00b/replay-e733a99a/observations.json) record the run. No `src/components/studio/parallax` file changed between the captured `166e0ffe` product source and this replay; intervening commits changed tests and review documentation. Earlier browser attempts failed on fixture navigation and an incorrect screenshot count; they are not promoted to passing evidence.

The next exact-source run at `024c059bd19c2c402b25901894ae7601767eb9dd` passed **all three** journeys. The new [live scale preview](evidence/sc-00b/replay-024c059b/scale-live-preview.png) shows the Parchment enlarged on the combined canvas before the pointer is released. The browser assertion reads the actual renderer scene receipt while Undo is still disabled, then verifies one enabled Undo after release and restoration to scale 1. Its [runtime](evidence/sc-00b/replay-024c059b/browser-runtime.json) and [suite result](evidence/sc-00b/replay-024c059b/browser-suite-profile.json) report PASS with task-owned cleanup. This is browser interaction evidence on the same product source, not a physical-device result.

At candidate `89a08310913cee254e4c0600a8dd2d29a5d4a3e5`, the task-owned replay passed **all four** browser journeys. The fourth selected mist, particles, projection, and phenomenon in each authoring depth under the actual light theme and reduced-motion preference. It checked effect-specific controls, keyboard Tab/Enter travel through all three Inspector rail destinations, preserved phenomenon context, no page errors, and no serious or critical axe finding in the light-theme Inspector. The [runtime](evidence/sc-00b/replay-89a08310/browser-runtime.json), [suite result](evidence/sc-00b/replay-89a08310/browser-suite-profile.json), and [effect capture inventory](evidence/sc-00b/replay-89a08310/effects-observations.json) record the exact candidate. The first effect attempt at `61630fc5` failed because its test requested a standalone text node inside an accessible select label; the corrected assertion targeted the real combobox by role and name. That failed attempt is not acceptance evidence. Product files under `src/components/studio/parallax` remain identical to the `166e0ffe` screenshot source.

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

The additional effect captures are from the same combined product source in light theme with reduced motion:

| Selection | Guided | Standard | Engineering |
| --- | --- | --- | --- |
| Mist atmosphere | [view](evidence/sc-00b/replay-89a08310/mist-guided-light.png) | [view](evidence/sc-00b/replay-89a08310/mist-standard-light.png) | [view](evidence/sc-00b/replay-89a08310/mist-engineering-light.png) |
| Magic particles | [view](evidence/sc-00b/replay-89a08310/particles-guided-light.png) | [view](evidence/sc-00b/replay-89a08310/particles-standard-light.png) | [view](evidence/sc-00b/replay-89a08310/particles-engineering-light.png) |
| Projected symbol | [view](evidence/sc-00b/replay-89a08310/projection-guided-light.png) | [view](evidence/sc-00b/replay-89a08310/projection-standard-light.png) | [view](evidence/sc-00b/replay-89a08310/projection-engineering-light.png) |
| Portal phenomenon | [view](evidence/sc-00b/replay-89a08310/phenomenon-guided-light.png) | [view](evidence/sc-00b/replay-89a08310/phenomenon-standard-light.png) | [view](evidence/sc-00b/replay-89a08310/phenomenon-engineering-light.png) |

## Visual observations and remaining boundary

- Typed light fields now distinguish the depths: color, type, intensity and range in Guided; falloff and pulse in Standard; technical direction guidance in Engineering. The same typed schema patch handles edits in every depth.
- Group selection shows collective viewport actions in Guided and numeric group transforms in Standard/Engineering. It no longer exposes a stale individual object's accessibility field. Spatial context retains member and group actions.
- Room editing has a clearer visual shell around construction, exclusion and add-feature tools. The Environment/room feature panel remains dense in Guided, with numeric room dimensions high in the viewport. This needs further design review; the screenshots are not owner acceptance.
- The combined probe has no final SC-01 Scene Manager host. Every support-surface state, mixed-selection edge cases, and source-bound invalid/preview states still need specific combined-source inspection. The effect screenshots show the visible Inspector viewport; technical controls below the fold need owner inspection. The browser pass does not establish physical room accuracy.
- The SC-00B probe is not merged to protected main. Integration against the advancing root source, independent visual review, exact final-source browser and Product Experience replay, documentation gates, protected qualification, and owner visual acceptance remain open.
