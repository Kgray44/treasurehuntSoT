---
title: "Voyagewright Spatial Chronicle Creation Program"
subtitle: "SC-00 through SC-11: Master Roadmap, Capability Boundaries, Dependency Map, and Completion Architecture"
document_id: VW-SC-PROGRAM-001
version: "1.0-review-candidate"
date: "2026-10-25"
status: "PROPOSED_GOVERNANCE_AWAITING_OWNER_AND_PROTECTED_REVIEW"
audience: product-engineering
canonical_for: spatial-chronicle-creation-program-proposed
program: Spatial Chronicle Creation (SC series)
repository: Kgray44/treasurehuntSoT
source_basis: October 14-15 2026 Spatial Studio Improvements discussion and current repository governance
---

# Voyagewright Spatial Chronicle Creation Program

## Master roadmap and governing integration plan, SC-00 through SC-11

> **Program principle.** A Creator authors **one canonical Chronicle**, whether working manually, with AI, from a template, or by adapting existing writing. Specialized tools author their own domain objects; Chronicle Creator coordinates them. The authored experience must remain inspectable, editable, accessible, verifiable, playable, and stable after publication. No subsystem may substitute a demonstration, placeholder UI, or AI-generated description for real canonical authoring.

### Document control and truth boundary

This is a **new proposed governing document**, prepared October 24, 2026 for a documentation-only PR. It does not assert that SC-00 through SC-11 were already ratified as a single program. It consolidates the October 14–15 planning conversation and reconciles it against related repository work. Existing accepted domain constitutions, implementation truth, published versions, protected-main rules, project ownership, and current source take precedence over illustrative designs in that conversation.

**This PR creates documentation, not feature functionality, not a release, and not authorization to launch remaining phases.** Every statement describing a future outcome is a requirement or proposal, never evidence that it currently works. Current availability must be verified anew at the start of any execution increment. Some earlier SC-numbered candidates have active or historical branches/PRs; this document does not erase or approve them.

MUST/MUST NOT = mandatory within an accepted future increment; SHOULD = recommended with recorded exception; MAY = optional. No implementation scope, exception, or release gate is granted solely by publication of this roadmap.

## 1. Executive vision

Voyagewright should make it possible for a Creator to turn an idea into a playable, deeply authored adventure, without losing the full manual control needed for ambitious work. Experiences may be prose-led, physical-world, virtual-world, spatial/AR, multisurface, cooperative, cinematic, or any meaningful combination. Sophistication should be **available**, not forced on the ordinary Creator. The ordinary Player experiences a cohesive Chronicle, not a stack of independently branded modules.

Our canonical example: a Creator asks for a 45-minute pirate mystery beginning in a saved bedroom, evolving through ghostly scenes and a hidden letter, moving into Sea of Thieves, using a phone optionally as a Chronicle Lens, and ending in a personalized reveal. Success means a Creator can inspect and alter real chapters, blocks, puzzles, scene bindings, media, access/fallback policies, and a deterministic Drydock suite before explicitly publishing an immutable edition. It does NOT mean a chatbot prints five intriguing chapter titles.

The program has two complementary build tracks following shared binding contracts:

1. **Spatial construction track:** environments, multiple independent scenes per reusable environment, scene management, premium assets, effects, reuse, and publication through existing Parallax/Harborlight authority.
2. **Chronicle composition track:** Chronicle Creator entry/authoring, puzzle patterns, AI Architect orchestration, story adaptation, narrative transitions, and the final joined experience through Shipwright, One Voyage, Drydock, Storytide and adjacent owners.

A third concern runs throughout: human product quality, privacy, truthful capability/fallback disclosure, and end-to-end verification.

## 2. Program identity, scope and non-goals

**Program name:** Spatial Chronicle Creation, SC series. **Series scope:** SC-00 through SC-11, with bounded lettered increments such as SC-00A/B/C and SC-07A where source evidence or approved planning identifies them. **Governance home:** Development_Docs/Programs/Spatial_Chronicle_Creation/. **Primary product home:** one integrated Voyagewright Creator Studio/Chronicle Creator. **Primary domain owners:** Shipwright/Creator Studio for story authoring, Parallax for spatial scenes, One Voyage for progression, Drydock for authored-content verification.

