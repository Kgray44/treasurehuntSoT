---
title: "Voyagewright Creator Experience Cross-Project Integration Amendment"
subtitle: "Equal-Standing Creator Tools, Named Branch Editing, Cross-Tool Playtesting and Authoring Continuity"
document_id: VW-SC-CREATOR-XP-001
version: "1.0-review-candidate"
date: "2026-10-25"
status: "PROPOSED_ADDITIVE_AMENDMENT_AWAITING_OWNER_AND_PROTECTED_REVIEW"
program: Spatial Chronicle Creation
scope: "Shipwright-led shared Creator experience with Drydock, One Voyage, Parallax, Landfall, Sextant, artifacts, Storytide, Harborlight and SC-04"
audience: product-engineering
canonical_for: proposed-cross-project-creator-experience-integration
repository: Kgray44/treasurehuntSoT
---

# Voyagewright Creator Experience Cross-Project Integration Amendment

## An integrated creative workspace for one Chronicle, many equal-standing authoring tools

> **Governing product promise:** Every major Creator discipline is discoverable, usable, and respected as a first-class authoring experience. A Creator can move fluidly among Story & Branches, Puzzle Workshop, Spatial Studio, Artifacts, Worlds & Navigation, Device Interactions, Cinematics/Media and Drydock without losing the Chronicle, their place, or their work. All tools contribute to **one canonical Chronicle** with project-owned data and one authorized publication path.

### Control, status, and adoption

This is a **new proposed cross-project design amendment**, reflecting the owner's October 24–25, 2026 discussion. It is intended to accompany the [SC Master Program Roadmap](./Voyagewright_Spatial_Chronicle_Creation_Program_Roadmap_v1.0.md) and [SC-04 Puzzle Composition constitution](./Project_Chronicle_Puzzle_Composition_Governing_Document_v1.0.md). It does **not** modify or supersede already accepted Shipwright, Drydock, One Voyage, Parallax, Crossdeck, Landfall, Sextant, Storytide, Harborlight or Global Product Governance. Adoption requires applicable domain-owner contract review and protected-main integration; proposed UX language alone is not implementation or release evidence.

This documentation PR MUST remain **draft and unmerged** while the owner has expressly directed no merges during the concurrent Parallax PR #776 work. No code work, phase dispatch, branch cleanup, PR merging, AI-provider execution or feature claims are authorized by this document.

**Normative usage:** MUST applies when a future owner-approved implementation increment adopts this design. SHOULD expresses a default needing recorded reason to waive. MAY expresses optional functionality. Examples are illustrative and not live product claims.

## 1. Why a cross-project amendment is necessary

SC-04 design revealed significant shared work that cannot be hidden in the Puzzle Workshop specification: a unified Creator Tools home, smooth cross-tool navigation, a comprehensible named Branch Editor, expressive branching decisions, a possible deeper Artifact authoring surface, universal Playtest Mode, and empirical authoring intelligence through Drydock. They share product UX but **do not share underlying domain authority**.

Separate project teams can fulfill local technical requirements yet deliver an experience that feels fragmented, inaccessible, or inconsistent. This amendment defines the **whole-Creator journey** and delegates actual implementation to existing owners. It is not permission to refactor all project surfaces in one enormous speculative pass.

**Required outcomes:**

- A person sees all major authoring disciplines as peers, with transparent availability and maturity.
- The entry hub is attractive and useful, but never a mandatory detour for every tool transition.
- Each tool has an honest shared Chronicle identity, breadcrumbs, contextual return and predictable state persistence.
- Named and nested branches are directly navigable, readable, editable using familiar Story Editor controls, and safely rejoined.
- Choosing a branch or outcome is as understandable as editing a passage; advanced logical power remains available.
- Playtest Mode spans **all** Creator tools, including story, branching, puzzle, spatial, artifact, navigation and device-dependent components, without live side effects.
- Drydock provides consistent simulated and analytical evidence, while never pretending to be the same as real Player/hardware evidence.
- Artifact authoring can mature into a first-class Studio experience without introducing a parallel Artifact domain.
- SC-04 consumes these shared features rather than secretly implementing independent versions.

