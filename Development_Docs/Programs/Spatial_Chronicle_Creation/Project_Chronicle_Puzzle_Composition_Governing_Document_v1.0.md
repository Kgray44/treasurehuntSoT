---
title: "Project Chronicle Puzzle Composition"
subtitle: "SC-04 Puzzle Workshop: No-Code Interactive Mechanics, Multi-Outcome Challenges, Collaboration, Variations, Playtest, Analytics and Community"
document_id: VW-SC-PUZZLE-001
version: "1.0-review-candidate"
date: "2026-10-25"
status: "PROPOSED_GOVERNING_SPECIFICATION_AWAITING_OWNER_AND_PROTECTED_REVIEW"
increment: SC-04
program: Spatial Chronicle Creation
audience: product-engineering
canonical_for: proposed-chronicle-puzzle-composition-governing
repository: Kgray44/treasurehuntSoT
---

# Project Chronicle Puzzle Composition
## A true authoring workshop for meaningful, interactive, reusable adventures

> **Governing principle:** Creators design the challenge, not the implementation machinery. Voyagewright composes supported interactions, verifies their logic, preserves deliberate outcomes, and gives Players a fair, compelling way to participate. Simple puzzles should be effortless to author; ambitious puzzles should be possible without programming. Rich device/3D realizations enrich the experience, but a usable, meaningful **2D version must remain available on every supported Player device**.

## 0. Document control, ratification and release boundary

This specification formalizes the owner's October 24–25, 2026 SC-04 design decisions after explicit clarification of six major questions. It is **proposed governance**, not evidence that SC-04 is implemented, accepted, merged, or enabled. It accompanies the [SC master roadmap](./Voyagewright_Spatial_Chronicle_Creation_Program_Roadmap_v1.0.md), the [cross-project Creator experience amendment](./Voyagewright_Creator_Experience_Cross_Project_Integration_Amendment_v1.0.md) and [traceability ledger](./SC_Requirements_Traceability_Ledger_v1.0.md). Adoption requires owner and relevant domain contract review, protected-main qualification and all normal policy gates.

