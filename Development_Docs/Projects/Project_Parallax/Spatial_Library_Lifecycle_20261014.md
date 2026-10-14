---
title: Spatial Studio working drafts and unified Library lifecycle
audience: product-engineering
status: candidate-under-validation
canonical_for: parallax-library-lifecycle-review-20261014
last_reviewed: 2026-10-14
---

# Spatial Studio working drafts and Library

This continuation on draft PR #722 separates durable work from intentional reuse.
It preserves the existing reusable-item/version storage, Scene history, Chronicle
attachments, private-photo permissions and OpenAI provider boundary. It does not
merge the branch or establish physical AR acceptance.

## What a Creator saves

| Action | Identity and persistence | Library visibility |
| --- | --- | --- |
| Autosave | Updates mutable version zero of the current definition, with a revision check | Does not establish membership or add a saved card |
| Save to Library | Establishes durable `SAVED` membership on the existing definition | One saved definition; subsequent editing updates it in place |
| Save as new | Creates a deliberately named, independently editable identity with source lineage | Creator chooses Library or Working Drafts |
| Create version | Freezes a checksummed snapshot under its existing definition | Appears in that definition's history; identical content reuses the latest version |
| Restore version | Copies historical content into the mutable working draft | Historical bytes and pinned consumers remain unchanged |
| Archive / Restore | Changes discovery metadata under the same identity | Archived content remains recoverable; instances and historical versions survive |

`MY_LIBRARY` and `CHRONICLE_ONLY` still describe content scope. They no longer
mean that persistence alone constitutes an intentional Library save. Durable
membership lives in the existing item status. Names, imported formats and the
presence of reconstructed geometry never change an item's first-class type.
A scene containing one placed asset is still a Scene.

## Independent environments

An Environment is its own typed working document in the same owner-scoped
`ReusableAuthoringItem` and mutable version-zero storage. It contains the room,
provenance, metadata, exclusions and collection, rather than a hidden persisted
Scene. New room setup creates no unnecessary Scene record. The canvas adapter
uses a hidden, locked entity to satisfy the existing renderer contract; it is
view-only and is never persisted as an additional Scene.

Library's environment plus offers a preset/existing room, empty shell or photo
setup. Editing opens the actual environment definition. Names and feature
transforms autosave to that identity. Save to Library is separate. The empty
shell has no preset furniture; a photo draft without geometry shows a starting
point rather than a fabricated room.

Using an Environment copies an independent room snapshot into the Scene. Its
binding records the source identity, working revision or immutable version,
checksum and use time. Editing the original never silently updates other Scenes
or published Chronicles. The Inspector identifies the independent snapshot and
offers Edit original environment. Applying an updated source checks attached
support surfaces; removed, moved or changed supports cause actionable refusal,
leaving the Scene untouched.

Photos use the same ownership, encrypted private-media storage, scanning,
consent, expiry and provider ports. Their request uses the view adapter, but
Apply saves the environment document directly. Explicit saving and versioning
still require Creator actions. The image-free observation is retained in the
owner-scoped expiring AI result for diagnosis, including rejected builds; photos,
base64, credentials and storage paths are not added to this diagnostic record.

## Definitions, instances and versions

Exporting a selected object or subtree is an intentional Asset/Assembly creation
and freezes its first version. Ordinary Scene edits do not export definitions.
Each placed instance embeds independent entities and pins the selected source
version. The Inspector offers Edit original asset and Add another instance.
Editing one copy or its original never silently changes siblings or historical
pins. Assets and Assemblies have stable type metadata; adding an imported model
does not turn a Scene into an Asset.

History shows working/current state, dated immutable versions, notes and pinned
use counts. Preview uses the real canonical canvas in read-only mode. Historical
copy asks for a new name. Retry identities are bound to the selected version;
changing versions cannot replay another version's failed copy operation. The
existing Chronicle attachment and publication authorities remain unchanged.

## Library organization and legacy content