## 2. Authority, ownership and non-negotiable boundaries

| Domain                                                                                               | Primary owner                                                | Shared Creator contract                                                                                                  | Must not be re-owned by this amendment                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Unified Tools hub, shared shell, tool switcher, breadcrumbs, contextual return, visual Branch Editor | **Shipwright / Creator Studio**, with global UX governance   | Discoverable pages, coherent user journeys, saved editing context, accessible controls                                   | Canonical graph schema, progression, validation rules                                    |
| Branch graph validation, typed connections, expressions, scenario and statistical analysis           | **Drydock**                                                  | Schema/policy authority, previews, reasoned diagnostics, proven/bounded counts                                           | Runtime business events and UI navigation                                                |
| Authoritative Chronicle/draft/progression, choices, session and outcomes                             | **One Voyage / accepted Chronicle services**                 | Exact draft identity, graph mutation and immutable published version, shared/individual progress                         | A second branch or puzzle runtime                                                        |
| Spatial Scene/Environment, reusable assets/effects and spatial renderer                              | **Parallax**                                                 | Scoped Scene editor, semantic references, playback adapter, physical fidelity labeling                                   | Chronicle branching/Player event authority                                               |
| Physical/virtual worldspace, waypoint, route and travel context                                      | **Landfall**                                                 | Worldspace/navigation editing and estimated travel inputs                                                                | Device permission/provider truth                                                         |
| Generic sensors, device capability and permission                                                    | **Sextant**                                                  | Device authoring, simulated capability profiles, runtime qualification                                                   | Place, puzzle or Chronicle completion authority                                          |
| Cross-device identity, roles/transport/handoff                                                       | **Crossdeck**                                                | Multisurface previews, same-Player multi-device and actual team participation distinction                                | Second Player identity for one device                                                    |
| Physical recognition/interaction                                                                     | **Watchglass / Reach**                                       | Evidence/fidelity-labeled simulation adapters                                                                            | Guaranteed outcomes from unqualified observations                                        |
| Artifact definitions, relationships, displays and grants                                             | **Existing artifact/Chronicle services**, with Shipwright UI | Artifact Studio discovery, qualified 2D/3D representations, collection/reward editing                                    | Duplicate inventory/custody truth                                                        |
| Narrative craft and animation                                                                        | **Storytide / Lanternwake**                                  | Cinematic editor integration, presentation previews, accessibility variants                                              | Independent plot/progression or puzzle success                                           |
| Canonical authoring tests, scenarios, readiness and estimates                                        | **Drydock**                                                  | Universal Playtest validation backbone, bounded simulation                                                               | Real-world test evidence without devices/Players                                         |
| Published sharing, license/dependency/mode restrictions                                              | **Harborlight + Sealed Hold**                                | Reusable puzzle/scene/artifact distribution through canonical policy                                                     | Sharing mutable private drafts silently                                                  |
| Whole-Chronicle AI                                                                                   | **SC-05 Chronicle Architect**                                | Single Creator-facing partner across tools; governed domain calls with shared Chronicle/conversation/revision continuity | Direct low-level writer, rival domain chatbot, editor replacement or publication control |
| Source-bound software evidence                                                                       | **Sounding Line**                                            | Exact-source technical verification and protected decision                                                               | AI or design-signoff substitution                                                        |

One feature receives **one primary owner** even if several owners provide dependencies. Conflicts must be explicitly reconciled and recorded before implementation. The current accepted domain constitutions and exact current main implementation prevail where this proposed UX contract describes a capability not yet real.

## 3. Unified Creator Tools home

### 3.1 Required entry experience

An open Chronicle offers a **Tools** destination at the same top-level prominence as its overview, preview, and publish workflow. A responsive, visually coherent overview presents major available authoring disciplines in equivalently sized/hierarchically balanced cards: Story & Branches, Puzzle Workshop, Spatial Studio, Artifacts, Worlds & Navigation, Device Interactions, Cinematics & Media, and Drydock. These are product-facing labels subject to normal copy review, not additional autonomous business systems.

