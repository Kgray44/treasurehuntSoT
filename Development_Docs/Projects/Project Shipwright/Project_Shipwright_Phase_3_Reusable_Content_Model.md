---
title: Project Shipwright Phase 3 Reusable Content Model
audience: engineering
status: active
canonical_for: project-shipwright-phase-3-reusable-content-model
last_reviewed: 2026-08-13
---

# Project Shipwright Phase 3: Reusable Content Model

## Personal Library records

The Phase 3 personal Library is private to the authenticated Creator. It has three reusable kinds: `PRESET`, `FRAGMENT`, and `CHAPTER_TEMPLATE`.

| Record | Responsibility | Immutability and privacy rule |
| --- | --- | --- |
| `ReusableAuthoringItem` | Owner-scoped Library identity, metadata, status, current version, and safe usage count. | A list/read/archive query always includes the authenticated owner; no cross-Creator discoverability is implied. |
| `ReusableAuthoringItemVersion` | Canonical checksum-backed envelope and version number. | Versions are immutable snapshots. A future edit must create a new version rather than mutating an existing insertion source. |
| `ReusableAuthoringUsage` | Draft-local source item/version provenance for a successful ordinary Studio save. | Existing inserted copies remain unchanged if their library item is archived or superseded. |

No record stores runtime session state, Captain commands, Player-private data, raw provider credentials, scanner diagnostics, executable content, or a second Chronicle runtime.

## Canonical reusable envelope

`voyagewright.reusable-authoring/v1` carries a stable item/version identity, kind, private owner, metadata, canonical blocks/chapters, ports, parameters, dependencies, accessibility obligations, attribution, lineage, compatibility, and a SHA-256 checksum over canonicalized content. The checksum is verified before use.

Capture originates only from persisted, owner-authorized Chronicle data. It fails closed for Creator notes, private/non-player-safe configuration, sensitive field names, and Sealed Hold sentinel content. Incoming/outgoing graph edges outside a selected fragment are represented as explicit ports, not silently copied.

## Parameter and dependency contract

Parameters use a stable lowercase key, readable label, enumerated safe type, required/default behavior, help text, and an existing canonical configuration/presentation/completion destination. Duplicate keys, synthetic destinations, unsupported value types, executable content, and arbitrary paths are rejected.

After values are resolved, the planner collects asset/artifact/location/provider references from the actual proposed blocks. Destination Chronicle assets, artifacts, and locations must exist; provider references fail closed unless an accepted adapter resolves them.

## Insertion contract

Insertion always reads the immutable owner-scoped version, creates a deterministic operation namespace, remaps known block/chapter/variable references, and produces a previewable plan. A fragment's entry root is connected from the explicitly selected destination Passage in the same plan. The resulting draft is checked by Drydock before confirmation; any newly introduced Drydock error rejects the plan.

Application goes through the ordinary Studio history/autosave path as one mutation with provenance. Undo removes the complete insertion and redo reapplies that one history entry. The server never accepts a client-supplied body as an insertion authority.

## Provider projection boundary

Harborlight installations are shown only when the installation, package checksum, package scan state, and release state remain eligible. Shipwright projects owner-backed title/release/license/attribution/compatibility/update metadata read-only. Current package items do not preserve a Shipwright reusable envelope, so insertion is explicitly unavailable. Landfall and Watchglass remain inactive absent accepted authoring contracts.
