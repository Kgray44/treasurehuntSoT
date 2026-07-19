# Project Lanternwake Phase 4 — Visual Checkpoint Index

## Evidence boundary

Checkpoints are semantic states, not timer screenshots. `Automated` means a repeatable component or Playwright assertion; `Live` means direct browser/DOM inspection in the Phase 4 worktree; `Final` means the serialized integrated gate. The live pass used Chromium at 1440×900 and 390×844 in full and reduced motion. No arbitrary-sleep screenshot set is treated as acceptance evidence.

## Landing

| Checkpoints                                                                                                            | Modes / viewport                       | Evidence                                                                           | Result                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| critical static frame; assets ready; roles ready; Player/Captain/Creator intent; route handoff; reentry; reduced final | Full and reduced; 1440×900 and 390×844 | Live DOM/visual inspection; `HarborLanding.test.tsx`; `lanternwake-phase4.spec.ts` | Passed; no overflow, accidental decorative tab stop, or reduced-motion loss of meaning |

## Authentication

| Checkpoints                                                                   | Modes / viewport                                    | Evidence                                                                                                                              | Result                                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| idle; pending; slow; failure; permission mismatch; success final before route | Full/gentle/reduced semantics; 1440×900 and 390×844 | Live Player failure and method-switch inspection; `PlayerSignIn.test.tsx`; `StaffSignIn.test.tsx`; `AsyncState.test.tsx`; Phase 4 E2E | Passed focused; stale method error corrected and inputs preserved |

## Invitation

| Checkpoints                                                                                                                                   | Modes / viewport                     | Evidence                                                           | Result                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| resolving; valid closed/open; PIN; invalid; expired; revoked; accepting; seal fracture; ribbon release; title; accepted; decline; replacement | Full/gentle/reduced component matrix | `InvitationCeremony.test.tsx`; access scene builder/registry tests | Passed focused; ceremony starts only after authoritative acceptance |

## Libraries and wizard

| Checkpoints                                                                                     | Modes / viewport                       | Evidence                                                                                                                     | Result                                                      |
| ----------------------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| initial grouped; gallery; list; filtered; pinned; hidden; polling changed; empty; route handoff | Full and reduced; 1440×900 and 390×844 | Live Player/Captain empty and populated inspection; `PlayerLibrary.test.tsx`; `CaptainLibrary.test.tsx`; polling-delta tests | Passed focused; unchanged polling does not replay           |
| wizard open; step direction; validation; pending; created result; close/focus restore           | Full/gentle/reduced component states   | Captain Library component tests and authoritative async tests                                                                | Passed focused; created result remains readable until close |

## Waiting room

| Checkpoints                                                                                                             | Modes / viewport                     | Evidence                                                      | Result                                                                               |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| closed journal; crew arrival; ready; polling; scheduled; launch-ready; latch release; route handoff; reconnect; revoked | Full/gentle/reduced component states | `PlayerVoyageRoom.test.tsx`; polling-delta and one-shot tests | Passed focused; launch is one-shot per authoritative version and revoked is terminal |

## Quartermaster

| Checkpoints                                                                                                           | Modes / viewport                                 | Evidence                                                                                                       | Result                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| confirmation; preflight; pending; failure reversal; success receipt; dashboard reconciliation; undo preview; conflict | Full/reduced; desktop and mobile dialog behavior | Live dialog, inert-background, and focus-restore inspection; `Quartermaster.test.tsx`; `admin-command.test.ts` | Passed focused; exact preflight and authoritative receipt remain visible |

## Studio

| Checkpoints                                                                                                                                               | Modes / viewport                       | Evidence                                                                                            | Result                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| library; editor section; drag placeholder; drag overlay; drop settle; validation; autosave; preview; publish; version; upload; comparison; immutable lock | Full and reduced; 1440×900 and 390×844 | Live Library/editor/version inspection; `TaleEditor.test.tsx`; Studio E2E; Phase 4 keyboard/axe E2E | Passed focused; mobile More overflow and drag-handle semantics corrected |

## Offline, notifications, and shell

| Checkpoints                                                                                 | Modes / viewport                     | Evidence                                                                | Result                                                                       |
| ------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| offline; reconnect; authoritative synchronized log entry; preserved ordering; reduced final | Full/gentle/reduced component states | `PlayerExperience.test.tsx`; `ShipsLog.test.tsx`; domain/snapshot tests | Passed focused; server sequence/time are the only offline metadata authority |
| unseen badge; acknowledgment failure; retry; authoritative success                          | Full/gentle/reduced component states | PlayerExperience, CompanionNavigation, and ProductShell tests           | Passed focused; unseen truth is retained until the server confirms           |
| route handoff; active plate; exact-once focus; keyboard disclosure; no mobile overflow      | Full/reduced; 1440×900 and 390×844   | ProductShell tests; live Studio/landing inspection; Phase 4 E2E         | Passed focused                                                               |

## Automated accessibility checkpoints

Axe scans passed for reduced mobile landing/authentication and reduced mobile Studio. Live inspection also covered Player/Captain Library, Quartermaster dialog semantics, decorative hiding, focus restoration, and mobile overflow. The final integrated browser gate remains the closing evidence source for the repository-wide viewport and accessibility matrix.