Cards must show understandable purpose and state. Categories with no actual standalone implementation must be clearly marked **coming later or limited current features**, while linking to current supported editing surfaces when appropriate. No dead navigation, fake editor or implausible “complete” indicator. Current publishing/version tools retain their appropriate prominent routes even if not separate art-direction cards.

No tool may be artificially relegated to obscure nested menus merely because it is technically built atop Story Blocks. Equal standing means equal **discoverability, perceived importance, quality, keyboard accessibility, direct navigation and return**; it does not require identical inner layouts or feature maturity.

### 3.2 Hub is not a compulsory round trip

A Creator can:

- choose any available tool from the Tools home;
- switch directly from Story Editor to Puzzle Workshop or from Spatial Studio to Artifact authoring;
- use contextual **Edit in ...** links attached to actual selected objects;
- return to the exact relevant chapter, branch, Scene/object, artifact or puzzle;
- open Drydock or Playtest with the current selected scope, without reconstructing it manually.

The tool switcher can be in shared header/navigation and is keyboard/screen-reader accessible. It must not obscure the current work canvas. On narrow displays, equivalent functionality may be in a compact menu that still preserves one-action discoverability from the tool header.

### 3.3 Chronicle identity, editing context and continuity

The shared shell MUST display canonical Chronicle identity and current draft/release state accurately, rather than deriving a project ID from a URL alone. Every tool entry receives a versioned, authorized context envelope, conceptually:

- Chronicle ID and accessible draft revision;
- current selected tool/domain and its permission/capability status;
- focused chapter, named branch, puzzle instance, Scene/Environment, artifact, waypoint, device/cinematic object as applicable;
- return origin and parent breadcrumbs;
- unsaved/conflicting/pending-apply state and safe exit policy;
- runtime device simulation posture if in Playtest Mode;
- source revision and intended preview/evidence classification.

Preserve scroll/canvas/zoom/selection where technically safe; never claim such state is saved when not. Context passing must not bypass domain authorization or reveal unauthorized object IDs. Switching tools cannot discard unsaved work, auto-publish, mutate source of truth from stale views, or leave hidden background edits running without truthful status.

### 3.4 Standard product states and inclusive navigation

Consistent UI semantics for New/Empty, Working Draft, Read-Only Release, Saving, Unsaved, Conflict, Permission Denied, Missing Capability, Offline, Provider Failure, Preview, Simulated, Published Version and Recovery. Desktop supports large creative canvases; narrow/mobile retains navigation and deliberate limited-mode messaging rather than broken cramped controls. Keyboard, assistive technology, 200% zoom, contrast and reduced motion are required per global governance.

### 3.5 Architect continuity and original visual references

The [expanded SC-05 specification](./Project_Chronicle_Architect_Governing_Document_v1.0.md) governs the single Creator-facing partner across full-screen, docked and minimized ambient states. Shipwright owns the shared shell and contextual tool handoff; each domain retains canonical operation authority. Preserve Parallax A1 functionality and the independent two-photo room reconstruction tool; retire its competing conversation interface only after verified parity and owner acceptance.

The [ten-image original gallery](./visual_references/README.md) and [exact-byte manifest](./SC05_Architect_Visual_Reference_Asset_Manifest_v1.0.md) show the required backgrounds, full Architect, Storyboard, Puzzle visualizer and expanded/minimized Editor and Spatial Studio concepts. The home and sidebar backgrounds are distinct original assets. These references are proposed design evidence, not implemented screens or permission to begin implementation.

## 4. Named Branch Editor: visual navigation over canonical Chronicle graph

### 4.1 Human model

