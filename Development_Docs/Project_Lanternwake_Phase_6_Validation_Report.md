# Project Lanternwake Phase 6 Validation Report

## Focused evidence — 2026-07-22

This report records focused evidence gathered before final Phase 6 acceptance. It is not a complete-repository gate and does not claim program closure.

| Gate                                               | Environment                                                                                                                                            | Result | Evidence                                                                                                                                                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AnimationShowcase focused component/lifecycle test | Detached local validation worktree at `62691f2ec8f68ec71f120c68dd963a72c6cea8df`; shared dependency runtime mounted read-only through a local junction | Passed | `node node_modules/vitest/vitest.mjs run src/components/dev/AnimationShowcase.test.tsx`: 1 file, 9 tests passed, 0 failed, 4.48 s.                                                                                                           |
| Production Rive authoring/export intake            | Authorized Rive editor account                                                                                                                         | Passed | Four project-owned `.riv` runtime exports and four matching governed `.rev` backups were exported and hash-recorded. The first three artboards are bound to `ViewModel1`; Finale Mechanism exposes all 12 native inputs.                     |
| Rive asset validation                              | Local Phase 6 runtime mirror                                                                                                                           | Passed | `node node_modules/tsx/dist/cli.mjs scripts/validate-animation-assets.ts`: validates 4 runtime binaries, 4 governed sources, 3 Lottie assets, local fallbacks, Rive artboards/state machines, bound view models, and frozen interface types. |
| Focused Rive runtime contracts                     | Local Phase 6 runtime mirror                                                                                                                           | Passed | `vitest run src/components/animation/RiveRuntime.test.tsx src/animation/assets/rive-contracts.test.ts`: 2 files, 14 tests passed.                                                                                                            |
| Production Rive consumer components                | Local Phase 6 runtime mirror                                                                                                                           | Passed | `vitest run InvitationCeremony.test.tsx JournalWorkspace.test.tsx VoyageChart.test.tsx FinaleChamber.test.tsx AccessGate.test.tsx`: 5 files, 43 tests passed.                                                                                |

## Interpretation

The historical AnimationShowcase timing failure did not reproduce at the current Phase 6 base. It remains subject to later complete-suite and production-browser proof, but it is not currently an active focused-test defect.

The Rive source/export pairs are now genuine project-authored artifacts; no third-party runtime binary was adopted. The runtime contract correction is explicit: current Rive data binding is used for Invitation Seal, Journal Clasp, and Voyage Compass, while Finale retains legacy state-machine inputs. The same consumer contract names and types remain frozen.

## Validation isolation

Source edits remain in the registered network-share Phase 6 worktree. A non-Git local runtime mirror is used only because Node/Vite cannot reliably resolve UNC file URLs; it links to the existing dependency runtime and does not alter those dependencies. Complete-repository, browser, lifecycle, performance, and remaining closure-ledger validation are still required before Phase 6 acceptance.
