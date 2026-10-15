---
title: SC-07A combined source adaptation and owner review
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc-07a-combined-adaptation
last_reviewed: 2026-10-15
---

# SC-07A combined source adaptation

This candidate connects the SC-07A Harborlight release path to the current Parallax Library lifecycle and the SC-01 Environment bridge. It remains an unmerged implementation candidate. The earlier SC-07A screenshots and approval receipts belong to a different source head and do not establish rendered behavior on this combined source.

## Source and safety contract

- Only an owned, unarchived, explicitly saved Library item may enter review. Autosaved working drafts and installed read-only content cannot publish.
- An Environment source records the mutable item revision and an explicit immutable `versionId`. Its release ordinal and checksum are checked separately. A Scene resolves its exact pinned Environment; a rich room snapshot must match that pin.
- The Community package is a server-side allowlist. A rich Environment may contain manually authored synthetic geometry; photo reconstructed rooms, measured scale, observed or media-derived features and private source references are refused. Library collection text, favorite state, source media IDs and owner metadata are absent from package bytes. The Creator still acknowledges that geometry can be sensitive.
- SC-01 legacy Environment versions remain readable through the compatibility resolver. Installation preserves legacy format or creates a local read-only rich Environment draft and immutable release as appropriate. Scene imports remap their pinned Environment and room snapshot to the local read-only dependency.
- Saved compositions require a matching dependency-closed subtree from their current owned source. Inserting a composition into another Scene records reuse lineage so that mixed rights cannot be republished as wholly original work. Parametric effects retain Effects Library identity.
- Harborlight remains the listing, license, scanner, release, moderation, review, and install authority. An exact submission retry verifies the recorded package, release, rights declaration and byte-identical reviewed JSON before reporting the prior release.

Spatial `collection` is a free-text organizer, while a Harborlight Community collection curates already published listings. Neither is an immutable, dependency-closed Spatial collection source. Collection package publishing therefore remains unavailable in this candidate. Referenced physical models, textures and audio also remain unavailable until their rights, bytes and scanner receipts can be resolved by the canonical package path.

## Owner review journey

1. In Spatial Studio, save the item to the private Library. Check that no Community listing appeared. If the Creator lacks a public Profile, open **Publish to Community…**, confirm Continue is blocked, use **Set up public Profile**, save a public handle, and confirm the return to this exact saved item before reopening the wizard. For an Environment, confirm the selected immutable version is restored as well.
2. Select its Library card and choose **Publish to Community…**. The single dialog shows the exact saved source revision and a private preview.
3. Enter description and tags; inspect the included dependency set and choose a configured redistribution license and credits.
4. Acknowledge rights and, for any Scene or Environment carrying room geometry, acknowledge the layout privacy warning.
5. Inspect the server-reviewed sanitized package. Expand **Inspect included effects and behavior** to read each resolved effect, behavior rule and animation track before acknowledging the package. Explicitly submit. A pending release says that Community moderation is next; an unconfirmed response asks for exact review and retry without claiming success.
6. In Admiralty, a separate moderator inspects the exact package and declaration, acknowledges review, then approves with recent privileged assurance. Open the actual Community listing.
7. As a second Creator, review and install the approved exact release. In the Spatial Library, inspect its pinned license, attribution and read-only origin. For an Asset or Composition whose pinned license permits modification, choose its credited Scene-copy action and confirm the installed source remains unchanged. For a release that forbids modification, confirm the action is unavailable and gives a specific explanation.
8. Edit the original private source. Confirm the published package and any earlier installation still refer to the immutable release.
9. Reopen **Publish to Community…** from that saved source, select the existing approved listing, revise its description, review and submit a new immutable release. Confirm moderation is pending without a premature public-success link. After separate approval, inspect release 2.0.0 on the actual listing while the first release package remains unchanged.

