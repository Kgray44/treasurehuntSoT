---
title: "Voyagewright Spatial Experience Wave 4 Implementation Launch Manifest"
subtitle: "Machine-Readable Architecture Contracts, Registry Baseline, Dependency Graph, and Implementation Entry Conditions"
author: "Voyagewright Engineering"
date: "2026-10-08"
version: "1.0"
status: "Implementation Launch Baseline"
document_id: "VW-SPATIAL-W4-001"
repository: "Kgray44/treasurehuntSoT"
repository_baseline: "5f8edcdcc5d10bef363f8889eeeb903c17cb00b4"
---

# VOYAGEWRIGHT SPATIAL EXPERIENCE WAVE 4

## Implementation Launch Manifest v1.0

> **Governing Principle**  
> Wave 4 does not invent new architecture. It turns the accepted Spatial Experience architecture into machine-readable ownership and launch contracts so implementation can begin without re-litigating who owns sensors, spatial truth, surface truth, provider evidence, event meaning, or Device Lab scenarios.

Wave 4 is the bridge between the completed Spatial Experience governance program and implementation.

Waves 1-3 established the human-readable authority. Wave 4 publishes the machine-readable registries required by the master architecture and freezes the dependency-aware implementation entry path for Project Sextant, Project Crossdeck, Project Parallax, and their integrations.

No registry in this wave claims that an unimplemented subsystem suddenly exists.

---

# 1. Authority and Scope

This manifest is subordinate to:

1. Voyagewright Spatial Experience Architecture v1.0.
2. Project Sextant v1.0.
3. Project Parallax v1.0.
4. Project Crossdeck v1.0.
5. Project Landfall v1.2 spatial ownership amendment.
6. accepted Storytide, Watchglass, Figurehead, and Wakebook spatial integration amendments.
7. Sounding Line Voyagewright Device Lab Governing Annex v1.0.
8. Drydock v1.1 spatial/provider integration amendment.
9. Harborlight v1.1 spatial-content distribution amendment.
10. Sealed Hold spatial-media/calibration integration record.
11. Project One Voyage authoritative progression.
12. current protected repository source.

This manifest is authoritative for:

- the Wave 4 registry set;
- registry ownership and purpose;
- registry implementation-state vocabulary;
- initial dependency ordering for Spatial Experience implementation;
- minimum prerequisite relationships between Sextant, Crossdeck, Parallax, and shared Device Lab work;
- the distinction between architecture readiness and implementation completion;
- the expected use of the registries by Drydock, Sounding Line, Project Trim, Deepwater, and future tooling.

It does not supersede any owner project governing document.

---

# 2. Wave 4 Deliverables

Wave 4 publishes six machine-readable registries under `Development_Docs/Spatial_Experience/`:

1. `spatial-capability-ownership.json`
2. `device-capability-registry.json`
3. `spatial-provider-registry.json`
4. `surface-capability-registry.json`
5. `spatial-event-registry.json`
6. `device-lab-scenario-registry.json`

This document is the seventh Wave 4 artifact and explains how those registries govern implementation launch.

---

# 3. Registry Set

## 3.1 Spatial capability ownership

`spatial-capability-ownership.json` is the machine-readable ownership treaty.

It answers questions such as:

- who owns a capability;
- which projects consume it;
- whether another project merely transports, validates, archives, or supplies evidence;
- whether the capability is authoritative, evidentiary, presentational, or archival;
- whether accepted implementation exists or the entry is governance-only.

Current baseline: **45 capability records**.

## 3.2 Device capability registry

`device-capability-registry.json` defines the initial device/spatial capability catalogue required by Sextant and Parallax.

Each entry declares:

- semantic identity;
- owner;
- provider classes;
- permission class;
- privacy class;
- background policy;
- Device Lab simulation tiers;
- required real-device qualification;
- default fallback;
- implementation state.

Current baseline: **22 device/spatial hardware capability records**.

## 3.3 Spatial provider registry

`spatial-provider-registry.json` defines owner-domain providers and their typed outcome/fallback expectations.

Providers include:

- Sextant device context;
- Landfall world context;
- Parallax tracking, adaptive placement, and shared scenes;
- Watchglass visual evidence and privacy screening;
- Crossdeck surface session and handoff;
- Storytide spatial moments;
- Figurehead spatial presence;
- Wakebook spatial memory;
- Sealed Hold spatial media;
- Drydock spatial validation;
- Harborlight spatial distribution;
- One Voyage progression.

Current baseline: **16 provider records**.

## 3.4 Surface capability registry

`surface-capability-registry.json` freezes the initial Crossdeck role vocabulary and privacy-safe surface projection contract.

