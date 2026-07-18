# Phase B-6 completion report

Date: 2026-07-18  
Branch: `codex/phase-b6-hardening-public-release`  
Starting point: `f26ef7d9c3d3d6fbe4b60cf2c5cabed445186001`  
Implementation commits: `eb8dc48badaca5847ac237a249b8026ec717905b`, `919df0e2843c8c03759b0dfd644e4e77801e03b6`

## 1. Executive summary

Phase B-6 implemented a substantial hardening foundation: persisted release authority, issue and compatibility governance, deterministic replay and soak tooling, signed-manifest contracts, bounded atomic update/rollback logic, package-extraction limits, a reproducible local Rive runtime, installer automation, diagnostics/readiness UI, metadata-only improvement review, onboarding, CI definitions, migrations, and operator/role documentation.

The implementation and local automated regression suites pass. A development-channel x64 NSIS artifact was built, truthfully reported as unsigned, and its packaged Electron/native-capture path passed. These successes do not authorize a creator preview, stable release, automatic progression, or public distribution.

Nine release blockers remain open. The missing evidence includes real locked Sea of Thieves pilot corpora, broader hardware and multi-hour/game-impact runs, a production signing identity, hosted clean-machine install/update/rollback proof, external usability participants, independent security/privacy review, and distribution-policy clarification. Therefore the release gates did not all pass.

## 2. Repository state

- Repository: `Kgray44/treasurehuntSoT` in the isolated worktree `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase_B6`.
- Starting branch/upstream: B-5 at `f26ef7d9c3d3d6fbe4b60cf2c5cabed445186001`; it was neither ahead nor behind its upstream after `git fetch --prune origin`.
- B-6 branch: `codex/phase-b6-hardening-public-release`.
- Focused code commits: `eb8dc48badaca5847ac237a249b8026ec717905b` and `919df0e2843c8c03759b0dfd644e4e77801e03b6`.
- The user-owned main checkout and its two untracked governing PDFs were not modified.
- Build outputs, dependency trees, generated Rive runtime copies, and local SQLite databases remain ignored and are not release-source commits.
- The final development artifact was produced while B-6 documentation was still awaiting the required documentation/chat synchronizer. Its provenance therefore truthfully records `workingTreeClean: false`; this is one reason it is evidence only, not a publishable candidate.

## 3. Baseline audit findings

The untouched B-5 baseline passed before B-6 modification: all ten pre-B-6 migrations, 37 unit files/115 tests, 3 desktop tests, 29 Companion tests, 33 Playwright passes with 13 intentional WebKit mutation skips, production build, and restart safety. B-1 through B-5 were present and operational; no completed phase was rewritten.

The starting release gaps were material: release readiness was not persisted as an authority, the installer/signing/updater path was incomplete, release corpora and statistical reporting were absent, the browser still depended on an external Rive WASM URL, the packaged smoke did not prove real desktop capture, and there was no B-6 hardware/usability/security/public-release evidence set. The baseline details are in `B6_Baseline_Audit.md`.

## 4. Architecture changes

- Added persisted `VisionRelease`, `Issue`, `DatasetManifest`, `ReliabilityRun`, `CompatibilityRule`, `ReleaseArtifact`, `ReleaseTestRun`, `UpdateState`, and `ImprovementCandidate` models. Waypoint versions now carry certification and compatibility state plus certified package/dataset identity.
- Added a machine-readable release issue register, compatibility policy, readiness record, error catalog, performance budgets, and immutable synthetic dataset manifest.
- Added deterministic release/fast replay, comparison support, Wilson interval/rule-of-three statistics, bounded soak, and CI gate definitions.
- Added canonical Ed25519 release metadata verification, channel/platform/architecture/version pinning, artifact size/hash checks, bounded package extraction, safe-path checks, and active-session interlocks.
- Added atomic update staging/activation, health-check rollback, interrupted-start recovery, and application-version/user-data separation.
- Added local pinned Rive WASM staging with magic-byte and SHA-256 validation; no runtime CDN is required.
- Added persisted release-readiness API/UI, version diagnostics, role onboarding, and a Captain truth-label improvement queue. Improvement candidates retain metadata only and record `rawFramesRetained: false`.
- Added ADR 0018 for release authority and ADR 0019 for signed manifests/atomic rollback.

## 5. Reliability results

The release-tier replay executed the production B-4 engine against 33 deterministic synthetic cases. All 27 selected release attempts produced their expected outcomes. Twelve positive cases passed on the first synthetic scan and six locked/regression negative cases produced zero confirmed false accepts. The positive Wilson 95% lower bound was 75.75%; with only six locked/regression negatives, the rule-of-three false-accept upper bound is 50%. No guided-retry rate was invented because the corpus has no human retry pairs.