Check the same route for a rich Environment and for a Scene with a pinned Environment. For an animated Effect or Composition, inspect the reviewed track definitions and compare the installed copy's motion with the saved source. Attempt an unlicensed physical model, a photo-derived room and a placed reusable asset without verified redistribution rights to verify specific refusal while the private source remains intact. Review desktop, narrow mobile width, keyboard focus and severe accessibility findings on the actual authenticated UI.

## Required acceptance coverage

This maps the brief's twelve journeys to the current local proof. The [exact-product-source run](evidence/sc-07a/20261015-frame-sanitize/README.md) passed eleven production Chromium cases on `5b0f6b3a05d4110462b90f984bc0f20be6fd18e6`; the focused package and isolated integration suites cover server-only invariants. Each row still awaits the formal cross-project Product Experience capture, independent review, protected qualification and owner walkthrough where applicable.

| # | Required journey | Current local evidence and limit |
| --- | --- | --- |
| 1 | Save a private asset without publishing | The asset journey checks the private save and zero owner listings before opening the wizard. |
| 2 | Open publishing directly from that asset | The same journey opens the selected saved Asset's contextual **Publish to Community…** action and checks its source revision and preview. |
| 3 | Review metadata, dependencies and license | The browser submits description, tags, license and credits through one wizard, then checks the server package review. Scene and Environment cases inspect the pinned dependency and privacy acknowledgment. |
| 4 | Publish through Harborlight | The asset, Environment, Effect and Composition journeys create canonical releases pending moderation; a distinct synthetic moderator approves them. The isolated integration suite verifies immutable package and release records. |
| 5 | Open the resulting listing | The browser opens the approved Community URL and checks its exact release and install action. A pending release does not claim a public listing. |
| 6 | Install or reuse released content | A second synthetic Creator installs the approved release, sees pinned read-only Library details, and adds a credited private Scene copy only when the exact license permits modification. Effect, Composition and Environment installs have separate journeys. |
| 7 | Publish a Scene with Environment references | The Scene case reviews and submits an exact pinned Environment dependency. The isolated integration case checks the source and pin; a separate revocation case refuses review and submission after Environment ownership changes. |
| 8 | Reject unauthorized or unlicensed dependencies | The browser leaves an unlicensed physical model private with a visible refusal. Package tests refuse unresolved media and placed reuse lineage; integration refuses a no-longer-owned pinned Environment. |
| 9 | Prevent private photo leakage | Server package tests refuse reconstructed, measured and media-derived rooms. The Scene and Environment browser cases exclude synthetic private source labels; the frame sanitization test checks public bytes for a private-looking source frame ID. These tests do not prove a real home's layout safe to disclose. |
| 10 | Handle failed publication truthfully | The browser aborts the submit response, checks the unconfirmed state, then retries the exact reviewed request and observes one release. External scanner or provider failure remains a separate deployment condition. |
| 11 | Keep published releases immutable after source edits | The browser changes the private source and checks the prior package checksum; the update journey creates release 2.0.0 while release 1.0.0 stays unchanged. |
| 12 | Desktop, mobile, keyboard and accessibility | The asset journey checks the desktop route, 390 px dialog, keyboard focus and no serious or critical axe findings. The generic-profile keyboard journey submits by keyboard, and the focused Environment case checks a visible mobile submit action. Physical devices and full independent visual review remain open. |

## Validation boundary

The fresh isolated SQLite migration bootstrap and seven focused backend/component suites passed 46 tests on the SC-07A + SC-00C merged candidate `bae94f5f1`, including direct rich Environment and pinned Scene publication, moderation, installation, source mutation, package privacy, damaged retry receipts, Effects and composition identity, and installed provenance filtering. The production build and TypeScript check passed. Seven production Chromium journeys passed on that same source: five SC-07A publication/recovery cases and two SC-00C Library cases. The [source-bound browser evidence](evidence/sc-07a/20261015-integrated/README.md) includes the output and actual UI captures. Independent product experience review, protected qualification, physical device behavior and owner acceptance remain separate.

## Installed-release return correction