The canonical initial roles are:

- `PRIMARY_STORY`
- `CHRONICLE_LENS`
- `CHART`
- `JOURNAL`
- `ARTIFACT_VIEWER`
- `SHARED_CREW_DISPLAY`
- `AMBIENT`
- `CAPTAIN_AUXILIARY`
- `CREATOR_PREVIEW`
- `ACCESSIBILITY_COMPANION`

Role never grants account permission.

Current baseline: **10 surface roles**.

## 3.5 Spatial event registry

`spatial-event-registry.json` provides the initial cross-project event/evidence vocabulary.

It records:

- event owner;
- producer and consumers;
- event kind;
- whether the event is evidence, spatial/surface state, privacy workflow, archive state, or canonical progression;
- privacy class;
- freshness;
- retention;
- replay semantics;
- implementation status.

Current baseline: **51 event records**.

One rule dominates the registry:

> No event emitted by Sextant, Parallax, Crossdeck, Watchglass, or Storytide becomes canonical Chronicle progression merely because it occurred. Only One Voyage owns accepted progression.

## 3.6 Device Lab scenario registry

`device-lab-scenario-registry.json` turns the Device Lab annex into an initial machine-readable scenario catalogue.

It defines:

- stable scenario ID;
- owning project;
- protected contracts;
- required capabilities;
- eligible D0-D5 tiers;
- preferred tiers;
- fixture class;
- privacy class;
- cleanup requirement;
- oracle owner;
- physical/field continuation requirement;
- current Sounding Line registration state.

Current baseline: **27 scenario records**.

The registry describes governed scenarios. A scenario is not a registered executable Sounding Line test until implementation supplies the actual test/suite registration and evidence path.

---

# 4. Implementation-State Vocabulary

Wave 4 deliberately distinguishes architecture from code.

The registries use implementation states such as:

- `AVAILABLE_ACCEPTED`
- `GOVERNED_NOT_IMPLEMENTED`
- `GOVERNED_INTEGRATION_NOT_IMPLEMENTED`
- `SEXTANT_NOT_IMPLEMENTED_COMPATIBILITY_SEAMS_EXIST`
- `BASE_SYSTEM_AVAILABLE_SPATIAL_EXTENSION_NOT_IMPLEMENTED`
- `SEED_IMPLEMENTATION_EXISTS_IN_LANDFALL_REQUIRES_GENERALIZATION`
- `REGISTRY_BASELINE_ONLY`
- `NOT_YET_REGISTERED_UNTIL_IMPLEMENTATION`

These labels are intentionally unromantic. Their purpose is to stop a future status page, Codex session, or validation tool from turning a design record into a shipping feature by enthusiastic interpretation.

---

# 5. Registry Consistency Rules

The Wave 4 registry set MUST satisfy all of the following:

1. every registry ID is unique inside its registry;
2. every `semanticId` in the device capability registry resolves to the capability ownership registry;
3. every capability referenced by a spatial provider resolves to the capability ownership registry;
4. every capability referenced by a Device Lab scenario resolves to the capability ownership registry;
5. every Crossdeck role ID is unique;
6. canonical progression events identify One Voyage as authority;
7. evidence-only events may not claim canonical progression authority;
8. all D-tier values are members of D0-D5;
9. unimplemented projects remain truthfully marked as unimplemented;
10. historical Landfall Device Lab evidence is not relabelled by this registry set.

Wave 4 publication is blocked if these invariants fail.

---

# 6. Device Lab Generalization Entry

The shared Device Lab is already governed, but accepted implementation still has historical Landfall ownership/path seams.

The first implementation action after Wave 4 is a **bounded Device Lab generalization increment**.

It should:

- preserve all historical Landfall Phase 4 receipts and evidence classes;
- identify reusable lab primitives already under Landfall;
- establish a neutral shared namespace for future scenario infrastructure;
- preserve compatibility adapters for accepted Landfall paths;
- create or prepare the machine-readable scenario loader;
- avoid rewriting evidence history;
- avoid attempting to implement Sextant, Crossdeck, or Parallax inside the lab migration.

This increment is infrastructure preparation, not a new product project.

---

# 7. Implementation Dependency Graph

The default critical path is:

```text
WAVE 4 REGISTRIES
        |
        v
DEVICE LAB GENERALIZATION
        |
        +--------------------+
        |                    |
        v                    |
SEXTANT PHASE 1              |
        |                    |
        +----------+---------+
                   |
           +-------+-------+
           |               |
           v               v
   CROSSDECK P1      PARALLAX P1
           |               |
           v               v
   CROSSDECK P2      PARALLAX P2
           |               |
           +-------+-------+
                   |
        SEXTANT P2 / P3
                   |
           +-------+-------+
           |               |
           v               v
   CROSSDECK P3      PARALLAX P3
           |               |
           +-------+-------+
                   |
          SHARED REALITY SEAM
          CROSSDECK P4 + PARALLAX P4
                   |
                   v
            PARALLAX P5
       + owner integrations
                   |
          +--------+--------+
          |                 |
          v                 v
   CROSSDECK P5/P6     PARALLAX P6
          |                 |
          +--------+--------+
                   |
                   v
             D4 / D5 FIELD
                   |
                   v
         SPATIAL PROGRAM CLOSURE
```

This is a dependency map, not a requirement that every phase run in a single serial branch. Phase-level mainline safety remains mandatory.

---

# 8. Minimum Phase Prerequisites

## 8.1 Sextant

### Sextant Phase 1 - Set the Sextant

Requires:

- Wave 4 registries on protected main;
- Device Lab generalization plan/compatibility boundary;
- accepted Landfall current-main seams;
- current Sounding Line authority.

May begin immediately after Wave 4.

### Sextant Phase 2 - Hold the Horizon

Requires Sextant Phase 1 accepted on main.

### Sextant Phase 3 - Read the Field

Requires Sextant Phase 2 accepted on main.

### Sextant Phase 4 - Take It Afield

Requires Sextant Phase 3 plus stable native-provider boundary and current Device Lab platform adapters.

### Sextant Phase 5 - Trust the Reading

Requires prior Sextant phases and D4/D5 qualification plan.

## 8.2 Crossdeck

### Crossdeck Phase 1 - Lay the Gangway

Requires:

- Wave 4 surface and capability registries;
- Sextant Phase 1 capability projection contract;
- existing Wayfarer/Homeport identity/session truth;
- One Voyage current authority.

Crossdeck MUST NOT create a second identity system while waiting for richer Sextant phases.

### Crossdeck Phase 2 - Keep One Deck

Requires Crossdeck Phase 1 accepted.

### Crossdeck Phase 3 - Pass the Chart

Requires:

- Crossdeck Phase 2;
- Sextant Phase 2 device/camera/haptic semantics;
- manual/non-camera handoff path first-class.

Watchglass gesture recognition may remain optional or simulated until its production implementation exists.

### Crossdeck Phase 4 - Work the Whole Deck

Requires:

- Crossdeck Phase 3;
- Parallax Phase 2;
- Storytide integration contracts;
- shared-surface Drydock validation.

### Crossdeck Phase 5 - Weather the Passage

Requires mature Crossdeck P4 behavior and relevant Sextant native/lifecycle support.

### Crossdeck Phase 6 - Make the Crossing Invisible

Requires D4/D5 Device Lab qualification and owner walkthrough.

## 8.3 Parallax

### Parallax Phase 1 - Establish the Frame

Requires:

- Wave 4 registries;
- Sextant Phase 1 capability contract;
- Device Lab shared scenario infrastructure.

### Parallax Phase 2 - Open the Spatial Studio

Requires Parallax Phase 1.

This phase owns the full Spatial Studio and Spatial Library. Ordinary Chronicle authoring must continue to reference reusable/versioned spatial definitions instead of expanding the normal block sidebar into the entire AR editor.

### Parallax Phase 3 - Let the World Adapt

Requires:

- Parallax Phase 2;
- Sextant orientation/motion capability sufficient for authored interactions;
- Sealed Hold and Watchglass privacy contracts available as integration boundaries;
- Drydock adaptive/fallback validation contracts.

### Parallax Phase 4 - Share the Reality

Requires:

- Parallax Phase 3;
- Crossdeck Phase 2 minimum synchronization/reconnect semantics;
- shared-anchor Device Lab scenarios.

Air Handoff is not a prerequisite for shared spatial reality.

### Parallax Phase 5 - Make the World Respond

Requires Parallax Phase 4 plus the owner integrations actually used by the feature slice.

Figurehead-dependent features remain optional until Figurehead exists.

### Parallax Phase 6 - Prove the Illusion

Requires D4/D5 real-device/field qualification, privacy/security review, accessibility acceptance, performance closure, and operations evidence.

---

# 9. Parallelism Rules

Parallel work is allowed only when ownership and dependency edges remain explicit.

Safe examples:

- Crossdeck P1 and Parallax P1 may proceed in parallel after Sextant P1 if they do not mutate the same unresolved shared contract.
- Parallax Spatial Studio UI work may proceed while Sextant P2 sensor detail evolves if the Studio consumes versioned capability declarations.
- Device Lab scenario implementations may be added incrementally by each project after the common scenario loader/registry seam exists.