| Pilot                          | Profile        | Attempts | Positive | Expected non-success | False accepts | Result         | Release meaning                 |
| ------------------------------ | -------------- | -------: | -------: | -------------------: | ------------: | -------------- | ------------------------------- |
| Easy exact landmark            | Balanced       |        9 |      4/4 |                  5/5 |             0 | Synthetic pass | Not a real locked pilot dataset |
| Moderate natural location      | Strict         |        9 |      4/4 |                  5/5 |             0 | Synthetic pass | Not a real locked pilot dataset |
| Difficult confusable viewpoint | Story-critical |        9 |      4/4 |                  5/5 |             0 | Synthetic pass | Not a real locked pilot dataset |

Each synthetic pilot generated immutable build/package hashes and certification detail, but automatic eligibility remained false and only shadow operation is approved. The report hash is `sha256:750dedc76e59509057437cf4a65692ae0442755026757d18b8799bbb0c0cbcde`; the dataset manifest hash is `sha256:2aa5006b9c3352d17cdc62389a4b9b61b596bea670ee37d2ad4b4ea780e9843b`.

Real reference/build, calibration, validation, locked-positive, locked-negative, and strongest-confuser datasets for the three Sea of Thieves pilots do not exist. This prevents real false-accept, first-scan, guided-retry, and per-waypoint certification claims and fails the release reliability gate.

## 6. Performance results

Release replay on the available machine used the active `CPU_CLASSICAL` provider: 27 attempts in 2,068.63 ms wall time, runtime p50 44 ms, p95 56 ms, p99/max 61 ms. The provider reported the GPUs as detected but did not claim a GPU inference path.

The bounded soak executed 15 builds and 250 scans: 84 verified outcomes, 166 expected non-success outcomes, zero system errors, p95 53 ms, and RSS growth 257,368,064 bytes against a 268,435,456-byte budget. It passed the bounded synthetic budget with little memory headroom.

Test host: GIGABYTE AERO X16 1WH, Windows 11 Home build 26200, AMD Ryzen AI 7 350 with 16 logical processors, 33,413,779,456 bytes RAM, RTX 5070 Laptop GPU driver 32.0.16.1047, Radeon 860M driver 32.0.31021.5001, and 2048x1280 32-bit desktop. No native game process, GPU inference, thermals, game FPS impact, multi-monitor matrix, HDR, DPI matrix, sleep/resume, network interruption, or multi-hour field soak was measured.

## 7. Installer and updater

The x64 assisted, per-user NSIS development installer builds successfully, permits install-directory choice, defaults to preserving user data on uninstall, and offers an explicit local-data removal choice. The final local artifact was:

- `dist/Forever-Treasure-Companion-0.8.0-b6-x64-unsigned-development.exe`
- size: 244,642,005 bytes
- source commit: `919df0e2843c8c03759b0dfd644e4e77801e03b6`
- Authenticode: `NotSigned`; the development channel permits this state, while preview/stable builds reject missing signing credentials
- final pre-document-sync artifact SHA-256: `b616718af4ef0abb92086aa71aba8d4b44d19dc07c9c28c45d2009e4adb4df29`

The packaged smoke loaded shell `0.8.0-b6`, started the local Companion, used `ELECTRON_DESKTOP_CAPTURER`, selected a separate animated WinForms window, captured 14 frames, retained 9 evidence frames, cleared raw frames, and returned no fabricated verification decision.

Automated update tests pass signature/metadata tamper rejection, hash/length rejection, unsafe-path rejection, active-story deferral, atomic activation, failed-health rollback, and interrupted-activation recovery while keeping user projects outside the version store. Clean-machine install, upgrade from B-5, hosted update, interrupted download, disk exhaustion, multiple-account behavior, uninstall observation, repair, and signed rollback were not run. The default Electron icon remains open non-blocking issue B6-011.

## 8. Security review

Implemented and tested controls include exact loopback origin and pairing proof, replay closure, monotonic sequence/request IDs, bounded rate limiting, allowlisted desktop commands, context isolation, structured/redacted logs, Ed25519 scope pinning, package/hash/size/count/path limits, traversal rejection, temporary-file cleanup, active-session update interlocks, and user-data separation.

`npm audit --json` reported zero vulnerabilities across 938 dependency records: 0 critical, high, moderate, low, or informational findings. `npm ls --all --json` resolved without invalid dependencies after pinning direct `esbuild@0.28.1`; npm still reports five extraneous optional WASM helper packages in the optional dependency tree. The license inventory covered 704 unique packages; one undeclared package is inside a Pino test fixture, not the runtime application.

No independent security assessor reviewed the B-6 release candidate, no production certificate was available, and no signed clean-machine binary was tested. Security issue B6-009 remains open, so the release security gate is not approved despite the internal controls and zero current audit findings.

