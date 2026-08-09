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
| Reconciled main        | `762258e31d7509aac8a7a46e7828ae0e92b84a84`                                             |
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

The branch first merged accepted Deepwater Phase 1 through `273fb5255ad222812530422e902db04c0ddd1961`, then the project-governance wave through `5b266251bd5a42efe90988e45daf55bca8e566f1`. A completion audit independently identified deterministic-identity, matching, unsupported-data, and redaction defects in Tideglass; those were corrected under `1366095b3ae637675c5dd9a97406bff0439fadf9`, formatted under `7db576d00d89b65edb9a1a0225df130fff8fcbe5`, and received exact local mainline `RELEASE_GO`.

The mandatory post-gate fetch then found accepted Deepwater Phase 2 at `762258e31d7509aac8a7a46e7828ae0e92b84a84`. That interval changed Deepwater records/tooling plus shared Sounding Line policy, registry, documentation indexes, and the generated Feature Catalog. It did not overlap Tideglass product source, schemas, migrations, publication, authorization, or runtime behavior. The accepted Deepwater state was preserved; shared generated artifacts were rebuilt from the merged inputs. Because the base changed after the earlier gate, its `RELEASE_GO` is historical and the exact reconciled candidate requires a new source-bound decision.

## Available integration path

The phase must pass the source-bound Sounding Line candidate gate and then use the protected branch/pull-request procedure. If merge authority or another external gate is unavailable, the correct stop state is `TIDEGLASS PHASE 1 MAINLINE CANDIDATE` with exact candidate and main SHAs. Branch proof is not mainline proof; post-merge validation and remote parity remain required before an integrated claim.