A Creator can make a named branch such as **The Lighthouse**, enter it, edit it with the **same familiar drag-and-drop Story Editor**, build nested choices, then return to Chapter II. The header identifies **which Chronicle, chapter and branch** is open, states **Branched from: A Choice Before the Storm**, and makes that origin clickable. A branch may rejoin a common story, terminate in a distinct ending, or remain intentionally optional.

Named branches are authoring/navigational projections over **canonical versioned Story Blocks and BlockConnection graph authority**; they must not be implemented as separate published Chronicles, alternative runtime engines or copies of the whole parent chapter. An implementation may add legitimate authoring metadata only after Drydock/One Voyage schema and migration review. The product must distinguish display names from stable IDs, labels from actual edge semantics, and editor nesting from runtime branch execution.

### 4.2 Expected editing experience

From a Choice, Condition, Puzzle Outcome, Timer/Event or Captain-governed decision, the Creator selects a path. Instead of spilling large divergent trees into the parent vertical editor, the parent shows distinct **clickable named path cards** with a synopsis, number of owned Story Blocks, linked puzzles, completion/end/merge status and warnings. Selecting one opens an editor scope visually identical to the ordinary Story Editor and preserves drag/drop, insert/move, inspector, undo/redo, autosave/version conflicts, keyboard alternatives and preview.

A branch editor:

- offers explicit **return to parent** and breadcrumb ancestry;
- can show optional **up one level** navigation for nested branches;
- displays the true branch source and supported possible entry conditions;
- provides **Branch Out**, **Branch Return/Merge**, and **Branch End** as approachable authoring concepts (not necessarily duplicate runtime block types);
- validates target availability, reachable rejoin and variable-state compatibility;
- maintains human edits and published snapshot behavior;
- supports links into sibling branches without falsely claiming a tree where the graph contains a DAG or cycle.

Use a focused scoped view for editing and a separate **whole-graph overview** for understanding reachability. The focused editor and full map are complementary, not rival sources of truth.

### 4.3 Branch scope and graph truth

The user's mental model is a series of named nested folders, but arbitrary Chronicle graphs can **reconverge, branch again, share subgraphs, and contain bounded loops**. An editor must therefore define scope honestly. A named branch references its initiating edge/anchor and a stable set of locally focused blocks; it is not an ownership prison that duplicates shared blocks. Shared blocks appear as external references or named join points. Any change to a shared node must disclose impact on every incoming path.

"Branch Return" targets a canonical join/entry point; it does not erase variables, per-Player clues or prior choices. Reconvergence can merge **story location** while preserving a Player's different route history and subsequent conditional content. An optional side-quest may continue independently when existing domain semantics allow.

For ambiguous/cyclic graphs, the editor must clearly show shared or external targets rather than invent an impossible perfect tree. Whole-graph validation MUST detect unintended unbound edges, unreachable nodes, unsafe recursive loops, mutually contradictory conditions and dangling rejoin targets. Existing authoring history and migrations remain authoritative.

### 4.4 Branch decision authoring

Instead of a raw target-ID dropdown, Creator chooses a human intent:

- **Player choice:** shows actual decision prompt, option labels, visibility, default/timeout policy and allowed participants.
- **Story condition:** readable condition builder over canonical Drydock typed expression/variable policy, with cases and fallback.
- **Puzzle outcome:** map full/partial/alternative/failure/assisted outcomes to named paths as exposed by SC-04 contracts.
- **Captain-directed:** expose existing authorized Captain action and override policy; no independent privileged command.
- **Timer/event:** explicit start/stop clock, offline/suspend and failure semantics through governed providers.
- **Authored variation:** choose among safe versioned alternatives through seeded, reproducible selection only.
- **Other domain evidence:** available only where owning provider exposes a supported typed, qualified semantic result.

A selection preview MUST show **what a Player will actually see** and which path would be chosen for sample states. Multiple true conditions must have an explicit priority, exclusivity or Creator-confirmed ambiguity policy; missing targets and no-match outcomes are errors or deliberate explicitly handled cases, not accidental “first item wins.”

### 4.5 Related SC-series work and ownership