In scope: Creator information architecture; environment/scene composition; reusable assets/effects; Chronicle-spatial binding; puzzle authoring; optional AI Chronicle Architect; source-story adaptation; Harborlight sharing; cinematic authoring; Chronicle Lens participation; cross-project integration; a full golden Chronicle journey.

Not in scope: a second Chronicle domain or database; autonomous publication; raw database updates from AI; a second puzzle progression engine; separate Parallax ownership of Chronicle progression; raw sensor ownership moving from Sextant; private drafts becoming public community listings; replacement of canonical One Voyage history; freeform uploaded executable code; claiming hardware accuracy from simulation; implementation of Puzzle Composer or Story Adaptation details before their separate owner-reviewed constitutions.

## 3. Canonical conceptual model

- **Environment:** persistent spatial setting and semantic structure, including geometry, furniture, surfaces, windows, doors, and baseline lighting. Owned within Parallax's accepted environment model.
- **Environment revision:** version of that setting during authoring; any published reference must be immutable or pinned to an immutable snapshot.
- **Scene:** what happens _in_ an environment. It references an environment revision and composes objects, effects, changes in lighting, tracks, spatial interactions, states, and entry/exit presentation.
- **Scene revision:** stable authored definition that can be attached, reviewed, compared and eventually pinned into a published Chronicle.
- **Chronicle:** canonical authored identity and chapters/Story Blocks, narrative decisions, gates, resources and outcomes under Chronicle Creator/One Voyage rules.
- **Chronicle spatial binding:** explicit relationship from a particular chapter/block/moment to a particular Scene revision, trigger, presentation and completion semantics.
- **Runtime scene instance:** materialization during a particular Voyage, with run/crew-specific resolved spatial state and existing ownership boundaries.
- **Puzzle:** Creator-level objective/interaction composition that emits or consumes canonical progression conditions. It is NOT a new Parallax runtime authority.
- **Capability:** deployed, supported, permission-aware authoring/runtime operation exposed through an owning subsystem. A planned feature or mock is not a capability.
- **Generated plan:** reviewable proposal, not draft state and not proof of execution.
- **Authoring transaction:** bounded, permission-checked set of canonical tool operations, with provenance and rollback/compensation where needed.

One environment can support many independent scenes; a Chronicle chooses which scenes and events matter. Editing the reusable environment must not silently corrupt sibling scenes or already published editions. A Player's phone and desktop may represent one Player in one Voyage; Crossdeck owns that identity/participation truth.

## 4. Non-negotiable experience invariants

**ONE-CHRONICLE.** Manual, AI, story adaptation and template entry all produce or edit the same canonical Chronicle draft. Switching mode may change the tool but MUST NOT create hidden alternate truth.

**REUSABLE-YET-PINNED.** Environment and Scene working revisions may be reused and compared, but published Chronicles pin versions/snapshots. Subsequent edits never mutate historical published editions or active playthrough meaning.

**DOMAIN-OWNED.** No project acquires another project's business authority via this roadmap. All writes flow through authenticated canonical commands, not direct record fabrication.

**OPTIONAL-INTELLIGENCE.** AI assistance is optional. Full manual editing must remain possible, including after AI authored part of a draft. Creators can inspect each resulting object.

**CAPABILITY-HONEST.** Supported features and device requirements are discovered from live governed capability contracts. Optional camera, spatial, sensor and multiple-device paths receive truthful fallbacks. A request for a plain text story must not trigger an unnecessary AR workflow.

**NO-IMPLICIT-PUBLISH.** Draft generation, adaptation, dry-run validation and previews do not publish, distribute, install, send invitations, launch Voyages or expose private assets without the relevant explicit authenticated Creator action and usual product gates.

**PRODUCT-REALITY.** Complete means an ordinary person can discover, understand, perform, revise, recover, preview, and leave the experience, not merely that models or APIs exist. Desktop and mobile matter according to the designed participation profile, not only CSS breakpoints.

**PRIVACY-AND-SPOILERS.** Spoiler answers, private drafts, source prose, invitations, private media, calibration data and privileged context remain protected by existing policy; generated previews and tests use synthetic safe content.

**SIMULATION-TRUTH.** Drydock proves authored behavior; Sounding Line proves software implementation. Simulated/browser/device-hardware evidence must be distinguished explicitly.

## 5. Formal document family and precedence

The intended four-document family is:

