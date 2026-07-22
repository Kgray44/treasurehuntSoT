# Private Content Canonical Import Architecture

**Status:** ownership/contract record. Existing package import currently persists private import and asset records; full Chronicle materialization must be evidenced separately.

## Authority boundary

One Voyage remains the sole canonical Chronicle/runtime authority. Sealed Hold may invoke current canonical creation/validation paths but must not create a parallel story, campaign, person, session, invitation, Community listing, or release model. Wayfarer supplies canonical account identity and privacy; Harborlight and Lanternwake are not import side-effect targets.

## Required materialization shape

After authentication, inspection, conflict review, and explicit confirmation, one transaction materializes supported `tale-draft`, `published-tale`, and `tale-archive` content through canonical `TallTale`, `TaleDraft`, `StoryBlock`, `BlockConnection`, `TaleLocation`, `TaleArtifact`, and `TaleAsset` models. A policy-permitted published package additionally creates an immutable `PublishedTaleVersion`; a draft does not publish.

Logical source IDs map deterministically to canonical IDs through `PrivateContentImportMapping`, scoped to the import and source type. Replays return the existing mapping. Source identity/revision collision, mutable-published-source, invalid Studio schema, and incompatible canonical relations produce explicit conflict codes and a reviewable plan instead of implicit remapping.

## Privacy and runtime invariants

Imported Chronicle content remains private to its canonical owner. Materialization must validate through current Studio/One Voyage validators and create neither a Tale Session nor a Player membership/reveal, invitation, Community Listing, or Community Release. Active Tale Sessions remain unchanged. Asset references remain unavailable until storage and scanner policies permit finalization.

## Current migration boundary

The reserved `20260722132000`/MySQL `0018` checkpoint is intentionally additive/no-op for canonical tables: materialization uses existing canonical models rather than duplicating them. Application services and transaction/authorization tests, not another schema table alone, are the completion evidence for this architecture.