The project is a **Composer/Workshop inside one canonical Chronicle Creator**, not a duplicate Chronicle engine. Existing accepted Drydock Story Block contract authority, \`BlockConnection\` graph authority, One Voyage progression, Parallax spatial ownership, Crossdeck participation, Landfall navigation, Sextant sensing, Watchglass perception, Reach intent, Harborlight sharing, Sealed Hold private-content/rights, Admiralty AI/provider quotas and Sounding Line release policy remain authoritative. If a requirement calls for a new contract, obtain acceptance through the owning project rather than assuming schema existence.

**PR constraint:** Documentation-only addition to an existing draft PR; no merge to main while owner's independent Parallax integration PR #776 is ongoing. No SC-04 implementation launch is authorized by this document.

Normative terms MUST/MUST NOT apply within an owner-ratified implementation scope; SHOULD requires documented exception; MAY is optional. Proposed JSON schemas here are **conceptual shapes for contract review**, not newly adopted serialized schemas or tables.

## 1. Product vision and non-negotiable goals

### 1.1 Product promise

Puzzle Workshop lets a Creator conceive and author anything from a simple riddle to a multipart, nonlinear, cross-chapter, physically situated, multi-device, collaborative challenge with bespoke mechanisms, carefully graded hints, multiple meaningful outcomes and end-to-end replayable tests. Templates are available as optional *starting conveniences*, never the definition of what is allowed.

A real Puzzle is more than a “question with one right answer.” It may involve discovering evidence, negotiating, manipulating a 2D dial, rotating a 3D object, visiting a real or virtual destination, identifying a visual clue, collaborating across roles, making an informed decision, surviving a timer or accepting intentional failure that changes the ending. The final authored Chronicle must still feel cohesive and understandable to Players.

### 1.2 Explicit owner design decisions (October 25)

1. **2D-first universal participation.** Interactive 2D forms of compatible mechanisms work on every supported device. AR/3D versions are optional enhanced realizations, not an accessibility or device prerequisite for core completion.
2. **Deep authoring without programming.** Start from scratch or optional templates, composing primitives visually. Advanced low-level logic composition and any prospective script editor appear **only in Engineering mode**. Safe advanced scripting is an eventual separate capability requiring formal security review, not an initial license to run untrusted code.
3. **Safe repeatable variation.** Creator-friendly alternate elements may sit **beside**, rather than below, an existing Chronicle block. All selected variants must be internally consistent, reproducible, solvable and fixed for a given Voyage. Randomness never creates impossible puzzles or changes an established answer mid-Voyage.
4. **Captain intervention.** Authorized Captain may provide hints, extend/adjust governed timing, reveal an optional clue, accept alternative outcomes or manually advance under explicit published rules and separately logged override authority.
5. **Creator-selectable participation policies.** One crew may combine independent contributions to shared puzzles, or every Player may be required to complete the same challenge. Individual/private discoveries, explicit sharing, role-based contribution, crew-wide completion and same-person multi-device must be distinct.
6. **Extensive privacy-safe analytics.** Per-version measured Player outcomes and attempts inform future estimates and reuse quality; disclose evidence source, uncertainty, sampling and technical failures.
7. **Universal Playtest Mode.** Playtest is **not exclusive to Puzzle Workshop**. It applies across all Creator Tools through the shared cross-project amendment, with puzzle-specific test panels plugged into the common platform.
8. **Partial/alternate/failed outcomes.** No hardcoded pass/fail-only progression. Creators may award different treasures, continue through an alternate arc, preserve lasting clues, fail forward, or intentionally end a timed challenge.
9. **Community reuse and metrics.** Puzzle definitions and templates are first-class reusable assets with safe versioned publication, parameter binding, compatibility and aggregate statistics.

These decisions are scope commitments for design, not declarations that current source already implements them.

## 2. Puzzle Workshop product experience

### 2.1 Entry surfaces and continuity

Puzzle Workshop appears as an equal-standing card within the **Creator Tools** home of an owned Chronicle. It is also reachable contextually from any named branch, chapter, Story Block, existing puzzle reference, Scene interaction, applicable Artifact, Landfall waypoint or Drydock result. It can operate on a Chronicle-local puzzle instance or on a Creator-owned reusable puzzle definition.

Tool switching retains canonical Chronicle identity, focused branch/chapter, puzzle instance, unsaved change state, selected object, relevant undo/redo scope and return destination, subject to authorization. **Do not force a round trip through the Tools home** or launch an unrelated app. Direct contextual return to “Chapter III, The Clockmaker's Secret” is core user experience.

### 2.2 Modes are depths of control, not distinct puzzle types

| Mode | Intended human experience | Tool exposure |
|---|---|---|
| **Guided** | State objective, choose optional template/pattern, personalize wording/media, pick participants, hints and outcomes through purpose-built controls | No graph syntax, script or intimidating raw schema |
| **Detailed** | Compose custom objectives, clues, multiple solution routes, 2D interactions, branch outcomes, completion conditions, permissions, reusable parameters and time rules | Rich visual connections with human-readable semantics; no raw scripting surface |
| **Engineering** | Diagnose/author full typed graph, event/evidence policies, deterministic seeds, numeric thresholds, guarded state transitions, source-bound assertions and controlled scripting if later approved | Advanced low-level logic editor, source details, safe expression tools, possible sandbox script editor |

Switching mode MUST NOT change persisted puzzle identity or rewrite its semantics. Every supported puzzle is editable through the appropriate progressive-disclosure features without hiding critical outcomes. An unsupported exotic mechanism MUST declare its requirements honestly.

### 2.3 Workshop composition surfaces

A rich desktop workspace can provide:
- **Puzzle outline:** identity, story purpose, chapter placement, target audience and duration, current status, selected participation policy.
- **Flow canvas:** objectives, gates, clues, devices, alternative evidence, hint stages, variants, outcomes and connections with overview/zoom.
- **Interaction builder:** visual 2D mechanism editor, input mappings and spatial references.
- **Object/condition inspector:** exact selected step, readable constraints and advanced mode disclosure.
- **Player perspective:** embedded playtest entry into universal Playtest, mobile/desktop view toggle, multi-role posture.
- **Analysis rail:** Drydock structural proof, modeled time estimates, observed aggregates, source/fidelity/classification and issues.
- **Library:** My Puzzles, parameterized starters, eligible Community puzzles, saved immutable versions and dependencies.

Small screens MUST remain navigable and truthful; unsupported rich graph manipulation can use a functional focused alternative without hiding essential read/review or claiming full desktop parity untested. Keyboard and assistive interaction alternatives are required.

### 2.4 Key workflows

**New from nothing:** choose Create Puzzle → name/describe objective → choose whether to add a mechanism, clues, conditions and outcomes → arrange visually → test → bind into Chronicle → publish only within canonical Chronicle workflow.

**New from a starter:** choose template → inspect what it requires → attach permitted assets/locations/Scene refs → customize every supported aspect → validate → save as an independent instance.

**Rework an existing puzzle:** open via Chronicle reference → inspect version/diff and current binding → update scoped working instance → verify no silent mutation of original Library release or old published Chronicle.

**Complex cross-chapter puzzle:** add one instance → place discovery/interaction/resolution moments at different chapters/branches → see a unified puzzle-centric view of all references and progress conditions.

**Reuse/publish:** parameterize a qualified definition, inspect dependency closure and rights, release a versioned package through Harborlight; install as a working copy or pinned version with explicit local mapping.

## 3. Canonical domain concepts

Puzzle Workshop MUST not make a second Chronicle progression store. These are semantic authoring concepts requiring owner-reviewed mappings to accepted models:

- **Puzzle Definition:** reusable authored challenge identity, mechanics, objective/outcome vocabulary, parameters, presentation alternatives, expected evidence and validation policy.
- **Puzzle Revision:** working mutable definition and immutable released definition or bound checksum; source of truth controlled by accepted domain publishing policy.
- **Puzzle Instance:** use of a particular definition/revision within a specific Chronicle or subgraph with bound resources/parameters, canonical Story Block references and participant/outcome policy.
- **Puzzle Moment:** occurrence of a puzzle-specific introduction, clue, interaction, hint, resolution, reward or transition bound to a chapter/branch/Scene. One instance may have many moments across a Chronicle.
- **Objective:** desired condition(s) and meaningful Player instruction, potentially ordered, optional, parallel, alternative or recursive only within bounded supported semantics.
- **Interaction:** accepted Player or authorized Captain operation, 2D mechanism manipulation or qualified owner-system observation.
- **Evidence:** typed, proven event/input with actor/role/source/quality, possibly requiring consent and participation policy; raw sensor or model confidence must not be treated as proof by itself.
- **Condition/Gate:** deterministic predicate combining canonical state and allowed evidence, using Drydock expression and validation authority.
- **Outcome:** Creator-defined named terminal or intermediate result with branch, reward, clue, narrative, score and continuation policies.
- **Hint Policy:** authored hints, release triggers, visibility, assistance classification and optional manual/skipping controls.
- **Variation Set:** mutually compatible authored alternatives for a given slot, selection scope/seed, per-option requirements and proof obligations.
- **Mechanism:** Player-interactive representation of puzzle state through device-independent 2D semantics and optional richer spatial/device adapters.
- **Participant Policy:** who can observe, contribute, decide and finish, preserving person vs device, Player vs Captain and shared crew vs private histories.
- **Playtest/Simulation Receipt:** source-pinned deterministic evaluation, selected variant, actor policy, faults/inputs/trace/coverage and evidence class.
- **Analytics Profile:** source-bound predicted/observed distribution and permissible public aggregate, separate from canonical live Player state.

The concept “shared progress” does not imply sharing spoilers or private clue grants. Artifact custody remains with the existing Artifact/One Voyage domain; a puzzle may request a validated grant only through a canonical owned operation.

## 4. Puzzle logic: objectives, alternatives and meaningful endings

### 4.1 Structural composition

A definition may combine:
- sequential steps, parallel steps and prerequisite gates;
- required versus optional clue/evidence;
- alternative solution strategies;
- branch-specific discoveries and rejoin conditions;
- bounded retry/attempt policy;
- explicit waits/time-limited decisions;
- collaboration requirements;
- intermediate milestones that do not end the puzzle;
- explicit completion, partial success, alternative success, failed, abandoned/skipped or assisted outcomes;
- cross-chapter puzzle moments and dependencies on earlier authored story state.

The editor SHOULD render this as a readable **challenge graph** with clearly distinguished objective steps, evidence ports and outcome transitions. Its typed semantics map to **existing Drydock graph and One Voyage** contracts; new domain shapes require accepted migrations/adapters. No opaque independent script defines canonical success.

### 4.2 Multiple solution strategies

The same objective may be resolved by a found key, a solved cipher, a negotiated alliance or a side quest. Each route must declare what evidence satisfies the objective, whether the result grants an identical or different outcome, and what state persists afterward. A route that is unexpectedly easier is not necessarily invalid, but it should be discoverable in Drydock analysis and Creator preview.

A puzzle can intentionally allow a Player to miss the “legendary treasure” and receive a different reward, ending or consequence. This is not a broken experience merely because it differs from the ideal path. **Intentional terminal outcomes** must be distinguished from **unintended inaccessible states**.

### 4.3 Branching integration

“Add Puzzle” in Story & Branches inserts a recognizable puzzle reference and offers contextual puzzle moments (Introduce / Discover / Interact / Hint / Resolve / Reward / Outcome) to place selectively. It MUST NOT flood the Story Editor with every internally generated step. Bindings may span Chapter I to Chapter V; the Workshop reveals the entire puzzle incidence map while each chapter shows only local references.

Puzzle outcome selections use the shared **named Branch Editor**. “Full success” may lead to a hidden treasure ending, “partial success” to a substitute keepsake, “failure” to a dramatic return-to-port path, and “alternative success” to a rescued character outcome. Rejoined branches retain prior state and personal/crew information.

The shared branch implementation belongs to Shipwright UX, Drydock graph contracts and One Voyage progression, not an SC-04-only fork.

### 4.4 Nested and interdependent puzzles

A puzzle may depend on another puzzle, reference previously acquired evidence, or be itself a step in a greater mystery. Composer MUST show dependency relationships and validate:
- impossible ordering or cycles without declared bounded/recovery behavior;
- unintended lockout from mandatory clues;
- duplicate global outcomes or rewards;
- outcomes unreachable under a given crew/device profile;
- exclusive conditions simultaneously true;
- hidden mandatory cross-chapter dependencies and out-of-order completion;
- rejoin behavior after different puzzle states;
- partial/alternate ending paths with clear, satisfying Player communication.

The graph must be manageable by progressive nesting/focus, not one giant spaghetti canvas.

## 5. Device-independent 2D interactive puzzles

### 5.1 Universal 2D baseline

Every supported Player device MUST be able to present and operate an appropriate **interactive 2D realization** of a core puzzle mechanism, without requiring camera, ARKit, ARCore, geospatial tracking or precise spatial sensors. A simplified 2D representation may be visually less spectacular than a 3D/AR realization but MUST preserve required puzzle **information, challenge, reachable outcome and fairness**.

If the Creator wants a rare spatial-only effect, it may be an optional enhancement. Mandatory completion semantics require a valid 2D accessible path or an explicitly approved restriction compatible with the platform's accessibility/product policy. For the normal SC-04 puzzle experience, **2D completion is a first-class requirement, not an emergency “skip puzzle” button**.

### 5.2 Supported 2D mechanism families (illustrative catalog)

- turnable combination dials, rotors, clock hands, cipher wheels and multi-ring locks;
- drag/drop, slide, sort, swap and arrange tiles/symbols, with keyboard/touch equivalents;
- switches, valves, gates, levers, connected circuits and logic routing;
- assembled artifacts, keys, object selection, inspection, alignment and placement;
- matching hidden inscriptions, decoding maps, solving sequence/logic grids;
- timing/sequencing challenges, explicitly including pause/suspend and deliberate fail paths;
- visual observation, puzzle journals, character dialogue, option choice and branching;
- other mechanics composed with accepted accessible input primitives.

Every interaction emits **typed puzzle intent**, not an unchecked client-authored “solved” event. 2D renderers must tolerate touch, mouse, keyboard, screen reader/reduced motion as appropriate, zoom and orientation changes. The puzzle creator can preview its 2D version on desktop, phone/narrow and accessibility profiles.

### 5.3 Spatial/physical enhancement

Parallax may realize the same logical mechanism with 3D objects, physics/animation, world-aware placement or AR gestures. Sextant/Reach/Watchglass provide only allowed capabilities/observations; Landfall supplies place/route context. SC-04 maps their **qualified semantic intents/evidence** to puzzle state through versioned contracts; the spatial renderer does not become a second logic authority.

3D visual realism, object collision, light, mist, sound, physical puzzles and device fidelity must follow owning systems' actual authoring/runtime budgets. A Parallax Scene and its 2D alternative must not secretly use two unrelated answers for the same canonical puzzle instance.

### 5.4 Authoring a mechanism

Guided chooses a curated existing mechanism or simple assembled form and configures content. Detailed builds from readable input/state/output primitives with a visual designer. Engineering optionally exposes raw typed transition/logic graphs and debugging. A Creator may build a unique mechanism **from scratch**, rather than being forced into a list of hardcoded puzzle templates.

The 2D preview builder should include: canvas/layout, component selection, touch targets, labels, input mapping, state transitions, success condition, invalid action policy, animation feedback, alternate/accessibility modes, sound/motion behavior, mobile size and reset. Mechanism rendering should be separated from canonical completion state, so a purely decorative animation cannot grant success.

## 6. Engineering-only advanced logic and prospective scripting

### 6.1 Visual logic system

For advanced Creators, Engineering mode MAY offer a composable deterministic graph of typed inputs, transforms, comparisons, counters, timers, state machines, variable reads/writes, gates and output intents. It must remain grounded in approved Drydock contract types, not arbitrary storage or generic JS objects. It can implement custom puzzle mechanics without requiring code.

**Only Engineering mode shows the low-level custom logic graph and any scripting controls**, respecting the owner's explicit direction. Guided and Detailed reveal safe high-level mechanics and connection controls, not intimidating implementation internals. This is a presentation boundary, not a security boundary: server-side validation/authorization is mandatory regardless of mode.

### 6.2 Scripted extensions are future-only, security gated

Advanced Creator scripts, if ever supported, are **NOT authorized by this document alone**. Before shipping, approve a separate threat model and versioned execution contract specifying:
- pure or explicitly effect-bounded deterministic behavior, stable replay and seed semantics;
- execution time, memory, recursion, state and event limits;
- no network, filesystem, system clocks, process, eval, dynamic imports, secrets or unchecked reflection;
- no direct database, One Voyage runtime, Artifact grant, Harborlight publication or real device sensor access;
- typed input/output interfaces with explicit approved capabilities, immutable published code, sandbox escapes tested;
- script-origin provenance, moderation/licensing/Community restrictions, security review and kill switch;
- safe 2D fallback and compatibility when scripting is disabled/unsupported;
- Drydock simulation with deterministic same-result assertions and malicious script cases.

The initial SC-04 plateau MUST remain capable of powerful no-code puzzle construction even if script execution never ships. Engineering mode access does not allow bypassing these restrictions.

## 7. Playthrough variation and the side-by-side Alternative element

### 7.1 Why variation is not merely another story branch

Owner intent includes configurable, easy-to-create alternate puzzle elements (e.g., a different code, hiding location, object, clue order or mechanism) that can vary across Voyages while preserving the same essential puzzle. This is not necessarily a different chapter or narrative ending. Treat **authored variation** as a controlled selection *within an interaction slot*, and use a named branch only when the **story itself diverges**.

### 7.2 Side-by-side authoring UX

From any eligible authored block or puzzle moment, choose **Add Alternative**. The editor places a visually adjacent **Variation Sibling** beside the original, not sequentially above or below it, with a shared “one of these versions runs” parent. Users may create or duplicate a variant, rename it, change its clues/appearance/parameters and preview each option side by side.

Examples:
- the same lock uses a distinct pre-authored code and matching clue set;
- three possible clue hiding places, one selected for a Voyage;
- different room themes that all expose identical required evidence;
- an alternate mechanism with the same required output outcome contract.

This **sidecar is a UX representation**. It must not invent an independent mutable path store or overwrite the original block. Drydock/One Voyage owners determine canonical compatible serialization, and the result must be inspectable through the normal Story Editor.

### 7.3 Variation Set contract

A Variation Set SHOULD include identity, eligible parent Slot/Block ID and revision, ordered alternatives, parameter schema, requirement/fallback lists, selection policy, seed/scope, invariant output contract, optional weights/eligibility and provenance. Weights are meaningful only under an approved reproducible selection algorithm; simply assigning a percentage does not prove all variants are playable.

Supported selection scopes can include **once per Chronicle edition, once per Voyage, once per team**, and only when expressly meaningful/safe **per Player**. For a shared crew puzzle, all members normally see one consistent shared selected variant. Same person on desktop and phone MUST NOT receive different supposedly canonical codes merely because the device changed.

Once a variant is selected for a running Voyage, the choice is **stable, version-pinned, recoverable and replayable**. Offline reconnection, late join, reset and repeated tool calls preserve its identity. The Creator may choose a **fixed mode** for cinematic specificity.

### 7.4 Solve-all-variants proof

No randomized variant may reach publication until Drydock verifies, or explicitly refuses to certify, every required variation class and compatible path under bounded policy. It must check:
- selected code corresponds to all displayed clues;
- required artifact/Scene/route references exist for each variant;
- 2D path works across supported devices for every mandatory variant;
- no variant omits a required step, creates dangling graph targets or awards duplicate prizes;
- all outcomes and crew participation policies remain consistent;
- variation combinations and cross-product size are bounded, sampled with explicit coverage limits or rejected as unproven;
- stable same-seed outcome and runtime replay are deterministic.

An **unbounded combinatorial space** must never be represented as exhaustively tested. The Creator may constrain combinations, set a bounded preapproved pool or redesign the dependencies. Failed/incompatible options are removed or corrected before the version is releasable. Randomization is not a source of arbitrary AI improvisation at Player runtime.

## 8. Multiple participants, multiple devices, and sharing policy

### 8.1 One Player is not one device

A person may use phone and laptop simultaneously within the same active Voyage through Crossdeck. These are surfaces belonging to **one Player identity**; independent crew participants have separate identities. Puzzle evidence, cooldown, contribution and “everyone has completed” checks must key to the approved canonical participant identity and team membership, not to number of connected devices.

### 8.2 Creator-visible participation models

| Policy | Player experience | Required semantics |
|---|---|---|
| **Shared / Cooperative Progress** (strong default for team Chronicles) | Crew collectively discovers clues, solves a shared puzzle and progresses one Chronicle | Contributions associated with real Players; shared objective state; explicit spoiler sharing; late join/reconnect safety |
| **Each Player Completes** | All required Players must complete the same puzzle or specified subset | Individual completion records, eligibility set snapshot/change rules, late join and dropout policy; completion is not one anonymous crew receipt |
| **Distributed Roles** | Different participants perform distinct roles and contribute to a common puzzle | Creator role assignment, contribution requirements, safe fallback and crew changes |
| **Individual / Private Discovery** | A Player sees a private clue or branch until shared | Audience-scoped visibility, safe explicit share/crew relay and no accidental spoiler broadcast |
| **Choice by Player/Captain/Crew** | Which person or authority chooses a branch/outcome is configured | Supported vote/leader/Captain/individual decision policy with exact tie, conflict and timeout handling |
| **Hybrid** | Some objectives shared, some personal, some all-player required | Explicit composition of the above, with meaningful per-step display |

A Creator can choose that everyone contributes to the same evolving Chronicle (the expected common case), or that **every Player must perform the same relevant steps**. The UI must clearly communicate who can act, see, complete and change the puzzle. No low-level multiplayer schema expertise should be needed for standard patterns.

### 8.3 Shared world and partial histories

Shared crew puzzle state may be common, while individuals hold different clues, artifacts, routes or discovery histories. If one Player finds a clue on mobile and another uses it on desktop, grants and sharing occur only per Creator-approved policy. Switching surfaces must not multiply discovery, award or solve receipts.

Branch reconvergence can lead the crew into the same next chapter without erasing evidence of which route each Player followed. If one Player enters a branch the other hasn't, Creator-specified shared vs per-Player story advancement governs. This cannot be inferred from how many devices are present.

### 8.4 Hard cooperative edge cases

Required tests include: joining after puzzle starts; Player disconnect; Crew member removed/replaced; two simultaneous valid solutions; duplicate submit; two conflicting branch votes; private clue accidental broadcast; Captain/Player race; all-player completion with a late join; partial solution by separate roles; one person contributing from two devices; crew partition/rejoin; one inaccessible device; and activity timeout semantics. Where policy is undefined or technically unsupported, block publication or demand Creator selection, not an arbitrary runtime guess.

## 9. Hint, assistance and anti-frustration architecture

### 9.1 Creator control first

Each puzzle may have zero or more **reviewed, authored hint tiers**: gentle nudge, stronger clue, near-solution, optional full answer/manual assistance, contextual reveal. Creator chooses which tiers exist, who may ask, what events/times activate them, whether they auto-offer, whether hints are public/private, whether they affect scoring, and whether an alternate resolution/skip is allowed.

No puzzle is forced into generic hint release just because a timer elapsed. Real-time AI improvisation MUST NOT independently reveal spoilers or unreviewed solutions. AI may propose **authoring-time hint drafts** via SC-05 or future tools only for Creator review and versioned persistence.

### 9.2 Creator-authored difficulty versus platform fault

A legitimately failed timed challenge is an allowed authored outcome. A device permission denial, missing AR provider, untrustworthy compass or network outage is a **platform capability/fault**, not an unexplained Player failure. The Creator must configure a valid fallback or honest restriction and Playtest it; platform safeguards prevent unsalvageable unsupported experiences.

The system MAY use eligible observations of repeated wrong attempts, stuck-state patterns or elapsed *active* effort to offer Creator-approved hints. It must not pretend it can diagnose human frustration or attention perfectly. A Player can continue unaided where allowed.

### 9.3 Assistance and integrity

Hint usage and Captain intervention generate classified assistance evidence. A Creator may prefer a purely narrative no-score experience; do not require grades. Assistance can affect a particular optional achievement only if deliberately configured and communicated. Never punish someone because they used an accessibility fallback.

## 10. Explicit failure, partial success and outcome composition

### 10.1 Outcome vocabulary

Puzzle Workshop supports **Creator-named outcomes**, optionally tagged for diagnostic purposes as COMPLETE, PARTIAL, ALTERNATE, FAILED, SKIPPED/ABANDONED or ASSISTED. These tags MUST NOT hardcode mandatory story endings or assume every puzzle has exactly one correct path. A puzzling moral choice may have no globally right answer.

For every outcome, Creator configures:
- evidence/conditions that select it;
- per-Player/crew authority and visibility;
- continuation branch, rejoin target, terminal conclusion or recovery;
- resulting legitimate canonical Story Block state/variables;
- allowed Artifact/treasure requests and recipient/custody policy;
- narrative/animation/2D/spatial presentation and spoilers;
- replay/late join behavior, idempotency and retry/timeout policy;
- what may appear in Playtest, Drydock analysis and private/community analytics.

### 10.2 Intentional failure and fail-forward

Timed or high-stakes puzzles may end in permanent loss of a particular prize, with a different story reward or ending. If Crew fails to open a chest by dawn, they might find a letter but miss the legendary treasure; this is a valid authored adventure, not a generic error. A failure must not strand the Player on a blank screen unless the Creator intentionally and validly ends the story.

"Partial success" may be genuinely different from both full and failed. Outcomes should have human-facing narrative explanation and clear effect. A runtime fault must not be accidentally counted as an authored failure.

### 10.3 Scores, rewards, achievements

Creator may optionally author scores, time bonuses, optional medals, achievement thresholds or qualitative performance summaries. They are opt-in and subordinate to story meaning. Do not make every romantic or exploratory Chronicle feel like a competitive examination. Any numeric scoring model must be deterministic, fair across permitted fallback modes, accessible, and validated for manipulation.

## 11. Captain intervention, timing and audit

### 11.1 Governed Captain control surface

A Captain may, within published rules and authorized role/session policy:
- deliver a configured hint;
- reveal an optional clue;
- extend/pause/resume a puzzle timer where supported;
- acknowledge a permitted alternative solution;
- choose a branch where the puzzle grants Captain decision authority;
- perform an extraordinary manual advance/override where canonical policy supports it.

Every action must identify actor, target puzzle instance, affected Player/crew scope, exact event, expected revision, reason/approval class when applicable, and resulting canonical receipt. Overrides are labeled **assisted/admin**, not falsely counted as ordinary solutions. No Captain action silently transfers private Player information to other participants.

### 11.2 Timers and clock truth

The Creator can choose elapsed wall-clock timing, active-engagement time, step-based timing or event-relative countdowns **only where fully supported by an accepted clock contract**. Define what happens on pause, offline, background, reconnect, late join, crew changes and Captain extension. Timers should use authoritative monotonic/clock semantics from the relevant owner to prevent device spoofing, double expiry and contradictory time readings. If physical server time is unavailable, do not claim it is enforced.

Timed failures are deliberate authored content; sensor faults and UI stalls must not unfairly consume the Player's available interaction opportunity without policy. Test time-expiry boundary races, concurrent successful submit and reboot/resume.

## 12. Reusable Puzzle Library and Community release

### 12.1 Definition versus instance

A **Definition** is a reusable template or authored mechanism, while an **Instance** is a configured use in one Chronicle. Shared definitions may have versioned immutable releases. Editing a local instance MUST NOT silently mutate the originating Community definition or another Chronicle. Reusing a puzzle can preserve provenance and credit without leaking private answers into public preview.

### 12.2 Parameterized starter composition

Reusable puzzles must declare explicit required/optional inputs, e.g. number of symbols, answer sequence, required clues, eligible Scene surface, reveal artifact, type of location, participation pattern, preferred duration and fallback profile. Installation/setup resolves these through an accessible parameter wizard. A typed dependency closure identifies assets, Scenes, Worldspaces, permissions, compatible device providers and supported mechanism renderers.

A package is valid only when all mandatory dependencies are resolvable or substitutable through declared fallback. It must not include references to somebody else's private bedroom map or an unavailable unreleased Scene.

### 12.3 Creator workflows

- **My puzzles:** edit own working definitions and instances, duplicate/save as new private version.
- **Starters/templates:** choose or decline suggestions; no requirement to begin from a template.
- **Community puzzles:** preview safe metadata, license/attribution, supported devices, difficulty/time estimate with labels, sample-size-qualified observed metrics; install through Harborlight.
- **Publish:** review snapshot, dependency/license/rights, spoiler redaction, moderation and compatibility; authorize an immutable public package separately from current private draft.
- **Upgrade:** compare versioned definitions and explicit breaking changes; choose compatible migration/new instance, never replace published Chronicle bytes in place.

### 12.4 Anti-spoiler analytics

No Community metric may expose puzzle answer strings, private clue locations, raw individual attempts, exact participant paths, unconsented locations, raw media, private device telemetry or uniquely identifying timing records. Use thresholds and aggregation, suppress small cohorts, and protect creators' unreleased puzzle secrets. Statistics need source/version context and update lag explanation.

## 13. Drydock Puzzle Intelligence and analytics

### 13.1 Three separate kinds of truth

**PROVEN STRUCTURE.** Bounded/exhaustively computed results from actual source and accepted graph semantics: reachable nodes, known endings and authored alternatives, solvable transitions, invariant/counterexample evidence, cycles, reward duplication and exact path counts *only when mathematically well-defined under stated bounds*. A cyclic/unbounded graph cannot truthfully display a finite universal number of possible histories.

**MODELED HUMAN ESTIMATE.** Hypotheses about reading, reasoning, search, travel, interaction, retry, difficulty, wrong attempts and assistance. Disclose explicit assumptions, ranges/percentiles and calibration quality. No result becomes factual because it is shown to two decimal places.

**OBSERVED AGGREGATES.** Actual completed eligible sessions and private/Community-safe statistical aggregates from consented, version-bound gameplay: attempts, timing, hints, clue discovery, abandonment, outcomes, opt-in ratings, technical failures and cohort composition. A sample median is a measured statistic for that sample, not a prediction guarantee.

Every Creator report MUST label class, source exact revision, model/version, selected variant set, participant and device posture, coverage, limitations, confidence/uncertainty and (for observed data) eligible sample count. Reanalysis of new drafts must not silently carry over old published playthrough measurements.

### 13.2 Structural count semantics

Drydock should report:
- reachable Story Blocks/objectives and inaccessible required steps;
- **number of distinct defined outcomes**, classified by intent;
- number of **distinct supported solution strategies** under declared equivalence;
- number of **reachable finite paths** for an explicit start/end, domain bound and loop policy where exact enumeration is feasible;
- alternative variants and their selected reachability;
- valid/invalid response classes for bounded controls;
- contradictory gates, unintended lockouts and orphaned/duplicate awards;
- min/max or distributions over explicitly bounded steps;
- covered versus uncovered modeled states and scenarios.

For a free-text puzzle, **counting "wrong solutions" is inherently open-ended**. Show known false input categories, defined invalid transitions, a bounded candidate set, or a behavioral estimated number of wrong attempts, never pretend to exhaust the universe of possible strings. Large finite spaces should show bounds and resource limits rather than allocating unbounded memory to enumerate every permutation.

### 13.3 Behavioral time model

For route/profile r, an initial conceptual model is:

\`T_r = T_read + T_search + T_reason + T_interact + T_travel + T_wait + T_retry\`.

Reading inputs can use actual localized words/media pacing. Search estimates can use authored clue visibility and number of eligible targets, learned calibration only where lawful; reasoning is probabilistic and heavily uncertain; physical/virtual travel can use legitimate Landfall distance/travel assumptions and route capability; interaction duration can reference mechanism steps, animation/timing; retry reflects attempt policy and observed priors. Cooperation adds coordination and player count effects, not merely dividing solo time by crew size.

Output plausible intervals/distributions such as p10/p50/p90 or scenario-based best/typical/slow, and show how changing assumptions affects them. Time estimates can vary by locale, viewport, crew policy, physical/virtual Worldspace and assistance rule. Do not display a single mathematically exact time estimate when estimates are uncertain.

### 13.4 Scenario exploration and probability

Where creators choose a defined random variant policy, selection probabilities can be computed **from authored weights**, distinct from the likelihood real humans solve or choose a branch. Human choice/attempt probability MUST NOT be inferred from variant generation weights. Behavioral models may evolve with observed data but must state whether they are default heuristics, cohort-trained models or direct aggregates.

Monte Carlo or stochastic search is useful when exhaustive exploration is infeasible. It does **not** prove no unreachable outcome; report sampling count, coverage bounds, seed, model limits and the failure to establish mathematical completeness. For safety-critical mandatory completion, require additional exhaustive bounded proof or constrained design.

### 13.5 Actual Player experience intelligence

Creator-only analytics may show:
- completion time histogram/median/quantiles, reading and interaction duration if meaningfully measurable;
- attempt counts, repeated invalid interaction categories and common wrong-answer **categories without leaking actual secret answers**;
- hint tier use, clue discoverability, missed/object-visibility bottlenecks;
- partial/alternate/failed/assisted outcomes, abandonments, branch choice distribution;
- solo vs crew and collaboration/role distributions, adjusted for meaningful selection bias;
- technical error/permission/fallback use distinguished from genuine puzzle difficulty;
- source-version and instance-context comparisons, before/after improvements and uncertainty;
- anonymized aggregated Community feedback, after minimum counts and spoiler review.

Telemetry is a proposal, not implicit collection authorization. Consent/retention/deletion, aggregation thresholds, data minimization, privacy tests and domain assignment require own approved implementation policy. Empty data means **not enough information**, not “all Players succeed.”

## 14. Universal Playtest: puzzle-specific functionality

Playtest Mode is **shared across all Creator tools**, as specified by the [Cross-Project Creator Experience Amendment](./Voyagewright_Creator_Experience_Cross_Project_Integration_Amendment_v1.0.md). SC-04 provides specialized puzzle plugin panels and scenario content; it does not create a private competing Playtest subsystem.

### 14.1 Direct interactive test

Creator selects **Play as Player**, optionally acting as solo Player, crew Player A/B/C, Captain or selected accessibility/device posture. Use real defined 2D interactions, honest spatial/device simulation and canonical isolated progression semantics. Creator can:
- start at puzzle introduction, given preconditions, selected clue and selected variant;
- test correct, wrong, partial, alternative, timer-expired, skipped, Captain-assisted and fault outcomes;
- switch between desktop, phone and representative supported accessibility profiles;
- inspect and reset graph variables, simulated inventory, participant-specific discoveries and whole-crew state;
- change Player roles, disconnect/reconnect surfaces, advance virtual time, request hints, test duplicate submits;
- jump to exact authored object/branch from a failing trace without discarding edit context.

Never modify a real Player's Voyage, grant real public artifacts, send invites or create genuine locations/AR scans. Physical capture is separate opt-in qualification with owning device teams.

### 14.2 Drydock-backed deterministic scenarios

Use current Drydock scenario/source checksum/seed/fault/limit identity when available. Existing Scenario v1 is bounded and does not accept arbitrary JS, URLs, real answer text or untrusted raw device evidence; new puzzle interaction and variant scenarios need **Drydock-owned schema/adapter version review**. Tests should include:
- graph reachability and ending coverage for every configured requirement class;
- all supported alternative solution strategies and outcome branches;
- deliberate failure and accessible recovery/fail-forward;
- 2D desktop/mobile accessible completion, optional AR parity;
- deterministic each-seed variation and allowed combinations;
- solo, shared crew, all-player-required, distributed role and private clue sharing;
- Captain hint/extension/override and exact assistance labels;
- timer edges, pause/suspend/network interruption, duplicate completion;
- recycled puzzle instance/cross-Chronicle version invariants;
- invalid inputs, spoofed success, denial of foreign Actor, provider degradation and graceful unsupported operation;
- published Chronicle stability and truthful source/physical evidence class.

A generated Scenario suggestion is not itself approved executable truth until validated and saved through its canonical owner path. Source or scenario changes invalidate completion claims for the new version.

## 15. AI Chronicle Architect and governed authoring integration

SC-05 can plan, create or adjust a puzzle using **real SC-04 authored commands** after those capabilities are accepted, not by emitting a magic “puzzle” prose blob or direct database mutation. It can suggest templates, variations, clue placements, hint ladders, difficulty/time estimates and alternate endings from Creator intent, then show a readable impact plan.

Before applying any change, Architect must:
- resolve authoritative Puzzle Definition, Instance and version;
- check eligible 2D mechanism/capability/participant options;
- use typed Creator-authorized mutation commands and exact revision guards;
- preserve authored human narrative/dialogue/solutions and existing published editions;
- show differences and ask approval for destructive/multisurface/paid operations;
- run Drydock on exact modified puzzle/Chronicle and present failures honestly;
- return Creator to normal Puzzle Workshop with editable real content and receipts.

No live AI improvisation of secret Player hints or puzzle correctness without a separate owner-approved runtime architecture. AI planning costs follow accepted Admiralty budget policy; Creator can build everything important manually.

## 16. Security, fair play, access control and abuse

### 16.1 Threat and source of truth

Untrusted clients cannot submit “puzzle solved” as sufficient evidence. Only authoritative One Voyage transition policy consumes verified events/conditions; tests assert no duplication and no foreign-account mutation. Treat community puzzle content, author descriptions, model outputs and asset metadata as data, not tool-authority instructions. Rely on existing authentication, role and owner permission checks for draft/private reads and updates.

### 16.2 Answer leakage

Accepted answers, secret combinations, unrevealed puzzle outcomes, private directions, personal media/locations and unpublished narrative twists are not exposed in public preview, model prompt logs, telemetry, screenshots, unsupported player clients or Community analytics. Diagnostic owner views may legitimately inspect answers under authorization, with spoiler-aware exports.

### 16.3 Multiplayer fairness and tampering

A Player cannot impersonate another to satisfy EACH_PLAYER policy. One person using two devices cannot satisfy two crew roles unless explicitly allowed by role policy on that single identity. A Captain override is recognized as an override, not an ordinary player action. Simultaneous completion grants a reward at most once under canonical idempotency. Variation selection cannot be reset by browser refresh to hunt an easier result once a Voyage begins.

### 16.4 Provider uncertainty and real-world safety

Sensor/recognition quality is not binary magic. Missing camera, GPS, heading, indoor placement, drift, offline state or unsafe travel cannot silently create success or blame a Player for a technological failure. Meaningful 2D and noncamera access is fundamental. Landfall paths and real-world puzzles must not imply access to unauthorized/unsafe areas or require undisclosed tracking.

## 17. Source, version and publishing integrity

A published Chronicle pins actual puzzle configuration and versioned dependent resources under current canonical publishing rules. Active Voyages and historical replay continue to use that published definition. A new working puzzle revision may have different hints/variations/branches but must not retroactively change Player history. Every analytical measure keys to exact published puzzle, Chronicle, variant/selection policy and applicable run context.

An update to a reusable Community puzzle is a new immutable release with lineage and compatibility/dependency reconciliation, not mass mutation of all installed copies. Template author rights and privacy restrictions persist. If an author revokes a release or a provider becomes unsupported, apply the accepted canonical policy and describe limitations; do not silently substitute a logically different puzzle in past releases.

## 18. Suggested implementation increments (future owner authorization required)

| Increment | Scope | Meaningful exit evidence |
|---|---|---|
| **P1: Puzzle Contract & 2D Baseline** | Current-source owner inventory, canonical definition/instance/moment mapping, objective/outcome/participant model, universal 2D mechanism capability, safe authored CLI/operations | Creator can build and truly play a small puzzle across desktop and phone, including more than binary success |
| **P2: Puzzle Workshop** | Equal-standing tool UI, Guided/Detailed/Engineering, from-scratch mechanics, hints, outcomes, cross-chapter references and branch context | Create/edit/reopen a substantial puzzle without hand-editing code; accessible flow works |
| **P3: Variations & Crew Logic** | Variation Sibling sidecar, deterministic selection/proof, multiple contribution modes, Captain interventions and timers | Every allowed variant/role outcome tests, reconnects and replays honestly |
| **P4: Drydock Intelligence & Universal Playtest Integration** | Structural exact/bounded counts, estimates/uncertainty, puzzle diagnostics and shared Playtest adapters; consent-based aggregates via owner interfaces | In-context testing, meaningful confidence labels, failure proof and no live-state effects |
| **P5: Puzzle Library, Community & Polished Completion** | Definition/instance versioning, parametric starters, Harborlight release, measurements, optimized visuals/UX, SC-05 tool contracts | Publish/reuse/read-only history, full Creator-to-Player journey with owner acceptance |

These are **proposed packaging suggestions**, not a mandated order of engineering PRs. Early prototypes may use mock materials only if labeled as such; complete-feature claims require real canonical authoring and player outcome proof. Scripting is separate future architecture, never a hidden gate to finishing the initial no-code Workshop.

## 19. Explicit SC-04 acceptance criteria

SC-04 must not be declared complete within ratified scope until all applicable checks are established:

**Core Creator authoring**
1. Accessible first-class Puzzle Workshop entry exists within Creator Tools and contextual Story Editor.
2. Guided, Detailed and Engineering operate over the same persisted authored definition and instance.
3. Puzzles can be started from scratch or optional template, and deeply edited in normal controls.
4. Low-level visual logic/scripting surfaces exist **only in Engineering mode**, with server policy always enforced.
5. Creator can save/reopen/history/undo relevant changes, survive conflicts, and see source/version truth.
6. Puzzle instances reference real Canonical Story Blocks/graph rather than a second hidden progression store.
7. Inserting puzzle into a Chronicle reveals deliberate local references and selectable puzzle moments, not unconditional bulk block spam.
8. A puzzle can span chapters, named branches and multiple steps while remaining discoverable/manageable.
9. Multiple solution strategies and Creator-defined distinct outcomes lead to the intended legitimate narrative/reward effects.

**Runtime, variation and devices**
10. Required puzzle mechanics have usable **2D equivalents on all supported Player device classes** and accessible input paths.
11. Optional 3D/AR/spatial enhancement preserves canonical state/output and does not turn missing AR into unplayable required path.
12. Variation Siblings are intuitive side-by-side, selectable, parameterized and source-stable with no unintended serial execution.
13. Fixed/seeding rules are deterministic and selected once per appropriate scope; disconnect/late join preserve selection.
14. Every published variant and eligible combination has accurate exhaustive/bounded/sampled proof label; broken variants block readiness.
15. SHARED_CREW, EACH_PLAYER, DISTRIBUTED, INDIVIDUAL and HYBRID policy cases work with correct identity/visibility/termination semantics.
16. One person across phone/desktop does not count twice; private discoveries are not accidentally broadcast.
17. Captain interventions are authorized, visible, logged and never mislabeled ordinary success.
18. Timers distinguish intentional failure from device/network/platform faults and handle reconnect and race boundaries.

**Drydock, Playtest and analytics**
19. Direct **universal** Playtest Mode can enter a puzzle from Workshop and other Creator tools, preserving editing context.
20. Playtest can exercise success, partial, alternate, failure, hint, Captain, crew, variation and device-fault paths without live side effects.
21. Drydock proves graph/objective reachability under source-bound conditions and refuses unjustified "all paths" completeness.
22. Structural counts, modeled human estimates and observed aggregate statistics remain visually and semantically distinct.
23. Time estimates consider reading, search, reasoning, interaction, travel, wait, retries, participant/devices and assumptions.
24. Empirical feedback clearly labels source/version/sample, avoids individual exposure/spoilers and separates technical failure from difficulty.
25. Wrong-answer counts identify finite enumerable classes separately from expected wrong attempts in open-ended puzzles.

**Community, AI, security and quality**
26. Reusable puzzle definitions, instances and immutable versions preserve all dependent source references and do not mutate prior Chronicle editions.
27. Community installation/publishing uses Harborlight rights/privacy/moderation/dependency contracts and safe aggregate metadata.
28. SC-05 orchestration uses canonical governed tools and ordinary Creator review; no AI hidden writes.
29. Private answers, identity, sensor/location data, model secrets, source prose and untrusted scripts never bypass the owning security boundary.
30. Keyboard, touch, screen reader, reduced motion, narrow/mobile and representative 2D Player paths are tested for full story outcome equivalence.
31. Source-bound deterministic, browser and appropriate device tests pass the accepted Sounding Line and protected-main release decision.
32. The Product Owner approves a full creator-to-Player walkthrough showing a genuinely compelling puzzle experience.
33. All deviations, unsupported provider tiers, unratified advanced scripting and physical qualification remain explicitly recorded.
34. SC-04 approval does not implicitly approve its neighboring SC-03 branch-UX or SC-06 Story Adaptation future work.

## 20. Mandatory edge-case matrix

| Scenario | Expected policy/result |
|---|---|
| One clue delivered twice | One canonical discovery; idempotent receipt |
| Two Players solve simultaneously | Crew completion and reward occur once when shared |
| One Player with two devices | Single Player identity and contribution, synchronized |
| EACH_PLAYER and third member joins late | Explicit Creator-defined eligibility/late-join path; no silent lockout |
| Player disconnects near timer expiry | Stable time policy and recovery; no fabricated intentional failure |
| Camera denied or AR unavailable | Functional accessible 2D path, not false negative sensor result |
| Inconsistent seeded clue/answer | Drydock rejects variation before publication |
| Random combination count too large to exhaustively test | Bounded/unknown label, constrained generation or stronger proof; never invented exhaustive PASS |
| Script loops/tries network/filesystem | Sandbox denies and isolates, future feature never assumed available |
| Choice conditions overlap | Drydock detects ambiguity or explicit precedence and presents Creator correction |
| Branch rejoin after partial prize | History/evidence and permitted award remain route-specific |
| Private clue in shared crew | Private until authorized share or published visibility rule |
| Captain manual override | Credited as assisted/admin, audited, no ordinary solved count |
| Puzzle reused after Community update | Instance pins version; upgrades deliberate, no retroactive mutation |
| Free-text input wrong-answer count | Not enumerable unless bounded input/defined categories |
| 100 runs from one testing fixture | Not counted as 100 real Player observations |
| 2D and AR show different answer state | Canonical puzzle semantics require parity; reject inconsistent renderers |
| Old saved Chronicle reopens | Historical edition and replay still use old version |
| Creator changes puzzle while another edits story | Stale source guards, explicit conflict and preservation |
| User lacks permission to view an asset | No unauthorized preview, sensible unavailable alternative |
| Technical error mid-puzzle | Error/fallback/retry state, not Player intelligence score |
| Required reward depends on unowned Artifact | Authoring/validation error; no phantom prize |
| Reusable puzzle installed without parameter mapping | Explicit missing-input prompts; reject incomplete install |
| Physical-world puzzle estimates travel | Legitimate worldspace/route assumptions disclosed; no bogus GPS proof |

## 21. Design decisions deliberately still open for later implementation review

- Exact repository-owned DTOs/schema migration for Puzzle Definition/Instance/Moment and Variation Sibling, including reusing existing typed block/version models.
- Exact numeric performance budgets for 2D mechanisms/AR assets across intended device classes, established by real testing not prose.
- Sandboxed scripting mechanism, language, entitlement and risk controls; **future-only** and Engineering-only.
- Contract for Captain timer adjustment and override where current One Voyage features do not supply the necessary semantics.
- Exact Crew membership-change policy when EACH_PLAYER requires every participant.
- Consent, aggregation thresholds, retention and attribution for observed playthrough analytics, including Community publication.
- Safe statistical model calibration and standardized uncertainty thresholds.
- Owner-approved specific template catalog and 2D art direction; examples do not amount to a shipped starter pack.
- Whether SC-03B named-branch UX becomes a numbered SC increment following cross-project approval.

Unresolved design details do not weaken the already explicit owner intent. Equally, this specification must not be treated as license for Codex to invent missing accepted contracts before review.

## 22. Source and companion governance

- [SC-00–SC-11 Master Roadmap](./Voyagewright_Spatial_Chronicle_Creation_Program_Roadmap_v1.0.md).
- [Cross-Project Creator Tools and Playtest Amendment](./Voyagewright_Creator_Experience_Cross_Project_Integration_Amendment_v1.0.md).
- [Requirements Ledger](./SC_Requirements_Traceability_Ledger_v1.0.md).
- [Chronicle Architect SC-05](./Project_Chronicle_Architect_Governing_Document_v1.0.md).
- [Drydock current graph/BlockConnection authority](../../Projects/Project%20Drydock/Project_Drydock_Phase_1_Set_the_Blocks_Design_Record.md).
- [Drydock scenario contracts](../../Projects/Project%20Drydock/Project_Drydock_Phase_3_Scenario_Contract.md).
- [Shipwright current Creator editor boundary](../../Projects/Project%20Shipwright/Project_Shipwright_Phase_2_Design_Record.md).
- [Spatial Experience master architecture](../../Governing/Voyagewright_Spatial_Experience_Architecture_Governing_Document_v1.0.md).
- [Parallax current domain identity](../../Projects/Project_Parallax/README.md).

**Design provenance:** October 24–25, 2026 owner conversation discussing complete puzzle composition, flexible solutions, tiered hints, cross-chapter references, 2D mechanism baseline, Engineering-only advanced authoring, stable variants/adjacent alternative blocks, Captain intervention, per-Player versus collective puzzle progress, empirical statistics and one universal Playtest Mode. These are owner-approved *design preferences*; ratification and implementation acceptance remain separate.

**Final safeguard:** Puzzles should be magical for Players and joyful for Creators. Complexity belongs in the governed internals, not in arbitrary menus, raw database IDs or inaccessible hardware dependencies. This proposed constitution freezes the intended standard of experience while allowing exact implementation to be reconciled honestly with present-day Voyagewright.