1. **This document:** SC-00–SC-11 overall product map, ownership, dependencies, milestones, risks and integration gates.
2. **Project Chronicle Architect Governing Document v1.0:** the detailed SC-05 AI-assisted whole-Chronicle orchestration specification, co-authored in the same documentation PR.
3. **[Chronicle Puzzle Composition Governing Document](./Project_Chronicle_Puzzle_Composition_Governing_Document_v1.0.md):** **DETAILED PROPOSED SPECIFICATION WRITTEN / AWAITING RATIFICATION.** Owner discussion of mechanisms, crew modes, variations, 2D access, outcomes, hints, analytics and Playtest has been captured. This document requires independent owner/governing review before implementation or authority claims.
4. **[SC-06 Story Import & Adaptation Governing Document](./Project_Chronicle_Story_Import_and_Adaptation_Governing_Document_v1.0.md):** **DETAILED PROPOSED SPECIFICATION WRITTEN / AWAITING RATIFICATION.** Owner design now governs editable per-element fidelity presets, Player roles, source custody, Architect-native UI, source-to-Chronicle traceability, incremental reconciliation, rights and low-cost AI. This roadmap does not claim implementation.

All four originally planned documents are now written as **proposed design specifications**, with source traceability and explicit implementation/owner-review gates. None is evidence of shipped functionality or product acceptance.

This series is **subordinate to** global product governance and current accepted domain constitutions. Relevant authority sources include the Spatial Experience Architecture, Project Parallax and A1 Spatial Assistant, Project Shipwright Creator Studio, Drydock, One Voyage, Landfall, Sextant, Crossdeck, Storytide, Lanternwake, Figurehead, Watchglass, Sealed Hold, Harborlight, Admiralty, and Sounding Line. Actual authoritative paths and current status should be discovered at task start; historical SHA references are not launch points.

## 6. SC-series roadmap at a glance

| Increment  | Product intent                                                   | Primary owner(s)                                    | Boundary / release condition                                                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SC-00**  | Creator/Spatial Studio readiness and shared authoring boundaries | Shipwright + Parallax                               | Four truthful creation entry paths; working/draft/library clarity; preparatory UX rather than fake AI availability                                                                                                                                                                  |
| **SC-00A** | Chronicle Creator entry and inline details                       | Shipwright                                          | Manual create genuinely works; future AI/adaptation/template paths marked forthcoming until implemented                                                                                                                                                                             |
| **SC-00B** | Spatial Inspector usability and complete field preservation      | Parallax                                            | Selected-object controls function at Guided/Standard/Engineering depths; no hidden lost property                                                                                                                                                                                    |
| **SC-00C** | Spatial Library discovery, owner actions and reuse               | Parallax                                            | Clear Assets/Environments/Scenes/Effects/Compositions; durable browse/place/edit/save behavior                                                                                                                                                                                      |
| **SC-01**  | Environment and Scene Manager                                    | Parallax                                            | Reuse one versioned environment across multiple editable, independently versioned scenes; stable edition pins                                                                                                                                                                       |
| **SC-02**  | Premium Asset and Spatial Effects Library                        | Parallax + Lanternwake contracts                    | Curated original assets and authored light/mist/particles/audio/interaction effects, resource budgets and provenance                                                                                                                                                                |
| **SC-03**  | Chronicle-to-Scene Integration                                   | Shipwright + Parallax + One Voyage                  | Typed block/scene binding, triggers, state, transition and immutable reference without duplicate progression                                                                                                                                                                        |
| **SC-04**  | Chronicle Puzzle Composition                                     | Shipwright/Creator authoring + One Voyage + Drydock | **[Detailed proposed Puzzle Workshop constitution](./Project_Chronicle_Puzzle_Composition_Governing_Document_v1.0.md)** covers 2D mechanisms, composition, seeded variation, crew/Captain roles, outcomes, analytics and Playtest; not yet accepted or implemented by this document |
| **SC-05**  | AI Chronicle Architect                                           | Shipwright / Chronicle Creator orchestration        | AI proposes and applies a real, editable, governed whole-Chronicle draft; detailed adjacent governing document                                                                                                                                                                      |
| **SC-06**  | Story Import and Adaptation                                      | Chronicle Creator + Sealed Hold + Drydock           | [Detailed proposed SC-06 constitution](./Project_Chronicle_Story_Import_and_Adaptation_Governing_Document_v1.0.md): per-element fidelity presets, meaningful Player roles, source mapping and versioning, Architect-native adaptation, incremental AI cost discipline               |
| **SC-07**  | Community publishing and reuse                                   | Harborlight + relevant domain owners                | Versioned, scanned, moderated, rights-aware templates/assets/scenes/Chronicles without draft leakage                                                                                                                                                                                |
| **SC-07A** | Spatial Studio publishing handoff                                | Parallax + Harborlight                              | Specialized existing proposal/candidate for safe spatial item sharing; must reconcile actual source                                                                                                                                                                                 |
| **SC-08**  | Cinematic narrative composition                                  | Storytide + Lanternwake + Shipwright                | Authored transitions, scene timing, reveal/replay/fallback and coherent storytelling without parallel animation authority                                                                                                                                                           |
| **SC-09**  | Chronicle Lens and multi-surface experience                      | Parallax + Crossdeck + Sextant + Reach/Device Lab   | Truthful active device participation, accessible alternatives, life-cycle and device/hardware qualification                                                                                                                                                                         |
| **SC-10**  | Whole-platform integration                                       | Integration owners + Drydock + Sounding Line        | Real authored paths through source/preview/publishing/Player/Captain/community/history; product navigation parity                                                                                                                                                                   |
| **SC-11**  | Golden Chronicle end-to-end demonstration                        | Program owners + KG owner acceptance                | A fully authored, playable, measurable reference Chronicle across agreed target devices and formats                                                                                                                                                                                 |