This is a **cross-project Shipwright-led redesign**, potentially introduced as a provisional SC-03B contract within SC-series coordination only after a numbered amendment is approved. It is not to be buried as an SC-04-owned editor replacement. SC-04 reuses these route semantics and can offer contextual puzzle-specific branch configuration. SC-05 may author/modify these paths solely through qualified canonical commands; SC-06's eventual adaptation authoring may use the same UI.

## 5. Puzzle integration into Story Editor

**Add Puzzle** is a first-class contextual action from a chapter, block insertion, named branch, or Chronicle-level tools. The Creator may:

- create from scratch, select a starter pattern, or instantiate an eligible reusable/private/Community puzzle;
- automatically see a recognizable puzzle component/ref in the main Story Editor;
- access supported puzzle elements such as Introduce, Discover, Interact, Hint, Resolve, Reward, and Outcome as **contextual insert actions**, not an uncontrolled automatic dump of all possible Story Blocks;
- bind an element to Chapter I, place another clue in Chapter III, and resolve in Chapter V while keeping one coherent puzzle instance;
- open Puzzle Workshop focused on the exact instance, return precisely to the originating block and inspect every cross-chapter reference;
- map puzzle outcomes to existing named branch destinations using standard branch selection UX.

Puzzle definitions, parameters, instance refs and underlying Story Block graph relations MUST be versioned, inspectable and consistent with canonical authoring authority. No hidden branch state behind a visual puzzle wrapper. The Creator can still edit ordinary narrative without touching puzzle mechanics.

## 6. Cross-tool Playtest Mode is universal, not Puzzle-only

### 6.1 Required top-level capability

**Playtest** is available in shared Creator shell and contextual tool views, where supported. It is a **mode spanning every Creator tool** rather than a Puzzle Workshop feature. Previewing a Story passage, branching decisions, a spatial room, an Artifact reveal, a route, sensor gesture, cinematic, or the whole Chronicle should use one conceptual test session with domain adapters.

The same user can choose:

- **Test this item**: selected passage, branch, puzzle, scene, artifact, waypoint or presentation;
- **Test this chapter or route**: focused narrative segment;
- **Play this Chronicle**: end-to-end realistic experience with complete present capabilities;
- **Switch Player posture**: desktop, phone/narrow, keyboard-only, reduced motion, audio-off, unavailable location/camera, supported multi-device, and allowed crew patterns;
- **Try alternate outcomes**: controlled test fixture states, path rewind and reset without changing real Player history;
- **Inspect evidence**: Drydock proof, warnings, simulation coverage and relevant device/provider fidelity labels.

These postures are authoring/test profiles. A mobile browser simulation is not a certified native iPhone spatial result; a virtual heading is not real sensor evidence.

### 6.2 One Playtest controller with owner adapters

The shell owns Playtest entry/navigation and coherent UI; Drydock owns deterministic authored scenarios and source-bound run identities. Domain adapters supply environment/Scene render, artifact projection, Worldspace paths, device simulation, cinematic presentation and puzzle interactions. One Voyage supplies **canonical progression semantics through isolated test projections only**; no live Voyage state is modified by test play.

A conceptual test identity binds: actor/permission role; exact Chronicle draft or published edition revision/checksum; named branch/puzzle/Scene refs and revisions; deterministic seed; viewport/reduced-motion/sound/keyboard/accessibility posture; crew participation policy; provider/fault profile; scenario inputs and bounds; evidence class.

**No testing side effects**: no publication, real invitations, real payments, Community release, player grants, live session advancement, raw personal camera/gallery uploads, actual location collection or real messaging. Use isolated synthetic accounts/fixture records where true browser end-to-end journeys require state. Recovery/cancellation must remove task-owned test artifacts without damaging private existing work.

### 6.3 Universal comparison, diagnostics and truthful preview

