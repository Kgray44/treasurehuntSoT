---
title: Project Homeport Phase 1 Test Plan
audience: product-engineering
status: current
canonical_for: project-homeport-phase-1-test-plan
last_reviewed: 2026-08-01
---

# Project Homeport Phase 1 test plan

## Decision boundary

Phase 1, **Unite Identity and Session Authority**, requires authoritative evidence that one `AccountSession` and one server-owned current-user context govern ordinary identity. Raw Vitest and Playwright runs are diagnostic development evidence only. Sounding Line owns the subsystem and mainline release decisions. No successful local check may be described as deployment, production, owner acceptance, or Phase 2 proof.

Validation uses a copied task-owned SQLite database, reserved synthetic accounts, task-owned Playwright storage, and a task-owned port. The canonical development database is hashed before and after the run and is never migrated, reset, pushed, seeded, or opened for test writes.

## Contract matrix

| Area                   | Stable contracts                                                                                                                                         | Primary proof                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| One auth product       | `homeport.auth.single-product`, `homeport.signin.lifecycle-links`, `homeport.registration.reachable`, `homeport.registration.success-destination`        | AccountFlow component/API tests and journeys A-B    |
| Canonical session      | `homeport.session.convergence`, `homeport.session.expiry`, `homeport.session.revocation`, `homeport.session.restricted-account`                          | Resolver/service tests and journeys A, C, F, H, I   |
| Current-user lifecycle | `homeport.context.failure-state`, `homeport.shell.auth-refresh`, `homeport.current-user.no-stale-overwrite`, `homeport.current-user.no-client-authority` | Provider/shell tests and journeys A-B, J-K          |
| Capability agreement   | `homeport.capability.player-agreement`, `homeport.capability.staff-agreement`, `homeport.permission.explicit`                                            | Resolver/guard tests and journeys C-G, K            |
| Sign-out               | `homeport.signout.visible`, `homeport.signout.multi-tab`, `homeport.signout.compatibility`                                                               | Sign-out route/component tests and journeys I-J     |
| Safe return            | `homeport.return-to.safe`                                                                                                                                | Unit attack matrix and journey O                    |
| Passport               | `homeport.passport.session`                                                                                                                              | Canonical guard/consumer contract and journey C     |
| Invitation             | `homeport.invitation.account-handoff`                                                                                                                    | Invitation component/service coverage and journey N |
| Compatibility          | `homeport.legacy-player.rotation`, `homeport.legacy-staff.bridge`, `homeport.compatibility.observation`                                                  | Resolver/API bridges and journeys L-M               |

## Browser acceptance journeys

| Journey | Required outcome                                                                                                            | Evidence                            |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A       | Gateway intent reaches canonical sign-in; lifecycle links are visible; authenticated shell settles without anonymous flash. | `HP-P1-EV-A-sign-in-desktop`        |
| B       | Visible registration creates a canonical session and completes the intended Player return.                                  | `HP-P1-EV-B-registration-return`    |
| C       | Player identity, shell, Passport, and reload remain coherent.                                                               | `HP-P1-EV-C-passport-continuity`    |
| D       | Captain capability opens Captain without another credential.                                                                | `HP-P1-EV-F-workspace-continuity`   |
| E       | Creator capability opens Studio without another credential.                                                                 | `HP-P1-EV-F-workspace-continuity`   |
| F       | One account crosses Player, Captain, Creator, Passport, and Player without role loss.                                       | `HP-P1-EV-F-workspace-continuity`   |
| G       | Authenticated non-moderator receives permission denial and remains signed in.                                               | `HP-P1-EV-G-permission-denied`      |
| H       | Expired session is explicit and preserves a safe return through reauthentication.                                           | `HP-P1-EV-H-session-expired`        |
| I       | Sign-out visibly removes identity and denies the protected route.                                                           | `HP-P1-EV-I-sign-out-complete`      |
| J       | A second tab refetches after sign-out; no secret enters the invalidation message.                                           | `HP-P1-EV-J-multitab-sign-out`      |
| K       | Captain removal denies Captain while retaining Player identity.                                                             | `HP-P1-EV-K-role-removal`           |
| L       | A mapped `chronicle_player` session rotates to canonical context and records bounded use.                                   | `HP-P1-EV-L-legacy-player-rotation` |
| M       | A mapped `forever_gm` session bridges to exact canonical permission and records bounded use.                                | `HP-P1-EV-M-legacy-staff-bridge`    |
| N       | A synthetic invitation is accepted, cleared, and followed by canonical Player context.                                      | `HP-P1-EV-N-invitation-handoff`     |
| O       | External return destinations are rejected and authentication lands internally.                                              | `HP-P1-EV-O-safe-return`            |
| P       | Mobile sign-in, Player context, and sign-out are equivalent to desktop.                                                     | `HP-P1-EV-P-mobile-context`         |
| Q       | Sign-in, registration, expiry, and permission states survive 200% zoom without horizontal overflow.                         | `HP-P1-EV-Q-zoom-permission`        |

## Required closure sequence

1. Focused registered unit, API/service, component, and browser development loops.
2. `npm run homeport:validate`.
3. `npm run docs:index` and `npm run docs:validate`.
4. `npm run private-content:scan` and staged-diff scan after targeted staging.
5. `npm run features:sync` and `npm run features:validate`.
6. SQLite and MySQL Prisma validate/generate, with no migration because the schema did not change.
7. Production build against isolated task state.
8. Sounding Line selected Homeport/auth subsystem plan.
9. One authoritative `npm run test:mainline` final decision.
10. Canonical database hash, task process/port cleanup, Git parity, and clean-tree proof.

Failures are repaired at their owning contract and rerun through the Sounding Line finalizer when required. Evidence remains pending until the finalizer says `RELEASE_GO`.
