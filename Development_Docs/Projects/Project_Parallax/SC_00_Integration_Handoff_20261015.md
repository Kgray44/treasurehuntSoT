---
title: SC-00 Spatial Studio integration handoff
audience: product-engineering
status: implementation-in-validation
canonical_for: parallax-sc-00-integration-handoff-20261015
last_reviewed: 2026-10-15
---

# Continuation and ownership

Continue `codex/parallax-studio-overhaul` in the owned `px-surface` worktree and
existing draft [PR #722](https://github.com/Kgray44/treasurehuntSoT/pull/722).
Continuation baseline is `a5eeb5b42561042cea7e799a3b0d54c1b03c1006`;
protected main was refreshed to `4baa39af82b78b50a46f590bc2acc2ff0b7597aa`.
Do not reset the owner checkout, its unrelated AGENTS/tsconfig changes, private
evidence, inspection app, phone pairing or test databases.

SC-00 retains geometry, reconstruction, Assistant, scene editing, timeline,
simulation and validation. SC-00B owns the right Inspector and vertical tool-rail
redesign; SC-00C owns the left Library redesign; SC-07A owns direct Spatial
Community publishing through Harborlight. Their complete UI/publication scopes
are not implemented or accepted by this handoff. SC-00A Chronicle creation
remains in its separately owned PR #726. SC-01 and SC-02 remain separately owned.

## Shared contracts to preserve

| Boundary                     | Canonical source and constraint                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scene identity and mutations | `src/parallax/authoring.ts`: `SpatialDraft`, `Edit`, `History`, `editSpatialDraft`, Undo/Redo. Preserve normal history, serialized autosave and revision checks.                                                                                                                                                                                                                                                                         |
| Entity properties            | `src/parallax/contracts.ts` and `studio-contracts.ts`: finite transforms, normalized quaternion rotation, anchors/parent frames, content/interactions, layers, animation tracks, groups and pins. Optional new fields must not change historical serialized/checksum material.                                                                                                                                                           |
| Inspector and selection      | Inspector is currently inline in `SpatialStudio.tsx`, with `RoomEnvironmentEditor`, `GroupSelectionInspector` and `StudioTextField`. Retain `selected`, `selectedRoomFeature`, `selectedGroupId`, typed `selectionItems` and derived `selectionMembers`; use shared `edit`/`replace` commands. Clicking a grouped member selects that member; group-wide editing starts in Groups. Room-feature mutation requires environment edit mode. |
| Library surfaces             | `SpatialLibrary.tsx`, `SpatialAssetBrowser.tsx`, `EnvironmentLibrary.tsx`, `SavedSpatialLibrary.tsx`, `EnvironmentCreateDialog.tsx`, `EnvironmentDefinitionWorkspace.tsx`. Discovery and panel state must not mutate authored data. Preserve explicit save, stable working identity, named copies and recoverable archive.                                                                                                               |
| Shared UI files              | `SpatialStudio.tsx`, `SpatialStudio.module.css`, `workspace-layout.ts`, `useWorkspaceLayout.ts` are integration hotspots for SC-00B/00C. Coordinate bounded sections instead of replacing the whole workstation. Preserve Assistant overlay, selection, timeline clock, recovery and narrow/reduced-motion behavior.                                                                                                                     |
| Environment geometry         | `environment-contracts.ts`, `room-geometry.ts`, `construction-verification.ts`, `room-placement.ts`, `surface-placement.ts` are shared by presets, photo rooms, direct placement and Assistant queries. Exclusions and physical clearance remain enforced.                                                                                                                                                                               |
| Timeline/simulation          | `animation-authoring.ts`, `behavior.ts`, `AnimationEditor.tsx`, `BehaviorTracks.tsx`, `SpatialSimulation.tsx`. Preview, scrub, playback and simulated triggers use the same evaluator and scene clock. Simulation never writes One Voyage progression.                                                                                                                                                                                   |
| Rendering                    | `SpatialCanvas.tsx` and `spatial-workstation` own actual editor instances, transforms, materials, picking and renderer receipts. Runtime adapters consume canonical Parallax entities; SC-02 must preserve shared evaluation and Lanternwake motion policy.                                                                                                                                                                              |

## Persistence and SC-01 reconciliation

The current overhaul uses existing owner-scoped `ReusableAuthoringItem` and
`ReusableAuthoringItemVersion` storage. Mutable version zero is the working
envelope; positive versions are immutable. `currentVersionNumber` is a CAS
revision, not the immutable release ordinal. Autosave does not establish Library
membership; Save to Library, Save as new, version creation and restore are
different operations. See the [lifecycle record](Spatial_Library_Lifecycle_20261014.md).

Independent Environment documents currently use `PARALLAX_ENVIRONMENT_DRAFT_1`
and `PARALLAX_ENVIRONMENT_VERSION_1` from `library-lifecycle-contracts.ts`.
`library-lifecycle-service.ts` owns saving, copying, releasing and reuse. A Scene
embeds an independent room snapshot under `studio.environment` and retains its
source in `studio.environmentBinding` with `INDEPENDENT_PINNED_SNAPSHOT` policy.
Updating a source never silently updates consumers; changed attached supports
are checked before any replacement. Historical versions remain unchanged.

SC-01 reviewed product source `adc5709b611bbc47e862a723395206d8b2106536`
(draft PR #727; reported evidence head `421bbcdd`) introduces a
`PARALLAX_ENVIRONMENT` record kind and a top-level Scene Environment pin,
`environmentPlacements`, description and presentation fields. These are **pending
interfaces**, not fields already integrated into PR #722. Reconcile these two
representations explicitly before combining branches: retain working-versus-saved
semantics, source identity, private-photo provenance, immutable versions and CAS.
Do not leave two competing Environment authorities or silently rewrite old pins.

The specific reconciliation is not a file replacement. SC-01's current
`EnvironmentContent.fixtures` contains axis-aligned size/position/color proxies;
the overhaul's `RoomEnvironment` includes classified features, yaw/orientation,
physical parts, supports, exclusions, construction and photo uncertainty. Retain
that richer authored geometry as lossless content. A Scene Manager or catalog
projection must not round-trip it through the smaller fixture shape and discard
those fields. The two branches also export different `environmentVersionSchema`
shapes. Reconcile exports deliberately rather than importing whichever name wins.

The compatibility bridge must preserve these invariants before sibling integration:

- Stable Environment definition identity, mutable working revision zero and
  WORKING/SAVED/LEGACY_REVIEW/archive status survive Scene Manager/catalog edits.
  An existing working save does not become a new Library member or release.
- Positive Environment versions and every existing published Scene checksum remain
  unchanged. Convert a legacy source only through an explicit owner-scoped operation;
  preserve lineage and report any unsupported data rather than dropping it.
- An immutable Scene pin resolves the exact Environment version and checksum.
  Working snapshots remain independent until an explicit reviewed source update;
  no lookup of moving `current`/latest may change an existing consumer.
- Environment replacement checks entity/support IDs and returns affected placements
  for review. A Scene rename, light override or material edit must not rewrite its
  Environment, and shared Environment changes must not silently edit other Scenes.
- All adapters use the existing owner authorization, CAS/history/save boundaries.
  Preserve private-photo consent/provenance without putting photos, credentials or
  private Library organization into Assistant requests or Community publication.

These are integration requirements, not a claimed implemented migration.

### Additive compatibility implementation in qualification

After verified direct owner repair/integration authorization and SC-01's explicit
bridge assignment, the existing PR #722 candidate adds these concrete interfaces:

- `environment-reference.ts` preserves the SC-01 exact-pin fields, accepting
  existing lifecycle release IDs up to 160 characters without truncation. Its
  `revision` means immutable release ordinal, not the mutable item CAS revision.
- `environment-version-resolution.ts::resolvePinnedEnvironment(accountId,pin,tx)`
  validates the exact owner, item kind, version ID/ordinal, envelope and checksum.
  The discriminant is `SC01_SCHEMA1` (`legacy`, no invented rich `room`) or
  `PARALLAX_ENVIRONMENT_VERSION_1` (`document` and the lossless `room`). Archived
  definitions still resolve their owner's exact immutable pins; v0 never qualifies.
- `legacy-scene-environment-contracts.ts` qualifies the unchanged schema-one
  content shape. `builtin-environments.v1.json` retains SC-01's checked-in version-one
  content/checksums from `a33780ae`. Existing richer release envelopes are not
  converted through that shape. Tests include 30 × 40 metre rooms and 150-character
  release IDs.
- `environment-library-compatibility.ts::listCompatibleEnvironments` returns
  `LIFECYCLE_V1` records containing `working`, the complete original `lifecycle`
  record, explicit `versions`, CAS `revision`, `saveState` and archive status.
  `SC01_SCHEMA1` records retain exact legacy/built-in `versions`, `working:null`
  and conservative legacy-review membership. No fabricated `current` pin is supplied.
- `POST /api/studio/parallax` action `ENVIRONMENT_CATALOG` returns `{catalog}`
  through the existing Creator/CSRF/rate/private-no-store port. It accepts no
  caller-supplied account selector and does not enlarge the ordinary GET projection.
  Existing `ENVIRONMENT_SAVE`, `ENVIRONMENT_RELEASE`, `ENVIRONMENT_USE`, `SAVE_AS`,
  `VERSION_RESTORE` and Library membership operations remain canonical. Environment
  release IDs through those mixed lifecycle inputs may be 160 characters.
- Optional top-level Scene fields match SC-01's pin, description, lighting and
  semantic-placement contracts; omitted historical fields remain omitted. The
  normal save transaction and Scene release verify a pin's room snapshot and
  referenced features. Explicit `ENVIRONMENT_USE` of a positive release records
  the exact pin; a working snapshot has no immutable top-level pin. The original
  snapshot source-binding CAS remains distinct. `scene-reference.ts` retains
  SC-01's exact released Scene/Environment/behavior/transition contract.
- Pinned Scenes keep their room read-only during ordinary Scene edits. **Edit
  environment** opens the established explicit Save As flow preselected to an
  independent Environment copy, then the existing Environment definition workspace.
  The original Scene/pin and released Environment remain unchanged. Legacy pins
  without rich room geometry receive explicit guidance rather than a fabricated
  baseline. `startRoomEditing`, `replace`/history and server save checks share this
  boundary; asset editing still uses the ordinary Scene controls.

This does not yet import the full SC-01 Scene Manager/comparison, SC-00B/C UI or
SC-02 elements. SC-01 owns the bounded Manager/comparison adaptation against the
frozen bridge. In particular, comparison must include canonical `animationTracks`
without changing their evaluator or timeline semantics. No implicit legacy
conversion or moving-current substitution is implemented.

The bridge's refreshed software suite passes **846 checks across 77 files**.
Independent domain review then identified two consistency gaps: historical Save As
lineage still capped release IDs at 128 characters, and the editor source binding
could contradict a valid root pin. Both are repaired. An actual 150-character
release copy preserves exact lineage/source bytes; canonical save rejects conflicting
definition/version/checksum without changing CAS or saved bytes. Matching source
CAS 19 remains valid against release ordinal 1, and absent legacy bindings remain
supported. The final focused run passes **29 checks across two files**. Independent
bounded re-review confirms both repairs with no remaining blocker; it inspected
the run rather than rerunning it. Resolver SHA256 at that review:
`3fcbeebc8bf8231c0e90e4e04d13aa9b45e273b899113b9542092c05e55f3930`.
Actual copy-flow browser proof remains a separate pending step.

The first actual production-browser run at `03fd8a318c3b79d6ada0472deb234fe5b7113009`
passed the existing Library discovery/edit/apply/archive journey. The new pinned
copy journey failed during fixture release, before Studio opened: Node 24's dynamic
TypeScript import raised `Cannot use import statement outside a module` in
`construction-verification.ts`. Source binding remained valid and task-owned
process/port cleanup passed. Preserve that failed run and recording; it does not
prove the copy UI. A bounded repair imports the same verifier normally, retaining
all construction checks and avoiding the loader mismatch. Fresh browser proof is
still required after that repair.

SC-01's independent compatibility audit also found that the new exact-pin check
needed its existing schema-one Environment impact guard. A valid legacy pin could
otherwise admit an object at x=99 metres. The bridge now retains SC-01's
`reviewEnvironmentImpact` rules in `legacy-scene-environment-impact.ts` and invokes
them for schema-one records: room bounds, available horizontal/vertical support,
safe semantic resolution and ordinary authoring errors remain enforced without
fabricating rich geometry. Focused regressions retain the rejected draft bytes
and cover missing surfaces and semantic candidates. The original failing audit
remains evidence; fresh combined review remains required.

Accepted diagnostic main `99a2babaefbbe051de0352c4aca22c8723b743b8` is reconciled
through local merge `a5cc24747251dbac521e17d746960bb77eaabe29` with no conflicts.
Its product `src` matches parent `7851ad5f`; the repair changes attribution of
browser receipts and preflight failures, not consumer experience acceptance. The
Crossdeck experience-design gate remains open. Earlier captures and failure
receipts retain their original source identities.

The second actual run at `8e612f7ad96f799cc7511bf72ea6196372d012f9` passed
production compilation/typechecking and the existing Library journey. It reached
the intended independent-copy dialog, but the new test's label locator did not
resolve its Type selector despite the accessibility snapshot exposing the expected
`combobox "Type"` and selected Environment. The next bounded test repair uses that
visible role/name and waits for the specific renamed copy to persist, rather than
accepting a pre-existing generic saved status. The failed receipt, screenshot and
recording remain retained. No product control or validation was bypassed.

The third run at `cde8957a8f1436387f5528f89949e0abb695e32c` created and renamed
the independent Environment and retained its rich features/no extra release.
It failed the final `JSON.stringify` Scene equality assertion. Parsing expected
and received values shows no content differences; only key order differs. The
next test revision compares content structurally and captures actual stored
working-envelope bytes separately. It has not been rerun. Preserve all three
failed overall receipts and recordings in the [attempt evidence](../../Testing/Product_Experience/evidence/parallax-environment-bridge-20261015/README.md).
No fourth browser attempt or budget reset occurs at this checkpoint; independent
review and combined verification remain pending. Existing Library journeys passed
in all three runs, but that is not a passing complete copy journey.

Independent experience review inspected all 11 retained stills and sampled all
six recordings, including denser inspection of the final copy transition. It
confirmed the serialization-order mismatch and found no changed Scene values or
visible product blocker. Its disposition remains **BLOCK_WITH_EVIDENCE** for
`PX-BRIDGE-PRESERVATION-EVIDENCE-01`: original stored Scene bytes, the unreached
immutable-release assertion and copied-workspace return/reload are not established.
The corrected harness passes TypeScript/focused lint but is unrun in the browser.
See the [supporting report](../../Testing/Product_Experience/evidence/parallax-environment-bridge-20261015/independent-review.md).

SC-01's `src/parallax/scene-reference.ts` exports `SceneReference`,
`sceneReferenceSchema`, `sceneReference` and `validateSceneReference`. It binds a
validated immutable Scene definition/version/checksum, its exact Environment pin,
behavior IDs and `CUT`/`PRESERVE_ENVIRONMENT` transition intent. Future Chronicle
consumers must validate the complete reference rather than substitute latest
versions. Transition intent is not SC-03 runtime implementation. Current Chronicle
attachment remains `library-service.ts::attachSpatialVersion`, validated through
the existing Chronicle/Drydock/publication authorities.

## Neighbor interfaces and integration order

Read-only source inspection pinned the following local checkpoints; none is
imported or accepted by this handoff:

| Owner/checkpoint                               | Interface to reconcile against the overhaul                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC-00B `847f54db`                              | Three Inspector destinations (Properties, Spatial context, Scene settings) preserve selection and use ordinary history. Its main-based preservation matrix predates the overhaul's explicit groups, editable room features and exclusions. Port bounded Inspector sections into the current selection model; retain group member isolation, environment edit guards, text keyboard handling and current Assistant/room editors. Do not replace `SpatialStudio.tsx` wholesale.                                                                                                         |
| SC-00C `2778b08d`                              | Its `SpatialLibrary` consumes `SpatialLibraryRecord[]`, SC-01 `EnvironmentRecord[]` and callbacks for insertion, composition copy, Scene open/duplicate/update/archive and Environment management. Build projections over the reconciled save model. Keep working/legacy/archive discovery and idempotent Save As; catalog filters and thumbnail selection do not write authored content. This source already depends on unmerged SC-01/SC-02.                                                                                                                                        |
| SC-02 `34d397d3` product / `2f31fb5f` evidence | Optional `entity.element` and `SpatialElementInspector({entity,onChange})` use normal CONTENT/history. `SpatialAssetBrowser` accepts catalog IDs or classic names; `SpatialCanvas` adds optional `playing`; `referenceSurfaceFrame(anchor,upright=false)` preserves legacy plane frames and typed Y-up roots. Preserve asset pins/instance IDs, layers/groups/behaviors and the shared timeline evaluator when adding these fields. Per-entity LIGHT remains distinct from Scene lighting and Environment base light. The vase remains reported Preview only, not a releasable asset. |
| SC-07A `13a7f68d`                              | This observed checkpoint merges SC-01 onto main and contains no verified Community publishing implementation. Harborlight publication must consume explicitly chosen immutable reusable versions through its own governed service. Private Library membership, archive, Scene attachment and Community publication remain separate operations. Await a concrete publishing interface before wiring a Library publish action.                                                                                                                                                          |

Integrate the Environment/version/save compatibility bridge with SC-01 first.
Then reconcile SC-02's optional element/renderer contracts and old-version tests.
SC-00B and SC-00C can then consume that stable model as bounded UI changes, followed
by SC-07A's separately reviewed publication port. This is a technical dependency
order, not authorization to merge any neighboring PR. If a neighbor advances,
re-pin and review the delta before using its interface.

## Isolated current-main reconciliation

The attached `px-production-qualification` checkout was clean and had no application
process referencing it. Its former detached tip `8928a985` was preserved in the Git
reflog. The local reconciliation uses product parent `b443ba06d6c4ac22e7288afe6f3e56a0ca61ec07`
and protected parent `4baa39af82b78b50a46f590bc2acc2ff0b7597aa`. Only
`.agents/README.md` conflicted; retain both Studio links and the accepted capture
lifecycle repair link. Regenerate the document index. No product source conflict
occurred, no sibling implementation was copied, and no protected GitHub merge is
performed. The active `px-surface` worktree and its unrelated dirty files stay intact.

On this reconciled tree, all 813 Parallax/Studio/Lens/photo checks across 74 files
pass. The accepted capture-lifecycle helper's 14 host tests also pass, including
expected injected timeout/cleanup cases; those diagnostic failure events are not
failed tests. No actual application capture or physical tracking probe was run.

The PR #722 publication ref is `codex/parallax-surface-orientation`; the live
implementation checkout uses local `codex/parallax-studio-overhaul`. The separate
A1 checkout's local branch remains at `1554ccc3`, an ancestor of the implementation.
Publish only a verified descendant of the latest remote PR head with an ordinary
fast-forward push. Never force-push or move the stale A1 checkout's branch.

Next trigger: an accepted Crossdeck consumer design and applicable source-bound
experience proof on protected main, plus the SC-01 compatibility decision above.
Crossdeck `c9f7f908` is an unaccepted reconciliation checkpoint, not that trigger.
Until then, retain local regression/contract evidence and draft PR status; do not
blindly capture, consume its 11/3 policy allowance or claim ordinary acceptance.

Reconciliation commit `eaab702b6fc32e043855d536ebcc1efff5d3912e` has exactly the
two parents above. Its product `src` tree matches `b443ba06`; accepted lifecycle
infrastructure matches `4baa39af`. Independent read-only review confirmed those
facts, the retained navigation links and the pinned neighbor interfaces. TypeScript,
documentation validation and feature sync/validation pass. Feature Catalog needs
no capability change for this reconciliation and handoff.

The local ordinary preflight against that exact commit exits FAIL. Its generic
wrapper reports `SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED`;
direct read-only `buildPlan` diagnosis identifies the actual blocker:
`PRODUCT_EXPERIENCE_EXPERIENCE_DESIGN_REQUIRED:crossdeck.phase2.continuity:Crossdeck and Parallax experience integration`.
No verification commands or fresh application browser suite ran. The wrapper
attached older browser-runtime and suite PASS receipts from the reused isolated
checkout; they are historical and must not be counted as this candidate's proof.
The successful lifecycle host tests above use fixture processes, not a real UI
capture. No protected run, consumer capture, paid inference or phone test was
dispatched by this reconciliation.

## Implemented behavior and remaining acceptance

| Original acceptance | Current boundary                                                                                                                                                                                                                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A–E, J–M            | Renderer-linked placement/recovery, room semantics, clarification, clamping, selection/framing, matched pan gestures, explicit retry and Assistant state transitions have bounded source/browser evidence. A final combined candidate still needs qualification.                                            |
| F, G, O             | Entity-bound keyframes, live scrubbing, clip movement/resizing, eased/cinematic motion, opacity, triggered simulation, reset and saved replay are implemented through the shared evaluator. Previous production journeys retain their exact source identities.                                              |
| H                   | One/two-photo import, review, correction, refinement and independent environment save are implemented. Real Sol requests reached usable proposals, but orientation variability, geometry rejections and incomplete clutter/sloped-ceiling fidelity remain open. No universal reconstruction-accuracy claim. |
| I                   | Independent definitions/instances, explicit Library membership, CAS, copies, versions, archive and recovery have bounded lifecycle evidence. SC-01 integration and the SC-00C redesign remain separate.                                                                                                     |
| N, P                | Existing modeled props, room construction and mode/reduced-motion journeys have bounded evidence. Complete premium visual quality and SC-02 light/effect/audio work are not discharged. Whole-overhaul owner acceptance remains open.                                                                       |

The first refreshed local suite ran 792 checks: 788 passed and four failed. One
failure exposed Library collection metadata in Assistant context; three used an
obsolete visible Save draft button instead of the current working autosave flow.
Keep this initial failure distinct from the subsequent repairs and their results.

The repaired domain/Studio suite passed all 793 checks across 72 files. Assistant
context now omits private Library organization metadata, and tests follow the
actual working autosave flow. A further isolated provider/Apply regression passes:
a title-only reviewed edit preserves nondefault tags, collection, favorite and
entity content while withholding private metadata from the provider request.
Independent review reran 43 focused checks and found no blocker in that repair.
These software results do not close the combined experience or integration gate.

The browser-first phone requirement remains unqualified. The owner's real iPhone
Safari test reached corner selection but reset tracking and failed calibration.
TinyVIO remains local-prototype-only, its plane output is not admitted, and
Guided View is an explicit fallback. See the [phone checkpoint](Two_Room_Phone_Readiness_20261014.md).

The merged Sounding Line lifecycle repair removes its infrastructure obstruction;
it does not supply the missing Crossdeck experience design/capture or establish
product acceptance. SC-00 must not rerun the separately owned Crossdeck capture
without explicit human authorization. Final ordinary qualification, source-bound
review and owner acceptance remain distinct gates. The later direct human
continuation above authorizes conforming protected integration after these gates
pass; it does not waive them or establish physical acceptance.