Playtest should have convenient **Edit ↔ Test** switching without losing editor context. A Creator can rewind, restart at a named point, select another outcome, compare branch behavior, inspect collected puzzle/artifact state and open the exact failing authored object. Renderers should make simulated objects and unavailable providers unmistakable. Never replace player-visible storytelling with a diagnostic overlay by default; diagnostics are optional.

A visually attractive screenshot is not evidence of graph reachability; deterministic simulation is not physical field acceptance. UI must surface the difference. SC-04 additionally exposes specialized puzzle state/attempt/hint diagnostics; those are plug-ins within the universal Playtest system, not duplicate infrastructure.

## 7. Drydock authoring intelligence as a shared service

### 7.1 What Drydock should compute

Drydock's expanded analysis may be accessible from every authoring tool as **whole Chronicle analysis**, with drill-down for chapters, named branches, puzzles, Scenes and Worldspace segments.

Offer three clearly labeled evidence families:

1. **Exact/bounded structural facts**: graph reachability, number of authored endpoints, valid conditions, known solution strategies, count of author-defined alternatives, maximum/minimum bounded steps, duplicate effects and declared impossible paths. Report exact counts only with exhaustive bounded proof and a stated graph/policy model.
2. **Modeled estimates**: reading, searching, reasoning, device interaction, travel, queue/wait/retry, collaboration overhead, expected wrong attempts, clue-discovery probability, hint utilization, time ranges and difficulty. Report assumptions, uncertainty and sample eligibility; never label estimates factual.
3. **Aggregated observed playthroughs**: actual completion distributions, attempts, hint usage, abandonment, alternate endings, technical fault incidence and version comparisons from lawful/privacy-compatible data. Clearly disclose sample size, selection bias, outliers and coverage. These observations are facts about the sample, not universal Player predictions.

Do not return a misleading finite **total possible paths** for cyclic/open-ended graphs. Use an exact bounded case count, number of distinct simple paths under declared assumptions, a lower/upper bound, or **unknown/unbounded**, as appropriate. A free-text answer space cannot be counted as if it were a small multiple-choice list.

### 7.2 Time models and evidence

A useful conceptual route-time decomposition is:
`T = T_read + T_search + T_reason + T_interact + T_travel + T_wait + T_retry`.
Measured prose length can inform reading-time models; Landfall route geometry and mobility posture can inform travel time when valid; mechanisms and animation length can inform interaction duration; searching/reasoning/retry depend on modeled human variance. Never claim unjustified minute-level certainty. Offer editable assumptions, percentiles/ranges, scenario comparisons and provenance.

Dry-run models and real Player observations must be stored/reported separately with exact source version, puzzle instance parameters, Chronicle context, audience/provider/crew posture and participation class. Difficulty is neither a score of intelligence nor a warranty of completion time.

### 7.3 Cross-project analytics boundaries

Drydock owns the analytical model, algorithms and classification; One Voyage and applicable account/history services remain authoritative for actual events; Wakebook/Wayfarer own their respective private personal projections; Harborlight publishes only authorized aggregate Community metrics. SC-04 supplies puzzle-specific event taxonomy and Creator analysis screens. No new blanket collection or tracking entitlement follows this proposal; collection/retention/consent/aggregation and safe publication require explicit privacy design/owner approval.

## 8. Artifact authoring and other first-class disciplines

### 8.1 Existing reality

A supported per-Chronicle Artifact authoring section already exists at `/studio/tales/[taleId]/artifacts` via `TaleEditorSection`; the existence of Artifact definitions does **not** prove a standalone Artifact Studio exists. Player Artifact Cabinet is separate and must not be mistaken for Creator authoring. The existing feature catalog historically used `/studio/artifacts` and a Deepwater reconciliation identified it as stale versus the canonical per-Chronicle route. This proposed amendment does not invent a shipped new Studio.

### 8.2 Proposed Artifact Studio experience

A first-class Artifacts card should initially navigate to current supported authoring. When separately designed/approved, an expanded Artifact Studio MAY expose meaningful 2D/3D representations, acquisition/reveal animations, inspection, nested artifacts/assemblies, collections, reward/recipient semantics, versioned reusable definitions, ownership previews and controlled integrations with Parallax and SC-04.

