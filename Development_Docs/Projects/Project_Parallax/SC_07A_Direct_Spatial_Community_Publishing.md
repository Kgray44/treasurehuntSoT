---
title: SC-07A direct Spatial Community publishing implementation record
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc-07a-implementation
last_reviewed: 2026-10-15
---

# Direct Spatial Community publishing

SC-07A connects saved Creator-owned Spatial Studio content to Harborlight listings, immutable releases, package scans, moderation and Library installation. The implementation is an owned candidate. Protected integration, independent product experience acceptance and owner acceptance remain separate decisions.

## Creator journey

Spatial Studio exposes one **Publish to Community** workflow from a saved personal item, the saved-item gallery, Scene Manager and an owned Environment. The guided dialog identifies the exact saved revision, asks for title, description, tags, license, credits and rights acknowledgment, resolves included content on the server, then shows the sanitized package before an explicit submit. A prior listing for the same source can be selected to submit a new immutable release. Saving a draft or creating a Parallax version does not publish it.

A successful submit creates a Harborlight listing and release in `READY_FOR_REVIEW` or `UPDATE_PENDING`. The result says that moderation is next. The listing link is usable after the separate moderation authority publishes the release. The Community detail page then offers an exact-release installation review. Installation creates a pinned read-only Spatial Library item and, for a Scene, a pinned local Environment dependency. An editable derivative requires a deliberate separate copy; installed content cannot be republished as Creator-owned source without verified redistribution lineage.

## Package and privacy boundary

The server reads an owner-scoped exact saved revision, validates its stored checksum and resolves its pinned Environment. A new schema-validated public projection contains spatial JSON and, when required, one owned Environment JSON. It excludes private draft scope, Chronicle ID, working-copy flags, source photo labels, Vision references, calibration receipts and private account data. It refuses reconstructed room geometry and measured room evidence. Manual synthetic Environments still require an explicit geometry privacy acknowledgment because geometry can be sensitive even without photos. The creator inspects the exact package before submission.

Referenced binary models, textures and audio are blocked because this source path does not resolve their bytes, scanner receipts and redistribution rights. Unverified remix lineage, missing dependencies, built-in Environments and installed read-only sources also fail closed. The ordinary supported package therefore contains JSON authoring content only. Effects and prefabs represented by eligible saved Parallax drafts follow the same asset path; collections and binary-heavy composites require further canonical package support. Only the Community visibility with a working public listing route is offered. These limits are surfaced in the workflow and must not be described as accepted publication of unsupported content.

The package uses Harborlight's manifest, checksums and scanner contract. License policies live in the existing `CommunityLicensePolicy` authority. The additive SQLite and MySQL migrations seed three built-in redistribution choices without replacing existing rows. The transaction records the release, package, package items, ownership declaration, outbox event and audit event together. Installation verifies the current approved release and package checksum and writes Exchange operation, mappings and Library records together. Editing a Studio source after submission does not rewrite the release payload.

## Validation boundary

Focused package and isolated SQLite integration tests cover private save without publication, preflight, license and dependency rejection, private source-label exclusion, immutable release payloads, Scene and owned Environment packaging, pending moderation, approved exact-release installation, verified-installation review eligibility, stable installation retries and update releases. The browser journey uses a production build, owned loopback server and synthetic accounts. It passed the direct Studio publishing, desktop/mobile package review, Escape focus restoration, Community listing, exact-release installation, verified review and read-only Studio return path. Its direct database transition to `PUBLISHED` is a test fixture for the post-moderation journey, not evidence that moderation approved a real release.

The [Creator guide](Spatial_Studio_Guide.md) gives the owner-review route. Screenshots and browser observations are kept in [local SC-07A evidence](evidence/sc-07a/20261015-local/). Independent product experience review, protected Sounding Line, SC-00C final Library entry integration and landed-source smoke remain open before claiming those tiers.

Feature Catalog: the candidate is not promoted as a completed mainline capability while protected integration and product experience evidence remain open.
