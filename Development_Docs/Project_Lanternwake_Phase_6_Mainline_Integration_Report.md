# Project Lanternwake Phase 6 Mainline Integration Report

## Status

**Blocked. `origin/main` was not changed.**

| Field                  | Value                                      |
| ---------------------- | ------------------------------------------ |
| Repository             | `forever-treasure-companion`               |
| Integration branch     | `integration/lanternwake-phase6-mainline`  |
| Starting `origin/main` | `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7` |
| Phase 6 source         | `8b8d75651b5450bf9b31d5c29397aa39b34b39f2` |
| Merge base             | `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72` |
| Mainline push          | Not attempted                              |

## Reconciliation

The non-squash merge was started with `--no-ff --no-commit` and had five semantic conflicts: the two animation reconciliation CSVs, the legacy Player event route and its test, and `src/server/admin-command.ts`.

- Current main remains authoritative for the canonical Chronicle/identity/legacy-compatibility event-route architecture and the newer admin-command entrypoint.
- Phase 6 component, asset, Rive runtime, moon-phase, reduced-motion, PageFlip, and animation-contract changes were retained.
- The two ledger files retain Phase 6 rows while carrying current-main Chronicle path and test-name references.
- `src/app/api/player/[campaignSlug]/events/stream-config.ts` was removed. `src/platform/player-event-stream.ts` is the only event-stream constants authority.
- The validation harness now migrates and verifies the legacy Companion compatibility projection before browser tests. Phase 3 browser fixtures likewise migrate their temporary Campaigns and read their sequence from the mapped canonical Session.
- An inherited nullability defect in `src/private-content/service.ts` was corrected with a fail-closed missing-payload guard so typecheck can run.

## Assets

The repository asset validator passed: four production Rive binaries, four governed Rive sources, three Lottie assets, and SVG fallbacks.

| Asset                                            | SHA-256                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `public/animations/rive/invitation-seal-v1.riv`  | `3432c0fd2a06192ecde97c9e931045eaa8aab37025ab81f60234b75e2684c2f5` |
| `public/animations/rive/journal-clasp-v1.riv`    | `0673ce171281bd63513eb3ade2e29a37d400577c300b2c89ce771fc25f3b0af2` |
| `public/animations/rive/voyage-compass-v1.riv`   | `7dbbaa18d6487334bba5f77dff85f674a1f9294f7b43b8b96d4f165a3fe43f49` |
| `public/animations/rive/finale-mechanism-v1.riv` | `6465b2540d031a64ef449d9c3ecac4cb8889534e8c821877b0f0f636dc5da6a1` |
| `lanternwake-invitation-seal-v1.rev`             | `259df9da1ed0d72d447a58224ff29de8bf739c30e0240809d0b9136bb5b027a8` |
| `lanternwake-journal-clasp-v1.rev`               | `57c9e198e167c945f5a412c8a0c8d37fbf137e4ceb5d30f885624163611f7c5a` |
| `lanternwake-voyage-compass-v1.rev`              | `e51522c647bdd862f9ed2e046cc0129f5593c701061985d9bcbf1d8c30c49627` |
| `lanternwake-finale-mechanism-v1.rev`            | `022ef282c30abba40c3e3e8ce4fc6609a4b81f1e3bd7175df95c0064428e8341` |

Validated Rive contracts are InvitationSeal/InvitationSealSM, JournalClasp/JournalClaspSM, VoyageCompass/VoyageCompassSM, and FinaleMechanism/FinaleMechanismSM.

## Validation Record

Passed before the blocking gates:

- focused animation and event-stream suite: 13 files, 79 tests;
- complete unit suite: 92 files, 873 tests;
- Prettier check; ESLint with 0 errors and 24 existing warnings; TypeScript check;
- Webpack production build;
- animation asset validator;
- ordered fresh SQLite rehearsal of all 12 migrations, `PRAGMA foreign_key_check`, and seed;
- legacy Companion migration execute and verify in the isolated validation database;
- Phase 3 nonce-bound setup, including 13 successful canonical command publications.

The first focused-test invocation failed only because the clean worktree had no dependency tree; it was rerun after attaching an ignored junction to the established local validation dependency mirror and passed.

Blocking gates:

1. `scripts/validate_animation_reconciliation.py` fails after reconciliation with 51 accepted-unmapped/source-unresolved records and schema-status incompatibilities. The Phase 6 source validator reported all 458 obligations accepted, but the current validator rejects legacy `validated`, `rejected-approved`, and `superseded-approved` ledger vocabulary. This requires a deliberate validator/ledger convergence, not a fabricated pass.
2. The browser matrix is not acceptable. The Phase 3 setup passed, but Chromium acceptance/access-gate tests still assert retired legacy UI routes and labels. The captured failures show the current canonical invitation, Captain, and Chronicle surfaces instead. The owned run was stopped after this conclusive failure; no complete browser, Finale-state, motion-mode, viewport, or restart pass exists.
3. The repository private-content staged scan reports two existing tracked `Codex_Chats` archive files as sensitive content. They are outside the integration diff; the scan must be made archive-aware or those archived inputs must be handled under their separate privacy workflow before it can serve as a passing gate.

The full validation harness was attempted three times. The first two exposed and repaired the missing compatibility migration fixture path; the third exceeded the foreground 20-minute command window while progressing, then exposed the browser failures above. No failed attempt is counted as a pass.

## Database and Process Safety

The integration-owned SQLite baseline was newly created and seeded; the harness created nonce-bound cloned databases and recorded canonical-family fingerprints. No production or other-task database was used. The foreground timeout left only harness-owned processes; their command lines and ancestry were verified before termination. Ports 3100 and 3200 were released. No unrelated server or worktree was stopped or deleted.

## Required Next Work

Do not push this branch to `main` until the reconciliation validator is converged and the complete browser matrix, production restart proof, and canonical-data isolation report pass. The merge is intentionally left reviewable on the integration branch only.