The visual renderer may come from Parallax; Chronicle/Player inventory and grants remain with accepted Artifact/One Voyage services, and private custody remains with account/Wayfarer/Wakebook authorities. No second Artifact reward truth or direct DB writer.

### 8.3 Worlds, devices, and cinematic tools

**Landfall** remains owner of physical/virtual Worldspaces and navigation; future detailed map/route authoring surfaces appear as peers in Tools without moving generic device capability into Landfall. **Sextant** owns device context and permission-provider semantics, with Creator-friendly interaction setup and Playtest fault profiles; unsupported sensors must not become silent required puzzle steps. **Storytide/Lanternwake** own narrative presentation/cinematic design, which may support a peer Creative tool and Playtest adapters. **Parallax** retains a deep spatial-specific Studio, not a tiny editor inside Chronicle Story Blocks.

A grouped navigation card may open an existing combined tool or allow domain-specific subtools, as long as user value and ownership are clear. Product labels and exact card counts are subject to real user testing, not mandated merely because this document enumerates domains.

## 9. Reusable assets and Community discoverability

Puzzle/Scene/Artifact reuse must feel consistent across authoring tools: common concepts of My Drafts, My Library, eligible Community releases, licenses, dependencies, import/install/copy, working revisions, pinned published versions, missing-reference resolution and provenance. Every item type keeps its owning schema, not one all-purpose generic data blob. Saved puzzle templates can advertise required parameters; a Creator configures them on installation in guided fashion.

Community ratings and actual measured puzzle statistics are not a license to publish secrets, private locations, attempt answers, personal identifiers or unconsented telemetry. Capability, license and moderation gates from Harborlight/Sealed Hold remain effective. Version changes must not mutate existing Chronicles.

## 10. Shared acceptance journeys

**J-01: Tools home.** Open an owned Chronicle via normal navigation; find every available tool without deep settings, identify unavailable tools honestly, open and return from at least three real tools via mouse, keyboard and a narrow viewport.

**J-02: Cross-tool context.** In Chapter III select a puzzle; open Puzzle Workshop, change its authorized hint, save, return to same focused block and revision. Repeat Story → Spatial Studio → Artifact section with appropriate permissions, no lost unsaved edits and no duplicated state.

**J-03: Named branch.** Create two named divergent paths from a Choice; open each familiar editor, edit nested passages, navigate to origin, add a nested branch, rejoin Chapter IV and verify persistent path-specific variables/Artifact outcomes.

**J-04: Decision clarity.** Configure Player, Condition, Puzzle Outcome, Captain, Timed and seeded Variation decisions using Creator-readable controls when actually supported. Validate overlapping conditions, missing targets, fallback and intentional failure paths.

**J-05: Puzzle insertion across chapters.** Add reusable puzzle to Chapter III; insert introduction in Chapter I, clue in Chapter II and completion in Chapter V; preview all references, edited parameters and branch mapping; no uncontrolled block dump.

**J-06: Universal Playtest.** Enter Playtest from Story, Puzzle, Spatial, Artifact, World/navigation and Cinematic surfaces in supported fidelity tiers; simulate desktop/phone, crew roles, network/device faults and alternative endings; real Player history remains unchanged.

**J-07: Source-bound analytics.** Inspect exact number of reachable authored endpoints and bounded path counts, then see separate modeled time/attempt estimates and observed aggregates with sample/uncertainty/version. Unsupported claims are unknown, not “0.”

**J-08: Publication and reuse.** Reuse a versioned Scene/Puzzle/Artifact across Chronicles, edit only working draft, detect incompatible dependency, run Drydock, publish only through explicit canonical Creator action and verify old immutable editions remain stable.

**J-09: Recovery.** Cancel edit, reload, open conflicting browser, lose network, deny optional sensor/AR and resume; visible state is truthful, no duplicate events or generated objects, no silent data loss.

