---
title: Crossdeck spatial experience refit and qualification
audience: product-engineering
status: current
canonical_for: crossdeck-spatial-experience-refit-20261011
last_reviewed: 2026-10-11
---

# Crossdeck spatial experience refit

This engineering record covers contextual connection from the active Chronicle
and useful personal companion purposes. The inspected protected baseline is
`6d13c357be93514c94e7f36db1a8c930265e65e2`. The refit is a local candidate;
protected qualification, integration, final rendered review and owner acceptance
remain pending. Owner acceptance is `NOT_CLAIMED`.

The existing [Phase 2 receipt](Phase_2_Implementation_Record.md),
[transport closure](Realtime_Transport_Protected_Closure_20261011.md) and
[Product Experience activation closure](../../Testing/Product_Experience/Activation_Closure.md)
retain their exact historical source and acceptance scope. Activation of the
verification mechanism does not accept this refit's experience.

## Baseline findings

The task-owned production-browser audit exercised desktop 1440×1000, phone
390×844 and medium 820×1180 presentation, normal and reduced motion, interrupted
connectivity and reload. It retained 15 numbered checkpoints, including a second
capture of checkpoint 11: 16 PNG files, eight recordings and two traces under
`artifacts/crossdeck/refit-baseline`. These are local diagnostic artifacts.

| Observed condition                                        | Evidence and scope                                                                                                                                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ordinary connection required an account-management detour | The Journal's Devices link led to Harbor setup, a device-name form and a long role/settings surface before pairing.                                                                                      |
| The selected Lens purpose returned to generic Journal     | The phone continued to the full Journal with Journal tools. The baseline synthetic edition contained no released spatial moment; this distinguishes the navigation defect from missing authored content. |
| Transfer controls competed with the reading task          | Expanded transfer controls occupied the Chronicle header rather than a bounded companion action area.                                                                                                    |
| Receive did not visibly present the promised Chart        | The normal-motion receive attempt did not produce the expected visible canonical Chart; checkpoint 11 and the traces retain the failed observation. A successful command alone is insufficient.          |
| Shared-display audit was incomplete                       | The later shared-display step timed out. No baseline shared-display or revocation success is inferred.                                                                                                   |

The baseline's offline, reduced-motion and reload captures document appearance
at those checkpoints. They do not establish physical-phone behavior, independent
accessibility acceptance or complete recovery correctness.

## Experience and ownership

The primary Chronicle retains the book and one contextual **Connect another
device** control. A focused **Bring your phone aboard** dialog presents scan/code
joining guidance and **Continue the Chronicle** returns to the same reading task.
Personal Harbor remains the account/device security destination.

The authorized companion route `/devices/companion?voyage=<id>` resolves the
current account session's own tab-local surface before mounting a presentation.
It is not an identity or progression authority. Purpose labels come from the
existing Crossdeck role taxonomy and are checked against released content.

| Purpose                                                                 | Consumer and authority                                                         | Current boundary                                                                                                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chronicle Lens                                                          | Canonical Parallax `ChronicleLens` and its authorized binding/interaction APIs | A released spatial moment opens its actual clue; Guided View remains useful without a camera. Native camera/tracking capability is separately governed. |
| Voyage Chart                                                            | Canonical Landfall Journal provider and Chart                                  | Shows the actual released Chart and current objective. Ordinary Chronicle progress remains One Voyage authority.                                        |
| Journal companion                                                       | Canonical Journal passage projection and `PageContent`                         | Reads complete released content with standard/larger reading size and a direct return. Companion reading does not write primary reading state.          |
| Artifact viewer                                                         | Canonical released artifact projection                                         | A released artifact has its own readable presentation; unreleased content is unavailable.                                                               |
| Continue the Chronicle                                                  | Existing authorized Player Journal route                                       | Returns to the full Chronicle in the same Voyage and immutable edition.                                                                                 |
| Crew display                                                            | Existing restricted `CrossdeckDisplay` projection                              | Does not mount the private Journal. Only explicitly crew-shared content can be shown.                                                                   |
| Atmosphere, Captain companion, Accessibility companion, Creator preview | Preserved role names with explicit availability reasons                        | Dedicated consumers are unavailable; the refit does not claim these capabilities.                                                                       |

Wayfarer/Homeport owns person, account session and registered-device authority.
Crossdeck owns surface participation, purpose changes, pairing, custody and
handoff. Sextant owns capability truth; Parallax owns Lens/spatial meaning;
Landfall owns Chart/worldspace meaning; One Voyage owns progression. The refit
adds no competing login, spatial runtime, Chart store or progression writer.

## Transport, safety and receiving

The committed-change SSE notification, monotonic durable revisions, authorized
HTTP/CSRF commands, nominal ten-second active reconciliation and recovery rules
retain their existing contracts. The reusable client session hook centralizes
surface registration, authorized projection, stream/reconciliation lifetime and
disconnect cleanup across the primary and companion presentations.