## 9. Privacy review

Runtime frames remain local and transient by default; the bounded ring zeroizes evicted/discarded data, selected evidence is minimal, scan cancellation and startup cleanup remove bounded temporary artifacts, and diagnostics/logging exclude pixels, secrets, window titles, and raw payloads. Creator recordings are explicit retained artifacts with integrity manifests and deletion support. Captain truth-label review creates metadata only and does not retain raw frames. No cloud-assisted build path is enabled; documentation discloses this status.

Automated privacy behavior passed, but no independent privacy validation or external participant comprehension study occurred. The B6-009 independent-review blocker therefore also prevents release privacy approval.

## 10. Usability and accessibility

Creator, Player, and Captain onboarding is role-specific, skippable, and revisitable. The readiness dashboard and onboarding flows pass automated axe WCAG 2 A/AA checks in Chromium and WebKit. Existing flows preserve keyboard operation, focus/labels, non-color status text, and reduced-motion behavior.

External participant count is zero. No technically comfortable outside Creator, non-technical Creator, accessibility-relevant participant, uninvolved Player, or uninvolved Captain ran the prescribed tasks. No System Usability Scale, completion-time, intervention, confidence, privacy-comprehension, or assistive-technology field data exists. The automated accessibility gate passes its enumerated checks; the external usability gate fails.

## 11. Automated tests

