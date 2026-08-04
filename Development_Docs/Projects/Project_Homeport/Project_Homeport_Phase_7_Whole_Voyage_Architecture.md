---
title: Project Homeport Phase 7 Whole Voyage Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-7-whole-voyage-architecture
last_reviewed: 2026-08-04
---

# Project Homeport Phase 7 whole voyage architecture

## Freeze boundary

This record freezes Phase 7 before fixture implementation, integrated journey
automation, broad browser work, or walkthrough publication. The source boundary
is retained-branch Phase 7 start SHA
`08b134a757c766a40bd47bbf6fec4d92284fd8a4`; fetched tracking SHA is identical,
and the fetched `origin/main`/merge-base anchor is
`8d142227d712d27e363b15903dba9b0c99a04bc8`. The canonical development database
begins at SHA-256
`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412` and is
never a Phase 7 runtime or mutation target.

Phase 7 integrates the accepted branch-local Phase 0 through Phase 6 work. It
does not redesign those authorities or turn local synthetic proof into `main`,
deployment, live-provider, owner-acceptance, or product-acceptance proof.

## Frozen decisions

|   # | Architecture subject                         | Frozen Phase 7 decision                                                                                                                                                                                                                                                                                                                                     |
| --: | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Automated readiness versus owner acceptance  | Automated success means exactly `PROJECT HOMEPORT PHASE 7 READY FOR OWNER WALKTHROUGH`. The independent owner decision stays `PENDING_OWNER_DECISION` until the owner performs the walkthrough and records a decision.                                                                                                                                      |
|   2 | Journey registry                             | A source-controlled registry owns journeys A through O, their ordinary/deep-link classification, account alias, preconditions, visible start, milestones, mutations, recovery, viewport, evidence, and disposition. Ordinary journeys start at `/` and use visible controls.                                                                                |
|   3 | Final fixture architecture                   | Fixture family `homeport-phase7-integrated-v1` is deterministic, synthetic, versioned, checksummed, schema-bound, and built from a task-owned copy rather than the canonical database. It extends the accepted Phase 4/5 synthetic data without importing private content.                                                                                  |
|   4 | Per-journey isolation                        | The immutable seed is never mutated after acceptance. Every stateful journey receives a fresh database clone and task-owned storage/browser roots; a clone is discarded or deterministically reset before reuse.                                                                                                                                            |
|   5 | Final walkthrough database                   | After automated validation, a new clone is created from the accepted immutable seed. It is distinct from every automated journey database and is the only database used by the retained walkthrough runtime.                                                                                                                                                |
|   6 | Account matrix                               | The governed aliases are `ANONYMOUS`, `REGISTRATION_CANDIDATE`, `RETURNING_FULL_CAPABILITY`, `PLAYER_ONLY`, `CAPTAIN_ONLY`, `CREATOR_ONLY`, `MODERATOR`, `RESTRICTED_ACCOUNT`, `EXPIRED_SESSION_ACCOUNT`, `RECOVERY_ACCOUNT`, and `EMPTY_NEW_ACCOUNT`. No Administrator account is introduced.                                                              |
|   7 | Token handling                               | Raw passwords, reset/verification/invitation/session tokens, and CSRF values exist only under the task root. Committed manifests contain aliases, purpose, state, and hashes or opaque references, never secret values.                                                                                                                                     |
|   8 | Production runtime                           | Browser journeys and the final walkthrough use a production build started with production runtime semantics, an explicit task-owned database/storage root, and owned ports. Development-server success is not accepted as final proof.                                                                                                                      |
|   9 | Evidence source binding                      | Every receipt and capture binds to exact product source SHA, branch, run ID, fixture version/checksum, database-clone identity, browser/version, viewport/zoom, evidence ID, and file SHA-256. Evidence from a superseded product source cannot prove the final source.                                                                                     |
|  10 | Visual milestone strategy                    | Governed milestones capture decision points rather than every page: gateway, account state, role gateway, domain mutation result, Community handoff, Profile/Passport, expiry/permission/recovery, mobile navigation, sign-out propagation, dependency failure, and final rehearsal closure. Phase 6 baselines are comparison inputs, not Phase 7 evidence. |
|  11 | Failure/recovery strategy                    | Journey N and the cross-journey failure matrix cover dependency unavailable, recoverable request failure, invalid/expired token, restricted capability, session expiry, and return to a stable state. Failure switches are synthetic and task-owned.                                                                                                        |
|  12 | Keyboard/focus strategy                      | Every ordinary journey verifies at least one keyboard-only transition and its visible focus target. Dialog open/close, validation errors, navigation changes, and mutation completion verify deliberate focus placement or restoration.                                                                                                                     |
|  13 | Mobile journey strategy                      | Journey L replays the coherent gateway-to-domain path on governed mobile and narrow-mobile viewports, using the actual mobile shell and visible controls. Critical milestones also cover desktop and effective 200 percent where applicable.                                                                                                                |
|  14 | Multi-tab strategy                           | Journey M uses two pages in one authenticated browser context. Sign-out and context invalidation must propagate through the canonical lifecycle; a stale compatibility projection may not remain authoritative.                                                                                                                                             |
|  15 | State mutation and reset behavior            | Registration, profile/privacy, save/follow, Player/Captain, Studio, recovery, and sign-out mutations run only against journey clones. Reset recreates the clone from the immutable seed and verifies fixture identity before serving.                                                                                                                       |
|  16 | Walkthrough package                          | The committed package under `walkthrough/phase7/` explains start, health, accounts by alias, journeys, limitations, visual comparisons, reset/stop/rollback, owner decision instructions, and screenshot index. It contains no credentials or tokens.                                                                                                       |
|  17 | External credential handoff                  | A task-owned local handoff outside the repository carries the live URL, synthetic credentials, token-flow directions, reset command, and stop command. Its path, not its secret contents, appears in the final handoff.                                                                                                                                     |
|  18 | Runtime commands                             | Package commands prepare the fixture, run journeys, prepare/start/status/reset/stop the walkthrough, and validate Phase 7. They reject canonical/unowned database paths, verify source and fixture identities, report bounded non-secret status, and stop only their recorded process.                                                                      |
|  19 | Live-server retention                        | Successful closure intentionally leaves exactly one healthy walkthrough server on the final publication commit and fresh walkthrough clone. Validation servers, build helpers, browser profiles, and transient clones are not retained.                                                                                                                     |
|  20 | Sounding Line maturity status                | Phase 7 contracts are registered at required maturity and executed through the authoritative subsystem and mainline finalizers. Raw passing tests do not establish `RELEASE_GO`; finalizer receipts do.                                                                                                                                                     |
|  21 | Owner decision record                        | The committed record contains `PENDING_OWNER_DECISION`, the exact automated-readiness boundary, decision options/instructions, and blank owner/date/notes fields. Automation never fills or infers the owner decision.                                                                                                                                      |
|  22 | HP-NC-015/019/020 handling                   | HP-NC-015 may close only after exact-source integrated visible-path proof; HP-NC-019 may close only after deterministic fixture and fresh-clone proof; HP-NC-020 advances only to waiting for the owner decision and is not owner-closed by Phase 7.                                                                                                        |
|  23 | Cleanup versus intentional runtime retention | Task-owned validation processes and transient resources are cleaned. The final server, final database, bounded logs, lease/status files, and external credential handoff are intentionally retained and identified.                                                                                                                                         |
|  24 | Rollback                                     | Product-source rollback is Git history on the retained branch; fixture rollback recreates a clone from the immutable seed; runtime rollback stops only the leased PID after port/process identity verification. Canonical data is never restored because Phase 7 never mutates it.                                                                          |
|  25 | Final status language                        | Success begins with `PROJECT HOMEPORT PHASE 7 READY FOR OWNER WALKTHROUGH`. A product defect uses `PROJECT HOMEPORT PHASE 7 RETURNED TO IMPLEMENTATION`; an evidence/environment/authority blocker uses `PROJECT HOMEPORT PHASE 7 BLOCKED`. No stronger status is permitted.                                                                                |