### Numbering reconciliation

SC-00A/B/C and SC-07A **have already been used in repository branch/PR names** and this roadmap adopts those meanings rather than renaming their history. Existing candidate identifiers must be compared against current PR state and accepted main; a document saying a phase exists is not integration proof. SC-00–SC-11 labels here are **program coordination identities**, not a replacement for Parallax Phase 4, Shipwright Phase 5, or any previously accepted project phase.

Particularly important observed pointers during October 24 discovery:

- [#726 Chronicle Creator entry](https://github.com/Kgray44/treasurehuntSoT/pull/726): manual creation and future-mode truthful entry (SC-00A).
- [#727 Environment/Scene reuse](https://github.com/Kgray44/treasurehuntSoT/pull/727): candidate related to SC-01.
- [#728 Premium assets/effects](https://github.com/Kgray44/treasurehuntSoT/pull/728): candidate related to SC-02.
- [#729](https://github.com/Kgray44/treasurehuntSoT/pull/729) and [#734](https://github.com/Kgray44/treasurehuntSoT/pull/734): SC-00B Inspector work.
- [#733](https://github.com/Kgray44/treasurehuntSoT/pull/733) and [#739](https://github.com/Kgray44/treasurehuntSoT/pull/739): SC-00C Library work.
- [#732](https://github.com/Kgray44/treasurehuntSoT/pull/732) and [#736](https://github.com/Kgray44/treasurehuntSoT/pull/736): SC-07A Spatial publishing work.
- [#722](https://github.com/Kgray44/treasurehuntSoT/pull/722): combined Spatial Studio refit candidate.

These are **discovery pointers**, not current merge, readiness, approval or dependency assertions. Recheck exact PR/base/head and current-main ancestry in a separate status audit. This PR must not make execution or merge decisions for them.

## 7. Workstreams, dependencies and permissible parallelism

### Shared contract foundation

Before further cross-project integration, reconcile:

- authoritative environment/version/scene contracts, including multiple scenes per environment;
- separate working drafts, explicitly saved Library items, and immutable releases;
- scene entry/exit, version-pinned Chronicle binding and runtime instance ownership;
- Scene/Chronicle difference review, permission and owner consent;
- canonical tool operations and minimal mutation receipts;
- capability discovery and truthful fallback/proof contracts;
- common Creator navigation, product wording and responsive behavior.

Do not turn this into an instruction to rebuild accepted source. First identify currently integrated contracts; add only genuinely missing behavior.

### Primary dependency edges

- SC-00/SC-01 → SC-03: working authoring and stable scene/environment references precede reliable Chronicle binding.
- SC-02 ↔ SC-01/SC-03: effects/assets can mature in parallel but depend on typed scene attachment and resource metadata.
- SC-03 and accepted One Voyage/Drydock contracts → SC-04: puzzles must consume canonical progression semantics.
- SC-03, available approved puzzle patterns, canonical authoring commands, model/quota controls → SC-05: AI must construct reality, not narrative-only output.
- SC-05 shared orchestration + owner-ratified adaptation document → SC-06: source adaptation may reuse planning/application but controls for faithfulness are separate.
- SC-01/02/03 and Harborlight's release/upload/privacy pathways → SC-07/07A: publish only immutable sanitized packages and compatible dependencies.
- SC-03/04 plus Lanternwake/Storytide → SC-08: cinematic moments attach to actual narrative triggers.
- Parallax/Crossdeck/Sextant/Reach capability and device truth → SC-09; supported browser fallback remains valuable.
- Accepted increments → SC-10 → SC-11; a golden demonstration cannot rescue unimplemented or incompatible basics.

**Parallelism:** Development lanes with separate ownership may proceed concurrently from current accepted source. Only canonical contract changes and protected integration require conflict management. No program coordinator may force independent product work to wait merely because another lane is unfinished, but no consumer may treat an unmerged dependency as production truth.

## 8. Accountabilities and decision rights

| Owning system                  | Owns                                                              | SC program may do                                                             | SC program may NOT do                                      |
| ------------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Shipwright / Chronicle Creator | Authoring screens, Story Blocks, graph and Creator workflow       | Provide one accessible composer and govern AI-facing operations               | Duplicate Chronicle identity or progression                |
| One Voyage                     | Published Chronicle identity, events, sessions, completion truth  | Receive authorized authored definitions and later normal completion proposals | Let AI/Parallax directly change live progression           |
| Parallax                       | Environment/Scene/version, spatial object and spatial runtime     | Provide scenes, anchors, spatial Library and authored interaction operations  | Declare Chronicle puzzle success unilaterally              |
| Landfall                       | Worldspaces, routes, waypoints and maps                           | Supply place/navigation reference contracts                                   | Become the puzzle/AI authoring engine                      |
| Sextant                        | Device capability, sensors and permissions                        | Report available semantic capabilities                                        | Assert GPS/spatial meaning independently                   |
| Crossdeck                      | One-person/multi-device participation and handoff                 | Describe supported surface combinations                                       | Create duplicate Player sessions                           |
| Reach/Watchglass               | Target acquisition and visual evidence under respective ownership | Expose qualified interactions/evidence references                             | Silently turn low-confidence detection into completion     |
| Storytide/Lanternwake          | Narrative experience and presentation authority                   | Define authored transitions and accessible motion                             | Author alternate business-state truth                      |
| Figurehead                     | Persistent characters/presence                                    | Expose qualified character assets/poses when actually available               | Treat future planned animations as present                 |
| Drydock                        | Schema, graph, state, scenario and readiness verification         | Prove authoring feasibility and report actionable failures                    | Certify a feature solely from UI appearance                |
| Sealed Hold                    | Protected content/media/import/export                             | Protect source prose, photos and generated draft assets                       | Permit raw private content in public telemetry             |
| Harborlight                    | Community release, scanning, licensing and distribution           | Publish explicitly approved immutable derivatives                             | Expose an unpublished mutable draft                        |
| Admiralty                      | AI provider configuration, spend quotas and privileged operations | Apply policy and observe costs                                                | Read Creator secrets casually or confer publication powers |
| Sounding Line                  | Tests, evidence and protected-main release decision               | Qualify implementation and source-bound journeys                              | Be bypassed by an AI success claim                         |

## 9. Design requirements shared by all increments

### Creator interaction and navigation

Creator Studio is a unified product, not a federation of URL-only feature demos. The creation entry presents four discoverable options: **Create Manually**, **Create with AI**, **Adapt a Story**, **Start from a Template**. Unsupported options may be discoverable but must clearly identify that they are not implemented; no simulated success, dead-end button or auto-invented timeline.

The Studio must distinguish **Environment editing** from **Scene editing**, current working versions from saved Library versions, private from Community content, and edits from published immutable editions. Scene Manager should show scene identity, thumbnail, description, environment reference, status, revision, usage and actions. Where supported, compare scenes semantically: additions/removals, lighting, tracks, objects, placement and triggers.

Desktop provides substantive space for graph, inspector and canvas; narrow/mobile presentations preserve purposeful usable navigation and authoring access. No user-facing route may be orphaned. Loading, empty, error, conflicts, permission, unsupported-capability, offline, cancelled and resumed states are first-class designs.

### Cohesion and quality

The visual design should follow current Voyagewright styling and Lanternwake ownership, not a generic dashboard. Authoring should prioritize visible content and understandable choices, revealing expert schema controls progressively. Effect and asset quality matters: believable scale, actual lighting, physically coherent material responses where supported, clear licensing provenance, adaptive performance/LOD, and meaningful fallback. Numbers like "30 premium assets" are historical candidate scope, not universal proof of artistic quality.

### Runtime integrity

Authoring/preview must never touch actual Player progress. All canonical live events remain idempotent and replay-safe. Scene/object changes need stable identities and explicit version policies. Retries must not grant duplicate artifacts, trigger duplicate transitions, or promote incomplete content to a release. Shared spatial moments must not give different crew members contradictory required objects. Personal effects may vary only under explicit policy.

### Data/security and accessibility

Server authorization is required for every write and private read. Model/asset provenance, usage rights, age/content policies, location privacy and spoiler boundaries are enforced by existing owner policies. Provide non-AR alternatives, keyboard controls, screen-reader meaning, audio-off presentation, reduced motion, and sensible device/battery/network fallbacks. An experience requiring unsupported capability must either have a legitimate route to completion or be honestly classified with the relevant Creator/Player restriction.

## 10. Source-bound implementation and acceptance policy

For each accepted increment, record:

1. Exact source baseline, implementation owner, file/contracts changed, and governing documents read.
2. Required capabilities and whether they were already accepted on current main.
3. New UI journeys, API/command contracts, migrations, and feature flags if applicable.
4. Privacy/security/rate/cost, accessibility, performance and fallback constraints.
5. Focused deterministic tests, browser journeys, relevant mobile views and provider/hardware tiers.
6. Drydock authored-content evidence when a Chronicle or puzzle contract changes.
7. Sounding Line qualification and exact protected-main integration decision for changed software.
8. Owner walkthrough with visible UI/experience, and explicit unresolved findings.
9. Completion wording distinguishing design, implementation, local qualification, mainline acceptance and physical/owner acceptance.
10. Links to new records without discarding old source-bound evidence.

**No retrospective evidence invention.** Historical source-bound tests remain valuable but cannot certify a different commit merely by proximity or file name. An in-progress PR is not a landed feature.

## 11. SC-05 handoff and safety gates

SC-05 must read the separate [Chronicle Architect governing document](./Project_Chronicle_Architect_Governing_Document_v1.0.md). The program must not start AI implementation until current canonical authoring tools, Drydock integration, capability lookup, provider/quota controls, and necessary rights/consent paths are available or the increment explicitly defines and proves a smaller coherent plateau.

Architect is the **single Creator-facing conversational partner**. Parallax A1 retains its specialized spatial authoring operations, provider/accounting/privacy controls and distinct two-photo room reconstruction workflow behind domain-owned tools. Typed requests and receipts connect those operations to Architect; no second conversation or hidden chat-to-chat state is introduced. The conflicting legacy conversation interface retires only after verified functional parity and owner acceptance. Architect cannot override Creator edits, destroy drafts or publish automatically.

SC-04 now has a **proposed detailed constitution** based on the October 24–25 owner discussion, linked above, while its implementation still requires domain reconciliation and ratification. SC-06 now has its [detailed proposed governing specification](./Project_Chronicle_Story_Import_and_Adaptation_Governing_Document_v1.0.md) after the October 31 owner design discussion; owner ratification and implementation remain outstanding. The [cross-project Creator Experience amendment](./Voyagewright_Creator_Experience_Cross_Project_Integration_Amendment_v1.0.md) and [requirements ledger](./SC_Requirements_Traceability_Ledger_v1.0.md) preserve features that should not be mis-owned by the Puzzle Workshop.

## 12. Proposed delivery and quality gates for later approval

| Gate                             | Must be demonstrated before classifying increment product-complete            |
| -------------------------------- | ----------------------------------------------------------------------------- |
| G-01 Source reality              | Current main contracts inspected, planned-vs-implemented reconciled           |
| G-02 Creator discovery           | Normal navigation, coherent screen purpose, desktop/mobile access             |
| G-03 Real authoring              | Creator can create/reopen/edit canonical owned artifacts                      |
| G-04 Persistence                 | Save, close, reopen, reload, undo where applicable, and conflict recovery     |
| G-05 Version truth               | Immutable editions stable, reused source versions explicit                    |
| G-06 Multi-project orchestration | No duplicate One Voyage/Parallax/Shipwright state or unauthorized writes      |
| G-07 Drydock                     | Schema, graph, branch/outcome and published-content readiness                 |
| G-08 Capability                  | Required/optional hardware and providers correctly negotiated/fallback        |
| G-09 Security                    | Owner/foreign authorization, privacy/spoilers, media/rights and no leakage    |
| G-10 Accessibility               | Keyboard, screen reader, reduced-motion/audio independence and responsive     |
| G-11 Operational truth           | Safe failure, cancellation, retry, idempotency, cost and cleanup              |
| G-12 Release evidence            | Source-bound tests, protected-main decision, landed-tree verification         |
| G-13 Human acceptance            | KG/owner walks through intended experience and accepts visual/product quality |
| G-14 Final story                 | A full synthetic Chronicle completed without hidden manual engineering steps  |

G-14 by itself is insufficient if unrelated required branches, devices or conditions remain unproved. Conversely, individual increments should leave current main valid if later SC increments are delayed indefinitely.

## 13. Risks and mitigations

- **Program numbering collision:** SC identifiers already appear in existing PRs. Remedy: use a reconciliation ledger and keep historical names; do not refactor old commits to match this paper roadmap.
- **Scope merger:** AI, puzzles, adaptation and AR blur ownership. Remedy: domain table, separate constitutions, canonical commands.
- **Feature hallucination:** AI designs unsupported devices/tools. Remedy: signed/versioned capability snapshot, conservative fallbacks, no imagined providers.
- **Data divergence:** scene changes mutate published identity. Remedy: immutable revision pins, explicit migration/version upgrade.
- **Prompt injection/content poisoning:** untrusted imported story/media/reviews influence AI tool decisions. Remedy: treat source as data, separated instruction/control policy, allowlisted tool operations, validation.
- **Costs and long-running jobs:** retries and generation multiply spend. Remedy: quota reservation, explicit budgets, idempotency, abort/cancel and clear spend receipts.
- **Unfair hardware requirements:** elaborate AR excludes participants. Remedy: capability-first fallback and published audience restrictions where unavoidable.
- **Overengineering:** every Chronicle receives unnecessary AR and assets. Remedy: capability selection based on Creator intent and Player posture.
- **Verification theater:** synthetic preview is mistaken for real AR/phone acceptance. Remedy: fidelity-labelled evidence and owner device review.
- **Visual incoherence:** beautiful separate tools feel like different products. Remedy: continuous user journeys and reference-quality design protection.
- **Premature implementation or authority:** the detailed proposed SC-04/SC-06 constitutions are mistaken for accepted implementation contracts. Remedy: preserve domain ownership, secure owner ratification and exact-source qualification before software development claims or protected-main changes.

## 14. Golden Chronicle definition (SC-11)

A future reference Chronicle should cover both the human creative loop and a credible adventure:

1. Creator starts in a real, discoverable Chronicle Creator.
2. Chooses manual/AI/adaptation/template path appropriate to implemented capability.
3. Designs a five-chapter mystery in a reusable environment with multiple separately versioned scenes.
4. Binds actual chapters, blocks, spatial moments, puzzle conditions, media and fallbacks.
5. Switches between modes without losing manual edits or canonical version identity.
6. Runs Drydock verification, repairs a meaningful failure, sees actual coverage.
7. Reviews and explicitly publishes an immutable edition.
8. Player joins the same Voyage from supported desktop and optionally phone surfaces.
9. Encounters real canonical narrative transitions and a spatial clue with fallback.
10. Continues through legitimate One Voyage progression, reconnect, resume, and replay.
11. Finishes a meaningful ending; history/keepsakes are bound to correct immutable edition where available.
12. Creator can inspect exact evidence, revise a new draft, compare releases and share through allowed Community paths.

This is a **target scenario**, not a claim that five chapters/six puzzles or every named adapter currently work. A fully nonspatial story and a mobile-first physical journey deserve their own independent acceptance examples too.

### October 25 SC-05 detailed design reconciliation

The Creator has now explicitly established that **Chronicle Architect is the one Creator-facing conversational partner** across every tool; the existing Parallax A1 conversational interface is to be retired after verified functional parity, while its spatial authoring capabilities and distinct **two-photo room reconstruction tool** remain available. SC-05's [expanded governing specification](./Project_Chronicle_Architect_Governing_Document_v1.0.md) defines complete full-screen, docked and ambient appearances; the exact supplied lighthouse/coast home and portrait sidebar images; animated shared-element transitions into real tools; Creative Profiles, Story Bible/Storybook, Creative Journal, Creative Commitments and scoped Insights; intelligent authority; and finite **Free/Luna-only, Paid, Pro** AI resource tiers with centrally metered Admiralty accounting. The companion [visual source manifest](./SC05_Architect_Visual_Reference_Asset_Manifest_v1.0.md) records exact original-byte identity and verified documentation custody, with all ten original PNGs available in the [visual gallery](./visual_references/README.md). The traceability ledger now contains **165 proposed requirements**, including 45 additional SC-05 and 44 new SC-06 acceptance conditions. These are **design commitments**, not proof of implementation or tier pricing approval. All integrations remain blocked on applicable domain review and owner's explicit authorization. SC-06's separate discussion is complete and its [proposed constitution](./Project_Chronicle_Story_Import_and_Adaptation_Governing_Document_v1.0.md) now requires independent owner review before implementation.

## 15. Future amendment discipline

On owner acceptance of this roadmap, establish a machine-readable SC ledger referencing: increment, owner, governing source, exact accepted base/head, status, dependencies, PR, risk, protected decision, owner approval, next action. Do not use an informal green emoji as release authority. Record adjustments in additive amendments, not by overwriting historical accepted reports.

No automatic implementation follows the documentation PR. This record does not merge or modify outstanding SC/Parallax/Crossdeck work. The detailed SC-04, SC-05 and SC-06 documents are now written as proposals, with the separate owner review, technical reconciliation and protected-main integration still outstanding.

## 16. Source and references

**Primary planning source:** October 14–15, 2026 ChatGPT conversation preserved as project attachment _Spatial Studio Improvements.txt_, especially its definitions of reusable Environments/Scenes, Puzzle Engine ownership, four creation modes, Architect orchestration, story adaptation, capability registry, build sequencing and golden demonstration. That material was a design conversation, not an approved technical implementation claim.

**Repository context, discoverable October 24, 2026:**

- [Spatial Experience master governance](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md)
- [Parallax governing authority](../../Governing/Project_Parallax_Spatial_Chronicle_and_Augmented_Reality_System_Governing_Document_v1.0.md)
- [Parallax Spatial Assistant A1](../../Governing/Project_Parallax_A1_Spatial_Assistant_Governing_Amendment.md)
- [Current Parallax engineering home](../../Projects/Project_Parallax/README.md)
- [Current Shipwright project records](../../Projects/Project%20Shipwright/)
- [Drydock governing records](../../Projects/Project%20Drydock/)
- [Spatial Chronicle Pilot](../../Projects/Spatial_Chronicle_Pilot/README.md) — integrated test experience, **not** this SC implementation roadmap
- [SC-04 Puzzle Workshop proposed governing document](./Project_Chronicle_Puzzle_Composition_Governing_Document_v1.0.md)
- [SC-05 exact owner-supplied background/concept image manifest](./SC05_Architect_Visual_Reference_Asset_Manifest_v1.0.md) — all ten original PNGs imported into this draft branch, SHA-256 verified, and individually previewed in the [gallery](./visual_references/README.md); production integration remains future work.
- [Creator Experience cross-project amendment](./Voyagewright_Creator_Experience_Cross_Project_Integration_Amendment_v1.0.md)
- [Cross-project requirements traceability ledger](./SC_Requirements_Traceability_Ledger_v1.0.md)
- PR pointers above for SC-00A/B/C, SC-01, SC-02 and SC-07A implementation candidates.

**Document-family status as of October 31, 2026:** All four originally planned proposed SC governing documents now exist on this draft branch: master roadmap, SC-04 Puzzle Composition, SC-05 Chronicle Architect and [SC-06 Story Import & Adaptation](./Project_Chronicle_Story_Import_and_Adaptation_Governing_Document_v1.0.md). The Creator Tools amendment, exact visual asset manifest and expanded cross-project ledger remain companion records. Owner ratification, current-source reconciliation and implementation acceptance are separate; no proposed document constitutes production evidence.