An accepted transfer must resolve the actual receiving object/view before the
existing acknowledgement is sent. The companion's receiving bridge selects the
canonical released passage and waits for the relevant Lens or Chart presentation;
failed rendering remains recoverable. Private-note confirmation, replay rejection,
surface/session ownership, access revocation and shared-display privacy remain
enforced by the existing domain services. The refit does not introduce Air
Handoff, raw account identifiers in product HTML or new sensor acquisition.

Background presentation following is now limited to the selected purpose's
content family. Returning explicitly to the Journal therefore cannot be
overridden by an older background MAP projection. An explicitly accepted
handoff still resolves its requested content through the receiving bridge;
this background filter does not gate acceptance or acknowledge an unseen view.

## Qualification and prerequisites

`spatial-pilot.experience`, `homeport.shell.crossdeck-companion`,
`crossdeck.phase2.continuity` and `crossdeck.refit.companion` in
`testing/contracts.json` describe visible connect, purpose, Lens, Chart, artifact,
Journal, actual published-clue inspection, contextual library exit and return outcomes. They require normal/reduced motion, desktop/mobile,
keyboard/accessibility, real screenshots/recordings and stable Voyage/edition
witnesses. Independent criticism must cover all 17 governed review dimensions.
`tests/e2e/crossdeck-experience-refit.spec.ts` owns the actual two-context pairing,
handoff, recovery and privacy journey; a single-context capture does not replace it.

`tests/e2e/crossdeck-refit-recovery.spec.ts` adds deliberately injected expired
pairing/transfer, cancellation, unavailable-content and restricted shared-screen
cases in its own synthetic fixture. Its current-source result remains pending.
`PE-DEBT-CROSSDECK-LENS` retains its original ID and fingerprint in the existing
intent and Homeport nonconformity ledger. It is not closed or waived before
independent exact-source repair evidence and qualification.

The smallest fixture adapter provisions one persisted private synthetic edition,
released spatial moment, Chart, letter and artifact, with two canonical account
sessions of the same person and distinct authorized surfaces. It accepts only
the existing generic profile's task-owned, nonce-bound SQLite path and identity
marker. The capture checks authoritative account/session/Player membership
through the existing APIs before and after the visible journey. Evidence stores
hashed identity witnesses; private setup tokens are not archived as fixture files.

Protected authority at baseline `6d13c357` does not contain this isolated role
fixture adapter. Candidate-helper diagnostics can run locally after the final
build and candidate freeze, but cannot qualify the refit against an unchanged
protected helper. Trusted-helper availability is a prerequisite; no candidate
runner substitution, policy downgrade or acceptance bypass is authorized.

| Evidence boundary                                        | Current result                                                                                                                                                                    |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline human journey                                   | Captured; Chart receiving defect and incomplete shared audit retained.                                                                                                            |
| Focused source tests                                     | Reported batch: 14 files / 150 product tests passed in 57.39 s; Product Experience helper/policy regression passed 44 tests. Exact final-source qualification remains pending.    |
| Production build                                         | Latest local build passed: compilation 21.1 s and TypeScript 15.5 s in `artifacts/crossdeck/review-candidate-build.log`. Frozen candidate/source qualification remains pending.   |
| Actual two-context refit journey                         | Latest core journeys passed normal motion in 33.3 s and reduced motion in 60 s. The remaining four-spec/seven-test batch is pending; the preceding failed batch remains retained. |
| Frozen candidate capture                                 | Pending; candidate helper is local diagnostic authority only.                                                                                                                     |
| Independent 17-dimension rendered criticism              | Pending.                                                                                                                                                                          |
| Ordinary protected Sounding Line and integration         | Pending; protected-helper prerequisite unresolved.                                                                                                                                |
| Landed smoke                                             | Pending integration.                                                                                                                                                              |
| Physical phone/native camera/production/owner acceptance | Not established; owner `NOT_CLAIMED`.                                                                                                                                             |

Final candidate, base/tree, capture packet, reviewer identity, protected run and
landed proof will be recorded only when available. The
[efficiency ledger](Spatial_Experience_Refit_Efficiency_20261011.md) records actual
measurements and unavailable counters without billing estimates.

The final preparation fetch confirmed `origin/main` remains the inspected
protected baseline `6d13c357be93514c94e7f36db1a8c930265e65e2`.

The current Homeport route inventory and both screen catalogs now record
`/devices/companion` and `/devices/display` using the canonical source-derived
route/screen IDs, actual immersive Player shell and `/player/library` exit.
Their new visual maturity remains pending exact-source evidence and independent
review. Historical source identities and accepted records are preserved. The
older Phase 5/6 whole-product census still represents 109 pages, while current
source has 128; this bounded amendment does not resolve or claim that broader
pre-existing source-parity gap.

An intermediate rebuild compiled, then failed TypeScript on the route owner
classification and two new compact-control test props. Those source defects were
corrected before the next rebuild; the failed intermediate build remains failed.

The preceding seven-test browser batch took 346.297 s. Its failures exposed a
deferred hook update overwriting a user-entered device label, an ambiguous label
in a legacy journey and a recovery harness hash assertion. The hook has a repair
and regression check, the product control has a specific accessible label, and
the harness assertion was corrected. These repairs do not reclassify that failed
batch; current-source rerun, final capture and independent review remain pending.