**J-10: Product coherence.** Owner inspects full creator-to-playtest-to-publish journey across desktop and representative phone, including keyboard/screen reader, reduced motion and visual quality; no isolated beautiful tools connected by broken navigation.

## 11. Implementation roadmap and release discipline

Suggested separable lanes (not implementation authorization):

- **UX-01** Inventory tools, routes, supported statuses and product entry paths; design the equal-standing Tools hub and shell; preserve existing experiences.
- **UX-02** Shared tool switching, breadcrumbs, context and draft state safeguards; owner browser walkthrough.
- **UX-03** Named branch UX and expressive choice authoring over Drydock/One Voyage graph contracts; migrate only with owner-reviewed compatibility, complete reversible tests.
- **UX-04** Universal Playtest controller with Drydock and domain adapters; quality tiers and no-production-side-effect proof.
- **UX-05** Authoring analytics and privacy-governed observation integration; exact/model/observed distinction; calibration and uncertainty.
- **UX-06** Artifact Studio and other specialized authoring enhancements after separate domain-owner design review and an explicit capability gap analysis.
- **UX-07** SC-04/SC-05 integration, whole-Creator quality and owner acceptance.

Independent domain work may continue in parallel where source and contract boundaries permit; no artificial hold imposed on unrelated lanes. PR #776 remains an independent active Parallax integration. This documentation PR makes **no mainline merge** and no demand that Codex suspend or restart its work. Before any implementation, recheck protected main, current PRs and approvals.

## 12. Requirements traceability and unresolved decisions

Each assertion above receives a stable requirement ID and acceptance evidence target in the companion [Cross-Project Requirements Traceability Ledger](./SC_Requirements_Traceability_Ledger_v1.0.md). Ledger entries are **proposals to govern**, not proof of implementation. Owners should update statuses with exact source-bound evidence; do not mark accepted from chat enthusiasm.

Still requiring later discrete design review: exact branch-scope graph representation; storage of navigation-only branch grouping metadata; permitted timer and Captain override contract; comprehensive Artifact Studio business/UI contract; privacy and opt-in telemetry specification; Playtest fidelity tiers on different devices; supported sandbox scripting threat model; acceptable statistical calibration methods. Do not treat these as gaps authorizing autonomous guessed implementations.

## 13. Authoritative and contextual references

- [SC Master Roadmap](./Voyagewright_Spatial_Chronicle_Creation_Program_Roadmap_v1.0.md).
- [SC-04 Puzzle Composition proposed governance](./Project_Chronicle_Puzzle_Composition_Governing_Document_v1.0.md).
- [SC-05 Chronicle Architect proposed governance](./Project_Chronicle_Architect_Governing_Document_v1.0.md).
- [Shipwright Phase 2 Creator UI/contract separation](../../Projects/Project%20Shipwright/Project_Shipwright_Phase_2_Design_Record.md).
- [Drydock canonical BlockConnection design](../../Projects/Project%20Drydock/Project_Drydock_Phase_1_Set_the_Blocks_Design_Record.md).
- [Drydock source-bound Scenario contracts](../../Projects/Project%20Drydock/Project_Drydock_Phase_3_Scenario_Contract.md).
- [Master Spatial Experience Architecture](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md).
- [Parallax engineering identity](../../Projects/Project_Parallax/README.md).
- [Current per-Chronicle Artifact route](../../../src/app/studio/tales/%5BtaleId%5D/artifacts/page.tsx).
- [Deepwater root cause and stale catalog route](../../Programs/Deepwater/reports/Project_Deepwater_Phase_2_Root_Cause_Summary.md).
- Owner conversations October 24–25, 2026: equal-standing Tools, named branch editing and outcomes, Drydock analytics, universal Playtest Mode, individual/crew progression, puzzle reuse and safe variability.

**Adoption note:** This amendment proposes coherent interfaces _between_ accepted owners. It neither amends their canonical semantics automatically nor relaxes current Sounding Line, protected-main, owner review, privacy, or hardware-evidence obligations.