On final product source `a7e0967d3`, installation returns to the pinned release in Spatial Library rather than opening it as an editable Studio definition. A separate private working Scene remains available and is labeled accordingly. Legacy direct installed-definition links are redirected to Library inspection. Exact owner-scoped detail reads retain the installed release summary even when 49 earlier-sorting private assets push its card beyond the first 48 results. The detail preserves the release version, readable license, attribution, description and read-only origin; installed Environments use a human-facing installed label. Exact owned item reads preserve the canonical `readOnly` field for both private and installed records.

The final production build and seven focused backend/component suites passed 48 tests. On earlier assertion-corrected source `cbd23391c`, the two SC-00C Library browser journeys passed in a combined attempt, but the first SC-07A journey encountered a Chromium `ERR_NETWORK_IO_SUSPENDED` navigation and four later journeys did not run. Fresh isolated five-journey SC-07A and separate two-journey SC-00C runs passed on the final source. The [corrected captures and retained browser receipts](evidence/sc-07a/20261015-readonly-return/README.md) preserve that distinction. Independent local visual re-review found no remaining P1/P2 issue and confirmed the final Environment label. The formal Product Experience artifact, uninterrupted combined rerun, protected Sounding Line decision, physical-device behavior and owner acceptance remain unproved.

## Generic-profile keyboard acceptance check

On exact candidate `649cafcd5`, the five SC-07A Community Chromium cases passed with Sounding Line's canonical generic task-owned isolated profile. The wizard test now activates the rights, Environment privacy, and package-review acknowledgments with Space and the final submission with Enter. The [source-bound receipts and rendered captures](evidence/sc-07a/20261015-generic-keyboard/README.md) show the pending moderation state and preserve the browser authority cleanup outcome. This is a local software and keyboard check; the protected Product Experience contract and Sounding Line decision remain open.

## Existing-listing release update

The [source-bound update evidence](evidence/sc-07a/20261015-update-release/README.md) adds the rendered Creator route for selecting an approved listing in the same wizard and publishing its next immutable release. Six generic-profile Chromium cases passed on exact integrated source `1d92a903f`, including SC-00C's collection-filter changes. The update case verified the revised public description, the visible 2.0.0 release, and the first package checksum unchanged before and after second approval. Two earlier integrated runs stopped at ambiguous test locators and their failed receipts remain in the evidence folder. This is local browser proof; formal Product Experience and protected Sounding Line qualification remain open.

## Natural Studio entry and semantic contract

The [natural-entry evidence](evidence/sc-07a/20261015-natural-entry/README.md) records seven passing generic-profile production Chromium cases on exact code and test source `328bade8d`, including the ordinary Creator sign-in to private save, Scenes Library discovery, contextual package review and return. The new case asserts that no Community listing appears during save or review. A dedicated SC-07A Product Experience contract now describes the Creator goal, visible states, cross-project continuity, desktop and mobile devices, keyboard access, server package review and ordinary return path. The separately owned protected Crossdeck Phase 2 experience intent still blocks formal capture and protected qualification; the contract registration and local browser pass do not discharge that gate.

## Public Profile prerequisite recovery

On exact source `d74ee3d759c9870dffbd04c777444a69b986658e`, the [eight-case direct browser suite](evidence/sc-07a/20261015-profile-recovery/README.md) passed with task-owned cleanup. A private-profile Creator now sees the setup action before continuing to rights and package review. The existing Profile editor saves the public handle and returns to the same saved Studio item; no Community listing is created during this recovery. The action is visible above the footer at narrow mobile width. The Product Experience contract includes this Homeport dependency and its fallback. The formal planner still stops on the separately owned Crossdeck Phase 2 continuity intent against protected base `9983c900875ffa116e7945318823e93e6e94348b`; no protected qualification or owner acceptance is claimed.

## Protected-main integration

