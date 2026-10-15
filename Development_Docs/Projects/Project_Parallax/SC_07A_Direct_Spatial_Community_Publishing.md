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

Spatial Studio exposes one **Publish to Community** workflow from a saved personal item, SC-00C Library details and context actions, Scene Manager and an owned Environment. The guided dialog identifies the exact saved revision, asks for title, description, tags, license, credits and rights acknowledgment, resolves included content on the server, then shows the sanitized package before an explicit submit. A prior listing for the same source can be selected to submit a new immutable release. Saving a draft or creating a Parallax version does not publish it.

A successful submit creates a Harborlight listing and release in `READY_FOR_REVIEW` or `UPDATE_PENDING`. The result says that moderation is next. An exact retry returns that same release after a lost response; a changed update waits for the pending review to finish. The listing link is usable after the separate moderation authority publishes the release. The Community detail page then offers an exact-release installation review. Installation creates a pinned read-only Spatial Library item and, for a Scene, a pinned local Environment dependency. An editable derivative requires a deliberate separate copy; installed content cannot be republished as Creator-owned source without verified redistribution lineage.

## Package and privacy boundary

The server reads an owner-scoped exact saved revision, validates its stored checksum and resolves its pinned Environment. A new schema-validated public projection selects approved spatial and Environment fields explicitly, then parses the projected documents. New top-level authoring fields therefore require a deliberate projection change before they can enter a Community package. The package excludes private draft scope, Chronicle ID, working-copy flags, source photo labels, Vision references, calibration receipts and private account data. It refuses reconstructed room geometry and measured room evidence. Manual synthetic Environments still require an explicit geometry privacy acknowledgment because geometry can be sensitive even without photos. The creator inspects the exact package before submission.

Referenced binary models, textures and audio are blocked because this source path does not resolve their bytes, scanner receipts and redistribution rights. SC-02 physical-model references are also blocked: their original asset package requires owner authorization, and the current JSON projection cannot establish that right or package dependency. Unverified remix lineage, missing dependencies, built-in Environments and installed read-only sources also fail closed. The ordinary supported package therefore contains JSON authoring content only. Parametric effects represented by eligible saved Parallax drafts follow the same asset path; collections and physical-model composites require further canonical package support. Only the Community visibility with a working public listing route is offered. These limits are surfaced in the workflow and must not be described as accepted publication of unsupported content.

The package uses Harborlight's manifest, checksums and scanner contract. License policies live in the existing `CommunityLicensePolicy` authority. The additive SQLite and MySQL migrations seed three built-in redistribution choices without replacing existing rows. The transaction records the release, package, package items, ownership declaration, outbox event and audit event together. Installation verifies the current approved release and package checksum and writes Exchange operation, mappings and Library records together. Editing a Studio source after submission does not rewrite the release payload.

## Validation boundary

Focused package and isolated SQLite integration tests cover private save without publication, preflight, license and dependency rejection, private source-label exclusion, immutable release payloads, Scene and owned Environment packaging, pending moderation, approved exact-release installation, verified-installation review eligibility, stable installation retries and update releases. The browser journeys use a production build, owned loopback server and synthetic accounts. They passed direct Studio publishing, desktop/mobile package review, Escape focus restoration, Community listing, exact-release installation, verified review and read-only Studio return, plus a mobile rights refusal that created no listing and preserved the saved source after reload. The refusal is focused and scrolled into view. The direct database transition to `PUBLISHED` is a test fixture for the post-moderation journey, not evidence that moderation approved a real release.

The [Creator guide](Spatial_Studio_Guide.md) gives the owner-review route. The [local SC-07A run receipt](evidence/sc-07a/20261015-local/run.json) binds the final two passing browser journeys and twelve captures to product source `fe65fda1`, after integrating SC-00C head `4f658431`. The captures include the [pending-update choice](evidence/sc-07a/20261015-local/sc07a-pending-update-desktop.png) and [focused mobile rights refusal](evidence/sc-07a/20261015-local/sc07a-rights-failure-mobile.png). SC-00C's lossless Environment bridge and its protected acceptance remain independently owned. Independent product experience review, protected Sounding Line and landed-source smoke remain open before claiming those tiers.

Feature Catalog: the candidate is not promoted as a completed mainline capability while protected integration and product experience evidence remain open.
