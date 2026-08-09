---
title: Project Tideglass Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-tideglass-phase-1-integration
last_reviewed: 2026-08-09
---

# Project Tideglass Phase 1 integration manifest

## Source identity

| Field                  | Value                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| Branch                 | `codex/project-tideglass-phase1-set-the-glass`                                         |
| Original base          | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                             |
| Original upstream      | `origin/main`                                                                          |
| Reconciled main        | `5b266251bd5a42efe90988e45daf55bca8e566f1`                                             |
| Implementation commits | `35b1418931bcef3babe12e981571207314bc6120`, `1366095b3ae637675c5dd9a97406bff0439fadf9` |
| Candidate branch tip   | recorded by the protected publication procedure                                        |
| Integrated main        | not integrated                                                                         |

## Owned change surface

- Additive Tideglass source, safe diagnostic CLI, and synthetic tests.
- Sounding Line owner, suite, four contracts, path/contract impact mapping, gates, and generated case registry.
- Phase 1 design, test, validation, integration, and completion records plus navigation.
- Branch-complete Feature Catalog entry `FT-B009`, bound to the corrected implementation commit `1366095b3ae637675c5dd9a97406bff0439fadf9`.

## Explicitly unchanged

- Both Prisma schemas and all migration directories.
- Chronicle publishing and its exact stored-byte checksum behavior.
- Existing Creator Studio version comparison, API, pages, and navigation.
- Voyage version pinning, progression, sessions, events, memberships, inventory, and variables.
- Wayfarer history and Harborlight releases/update application.
- Ordinary public/private Chronicle projections and every user journey.

## Reconciliation protocol

Immediately before final acceptance, fetch and compare the original base with current `origin/main`. Inspect changes affecting One Voyage published editions, Story Blocks, Drydock, Wakebook, Harborlight, shared schemas, authorization, and testing policy. Classify each overlap and rerun only invalidated evidence. Do not start Phase 2 or stack it on this candidate.

The branch first merged accepted Deepwater mainline history through `273fb5255ad222812530422e902db04c0ddd1961`. The 2026-08-09 pre-candidate fetch then found current `origin/main` at `5b266251bd5a42efe90988e45daf55bca8e566f1`; that interval added only governing PDFs and documentation-index governance for the 2026 project wave. It did not overlap Tideglass source, schemas, migrations, publication, authorization, or runtime behavior. Documentation validation was invalidated and must rerun. A completion audit independently identified deterministic-identity, matching, unsupported-data, and redaction defects in Tideglass itself; those were corrected under `1366095b3ae637675c5dd9a97406bff0439fadf9` with focused 49/49 diagnostic coverage. All earlier Sounding Line candidate decisions are therefore historical and must be replaced for the exact corrected candidate.

## Available integration path

The phase must pass the source-bound Sounding Line candidate gate and then use the protected branch/pull-request procedure. If merge authority or another external gate is unavailable, the correct stop state is `TIDEGLASS PHASE 1 MAINLINE CANDIDATE` with exact candidate and main SHAs. Branch proof is not mainline proof; post-merge validation and remote parity remain required before an integrated claim.