## Specialist and ownership boundaries

Wayfarer retains account/session, Personal Harbor, Profile, Passport, recovery,
and account-security authority. True North retains ProductShell, global
wayfinding, and route-projection authority. One Voyage retains Player, Captain,
Creator, invitation, and compatibility behavior. Harborlight retains Community
district, public projection, discovery, moderation, and community-operation
authority. Sealed Hold retains private-delivery boundaries. Lanternwake retains
presentation behavior and not domain state. Universal Language retains language
and locale behavior. Sounding Line retains governed contract selection and
release-result authority. Homeport owns only integrated convergence evidence,
the Phase 7 fixture and journey model, the walkthrough package/runtime, and its
nonconformity dispositions.

## Fixture and runtime topology

```text
canonical development database (read/hash only)
  -> task-owned source copy
     -> immutable accepted seed
        -> journey A clone ... journey O clone
        -> fresh final walkthrough clone
```

The task root, databases, credentials, tokens, profiles, screenshots, traces,
reports, logs, receipts, build runtime, leases, and synthetic media remain
outside committed source. The final runtime must bind to the final publication
SHA, its dedicated build output, port `3717` unless the lease reports a governed
replacement, and the fresh final walkthrough clone. Ports `3718` through `3720`
are reserved for owned validation work and are released before handoff.

## Journey groups

| Journey | Integrated intent                                                                   |
| ------- | ----------------------------------------------------------------------------------- |
| A       | New-account registration and first coherent landing                                 |
| B       | Returning full-capability account and intended return                               |
| C       | Player voyage and playthrough continuity                                            |
| D       | Captain voyage/session and invitation continuity                                    |
| E       | Creator Studio Chronicle/version continuity                                         |
| F       | Community discovery, district, listing, save/follow, and governed public projection |
| G       | Personal Harbor Profile and preferences/privacy                                     |
| H       | Passport and account-history continuity                                             |
| I       | Password recovery and stable post-reset return                                      |
| J       | Expired session and reauthentication                                                |
| K       | Restricted capability and deliberate permission denial                              |
| L       | Mobile whole-voyage path and shell continuity                                       |
| M       | Sign-out and multi-tab invalidation                                                 |
| N       | Dependency failure, recovery, and stable retry                                      |
| O       | Automated owner-walkthrough rehearsal across the assembled product                  |

## No-migration decision

The accepted schema already represents accounts, sessions, roles, tokens,
profiles, domain records, Community records, and fixture states required for
Phase 7. Phase 7 introduces orchestration and synthetic data, not new product
persistence authority. No Prisma migration or canonical-data transformation is
authorized by this freeze.

## Freeze effect

This architecture authorizes Phase 7 implementation only after its publication
commit. It establishes no journey result, fixture acceptance, evidence result,
Sounding Line result, nonconformity closure, walkthrough readiness, running
server, owner decision, merge, deployment, or product acceptance.