Unsafe examples:

- Parallax implementing its own motion/provider stack because Sextant P2 is not finished;
- Crossdeck inventing permanent device identity because Wayfarer integration is inconvenient;
- Watchglass and Parallax both owning relocalization truth;
- two projects independently changing a shared event ID without registry reconciliation;
- a later phase landing on main while depending on unmerged earlier-phase source.

---

# 10. Registry Change Control

The registries are machine-readable governance, not casual configuration.

A registry change requires owner review when it changes:

- capability owner;
- authority class;
- provider ownership;
- event authority or replay semantics;
- surface privacy rules;
- Device Lab evidence-tier meaning;
- scenario owner;
- implementation-state truth;
- fallback requirements.

Additive entries that merely register implementation of an already-governed capability may use ordinary project integration if they preserve the governing architecture.

No project may silently redefine another project's registry entry inside its own local config.

---

# 11. Drydock Consumption

Drydock should eventually consume these registries to validate:

- capability existence;
- owner correctness;
- required fallback;
- surface-role availability;
- provider unavailability scenarios;
- shared-anchor semantics;
- Device Lab qualification requirements;
- privacy class;
- exact event/evidence authority.

Drydock remains the authored-Chronicle validator. It does not become the registry owner for every subsystem.

---

# 12. Sounding Line Consumption

Sounding Line and Device Lab should eventually consume:

- scenario ownership;
- scenario tier requirements;
- capability dependencies;
- project registration state;
- evidence-fidelity requirements.

Wave 4 does not register executable tests that do not yet exist.

A scenario marked `NOT_YET_REGISTERED_UNTIL_IMPLEMENTATION` must not be mistaken for passing evidence.

---

# 13. Project Trim / Codex Context Use

The registry set is explicitly intended to reduce future context and ownership ambiguity.

A future coding task should be able to answer:

- Who owns magnetic-field semantics?
- Which project owns a shared anchor?
- Can a shared display show private notes?
- Is `SPATIAL_ENTITY_DISCOVERED` canonical progression?
- Which Device Lab scenarios protect adaptive placement?
- Is Parallax implemented yet?

without rereading hundreds of pages.

The registries are acceleration aids. They never outrank the accepted governing documents.

---

# 14. Privacy and Security

Machine-readable registries MUST NOT contain:

- real Player identifiers;
- real location history;
- room imagery;
- calibration images;
- secrets;
- pairing tokens;
- real device serials;
- personal device fingerprints.

They contain architecture, policy, capability, and scenario metadata only.

---

# 15. Wave 4 Validation Record

The Wave 4 baseline is internally validated before publication for:

- JSON parseability;
- unique IDs;
- device `semanticId` resolution;
- provider capability resolution;
- Device Lab scenario capability resolution;
- D0-D5 tier vocabulary;
- implementation-state honesty;
- cross-registry ownership consistency.

Final publication additionally requires ordinary Sounding Line acceptance for the exact frozen candidate.

---

# 16. Implementation Launch Decision

Once Wave 4 is accepted into protected main:

- the Spatial Experience **governance program is complete through machine-readable launch preparation**;
- Project Sextant Phase 1 becomes the first product implementation phase to authorize;
- Device Lab generalization may proceed as the bounded shared-infrastructure precursor/companion increment;
- Crossdeck and Parallax remain governed but unimplemented until their prerequisites are met;
- no future implementation prompt needs to re-decide the fundamental ownership split.

---

# 17. Wave 4 Completion Criteria

Wave 4 is complete when:

1. all six registries exist at the canonical paths;
2. all registries parse as JSON;
3. all registry IDs are unique;
4. all capability references resolve;
5. the program home links the registry set and marks Wave 4 complete;
6. the engineering index exposes the launch manifest;
7. the document index and Ledgerlight inventory include the new records;
8. the implementation launch manifest is published;
9. ordinary Sounding Line is green on the exact candidate;
10. the exact accepted candidate lands on protected `main`;
11. post-merge verification confirms the registry and manifest paths on `main`.

---

# Final Launch Rule

> **The architecture is no longer allowed to live only in prose.**  
> Wave 4 gives Voyagewright a machine-readable map of who owns what, what can be observed, what can be rendered, what can be synchronized, what counts only as evidence, what can advance the Voyage, and how those claims are supposed to be tested.
>
> From this point forward, implementation may become complicated. Ownership may not.

**End of Voyagewright Spatial Experience Wave 4 Implementation Launch Manifest v1.0**
