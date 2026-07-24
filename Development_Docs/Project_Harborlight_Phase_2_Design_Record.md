# Project Harborlight Phase 2 - Open the Exchange Design Record

Status: frozen before implementation. Base: `origin/main` `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`.

## Authority and boundaries

Harborlight owns Community listings, immutable releases, package semantics, publication, installation plans, dependency/licence compatibility, attribution, lineage, and release-update records. One Voyage remains the sole Chronicle, `PublishedTaleVersion`, Studio-draft, and live `TaleSession` authority. Wayfarer remains the account/profile/privacy authority; Harborlight consumes a small creator-identity port and stores no person-profile fields. Sealed Hold remains the archive-safety, scanner, quarantine, object-storage, and cryptographic authority; Harborlight consumes narrow safety, scanner, and asset-storage ports. Lanternwake remains the animation director and reduced-motion/cleanup authority; no success presentation occurs before a successful commit.

## Frozen exchange contracts

A **listing** is mutable catalog intent. A **release** is an immutable published version of that listing, including source/version, manifest, package checksum, licence and attribution snapshots. A **package** is a non-executable, checksummed distribution archive generated from exactly one release. Packages have deterministic manifests, no executable entries, normalized relative paths, no symlinks, and explicit limits. Corrections and updates always create releases; a release payload is never rewritten.

Install planning is pure/dry-run: it validates package integrity, dependencies, licence closure, destination freshness, conflicts, remapping and asset reuse. Install commit is idempotent and records an operation, receipt, mappings, attribution and lineage in one database transaction. Asset finalization failure marks a recoverable unavailable operation and permits retry; it cannot report success or silently create a partial Studio draft. Active `TaleSession` records are neither read for mutation nor written by Harborlight.

Supported delivery uses typed package items: Chronicle, Chronicle template, block preset, 2D/3D artifact, collection, and assembly. 2D requires declared/detected type, accessible description and licence data. 3D is GLB-only in this phase, has bounded parser limits, poster/fallback text, and never executes scripts or follows external URIs.

## Compatibility adapters

`CommunityCreatorIdentityPort` obtains public/owner creator projections and asserts capability. `CommunityChronicleSourcePort` reads a sanitized immutable `PublishedTaleVersion` projection and creates any Studio draft only through One Voyage. `CommunityPackageSafetyPort`, `CommunityAssetStoragePort`, and `CommunityScannerPort` are Sealed Hold replacements; a local deterministic test adapter is development-only. `CommunityAnimationPort` is a receipt-only Lanternwake seam.

## Schema and migration plan

All schema changes are additive in this branch. SQLite directories use `20260722140000`, `20260722141000`, `20260722142000`, `20260722143000`, `20260722144000`, and `20260722145000`; matching MySQL scripts use `0019` through `0024`. No prior migration, canonical Chronicle model, account model, private-content table, or Lanternwake registry is modified.

## Non-goals

No public discovery/social features, review/comments/follows, public collections, production storage/scanning/worker deployment, live MySQL execution, or Phase 3 work is included. Browser proof requires an isolated runtime and is reported separately when unavailable.
