---
title: SC-07A local independent visual review
audience: product-engineering
status: local-review
canonical_for: sc-07a-local-visual-review
last_reviewed: 2026-10-15
---

# SC-07A local independent visual review

Reviewer context: `/root/sc07a_visual_review`, a separate read-only subagent context. The reviewer inspected the SC-07A experience contract, both accepted Homeport visual references, the updated Playwright journey and the 21 production-browser captures. The reviewer did not rerun Chromium. The [run receipt](run.json), SHA256 `34fa0158094975c4bb5de2eaa04143a8b8cd0b8822e1687ef3ea8de8e5f2b667`, binds all 21 image hashes to source commit `5ce163b896ebe0ed162a4f246f9d9c3f09840fd0` and tree `4b987e0256e1bde4fc599d64bb96bb43fe4da20f`.

| Contract dimension | Read-only observation |
| --- | --- |
| Persona and goal | The private saved source appears in [source desktop](sc07a-source-desktop.png); a separate synthetic Creator sees the approved release and exact-install action in [approved listing mobile](sc07a-approved-listing-mobile.png). The test creates two accounts. |
| Entry | The test follows Creator Library to Spatial Studio, saves, then opens **Publish to Community**; [Library entry](sc07a-library-entry-desktop.png) shows the contextual dialog. |
| Hierarchy and composition | [Description](sc07a-description-mobile.png), [included content](sc07a-included-mobile.png), [rights](sc07a-rights-mobile.png) and [final review](sc07a-package-review-mobile.png) show the five-step phone journey. The immutable-release warning appears before the package summary and advanced JSON. |
| Outcomes and adverse states | [Submission](sc07a-submitted-mobile.png) says moderation is next; [pending update](sc07a-pending-update-desktop.png) explains the wait. [Known limit](sc07a-known-limit-desktop.png) and [focused refusal](sc07a-rights-failure-mobile.png) expose the unsupported physical model. The test confirms no listing was created and the private source remained. [Scene package](sc07a-scene-environment-review-desktop.png) names its pinned Environment and warns about room geometry. |
| Desktop and mobile | The test advances all five wizard stages at 390 px, installs at that width and returns to Studio. Desktop and mobile review captures have distinct filenames. |
| Keyboard and accessibility | The browser test checks labeled fields, visible refusal focus, Escape focus restoration, Tab and Shift+Tab wrap, package JSON keyboard scrolling and no serious or critical axe violations. This is bounded browser evidence. |
| Return and continuity | The test returns from submission to Studio, restores the Library trigger after Escape and opens the pinned installed release. [Mobile Studio return](sc07a-installed-library-mobile.png) and [desktop Studio return](sc07a-installed-library-desktop.png) show its read-only state and **Create editable copy** action. |

Initial review findings concerned a final warning below the visible review area, incomplete mobile interaction and keyboard evidence, and an installed status message that called the release a working draft. Follow-up review also found a mislabeled viewport capture and raw license key. The builder repaired those items, recaptured the journey and obtained this re-review. The reviewer reported no remaining P1 or P2 experience finding in the inspected scope.

The approved listing in this local journey uses a synthetic post-moderation database transition. This review does not establish real moderation approval, protected product experience qualification, Sounding Line acceptance, deployment, owner acceptance or physical-device behavior. The protected planner still stops at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`; the Crossdeck contract remains on draft PR #721.
