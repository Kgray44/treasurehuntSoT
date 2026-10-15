---
title: SC-01 canonical Studio integration checkpoint
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc01-studio-integration-20261015
last_reviewed: 2026-10-15
---

# Reusable Environments and independent Scenes

The SC-01 consumer port is implemented in the owned D: branch codex/parallax-sc01-studio-integration. Initial host source 68d59944 and handoff c361d60c combine the frozen Studio e073eaa2 with the lossless compatibility bridge, typed legacy working storage, Scene Manager and the SC-00C Library projection. Later combined production-browser progress is recorded below. No combined visual, protected, physical or owner acceptance is claimed.

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

The frozen host has 148 passing focused checks across 16 files, full TypeScript and scoped runtime/component/test lint. One inherited internal full-navigation warning remains in EnvironmentDefinitionWorkspace. Validation-only follow-up d88c0cf6 types the older lifecycle model fixture; its 17 checks, full-file lint and full TypeScript pass. The exact-target legacy impact repair at 6a476d05 adds 11 impact checks; its focused three-file run passes 35 checks. These overlapping runs are not added together. The contract schema validates all 67 visible journey steps and 13 states. At d88c0cf6, SC-01 adds one contract while preserving the 493 prior objects; parsed objects are identical before and after required formatting. The subsequent ea4b5f24 root merge retains its separately owned SC-02 control-selector corrections.

The [development receipt](evidence/sc-01/20261015-studio-integration/run.json) retains the initial failing public-preset metadata lookup, recovery observation race, stale calibration review, SC-02 timing classification and actual legacy target/support-frame probes, together with their bounded repairs and checks. Earlier fixture/type errors and the invalid async plan invocation are retained as harness failures. They are not passing product receipts or protected review iterations. This record does not reset any capture, repair or independent-review history.

The new actual-browser file covers the Haunted Bedroom's three independent Scenes, saved/built-in/reconstructed sources, rendering, source/version reuse, reload, ordinary history, stale conflicts, immutable publication bytes, comparison, explicit updates, geometry rejection, semantic repair and constrained keyboard/dialog behavior. At the initial checkpoint these journeys were prepared but unrun.

## Combined production-browser attempt

Combined source 3ecb2962 merges root ea4b5f24 and retains the exact reviewed legacy impact recovery. Focused domain/API checks pass 133 checks in ten files; the separate Canvas/Studio run passes 19 checks in two files. The full TypeScript check catches a missing anchor discriminant in the late support-frame condition. Correction c4d65860 narrows the kind before reading alignment without changing the existing runtime branch. Full TypeScript, scoped authoring lint and 25 focused support/Canvas checks then pass.

The [first combined browser attempt](evidence/sc-01/20261015-studio-browser-attempt1/run.json) builds that exact source successfully and opens the actual room picker. Its first journey fails because the prepared harness requests a textbox while the actual field has the correct searchbox role; the two subsequent serial journeys are skipped. The screenshot, recording, snapshot, complete log and valid source-binding receipt remain preserved. The bounded harness correction uses the actual search role and the existing visible Manager Save Scene flow. This failure does not establish any of the three end-to-end journeys. Prior independent and protected review counts remain unchanged.

The [second attempt](evidence/sc-01/20261015-studio-browser-attempt2/run.json), at 5c551db6, reaches actual Environment creation, the three named Scenes, letter editing and the shared-room Canvas. It fails on the next stale harness locator: the current Compositions Library uses searchbox Search compositions. Its three partial captures and failed recording remain source-bound. The subsequent selector audit also keeps unsaved-state assertions inside the visible native modal, makes the archive-card heading filter relative and narrows the expected geometry alert. These are harness corrections; complete persisted independence, revision updates and the other two journeys remain unproved by this attempt.

The [third attempt](evidence/sc-01/20261015-studio-browser-attempt3/run.json), at 67984bd9, runs all cases independently with one worker. Two pass: the legacy working/release/reload/semantic-repair consumer and reconstructed-source Scene duplication/reload. The Haunted Bedroom case reaches the composition details, then fails on another stale harness label, Add to Scene instead of the actual Add to active Scene.

