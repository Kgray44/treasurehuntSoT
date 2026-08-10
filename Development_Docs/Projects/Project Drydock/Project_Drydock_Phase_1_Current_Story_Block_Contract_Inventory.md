---
title: Project Drydock Phase 1 Current Story Block Contract Inventory
audience: engineering
status: current
canonical_for: project-drydock-phase-1-story-block-inventory
last_reviewed: 2026-08-09
---

# Project Drydock Phase 1 current Story Block contract inventory

The accepted inventory contains **23 / 23** Story Block types. Persisted historical/current drafts may contain schema version 1. The Drydock contract authority reads version 1 through a deterministic per-type upcast and produces strict current schema version 2. The machine-readable authority is [the block contract registry](Project_Drydock_Phase_1_Block_Contract_Registry.json).

| Type                  | Family      | Current completion/provider | Connection authority               | Notable typed obligation                                             |
| --------------------- | ----------- | --------------------------- | ---------------------------------- | -------------------------------------------------------------------- |
| `narrative`           | Narrative   | configured completion       | `BlockConnection.DEFAULT`          | heading/body contract                                                |
| `captainsNote`        | Narrative   | configured completion       | `BlockConnection.DEFAULT`          | authored note fields remain Creator content                          |
| `riddle`              | Interaction | `textAnswer`                | `BlockConnection.DEFAULT`          | nonempty accepted-answer array; diagnostics never echo answers       |
| `information`         | Narrative   | configured completion       | `BlockConnection.DEFAULT`          | importance and acknowledgment types                                  |
| `travelDirection`     | Direction   | configured completion       | `BlockConnection.DEFAULT`          | bounded travel metadata and optional map reference                   |
| `location`            | Direction   | configured completion       | `BlockConnection.DEFAULT`          | required canonical location reference                                |
| `arrivalCheck`        | Direction   | configured provider         | `BlockConnection.DEFAULT`          | future providers require registered options and fallback             |
| `image`               | Media       | configured completion       | `BlockConnection.DEFAULT`          | image reference plus alt/decorative classification                   |
| `imageTransformation` | Media       | configured completion       | `BlockConnection.DEFAULT`          | before/after images, bounded alignment, non-motion meaning           |
| `cinematic`           | Media       | configured completion       | `BlockConnection.DEFAULT`          | video, poster, captions, non-motion meaning contract                 |
| `audio`               | Media       | configured completion       | `BlockConnection.DEFAULT`          | audio reference and transcript                                       |
| `artifactReveal`      | Reveal      | configured completion       | `BlockConnection.DEFAULT`          | artifact reference; Wayfarer retains grant truth                     |
| `hiddenMessageReveal` | Reveal      | configured completion       | `BlockConnection.DEFAULT`          | base image plus governed revealed image or message                   |
| `collectionUpdate`    | Reveal      | configured completion       | `BlockConnection.DEFAULT`          | artifact reference and bounded quantity                              |
| `confirmation`        | Interaction | configured completion       | `BlockConnection.DEFAULT`          | typed labels/style/override                                          |
| `choice`              | Interaction | configured completion       | ordered `BlockConnection.CHOICE`   | 2-20 unique choices; configuration targets are compatibility mirrors |
| `textAnswer`          | Interaction | `textAnswer`                | `BlockConnection.DEFAULT`          | nonempty accepted-answer array; private answer evidence              |
| `captainApproval`     | Interaction | `captainManual`             | `BlockConnection.DEFAULT`          | Captain instruction remains private-capable authored content         |
| `wait`                | Logic       | `timer`                     | `BlockConnection.DEFAULT`          | finite bounded duration and reconnect policy                         |
| `condition`           | Logic       | automatic                   | ordered `SUCCESS` / `FAILURE`      | typed expression AST; target fields are compatibility mirrors        |
| `setVariable`         | Logic       | automatic                   | `BlockConnection.DEFAULT`          | stable variable ID, type, scope, operation, privacy                  |
| `chapterComplete`     | Completion  | configured completion       | optional `BlockConnection.DEFAULT` | outcome/repeat metadata; One Voyage retains runtime semantics        |
| `taleComplete`        | Completion  | configured completion       | terminal, no edge                  | final authored content and repeat metadata                           |

## Contract separation

- `configuration` contains authored content and block behavior.
- `presentation` uses the strict journal/presentation contract and optional versioned scene reference.
- `completion` contains completion/provider mode, typed provider options, fallback, retry, and override policy.
- `connections` are canonical graph-edge authority. `nextBlockId` and choice/condition configuration targets remain bounded compatibility mirrors only.
- asset, variable, provider, extension, and accessibility requirements are typed registry metadata rather than arbitrary configuration bags.

No Phase 2 whole-Chronicle analyzer, repair system, or Drydock workspace is included.
