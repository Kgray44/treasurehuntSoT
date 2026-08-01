---
title: Project Homeport Phase 1 Integration Manifest
audience: product-engineering
status: current
canonical_for: project-homeport-phase-1-integration-manifest
last_reviewed: 2026-08-01
---

# Project Homeport Phase 1 integration manifest

## Source identity

| Item                     | Value                                                        |
| ------------------------ | ------------------------------------------------------------ |
| Phase 0 closure          | `bda5217a67d8ce2b56a02163371c137d9ed07275`                   |
| Phase 1 starting SHA     | `bda5217a67d8ce2b56a02163371c137d9ed07275`                   |
| Phase 1 implementation   | `43c0fdc701de1425e651acb06924051fbd3a4a34`                   |
| Reconciled `origin/main` | `8d142227d712d27e363b15903dba9b0c99a04bc8`                   |
| Worktree                 | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport`       |
| Branch                   | `codex/project-homeport-product-reality-recovery`            |
| Integration target       | Existing Homeport upstream only; no PR and no mainline merge |

`origin/main` is the exact merge base of the Phase 0 line, so no newer accepted mainline identity/session change required merge or rebase. The machine-readable inventories retain the Phase 0 source SHA as their historical census boundary and add a Phase 1 implementation digest over affected source/test content.

## Source families

- `src/homeport/*`: typed context, canonical resolver, capability decisions, and safe return.
- `src/components/auth/*`: client provider, explicit states, role adapters, and sign-out.
- account lifecycle routes/components: canonical context endpoint, sign-in/register/recovery/verification/claim/merge/session mutation behavior.
- shell/Passport: shared current-user consumption and stale private-projection removal.
- Player/Captain/Studio/moderation/account guards: canonical capability decisions and explicit denial/expiry/restriction/unavailable states.
- compatibility: canonical writes and mapped read/rotate bridges for legacy Player/staff sessions.
- invitation/waiting room: current-user invalidation before handoff and async destination focus.
- `tests/e2e/homeport-phase1.spec.ts` plus affected unit/component/service tests.
- Sounding Line registration and Playwright project configuration.

## Governed artifact families

- Phase 1 architecture, cutover ledger, test plan, implementation report, validation record, and this manifest.
- Updated session, route, navigation, screen, screen-contract, control, journey, nonconformity, and visual-baseline inventories.
- Phase 0 audit linked addendum and journey-audit Phase 1 addendum.
- 15 synthetic after-state PNGs under `evidence/phase1` with manifest checksums.
- Homeport README, documentation index, product/current/feature status, changelog, and owning Feature Catalog fragment.

## Database and rollback

No Prisma schema or migration file changed. Rollback is a normal code/document revert that preserves all account, session, profile, role, invitation, PlayerAccess, PlayerIdentitySession, GameMasterSession, TaleSession, and history data. Compatibility readers remain available during the observation window, so rollback requires no destructive data action.

## Phase boundary

This manifest publishes Phase 1 only. It does not open a PR, merge to main, start Phase 2, delete the Homeport worktree, retire compatibility, or claim deployment/product acceptance.