The branch merged protected main `9983c900875ffa116e7945318823e93e6e94348b` at `749ddc2b484ea4f75a4d25a44037954adf9c0aa6` to resolve PR #736's merge conflict. TypeScript and documentation validation passed. The [post-merge evidence](evidence/sc-07a/20261015-main-sync/README.md) records an eight-case isolated production Chromium pass, actual listing, package-review and mobile prerequisite captures, and complete owned cleanup. The formal planner on that merged candidate still requires the separately owned Crossdeck Phase 2 continuity design; the SC-07A draft remains unqualified for protected integration and owner acceptance.

## Environment Profile return correction

On exact source `dc3245b90a611e208cd79ef41927e9b79e403bfa`, the [nine-case direct browser suite](evidence/sc-07a/20261015-environment-profile-recovery/README.md) passed after the Profile setup return was extended to preserve the selected Environment and immutable version. The ordinary Profile editor and Library selection remain authoritative; no Community listing is created during setup. The return route accepts only the saved Studio definition or validated Environment selection, and the Creator can reopen the same publishing wizard with Continue enabled. On follow-up source `1ec77b38ad7f0b89f606c1a9ab16689cdb8afb62`, a focused production browser case passed after removing the stale Environment version from the URL when switching to another saved definition. These are local browser proofs; formal Product Experience and protected qualification remain open.

## Saved Effect and Composition Library correction

The first rendered Effect journey on `f29fee51f` failed because the paged Library classified an owned saved Effect as a Scene, leaving only built-ins in **Effects**. The [retained failure and correction evidence](evidence/sc-07a/20261015-effect-composition/README.md) binds the repair to `355325b6ad485694b301d58471dbec126d82fa1c`. Its owner-scoped catalog and global projection preserve Effects identity, and focused tests pass 17/17. Two direct production Chromium journeys then passed for Effect and Composition publication, moderation, approved listing, second-Creator installation and read-only Library return. The full SC-07A suite passed 11/11 on that same code and test source with owned cleanup. Collection packages and unresolved binary dependencies retain the stated backend limits; the Crossdeck Phase 2 continuity gate still prevents formal Product Experience and protected qualification.

## Current protected-main continuity

The branch merged current protected main `670706e875eeac61031f08f69595db2dc9a81879` at `a2eb08dbede39e27a24328e021743cf32ea974a4`. Main added the accepted Sounding Line context-setup replay repair without changing SC-07A product code. TypeScript, documentation validation, 50 Product Experience authority tests and 12 real-browser authority fixture tests passed on that merged tree. The [source-bound record](evidence/sc-07a/20261015-main-sync/README.md) retains the exact merged-candidate planner result: the separately owned Crossdeck Phase 2 continuity intent still blocks formal SC-07A capture and protected qualification. The earlier 11/11 SC-07A product browser result remains bound to its pre-merge product/test source, which this helper-only merge did not alter.

## Animation and placed reusable asset rights

Package review previously omitted authored animation tracks even though the Spatial runtime uses them, and placed reusable asset instances could lose their origin identity in the public projection without a redistribution check. Correction source `61f146dd590eaea17fc9ceedef95a999f370570b` retains validated local animation tracks in the immutable package and refuses unresolved placed-instance lineage with the same specific limit in the Library. The [source-bound evidence](evidence/sc-07a/20261015-motion-lineage/README.md) records 12 focused package tests, five isolated publication/installation tests, one focused production Chromium Effect journey and the full eleven-case SC-07A browser suite passing with owned cleanup. The installed-record assertion verifies exact track preservation; rendered motion quality and owner acceptance are still unproved.

The same evidence record now includes a reviewed-package list of resolved effects, behavior rules and animation tracks. Its inspected production Chromium capture shows the synthetic atmosphere Effect and its two-keyframe opacity track. After a stale wording assertion in the first complete-suite attempt was corrected, all 11 SC-07A production Chromium journeys passed on exact browser-test commit `0278b263b244ee6955948fb11446ba077a726dd7` with a fresh isolated database and owned cleanup. This is local package-review presentation evidence; formal Product Experience review and owner acceptance remain open.