Authoritative final command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test-all.ps1 -SkipBrowserInstall
```

Result: exit 0 in 360.4 seconds.

- Formatting, ESLint, TypeScript: pass.
- Vitest: 37/37 files, 115/115 tests pass.
- Desktop bridge/update tests: 6/6 pass.
- Companion capture/runtime/security tests: 34/34 pass.
- SQLite migrations: all 11 apply to a clean database.
- Representative pre-B-6 migration, B-1/B-2/B-3 fixtures, B-5 production-engine fixture, additive platform backfill, and B-6 release foundation: pass.
- Playwright: 37 pass, 13 intentionally skipped WebKit-mobile mutation tests, 0 fail, across 50 enumerated tests.
- Accepted-state verification, seed preservation, production build, and production restart safety: pass.
- Release authority: verified `NO_GO`, 9 open blockers, 12 total issues, stable promotion false.
- Release replay/soak: synthetic gates pass, release eligibility false.
- `npm audit --json`: 0 vulnerabilities.
- Development x64 installer build: pass after Windows PowerShell 5.1 parser/runtime fixes.
- Packaged native-capture smoke: pass.

The workflow `.github/workflows/vision-release-gates.yml` defines fast and full Windows gates, but no hosted GitHub Actions execution was available in this session. That absence is B6-005.

## 12. Manual demonstrations

Local demonstrations completed: persisted readiness dashboard, role onboarding, metadata-only improvement review, production-engine synthetic replay, bounded soak, development installer build, packaged Electron startup/native capture, and automated atomic update/rollback exercises.

Not completed: full Creator workflow on a clean installed signed candidate; real correct-location, wrong-location, and difficult Sea of Thieves workflows; uninvolved Captain recovery; real offline play; and clean-machine update/rollback. No screenshots or videos are represented as if these demonstrations occurred.

## 13. Database and migrations

Added additive SQLite migration `20260719010000_vision_release_hardening_b6` and MySQL migration `0010_vision_release_hardening_b6`. Clean SQLite migration from B-1 through B-6 passed, and the representative pre-B-6 database proof preserved a published waypoint while adding conservative defaults: `certificationStatus=DRAFT` and `compatibilityStatus=NEEDS_RETEST`.

The isolated B-6 development database also applied all 11 migrations and ran the idempotent `awaiting-first-release` seed without resetting progress. The seed persists the `vision-b6-development-0.8.0` NO-GO authority, issues, compatibility rules, and dataset identity. MySQL syntax was authored and reviewed but not executed against a live MySQL server in this session.

## 14. Documentation produced

- Baseline, architecture/release governance, reliability/replay, hardware/performance, installation/update, security/privacy, distribution/game safety, external usability, final demonstration, runbook/rollback, development release notes, inventory, and this completion report.
- Creator, Player, Captain, Release Administrator, Developer Architecture, and Troubleshooting guides.
- ADR 0018 and ADR 0019.
- Machine-readable replay JSON/Markdown and bounded-soak evidence.
- Machine-readable issue register, compatibility policy, readiness record, error catalog, performance budgets, dataset manifest, and CI workflow.

## 15. Release checklist

| Gate          | Result                 | Evidence                                                                                                                           | Blocking reason if failed                                                                    |
| ------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Reliability   | FAIL                   | 27/27 synthetic expected outcomes; 0/6 locked/regression synthetic false accepts; statistical report generated                     | No real locked pilot datasets or real per-waypoint certification                             |
| Product       | FAIL                   | Automated B-5/B-6 Creator, Player, Captain, story, offline, immutable-version, and compatibility paths pass                        | Required real/clean-installed end-to-end demonstrations were not performed                   |
| Installation  | FAIL                   | x64 NSIS artifact and packaged launch/capture pass; signing state is accurate                                                      | Clean install/upgrade/uninstall/repair and production signing absent                         |
| Update        | FAIL                   | Manifest, integrity, interlock, atomic activation, recovery, rollback, and data separation pass automated tests                    | No signed hosted clean-machine update/rollback evidence                                      |
| Security      | FAIL                   | Internal hardening tests pass; npm audit has zero findings                                                                         | Independent review and signed-candidate test absent                                          |
| Privacy       | FAIL                   | Transient local frames, explicit retention/deletion, redacted logs, and cloud disclosure implemented/tested                        | Independent validation and participant comprehension absent                                  |
| Usability     | FAIL                   | Onboarding and role flows implemented; study protocol prepared                                                                     | Zero external participants                                                                   |
| Accessibility | PASS (automated scope) | Chromium/WebKit axe checks, keyboard/focus/labels, non-color status, reduced motion                                                | No enumerated critical automated defect; manual assistive-tech evidence remains a limitation |
| Documentation | PASS                   | All six required guides plus architecture, runbook, evidence, ADRs, and completion report exist                                    | None                                                                                         |
| Regression    | FAIL                   | Full local suite, migrations, seed preservation, production build/restart, shared interfaces, and published-version migration pass | The gate requires no known blocker; nine release blockers remain                             |

Release authority result: `NO_GO`. Stable promotion: false. Creator-preview promotion: false. Automatic progression: disabled.

## 16. Known limitations

- Synthetic mathematical fixtures are not Sea of Thieves field evidence.
- Only `CPU_CLASSICAL` is active; GPU capability is detection-only.
- No multi-hour, thermal, game-FPS-impact, sleep/resume, HDR, DPI, multi-monitor, or broad hardware matrix exists.
- No production Authenticode identity, timestamp, or signed release manifest exists.
- The current artifact uses the default Electron icon.
- Clean-machine install/update/uninstall/repair evidence is absent.
- Hosted CI evidence is absent.
- External usability and independent security/privacy evidence are absent.
- MySQL migration was not executed against a live server.
- The pre-document-sync artifact provenance records a dirty tree because the required B-6 documents were not yet committed.
- No public-release, anti-cheat compatibility, Microsoft/Rare affiliation, or endorsement claim is made.

## 17. External dependencies

The following cannot be completed from this local session alone:

- An approved Windows code-signing certificate, protected signing credentials, timestamp service, and release operator.
- Hosted artifact/update infrastructure and a signed prior/current candidate pair.
- Clean Windows machines/accounts and a broader supported hardware/display matrix.
- Real Sea of Thieves pilot capture corpora with consent, provenance, hashes, locked partitions, and strongest confusers.
- Outside Creator, Player, Captain, accessibility, security, and privacy participants/reviewers.
- Hosted GitHub Actions execution evidence.
- Product-owner/legal/policy clarification for distribution language and current Rare/Microsoft enforcement expectations.

These dependencies are tracked in B6-002, B6-003, B6-005 through B6-009, and B6-012. B6-011 is a non-blocking icon issue.

## 18. Rollback instructions

1. Stop active scans/builds and do not activate a pending release while a story or scan interlock is active.
2. Use the release manager's health-check rollback/startup recovery to restore application version `0.7.0-b5`; user projects and server data live outside the application version store and must not be deleted.
3. If reverting source, create a forward revert of `919df0e2843c8c03759b0dfd644e4e77801e03b6` and `eb8dc48badaca5847ac237a249b8026ec717905b`. Do not reset or discard unrelated work.
4. Reapply the prior schema/application pair only through the documented migration/backup procedure. The B-6 migration is additive; do not hand-delete release rows from a shared database.
5. Verify B-5 package/protocol compatibility, seed preservation, Player/Captain story state, and audit history after rollback.
6. If uninstalling the development build, preserve local data by default. Select explicit local-data removal only when that deletion is intended and backed up.

Detailed operator commands and failure handling are in `B6_Release_Runbook_and_Rollback.md` and `Guides/B6_Release_Admin_Guide.md`.

## 19. Final determination

`PHASE B-6 NOT COMPLETE — RELEASE GATES FAILED`

The local implementation is materially hardened and its automated foundation passes, but the release cannot close while real reliability, clean-machine/signing/update, hardware/field, external usability, and independent security/privacy gates remain unproven.
