---
title: SC-00B Spatial Inspector candidate browser review
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc00b-inspector-candidate-review
last_reviewed: 2026-10-15
---

# SC-00B Spatial Inspector candidate review

The product source in commit `ca48a6c767fe36240610c02fb857c9d81f71c385` was built as a production Next application in a task-owned D: checkout. The generic Sounding Line browser profile used an isolated SQLite fixture and a synthetic Creator. Its dedicated Playwright journey passed in Chromium. The [capability matrix](SC00B_Property_Capability_Matrix.md) maps the pre-refit controls to their destinations and canonical edit commands. This is candidate evidence, not protected-main integration or owner visual acceptance.

## Review captures

All captures below are from that same production build and synthetic scene. They are full-page screenshots; the right panel scrolls independently. The Engineering screenshots follow the visible **Precision controls** action to show the exact coordinate section.

| Selection and state | Guided | Standard | Engineering |
| --- | --- | --- | --- |
| Parchment note | [Desk Map](evidence/sc-00b/candidate-ca48a6c7/parchment-guided.png) | [Desk Map](evidence/sc-00b/candidate-ca48a6c7/parchment-standard.png) | [Desk Map precision](evidence/sc-00b/candidate-ca48a6c7/parchment-engineering.png) |
| Marker asset | [Floating Compass](evidence/sc-00b/candidate-ca48a6c7/marker-guided.png) | [Floating Compass](evidence/sc-00b/candidate-ca48a6c7/marker-standard.png) | [Floating Compass precision](evidence/sc-00b/candidate-ca48a6c7/marker-engineering.png) |
| Text/room message | [Hidden Wall Message](evidence/sc-00b/candidate-ca48a6c7/text-guided.png) | [Hidden Wall Message](evidence/sc-00b/candidate-ca48a6c7/text-standard.png) | [Hidden Wall Message precision](evidence/sc-00b/candidate-ca48a6c7/text-engineering.png) |

Additional captures: [Spatial context](evidence/sc-00b/candidate-ca48a6c7/text-spatial-context.png), [group relationship and Timeline](evidence/sc-00b/candidate-ca48a6c7/group-and-timeline.png), [empty selection and scene overview](evidence/sc-00b/candidate-ca48a6c7/empty-selection.png), [light Scene settings with reduced motion](evidence/sc-00b/candidate-ca48a6c7/light-scene-settings-reduced-motion.png), and [390 px mobile Scene settings](evidence/sc-00b/candidate-ca48a6c7/light-mobile-scene-settings.png).

The first mobile visual inspection at `79d135c7` found a narrow Inspector overlay even though the element was technically visible. Commit `71309205` gave the overlay the whole responsive grid as its containing block and added an explicit usable-width assertion. The retest and final source capture pass. The Standard numeric control initially wrapped its accessible label into several visible lines; `ca48a6c7` retains the label for assistive technology and presents a compact number beside its slider. Engineering now exposes a visible precision shortcut and exact fields.

The dedicated journey exercises object selection, three depths, the three right-rail destinations, grouping, Timeline entry, a canonical width edit and save, clear selection, keyboard activation, light theme, reduced motion, mobile width and axe serious/critical findings. Its [browser observations](evidence/sc-00b/candidate-ca48a6c7/browser-observations.json), [suite profile receipt](evidence/sc-00b/candidate-ca48a6c7/browser-suite-profile.json), and [browser runtime receipt](evidence/sc-00b/candidate-ca48a6c7/browser-runtime.json) preserve the local execution boundary. Ten focused component tests, TypeScript, targeted lint, documentation validation and feature validation pass. An earlier candidate's affected existing production journeys passed five tests with four fixture-gated skips; those results are not represented as a final-source suite.

## Integration and acceptance boundary

The protected base `4baa39af82b78b50a46f590bc2acc2ff0b7597aa` models `PARCHMENT`, `MARKER` and `TEXT`, plus a scene overview and parent/group relationships. It does not model selectable lights, effects, audio sources or exclusions in this checkout. Draft SC-00, SC-01 and SC-02 branches add room features, Environment and element interfaces; they require additive integration before complete type coverage can be claimed. A multi-selection surface is not available on this base. No private room content or physical-device result is included in these captures.

The first trusted Product Experience replay against `57d337a0` failed at the SC-00B journey's final return assertion with `PRODUCT_EXPERIENCE_RETURN_WITHOUT_DEPARTURE`. The return assertion was incorrectly marked as another semantic outcome in the candidate contract; the earlier visible Inspector outcomes completed. The [failed runtime](evidence/sc-00b/candidate-ca48a6c7/experience-replay-failed-57d337a0-runtime.json) and [suite receipt](evidence/sc-00b/candidate-ca48a6c7/experience-replay-failed-57d337a0-suite.json) remain failed evidence. The declaration was corrected in the next candidate; no failure is reclassified as a pass.

The replay against `d6951ebf` then completed the original spatial and floating-control contexts and the desktop Inspector contexts. Its first mobile Inspector role setup failed: the shared synthetic Creator login exhausted the application's six-attempt window after earlier contexts. Its [failed runtime](evidence/sc-00b/candidate-ca48a6c7/experience-replay-failed-d6951ebf-runtime.json) and [suite receipt](evidence/sc-00b/candidate-ca48a6c7/experience-replay-failed-d6951ebf-suite.json) remain failed. The next candidate adds a distinct synthetic Inspector Creator to the existing isolated fixture and binds only the new contract to it.

The candidate still needs a passing exact-source Product Experience replay, independent visual review, shared-branch interface reconciliation, ordinary Sounding Line, protected integration, landed smoke and the owner's visual decision. Screenshots support review; they do not supply those decisions.
