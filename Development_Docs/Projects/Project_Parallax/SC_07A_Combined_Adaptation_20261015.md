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

The fresh isolated SQLite migration bootstrap and five focused backend suites passed 29 tests on this combined adaptation, including direct rich Environment and pinned Scene publication, moderation, installation, source mutation, package privacy, damaged retry receipts and installed provenance filtering. The current browser and protected qualification receipts must be recorded against this combined head before claiming those tiers. Physical device behavior and owner acceptance are separate.
