---
title: Project Admiralty Phase 1 Integration Manifest
audience: product-engineering-security
status: current
canonical_for: project-admiralty-phase-1-integration-manifest
last_reviewed: 2026-08-09
---

# Project Admiralty Phase 1 integration manifest

## Source identity

| Item                      | Value                                                                       |
| ------------------------- | --------------------------------------------------------------------------- |
| Starting `origin/main`    | `f1c2f22dd935322c1a71eb80c51592f243dc196d`                                  |
| Implementation checkpoint | `648d1068ee3007c303ac76ae3a3c68e137f73a0e`                                  |
| Reconciled `origin/main`  | `40d822cd936c9abbfce064fd7799e6a2f8c9785e`                                  |
| Exact tested app source   | `49c2f59d6d75791edbdba84f22f5ec1595d2d129`                                  |
| Owner-observed source     | `750b904cfec013f0b6adec3d930caf5eeae9ec0b`                                  |
| Current-main merge anchor | `0ba4df35e7bf6a9597ca8d52ff9063e320554a24`                                  |
| Worktree                  | `C:\Users\kkids\Documents\treasurehuntSoT-admiralty-phase1`                 |
| Branch                    | `codex/project-admiralty-phase1-raise-the-colors`                           |
| Owner decision            | `ACCEPTED` on `2026-08-09`                                                  |
| Publication               | Owner-accepted mainline candidate; canonical integration and parity pending |

The non-destructive current-main merges retain Project Deepwater's accepted
control plane, the current project-governance wave, governing PDFs, and accepted
Project Tideglass Phase 1 source. Shared ownership, contract, suite, impact,
generated test-registry, documentation, and Feature Catalog artifacts combine
both projects. The parallel Feature Catalog ID collision was reconciled by
preserving Tideglass `FT-B009` and assigning Admiralty `FT-B010`. No canonical
checkout or database was used for implementation or validation.

## Source families

- `src/admiralty`: capability resolution, authorization, assurance, bootstrap,
  scoped Support Access, safe projections, and audit composition.
- `/admin`, `/api/admin`, `/account/support-access`, and
  `/api/account/support`: bounded privileged and account-owner surfaces.
- canonical shell/navigation integration: privileged direct-entry
  classification plus ordinary consent reachability, without Admin navigation.
- Prisma schemas and paired additive SQLite/MySQL migrations.
- synthetic fixture, migration rehearsal, browser journey, Sounding Line policy,
  and owner-runtime controllers under `scripts/admiralty`.
- focused unit/component tests and isolated production-browser journeys.

## Governed artifact families

- Phase registration, design, safety, threat, test, integration, validation,
  completion, and owner-walkthrough records.
- Role/capability, Support Access scope, migration reservation, and 92-entry
  capability-floor registries.
- additive Homeport route, journey, screen, state, responsive, accessibility,
  and visual evidence reconciliation for the new human-facing surfaces.
- additive Sounding Line ownership, contracts, suites, impact mappings, adapter,
  and generated active test registry.
- current product, user, administrator, developer, route, command, environment,
  status, changelog, and Feature Catalog documentation.

## Database and rollback

SQLite migration `20260809120000_admiralty_phase1_foundation` and MySQL
migration `0052_admiralty_phase1_foundation` add only `PrivilegedAssurance`,
`SupportAccessRequest`, and `SupportAccessGrant` state and relations. Upgrade
rehearsal preserves a preexisting sentinel row. Code rollback leaves the
additive tables dormant; destructive rollback is neither required nor
authorized. Administrator bootstrap remains an explicit, dry-run-first,
audited role reconciliation against existing canonical accounts.

## Phase and acceptance boundary

This manifest contains Phase 1 only. The owner decision is `ACCEPTED`, but the
branch has not yet been integrated to canonical mainline or proven at remote
parity. It does not start Phase 2, deploy, run production MySQL, or claim
live-provider, physical-device, or physical assistive-technology proof.
