---
title: SC-01 canonical Studio integration checkpoint
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc01-studio-integration-20261015
last_reviewed: 2026-10-15
---

# Reusable Environments and independent Scenes

The SC-01 consumer port is implemented in the owned D: branch codex/parallax-sc01-studio-integration. Host source 68d59944 and handoff c361d60c combine the frozen Studio e073eaa2 with the lossless compatibility bridge, typed legacy working storage, Scene Manager and the SC-00C Library projection. This is implementation and focused contract evidence. The three new production-browser journeys have not yet run on this combined source, and no combined visual, protected, physical or owner acceptance is claimed.

The [main-based SC-01 candidate](https://github.com/Kgray44/treasurehuntSoT/pull/727) retains source a33780ae and its original captures, three independent local reviews and repairs. Those artifacts remain bound to that source. They cannot qualify this newer Studio port. The [compatibility review](SC_01_Compatibility_Review_20261015.md) and [typed Library projection](SC_00C_Legacy_Working_Projection_20261015.md) retain their separate source boundaries.

## Persistence and ownership

Rich rooms use the existing EnvironmentDraft v0, deliberate releases and canonical ENVIRONMENT_USE operation. The legacy adapter keeps schema-one fixtures, semantic candidates and base properties in a typed v0 document in the existing ReusableAuthoringItem/Version tables. It does not convert fixtures into a rich room or introduce a runtime authority. Positive release ordinals remain distinct from mutable CAS revisions. Opaque Environment version IDs retain the full 160-character contract.

| Legacy action            | Durable effect                                                                        | Reuse and history boundary                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Begin shared editing     | Creates v0 once from a verified owned positive source; retains existing working edits | Does not rewrite the source release or infer Library membership                                           |
| Copy built-in            | Creates a new owned v0 with immutable source/operation provenance                     | The public preset is unchanged; unrelated private rows cannot supply its CAS metadata                     |
| Working save             | Replaces only v0 through owner/kind/CAS checks                                        | No automatic release or Library membership; exact lost-response retries acknowledge the retained payload  |
| Save to Library          | Changes explicit membership                                                           | Preserves working and released envelopes                                                                  |
| Create immutable version | Appends a positive version through a replayable reviewed operation                    | Checks the working content checksum; release ordinal is independent of CAS; legacy membership is retained |
| Archive or restore       | Changes owner-scoped discoverability through CAS                                      | Existing immutable Scene pins remain resolvable                                                           |

The rich lifecycle keeps its existing deliberate release/membership behavior. Its canonical Environment-use transaction now invalidates a prior derived calibration review when the selected Environment changes. This invokes the existing invalidation function and does not create physical qualification.

## Visible workflow

Ordinary Scene editing has one Environment-to-Scene context and one Manage Scenes entry. Assets and compositions retain their original-definition context. The Manager shows associated working Scenes, content-derived thumbnails and descriptions, explicit Environment source versions, independent save state and immutable identity information. It supports baseline creation, Scene-source duplication through Save As, rename, archive, switching, saving, preview and comparison.

Owned Environment editing opens that same definition in its existing working workspace. Built-ins open a new owned copy. The separate legacy workspace provides ordinary working saves, independent Undo/Redo, explicit Library membership and immutable release. Its crash recovery uses the same account/definition-scoped journal family, a typed reader and the original retained CAS. Recovery never advances the stale revision to overwrite another editor. Reloading an Environment workspace preserves an explicitly named return Scene.

Environment source selection requires a deliberate saved membership or a built-in source. A working document is not an immutable pin. The catalog separates v0 from checked positive releases, keeps unknown legacy organization preferences unknown, and supplies no fabricated moving current version. Existing Scene duplication retains its original immutable association even if the Environment's working state later changes.

Rich updates call canonical ENVIRONMENT_USE. Legacy updates use the retained impact rules and ordinary Scene save/CAS. Both retain Scene history; inactive updates load the latest owned Scene before changing it. The impact projection uses the existing geometry/semantic facilities. Attached rich supports use the same extracted guard in the service and Manager. The bounded legacy follow-up uses actual target support frames and checks stored attachment existence, safety and pose. It also treats a distinct exact release as an explicit update even when its content checksum is equal.

Tideglass remains the comparison engine. The projection distinguishes objects, transforms, visibility, effects, interactions, animation tracks and Environment associations. Actual SC-02 pulseHz, common playback timing and motion speed participate in animation differences. A static intensity change remains an effect difference.

## Integration-ready Scene reference

The existing scene-reference module exports and validates schemaVersion 1 with Scene definition/version/checksum, the exact Environment reference, authored behavior IDs and CUT/PRESERVE_ENVIRONMENT intent. The consumer must retain every pin when publishing. Working edits cannot rewrite a released Scene or an exported immutable reference. This is a future Chronicle handoff, not SC-03 Creator integration or a transition runtime.

## Validation and retained failures

The frozen host has 148 passing focused checks across 16 files, full TypeScript and scoped runtime/component/test lint. One inherited internal full-navigation warning remains in EnvironmentDefinitionWorkspace. Validation-only follow-up d88c0cf6 types the older lifecycle model fixture; its 17 checks, full-file lint and full TypeScript pass. The exact-target legacy impact repair at 6a476d05 adds 11 impact checks; its focused three-file run passes 35 checks. These overlapping runs are not added together. The contract schema validates all 67 visible journey steps and 13 states; all 493 prior contract objects remain unchanged. The required repository formatter normalizes the registry's existing array layout as well as the new entry; parsed registry objects are identical before and after formatting.

The [development receipt](evidence/sc-01/20261015-studio-integration/run.json) retains the initial failing public-preset metadata lookup, recovery observation race, stale calibration review, SC-02 timing classification and actual legacy target/support-frame probes, together with their bounded repairs and checks. Earlier fixture/type errors and the invalid async plan invocation are retained as harness failures. They are not passing product receipts or protected review iterations. This record does not reset any capture, repair or independent-review history.

The new actual-browser file covers the Haunted Bedroom's three independent Scenes, saved/built-in/reconstructed sources, rendering, source/version reuse, reload, ordinary history, stale conflicts, immutable publication bytes, comparison, explicit updates, geometry rejection, semantic repair and constrained keyboard/dialog behavior. These journeys are prepared; their existence is not execution proof.

## Remaining acceptance and coordination

Root PR 722 owns the final shared Canvas, Assistant and element insertion reconciliation. Preserve its later composition classification fix, room-aware insertion helper, Inspector work and phone View-control repair when integrating this host. Legacy projection must use exact fixtures, candidates and light, without substituting generic Bedroom geometry or inventing rich rooms. Significant experience acceptance still requires actual combined captures and independent review with all prior history intact.

Inventory currently loads full owned drafts/releases before displaying cards. No hundreds/thousands-scale acceptance follows from these small fixtures; SC-00C and the canonical service owner retain the pagination investigation. This checkpoint does not truncate memberships or weaken exact-pin resolution.

Protected main was refreshed to 99a2baba on 2026-10-15. The correctly awaited read-only c361d60c plan diagnostic remains blocked by PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity. [Proposal 731](https://github.com/Kgray44/treasurehuntSoT/pull/731) remains an open draft at e56dbdd8; it is not an active waiver. No new authority run, ordinary PASS, protected merge or landed smoke is claimed here. The Feature Catalog fragment remains unchanged for this unaccepted integration work.