Inspection of the actual legacy Canvas shows only its Scene object. Source inspection confirms all ten historical built-ins store an empty fixtures array alongside semantic placement references. The exact renderer correctly preserves that absence; drawing an unrelated Bedroom would falsify the pin. The Manager and owned editor now disclose absent geometry. The next legacy journey deliberately adds shared furniture through the editor, verifies its working/released payload and captures that explicit geometry. The earlier automated PASS is retained but does not prove nonempty fixture rendering.

The [fourth attempt](evidence/sc-01/20261015-studio-browser-attempt4/run.json), at ff798609, passes both consumers again and renders the explicitly authored legacy cabinet. Its Haunted Bedroom case proves the reached isolation, publication, exact Scene-reference export, shared-version review/update, comparison and first two Undo-save assertions. It then exhausts the unchanged production 60-request/minute limit during the dense automated redo sequence. The original rate-limit failure is retained.

That adverse state reveals a separate recovery gap: background autosave errors appear only in the inert Studio behind the native Manager. The bounded correction brings the existing error beside the active Scene controls, preserves working changes, clears it on explicit retry and retains canonical persistence/CAS. A regression fails before repair; the Manager/host rerun passes 23 checks. The next journey deliberately spans one ordinary rate window between publication and revision review, without changing production protection, and adds an actual Ordinary Room capture through Preview Scene.

The [fifth attempt](evidence/sc-01/20261015-studio-browser-attempt5/run.json), at 08094ba1, compiles successfully but stops before browser execution: the new regression accidentally uses Playwright's exact option in a Testing Library role lookup. The correction removes that unsupported test option while retaining the recovery assertions. The original build log is preserved; this attempt adds no browser result or rendered acceptance.

## Passing normal journeys

The [sixth attempt](evidence/sc-01/20261015-studio-browser-pass/run.json), at b717de17 with tree 4acc4623, passes all three actual production-browser journeys without retries. The full Haunted Bedroom case completes independent content, publication and [immutable Scene-reference export](evidence/sc-01/20261015-studio-browser-pass/chronicle-scene-reference-example.json), controlled Environment update, comparison, Undo/Redo, inactive update, stale-save rejection, unchanged published bytes, reload/switch, mobile accessibility/focus, archive and natural Library return. Actual Canvas captures show Ordinary Room through Preview Scene, The Haunting and The Hidden Letter. The legacy case renders explicitly authored fixture geometry, and the reconstructed-source copy retains its exact pin after reload.

This establishes the executed normal journeys on that frozen source. All five earlier failures remain retained. The save-error fix still needs its separate actual adverse-state capture; a bounded fourth case now injects one transport failure, verifies the retained server revision and retries the same working identity. Additional mobile gallery and impact framing will make those existing states easier to inspect. Later root Inspector, paged Library and installed read-only changes retain their own source and acceptance obligations. Independent combined review, protected qualification and landed smoke remain open.

## Remaining acceptance and coordination

Root PR 722 owns the final shared Canvas, Assistant and element insertion reconciliation. Preserve its later composition classification fix, room-aware insertion helper, Inspector work and phone View-control repair when integrating this host. Legacy projection must use exact fixtures, candidates and light, without substituting generic Bedroom geometry or inventing rich rooms. Significant experience acceptance still requires actual combined captures and independent review with all prior history intact.

Inventory currently loads full owned drafts/releases before displaying cards. No hundreds/thousands-scale acceptance follows from these small fixtures; SC-00C and the canonical service owner retain the pagination investigation. This checkpoint does not truncate memberships or weaken exact-pin resolution.

Protected main was refreshed to 99a2baba on 2026-10-15. The correctly awaited read-only c361d60c plan diagnostic remains blocked by PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity. [Proposal 731](https://github.com/Kgray44/treasurehuntSoT/pull/731) remains an open draft at e56dbdd8; it is not an active waiver. No new authority run, ordinary PASS, protected merge or landed smoke is claimed here. The Feature Catalog fragment remains unchanged for this unaccepted integration work.
