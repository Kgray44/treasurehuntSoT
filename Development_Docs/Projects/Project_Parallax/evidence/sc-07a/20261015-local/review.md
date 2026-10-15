---
title: SC-07A local independent visual review
audience: product-engineering
status: local-review
canonical_for: sc-07a-local-visual-review
last_reviewed: 2026-10-15
---

# SC-07A local independent visual review

Reviewer context: `/root/sc07a_visual_review`, a separate read-only subagent context. The reviewer inspected the SC-07A experience contract, both accepted Homeport visual references, the updated Playwright journeys and the 24 production-browser captures. The reviewer did not rerun Chromium. The [run receipt](run.json), SHA256 `a655bcee748bd9abe57f36b983c40b262768f19f30e5c8ae99b3835c81a389c7`, binds all 24 image hashes to source commit `23582bf11513fff97c1674af09ddefa48d25a323` and tree `1ee3c3c14c91f5c274f580ac3bf28fbfccba414b`.

| Contract dimension | Read-only observation |
| --- | --- |
| Persona and goal | The private saved source appears in [source desktop](sc07a-source-desktop.png); a separate synthetic Creator sees the approved release and exact-install action in [approved listing mobile](sc07a-approved-listing-mobile.png). The test creates two accounts. |
| Entry | The test follows Creator Library to Spatial Studio, saves, then opens **Publish to Community**; [Library entry](sc07a-library-entry-desktop.png) shows the contextual dialog. |
| Hierarchy and composition | [Description](sc07a-description-mobile.png), [included content](sc07a-included-mobile.png), [rights](sc07a-rights-mobile.png) and [final review](sc07a-package-review-mobile.png) show the five-step phone journey. The immutable-release warning appears before the package summary and advanced JSON. |
| Outcomes and adverse states | [Submission](sc07a-submitted-mobile.png) says moderation is next; [pending update](sc07a-pending-update-desktop.png) explains the wait. [Known limit](sc07a-known-limit-desktop.png) and [focused refusal](sc07a-rights-failure-mobile.png) expose the unsupported physical model. The test confirms no listing was created and the private source remained. [Scene package](sc07a-scene-environment-review-desktop.png) names its pinned Environment and warns about room geometry. |
| Desktop and mobile | The test advances all five wizard stages at 390 px, installs at that width and returns to Studio. Desktop and mobile review captures have distinct filenames. |
| Keyboard and accessibility | The browser test checks labeled fields, visible refusal focus, Escape focus restoration, Tab and Shift+Tab wrap, package JSON keyboard scrolling and no serious or critical axe violations. This is bounded browser evidence. |
| Return and continuity | The test returns from submission to Studio, restores the Library trigger after Escape and opens the pinned installed release. [Mobile Studio return](sc07a-installed-library-mobile.png) and [desktop Studio return](sc07a-installed-library-desktop.png) show its read-only state and **Create editable copy** action. |
| Composition reuse and provenance | The [composition source](sc07a-composition-source-desktop.png) is selected from the owner's Library, the [package review](sc07a-composition-review-desktop.png) names the composition, and the [installed Library](sc07a-composition-installed-library-desktop.png) places it under Compositions with **Installed composition / Community installs**. Library details identify an installed read-only release, omit working-item actions, and offer **Add composition**. The source carries reuse lineage into a receiving Scene; server archive and publication guards preserve those boundaries. |

Initial review findings concerned a final warning below the visible review area, incomplete mobile interaction and keyboard evidence, and an installed status message that called the release a working draft. Follow-up review also found a mislabeled viewport capture and raw license key. The composition review found a further P2: the installed release was labeled **My Creations** and exposed mutable working-item actions. The builder separated Community provenance, hid those actions, guarded archive on the server, preserved reuse lineage, rebuilt and recaptured the four journeys. Final read-only re-review reported no remaining P1 or P2 experience finding in the inspected scope.

The approved listing in this local journey uses a synthetic post-moderation database transition. This review does not establish real moderation approval, protected product experience qualification, Sounding Line acceptance, deployment, owner acceptance or physical-device behavior. The protected planner still stops at `PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`; the Crossdeck contract remains on draft PR #721.