## Installed reuse rights and extracted lineage

The [source-bound reuse evidence](evidence/sc-07a/20261015-installed-reuse-rights/README.md) records the server's exact installed-release and license check before a credited Asset or Composition enters an editable private Scene. The Library disables that action for releases without modification rights. A permitted Composition leaves the installed version read-only and retains placed-source lineage in the receiving Scene. Extracting a private Composition preserves intersecting placed-source references; exporting a self-contained Asset from such a subtree is refused because that asset contract cannot carry the lineage. The full SC-07A production Chromium suite passed 11/11 on exact product and browser-test source `3ac71aaa108e977fce552c714b4a0a87b5d8b516` with owned cleanup. Formal Product Experience review, protected qualification, physical presentation and owner acceptance remain open.

## Saved Asset reuse after installation

The [saved Asset evidence](evidence/sc-07a/20261015-asset-reuse/README.md) retains two failed browser attempts: an off-page catalog-card locator and a genuine product refusal when an installed, publishable saved Asset lacked a generated `libraryDefinition`. Correction source `058b901a60e93c720b1b07c65c532e06cbcb46b5` accepts that saved Asset or Assembly form only after server verification of its Library classification, source checksum, pinned release and modification license. Reuse still rejects nonportable content and nested placed-source references. A focused production Chromium journey then passed, followed by the complete 11/11 SC-07A suite with isolated data and owned cleanup. The second Creator's separate private Scene records the installed source version; the installation remains read-only. Formal Product Experience review and protected qualification remain open.

## Reviewed package presentation

The [source-bound presentation evidence](evidence/sc-07a/20261015-review-labels/README.md) records the corrected Scene and standalone Environment package review on `6d0ea2b8896915c2ea7c94ef58a93e1f80e65ee1`. Reviewed content uses Creator-facing names; technical package paths remain inspectable in the sanitized JSON. The standalone Environment is the selected immutable source, not an extra dependency. The Environment privacy acknowledgment remains required. Two focused and all eleven SC-07A production Chromium journeys passed on the exact committed source with isolated data and owned cleanup. Formal Product Experience review and protected qualification remain open.

The same evidence record now includes an inspected 390 px final Environment review capture and a test-only continuation at `05356c5f7788f65bb89aced9522d40f3f674b734`. The focused 1/1 and complete 11/11 production Chromium reruns passed with isolated data and owned cleanup. The mobile assertion checks dialog width, visible submit action and no serious or critical axe findings. This does not establish formal cross-project Product Experience or physical presentation.

The [pinned Environment ownership evidence](evidence/sc-07a/20261015-dependency-revocation/README.md) adds a test-only case at `4fd031c23faf6553c2430649dbf56648f6acf7db`. After a valid server review, moving the synthetic Environment to another account causes both a fresh review and submission with the earlier digest to refuse. The Scene remains private and no listing is created. All six isolated SC-07A integration cases pass on that committed source; formal Product Experience and protected qualification remain separate.

## Legacy Environment evidence frame sanitization

The SC-01 compatibility package previously copied the source `evidence.frameId` into the public Environment JSON. Even simulated evidence can carry an internal photo or processing identifier in that field. The server now emits the fixed `community-simulated` marker while retaining the semantic candidates needed by the installed Environment. A byte-level package case verifies that a synthetic source frame named `private-room-photo.jpg` is absent from the reviewed package. The focused package suite passed 13/13, the fresh isolated Harborlight integration suite passed 6/6, and TypeScript passed. The [exact-head production browser evidence](evidence/sc-07a/20261015-frame-sanitize/README.md) records 11/11 SC-07A journeys with owned cleanup on `5b0f6b3a05d4110462b90f984bc0f20be6fd18e6`. This strengthens metadata exclusion; it does not establish that every manually authored room layout is safe to share. Formal Product Experience capture, protected qualification and owner acceptance remain open.