The same typed browser serves all definitions and its Environment subset. It
provides Saved, Working Drafts, Legacy review, Favorites, Recently used, Recently
modified, Collections, In use and Archived views. Search includes names, type,
description, tags, collections and classifications. Collections organize
identities; changing one does not clone the item. Context menus, keyboard entry,
focus restoration and light/dark styling retain the blue workstation design.

Old `ACTIVE` records with immutable releases project as intentionally saved.
Unreleased legacy records project as `LEGACY_REVIEW`, preserving ambiguous
intent for explicit review. Owner-scoped reconciliation changes status once
through CAS. It neither rewrites envelopes/checksums nor merges/deletes content
because titles or geometry match. Legacy Scene room snapshots can be extracted
deliberately with Save as new → Environment; they are not automatically promoted
to environment definitions. No bulk mutation of the shared owner database was
performed for validation.

## Failure, conflict and history safeguards

Autosave coalesces edits and serializes acknowledgments on the active identity.
Switching documents waits for the current save. Exact payload retries after a
lost response return the already acknowledged revision. Different stale payloads
must pass CAS and cannot overwrite another editor.

An account/definition-scoped browser journal retains pending authoring data for
refresh recovery. It contains neither photographs nor credentials. Reviewing
retained edits preserves their original base revision, including in environment
editing. A conflict can be resolved by keeping the saved revision or deliberately
creating a named independent copy of retained work. It is never an automatic
fork. Browser-storage exhaustion still leaves server autosave available, but a
browser that refuses storage cannot provide the same crash-recovery guarantee.

Environment Undo/Redo and shortcuts target its own history. Scene shortcuts are
suspended while that workspace or a modal is active. Returning does not mutate
or undo the originating Scene. The explicit Asset-export and Save-as dialogs
retain their operation identity across retries. No cloud secret manager or new
local service is required for these persistence semantics.

## Verification and remaining boundaries

Focused checks cover repeated editing, membership, retries, stale writers,
named copies, one room used by three independent Scenes, five pinned Asset
instances, historical integrity, metadata/archive recovery, legacy idempotency,
authorization and support-change refusal. Private-photo tests exercise a real
isolated SQLite environment document with synthetic image/provider bytes, then
verify that Apply creates no Scene definition.

Development journeys exercise the actual authenticated application, canonical
storage and renderer: twenty working edits, explicit Save plus ten edits, named
Save As, version preview, collections, environment creation/use/edit, failure
recovery/reload, lost acknowledgments, two tabs, typed views, light/dark/narrow
layouts, keyboard menus, environment history and version-specific copy retries.
Independent preflight found viewport clipping, a stale-recovery base-revision
error, hidden-Scene shortcut dispatch and cross-version retry intent. Bounded
repairs and targeted browser checks address these findings. Final production
capture and independent final review remain separate evidence tiers.

This work makes no paid OpenAI test calls. The owner's three recent two-photo
calls were inspected read-only: one proposed room in 76.454 seconds; two rejected
builds in 77.739 and 77.866 seconds. Provider generation accounted for 73.814,
76.162 and 76.474 seconds respectively. Both rejected results completed provider generation and then failed local
relationship/geometry validation; the saved content stayed unchanged. Private
photo-derived feature details remain outside public documentation. Generic
instructions now clarify rotated local frames and identifiable supports. Future
image fidelity and failure-rate improvement are not established by synthetic
tests or this prompt change. The [updated instruction snapshot](reference/Room_Instruction_Continuation_20261014.md)
records the exact adjustment; prior measured model comparisons remain historical.

Whole-overhaul integration, repeatable photo fidelity, rebuildable browser SLAM
qualification and real iPhone alignment/tracking remain distinct from this
Library increment. No physical accuracy, owner acceptance or merge is claimed.

## Source and document classification

This is current engineering evidence/user-workflow guidance under
`Development_Docs`, not active automation. The matching execution contract lives
in [`.agents`](../../../.agents/parallax-library-lifecycle.md). New raw screenshots
and recordings are engineering evidence. The instruction reference contains
product instruction strings only, not private inputs. See the
[Studio guide](Spatial_Studio_Guide.md) and
[user development overview](Spatial_Studio_User_Development_Overview.md).
