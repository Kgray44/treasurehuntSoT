---
title: Project Homeport Phase 2 Test Plan
audience: product-engineering
status: current
canonical_for: project-homeport-phase-2-test-plan
last_reviewed: 2026-08-01
---

# Project Homeport Phase 2 test plan

## Decision contract

Phase 2 is releasable on its named branch only when one typed shell classifier assigns every page exactly one of eight modes, one registry projects every navigation layer, desktop/mobile destination IDs are equal for equivalent state, compact and immersive routes have governed exits, all A-U journeys pass in isolated state, the 20 required images are visually accepted and checksum-bound, and Sounding Line returns `RELEASE_GO` for both the selected subsystem plan and mainline.

Raw Vitest or Playwright output is diagnostic evidence. Sounding Line is the authoritative release decision. Local evidence does not establish deployment, live-user behavior, owner acceptance, or product acceptance.

## Focused contracts

- `src/navigation/navigation.test.ts`: route classification cardinality, active matching, capability-only projection, registry uniqueness, account hierarchy, workspace projection, contextual exits, and exact desktop/mobile functional IDs.
- `src/components/shell/ProductShell.test.tsx`: gateway/workspace/compact/immersive rendering, loading and unavailable identity states, menu semantics, outside click, Escape, route-change close, focus restoration, scroll lock, sign-out projection, and reduced-motion behavior.
- `tests/homeport/phase2-contracts.test.mjs`: deterministic generation and schema/contract rejection paths.
- `scripts/homeport/validate-phase2-contracts.ts`: 69-page mode cardinality, eight-mode vocabulary, runtime drift, registry drift, capability vocabulary, active aliases, parity rows, and contextual-exit coverage.
- `tests/e2e/homeport-phase1.spec.ts`: retained Phase 1 identity/session regression scope.

## Browser acceptance matrix

| Journey | Acceptance contract                                                                          |
| ------- | -------------------------------------------------------------------------------------------- |
| A       | Anonymous gateway Account control, Create Account, Sign In, pointer and keyboard lifecycle   |
| B       | Authenticated gateway identity, no anonymous Sign In, granted workspaces                     |
| C       | Gateway control to Community Harbor, active state, Home return                               |
| D       | Gateway control to Explore Chronicles, persistent global navigation, Home return             |
| E       | Player library, Community, Profile, Passport, Security, Player return without second sign-in |
| F       | Captain, Community, personal destinations, Player/Captain switching without second sign-in   |
| G       | Creator, Community, Security, Creator return and responsive overflow check                   |
| H       | Player/Captain/Creator/Player workspace continuity and current-workspace state               |
| I       | Identity, Personal Harbor, Workspaces, Account actions, and every personal destination       |
| J       | Anonymous 390x844 global drawer and account lifecycle                                        |
| K       | Authenticated 390x844 functional-ID equality, Security, workspace access, Sign Out           |
| L       | Skip link, account disclosure, mobile drawer, Escape, and focus restoration by keyboard      |
| M       | Account and drawer route-change closure plus body-scroll restoration                         |
| N       | Exact/section/dynamic active-state matrix with no false prefix                               |
| O       | Representative compact Captain exit with account continuity                                  |
| P       | Representative immersive Player exit with persisted Voyage fields and event count unchanged  |
| Q       | Explicit permission denial while identity and a safe global return remain available          |
| R       | Task-owned current-user 503, unavailable state, no anonymous misrepresentation, retry        |
| S       | 200% layout equivalent across gateway, account, Community, and compact exit without overflow |
| T       | Reduced-motion navigation, disclosures, and immersive exit                                   |
| U       | Phase 1 sign-in, Player, Captain, Creator, Passport, and Sign Out continuity                 |

The browser project uses port 3188, a copied task database, reserved synthetic accounts, task-owned browser state, and committed evidence under `evidence/phase2`. Ordinary reachability journeys begin at `/`; direct URLs are used only for governed contextual/security states.

## Required closure sequence

1. Apply the Phase 2 updater twice and require byte-identical results.
2. Validate Homeport artifacts, documentation, catalog, formatting, lint, TypeScript, privacy, both Prisma providers, and the production build.
3. Run the selected Homeport/shell Sounding Line plan without manually narrowing required suites.
4. Repair any valid rejection at its owning contract and preserve the rejected attempt in the validation record.
5. Run one authoritative mainline decision and require `RELEASE_GO`.
6. Stage exact scope, run staged-diff privacy, commit, push, prove remote parity, verify canonical DB hash and runtime cleanup, and retain the worktree.
