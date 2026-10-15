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

1. In Spatial Studio, save the item to the private Library. Check that no Community listing appeared.
2. Select its Library card and choose **Publish to Community…**. The single dialog shows the exact saved source revision and a private preview.
3. Enter description and tags; inspect the included dependency set and choose a configured redistribution license and credits.
4. Acknowledge rights and, for any Scene or Environment carrying room geometry, acknowledge the layout privacy warning.
5. Inspect the server-reviewed sanitized package. Explicitly submit. A pending release says that Community moderation is next; an unconfirmed response asks for exact review and retry without claiming success.
6. In Admiralty, a separate moderator inspects the exact package and declaration, acknowledges review, then approves with recent privileged assurance. Open the actual Community listing.
7. As a second Creator, review and install the approved exact release. In the Spatial Library, inspect its pinned license, attribution and read-only origin. Make an independent licensed copy before editing.
8. Edit the original private source. Confirm the published package and any earlier installation still refer to the immutable release.

Check the same route for a rich Environment and for a Scene with a pinned Environment. Attempt an unlicensed physical model and a photo-derived room to verify refusal. Review desktop, narrow mobile width, keyboard focus and severe accessibility findings on the actual authenticated UI.

## Validation boundary

The fresh isolated SQLite migration bootstrap and seven focused backend/component suites passed 46 tests on the SC-07A + SC-00C merged candidate `bae94f5f1`, including direct rich Environment and pinned Scene publication, moderation, installation, source mutation, package privacy, damaged retry receipts, Effects and composition identity, and installed provenance filtering. The production build and TypeScript check passed. Seven production Chromium journeys passed on that same source: five SC-07A publication/recovery cases and two SC-00C Library cases. The [source-bound browser evidence](evidence/sc-07a/20261015-integrated/README.md) includes the output and actual UI captures. Independent product experience review, protected qualification, physical device behavior and owner acceptance remain separate.

## Installed-release return correction

On final product source `a7e0967d3`, installation returns to the pinned release in Spatial Library rather than opening it as an editable Studio definition. A separate private working Scene remains available and is labeled accordingly. Legacy direct installed-definition links are redirected to Library inspection. Exact owner-scoped detail reads retain the installed release summary even when 49 earlier-sorting private assets push its card beyond the first 48 results. The detail preserves the release version, readable license, attribution, description and read-only origin; installed Environments use a human-facing installed label. Exact owned item reads preserve the canonical `readOnly` field for both private and installed records.

The final production build and seven focused backend/component suites passed 48 tests. On earlier assertion-corrected source `cbd23391c`, the two SC-00C Library browser journeys passed in a combined attempt, but the first SC-07A journey encountered a Chromium `ERR_NETWORK_IO_SUSPENDED` navigation and four later journeys did not run. Fresh isolated five-journey SC-07A and separate two-journey SC-00C runs passed on the final source. The [corrected captures and retained browser receipts](evidence/sc-07a/20261015-readonly-return/README.md) preserve that distinction. Independent local visual re-review found no remaining P1/P2 issue and confirmed the final Environment label. The formal Product Experience artifact, uninterrupted combined rerun, protected Sounding Line decision, physical-device behavior and owner acceptance remain unproved.

## Generic-profile keyboard acceptance check

On exact candidate `649cafcd5`, the five SC-07A Community Chromium cases passed with Sounding Line's canonical generic task-owned isolated profile. The wizard test now activates the rights, Environment privacy, and package-review acknowledgments with Space and the final submission with Enter. The [source-bound receipts and rendered captures](evidence/sc-07a/20261015-generic-keyboard/README.md) show the pending moderation state and preserve the browser authority cleanup outcome. This is a local software and keyboard check; the protected Product Experience contract and Sounding Line decision remain open.
