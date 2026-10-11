---
title: Project Sextant Phase 3 implementation receipt
audience: product-engineering
status: local-candidate-qualification
canonical_for: sextant-phase3-implementation-receipt
last_reviewed: 2026-10-11
---

# Sextant Phase 3 - Read the Field

This isolated candidate implements the software plateau in Sextant v1.0 section 55.3, read with the effective Spatial Experience authority and Sextant v1.1 Reach amendment. It starts at protected-main `2e367c372a6d44e4e6a68bb38266196954f8d486` on `sextant/phase-3-read-the-field`. Phases 1-2 and correction PR #695 remain the protected baseline. This record does not grant mainline, deployment, RELEASE_GO, native parity or physical acceptance.

## Requirement to evidence

| Section 55.3 obligation                        | Delivered source and focused proof                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Magnetic provider semantics                    | `src/sextant/field-provider.ts`: optional secure-context Magnetometer adapter, device-frame microtesla, bounded sampling, LOW/UNKNOWN calibration and explicit receipt-time provenance. `phase3.test.ts` covers absent APIs, malformed readings, provenance and cleanup. No browser API is invented.                                                                                                                             |
| Calibration, disturbance, baseline and anomaly | `field-context.ts`: quality/calibration gates, monotonic continuity, stable multi-sample baseline, baseline age, disturbed-field refusal and trend. D0 magnetic-baseline-trend / magnetic-disturbance; tests reject spikes, bad calibration, frame/source/generation changes and nonfinite input.                                                                                                                                |
| Pressure and relative elevation                | `field-context.ts`, `field-provider.ts`: short-lived pressure reference, delta in meters, weather/door/HVAC ambiguity warning, explicit revalidation. D0 pressure-relative-climb / pressure-weather-drift. It supplies neither absolute altitude nor floor truth.                                                                                                                                                                |
| Supported steps/pedometer                      | `PedometerContext`: OS/accessory counter only, generation/reset/pause/freshness, plausible count rate, optional stride with paired uncertainty. D0 pedometer-pause-restart. Web exposes the semantic contract as FOUNDATION_ONLY, not a fabricated step sensor.                                                                                                                                                                  |
| Camera/microphone declarations                 | `media-capability.ts`, `advanced-web.ts`: purpose/consent/support/permission/busy distinction, compatible shared resource leases, cancellation, revocation, expiry, source geometry and generation changes. D1 media-denied-busy / media-shared-cleanup / media-source-generation. Factory/track ownership remains with Reach, Parallax or other authorized consumers; no parallel capture or perception pipeline.               |
| BLE capability and sessions                    | `nearby.ts`: secure-context user chooser, UUID service allowlist, bounded TTL/concurrency/operations/payloads and disconnect cleanup. Writes require application-authenticated policy plus a live owner authenticator. D1 web-ble-denied / web-ble-disconnect / web-nearby-background. RSSI is not distance; no inventory or presence proof.                                                                                     |
| NFC read foundation and rules                  | `nearby.ts`: optional NDEFReader, bounded foreground abortable read, strict envelope plus consumer payload schema, no URL execution or serial-number projection. D1 web-nfc-strict-read / web-nfc-malformed and injection/late callback tests. Write support is explicitly unavailable.                                                                                                                                          |
| UWB/ranging and secure peer                    | `SecureRangingSession`: owner authentication callback, strict expiring purpose/surface/consumer-bound peer, authenticated OOB/security mode, replay-resistant nonce/sequence/generation, distance uncertainty, local frame and dropout failure. D0 nearby-peer-replay plus mutation/security tests. Native UWB transport remains Phase 4; no global position or authoritative arrival.                                           |
| Magnetic reference mechanic and safety         | `MagneticHunt`, `runtime.beginMagneticHunt`, `MagneticHuntControls`: weak enclosed distant prop declaration, safety acknowledgment, stable calibration and sustained local signal, timeout, pause and always-visible screen clue. Signal emits local reference guidance only; One Voyage/owner requalification retains progression. Component tests cover accessible fallback and cleanup.                                       |
| Creator/Drydock schemas                        | `requirements.ts`, `src/drydock/sextant-capabilities.ts`, registered `voyagewright.sextant` extension: strict version/range/quality/purpose, preferred versus restricted-required capability, audience/profile/preplay disclosure and all four fallback scenarios. Actual immutable Drydock block parser roundtrip and existing-content compatibility tests. Simulation never qualifies physical hardware or writes progression. |
| Capability-gated web support                   | `web-runtime.ts`, `advanced-web.ts`, additive capability definitions: runtime detects actual APIs, keeps unsupported states and purpose/foreground controls. Existing 30 version-1 values remain compatible; four rich semantics are additive. No required upgrade of accepted Player content.                                                                                                                                   |
| D0-D2 where available, privacy/threat          | Sixteen new shared Device Lab scenarios (eight D0 and eight D1), retained earlier twenty, source-bound v2 receipts and cleanup; `phase3.test.ts` covers denial/revoke, late callbacks, resource limits, raw/identifier privacy, malformed input, replay and consumer failure. D2 is unavailable locally (no Android SDK/adb); D0/D1 are never promoted to D2/D4/D5.                                                              |

## Integration and operating limits

Reuse one `webSextantRuntime(window, navigator)` per active surface. Its `advanced` context composes field/media/nearby lifecycle with foreground, pause and dispose; returning to foreground never reacquires without a new user action. Camera/microphone consumers supply and own their existing capture resource factory. Compatible sharing requires the same source key, purpose, surface and expiry; one consumer release does not stop other consumers. Source/geometry/thermal/revocation invalidation ends leases and advances source generation. Generation is capability provenance, not hand/perception intent or Crossdeck pairing.

Media and nearby leases are at most sixty seconds with ten-second acquisition bounds. Nearby sessions allow two concurrent sessions, at least one second between starts, and sixty-four operations. BLE reads/writes are bounded to 4096 bytes; NFC allows up to eight records, at most 2048 bytes each and 4096 aggregate. Diagnostics retain counts and states, never raw media, radio inventory, NFC serials, purposes or biometric identity. Callbacks and native owners must uphold their own secrecy and authentication requirements; Sextant does not implement Crossdeck authentication or execute tags.

Reference thresholds are conservative software policy, not a physical accuracy guarantee: magnetic baseline uses five samples over at least 800ms within 5 microtesla, field magnitude outside 5-200 microtesla is unusable, baseline expires after sixty seconds. Pressure baseline uses five samples over 800ms within 0.2 hPa, revalidates after 120 seconds and refuses over 200m of relative change. Weather drift cannot be distinguished from motion by pressure alone. A web Magnetometer does not expose trustworthy calibration metadata here, so it stays LOW/UNKNOWN and cannot satisfy a MEDIUM calibrated hunt; use the screen clue. OS/native/accessory adapters must provide qualified provenance before those features can guide a player.

Owner authentication is a required trusted integration seam, not a claim that a boolean label establishes identity. Ranging consumers must authenticate their actual peer and maintain that verification; BLE write callers supply a live owner authenticator. No exact RSSI distance, global position, presence, artifact identity, floor, person identity or authoritative progression is inferred.

## Development evidence and final checks

Development evidence is retained under ignored `artifacts-*` logs and `artifacts/sextant-device-lab` in the owned checkout. Initial setup failures were resolved through locked dependency installation and Prisma generation. Initial fixture failures corrected bounded consent expiry, type annotation and complete Drydock image configuration. The shared source-binding fixture used a Windows drive path in `--import`; converting it to a file URL repairs execution without weakening source-fingerprint assertions. A broad shared run later hit an existing Landfall subprocess timeout; isolated rerun and final candidate qualification are recorded at closeout, rather than concealing the attempt.

Final local qualification and exact candidate identity are recorded in the closeout section below. Ordinary Sounding Line retains acceptance authority. Protected PR qualification and landed smoke have not been requested or performed.

### Candidate closeout evidence

The common Windows source-binding fixture correction is isolated as `f5c34d5bd38a8bb5588da32cbaa4f4cfb09f989c`; it changes only the loader argument in `src/device-lab/device-lab.test.ts`, test "binds future receipts to changes in shared scripts and governing registry bytes." The implementation commit is `6eebad0623edc5a4debd23eead05a0cd43093873`, with the same implementation tree as preserved local development checkpoint `5c34f76f66fd46bda84af16c7cf4fb4703b8e9a5`.

- Focused Sextant/shared Device Lab/Drydock contracts: 296 tests in thirteen files pass (`artifacts-focused-final.log`). The final security expansion passes all 49 Phase 3 tests (`artifacts-phase3-security-final.log`), adding two owner-authentication/failure-cleanup regressions.
- Sextant Device Lab CLI: thirty-six retained/additive D0/D1 scenarios pass with source-bound receipts and cleanup. The repeat in `artifacts-device-lab-final-source.log` binds the isolated implementation commit `6eebad0623edc5a4debd23eead05a0cd43093873`; earlier development receipts and `artifacts-device-lab.log` remain preserved. Pending documentation changes are reported as dirty; no source or tier is relabeled.
- Documentation index and validation, catalog generation and validation pass. Catalog completion is conditional on final local acceptance; no mainline promotion is claimed.
- The wider shared run passes 403 tests but fails the incomplete image fixture and an existing thirty-second Landfall OS-only wrapper timeout. The image fixture is corrected and passes the real block parser. Landfall's isolated wrapper also times out; its direct CLI finishes with exactly one unsupported case, zero failures/progression and clean owned resources (`artifacts-landfall-direct.log`). The wrapper timeout is retained as an environmental qualification limitation, not converted into a pass.
- Full standalone TypeScript passes (`artifacts-typecheck-escalated.log`). An initial stalled compiler was terminated only after verifying its owned command/path; no sibling process was stopped. A subsequent canonical `npx --no-install tsc --noEmit` also exits zero after the owner computer restart (`artifacts-typecheck-canonical-command.log`).
- An initial `npm run test:changed` invocation lost explicit flags under this Windows npm invocation; it was stopped and is not accepted evidence. The direct canonical candidate run reports `FAIL` at TypeScript preflight with no compiler diagnostics, after formatting, lint and Prisma generation pass. This coincides with the owner restart and execution-service disconnection; the failure is preserved in `artifacts/sounding-line/pre-restart-ordinary-decision.json`, not waived or recategorized. The same TypeScript command passes after reconnection. Final results remain pending until the resumed governing decision exists.
- The later isolated Landfall retry could not start a Vitest worker within sixty seconds and ran no tests (`artifacts-landfall-isolated-after-load.log`). Host pressure and earlier thirty-second wrapper timeouts remain development evidence; they do not count as passes.
- After restart, the parent assigned Sextant the first shared heavy-testing slot under UNATTENDED_CONTINUATION. Qualification runs one heavy job at a time, uses only supported runner concurrency controls, and does not alter OS priorities, security or game/sibling processes. The governing decision remains required before catalog completion.

### Media generation-isolation correction

Final source review found that a delayed denial from an old acquisition could change the permission of a newer granted source, and a queued old track-ended callback could stop that newer source. Listener registration could also end synchronously before its returned detach function was stored for cleanup. Three focused regression cases fail before the correction (`artifacts-media-race-before.log`) and pass after it (`artifacts-media-race-after.log`).

`media-capability.ts` now binds synchronous/asynchronous failure handling and track-ended callbacks to the current slot identity before mutating permission, availability or generation. It immediately detaches the returned listener if the source ends during registration. This preserves current grants/leases against old callbacks without changing sharing, consent or source ownership. Reach's separate camera lease should apply the same generation-isolation and registration-cleanup invariants; this task does not edit its implementation.

The correction is committed as `8a196dfa0080b4dc266d540ab7bf94aeaecdfdf0`. All fifty-two Phase 3 tests pass after the correction with one worker (`artifacts-phase3-after-generation-fix.log`); the three before/after regression logs remain preserved. This focused result does not replace the pending corrected-source aggregate decision.

The resumed aggregate on `be8d70c732e6821e27b1285e89da8a908dab8454` was intentionally stopped for this source correction and is not complete qualification. Its controller and positively identified retained Vitest descendants were cleaned; no sibling/game process was stopped. The parent reassigned the heavy slot while Sextant completed focused correction checks. No further aggregate begins until the parent grants the slot. Final-head TypeScript and ordinary qualification remain required for the corrected source.

### Corrected-head qualification and resource-control boundary

The parent granted slot B at 04:53 UTC with two total heavy jobs and one worker per job. The canonical ordinary run on clean `7b01ce612f1f4d18f781f643a44e59a0328bf0e8` started at `2026-10-11T04:54:04.146Z`, using `SEALED_HOLD_SINGLE_FORK=1` and `VITEST_MAX_WORKERS=1`. Read-only process inspection confirmed one owned Vitest fork. Formatting, ESLint, full TypeScript, the private-content scan and Prisma validation passed. Both selected product batches passed: 721 tests in 114 files and 780 tests in 127 files, totaling 1,501 tests in 241 files, including the unchanged Landfall provider regression file. All 58 Sounding Line verification tests also passed. No previous timeout was waived.

The selected isolated Admiralty journey build compiled and completed its build-time TypeScript check, then reported fifteen page-data workers. Those workers exceeded the requested cap. The build had already finished when the verified stop check ran; no process was stopped by that check. The subsequently verified owned journey harness and its descendants were stopped to prevent later uncapped builds. No sibling/game process was stopped. The ordinary controller completed at `2026-10-11T05:23:37.482Z` with `FAIL`, category `PRODUCT_FAILURE`, error `SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED`. This is the canonical recorded result; it is not reclassified or accepted as a pass. Browser qualification and the overall ordinary gate remain incomplete. Evidence is preserved in `artifacts-sounding-line-corrected-head.log`, `artifacts/sounding-line/corrected-head-worker-cap-decision.json` and the owned process/stop records in that directory.

The subsequent single-process Sextant Device Lab replay passed all thirty-six D0/D1 scenarios on the unchanged clean `7b01ce612f1f4d18f781f643a44e59a0328bf0e8`. The source-bound v2 receipts report `dirty: false`, the exact source SHA/tree/fingerprint, synthetic fidelity and passing cleanup with no remaining resources (`artifacts-device-lab-corrected-head.log`, `artifacts/sextant-device-lab`). Slot B was released at 05:25 UTC after a fresh process check found no remaining owned-path Node process. D2 is still unavailable and no physical tier is promoted.

Shared resource correction `81840185c2fb21ee360ff3515923dfece314451c` adds only an opt-in `experimental.cpus: 1` setting in `next.config.ts` when the existing one-worker validation flag is enabled. The installed Next worker-selection code honors that supported configuration. Direct config evaluation with the flag disabled and enabled, plus formatting, passes; an actual capped build and renewed final-head ordinary decision remain required. The correction changes no tests, timeouts, selection or OS settings. Catalog completion remains blocked until local acceptance passes. No further heavy job starts without a new slot grant.

Light closeout documentation indexing/validation and catalog generation/validation pass (`artifacts-phase3-closeout-docs.log`, `artifacts-phase3-closeout-features.log`). The generated inventory reflects the refreshed protected-main documentation baseline. The catalog retains sixty-two existing entries and adds no premature Phase 3 completion entry.

Protected main was refreshed after the attempt and verified at `7284b0dfaa31037d074d27df0f27b968f3977000`, containing merged Reach PR #697. Its Sextant-owned `BrowserCameraBroker` uses generation guards for stale denial/ended callbacks and rejects synchronous source termination during listener registration. Phase 3 media declarations acquire no stream themselves and preserve this owner factory boundary. The refreshed main has seventy-two Device Lab scenarios, including seventeen Reach scenarios; combining its accepted Reach additions with this candidate's sixteen new Sextant scenarios requires eighty-eight total, seventy-one non-Reach and seventeen Reach. The shared loader file-URL correction is already present upstream. Registry/count assertions, test registrations, generated index/inventory and changelog must be reconciled against that source before final integration qualification; the active tested candidate was not mutated or represented as a combined-main test.

## Native task and concurrent integration

### Local reconciliation with accepted Reach

After slot B was granted again, protected main was independently refreshed and remained `7284b0dfaa31037d074d27df0f27b968f3977000`. It was reconciled locally in the owned branch while preserving the earlier tested commits and receipts. Additive conflicts were resolved by retaining both changelog entries and both contract registrations, and by a strict union of scenario IDs that refuses differing common declarations. The combined registry has eighty-eight declarations, seventy-one non-Reach and seventeen Reach. Sextant has forty declarations (twenty-four baseline plus sixteen Phase 3 additions), distinct from its thirty-six executable CLI scenarios. Count assertions preserve that distinction and every accepted Reach entry.

`src/sextant/camera.ts` and `src/reach/browser-runtime.ts` are identical to the accepted main source. A new Phase 3 integration case exercises the actual accepted `BrowserCameraBroker` through the consumer factory seam: two compatible declaration leases call one capture factory and one `getUserMedia`, a competing broker is refused, and background suspension stops the owned track once. The focused reconciliation run passes all sixty-six tests in three files (`artifacts-phase3-reach-reconciliation.log`). It is preparation evidence; previous qualification remains historical unless canonical reuse accepts it. The reconciled candidate requires a new source-bound ordinary decision and actual one-worker build proof.

The native title and request marker were reconciled on this newly owned task. VoyageWright project `fd21b701-3215-417a-a413-0a17e02badbb` exists, but durable readback reports `projectId: null`; local sidebar membership is unverified. Native Goal mutation/readback is not callable. The parent native messaging route returns thread-not-found, so no outbound coordination success is claimed. These metadata gaps do not prevent isolated software implementation. The durable task is `01a1287c-8f80-7366-a379-4939d974a032`, marker `ld-Sentinel_ced57a02aaf0819185ccbb151fe64653-sextant-p3`.

Concurrent Crossdeck, Parallax and Reach must reconcile additive Device Lab registry, test registrations, Drydock extension registration and generated documentation/catalog. There are no database migrations, package/lockfile changes or dependencies on another task's unmerged source. Reach owns hand providers/webcam/calibration and target intent; Sextant owns capability state/lease/lifecycle only. Accepted Landfall and original Sextant contracts remain intact.

### Reconciled candidate qualification - blocked

The frozen clean candidate is `239ee9a6e28c7b5a959efb87ada3351305ef8f87`, tree `e10a957f1c6fc74cf3a96212e8ddd299b9f9f5d4`, against protected-main `7284b0dfaa31037d074d27df0f27b968f3977000`. The canonical ordinary run began at 05:48:44 UTC and recorded `FAIL`, category `PRODUCT_FAILURE`, at 06:39:28 UTC on 2026-10-11. This is an incomplete failed attempt, not software acceptance. The exact decision is preserved in `artifacts/sounding-line/reconciled-cap-ordinary-decision.json`; the full output is `artifacts-sounding-line-reconciled-cap.log`.

The unchanged canonical invocation was `node scripts/sounding-line/ordinary.mjs --mode ordinary --base 7284b0dfaa31037d074d27df0f27b968f3977000 --candidate 239ee9a6e28c7b5a959efb87ada3351305ef8f87`, with task-local `SEALED_HOLD_SINGLE_FORK=1` and `VITEST_MAX_WORKERS=1`. The opt-in Next correction is now proven by actual production builds: all three logged page-data collections explicitly use one worker. No OS priority, security setting, test time limit, viewport or assertion was changed.

| Check                                                                 | Reconciled candidate result                                                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format, ESLint, TypeScript, private-source scan and Prisma validation | PASS                                                                                                                                               |
| Product unit batches                                                  | PASS: 719 + 795 = 1,514 tests, 114 + 131 = 245 files                                                                                               |
| Sounding Line runner tests                                            | PASS: 58 tests                                                                                                                                     |
| Dedicated browser profiles before Lanternwake                         | PASS: Admiralty 2, subsequent isolated profiles 4, 1 and 1; one Playwright worker                                                                  |
| Capped production builds                                              | PASS: compile, one-worker page collection and route generation, including accepted Reach routes                                                    |
| Lanternwake selected browser batch                                    | FAIL/incomplete: fifteen completed failing cases were observed before ending the attempt; later selected cases are unqualified                     |
| Sextant Device Lab replay on the same clean candidate                 | PASS: all 36 executable scenarios, 21 D0 and 15 D1; source identity matches the candidate, all cleanup receipts PASS with zero remaining resources |

The browser failure evidence is concrete:

- `2560x1440 replay`: `phase3-accessibility-viewports.spec.ts:600` expects `JOURNAL_READY` after replay, but receives `BOOK_SETTLING` at the unchanged ten-second assertion boundary.
- All thirteen `390x844` flows: `openReadableJournal` at line 333 loses `.chronicle-journal-shell` after the existing forced skip click; the captured page is the Chronicle Library. This is not a passing accessibility result.
- `844x390 journal-first-opening`: line 313 cannot click `Open the journal` within the existing 180-second test limit because `.shell-contextual-navigation` repeatedly intercepts pointer events.

Completed failure traces, screenshots and page snapshots are preserved under `artifacts/sounding-line/reconciled-browser-failures`. The test, journal renderer, opening-machine and Player styles are byte-identical to the protected-main base; this establishes that those files were not modified by Sextant, but does not establish that a separately executed baseline passes or fails. Root-cause repair and a source-bound baseline comparison remain necessary before any aggregate acceptance claim. Required checks are neither waived nor relabeled as an environment problem.

After the real browser failures were retained, only the freshly verified owned Playwright CLI subtree was stopped to bound the failed attempt and release the shared resource slot. The ordinary controller subsequently recorded `SOUNDING_LINE_PRODUCT_FAILURE:VERIFICATION_COMMAND_FAILED` with browser `PLAYWRIGHT_EXITED`. This stop is part of the failed-attempt provenance; it is not a complete execution of the remaining selected suite. The source-bound Sextant CLI replay followed sequentially (`artifacts-device-lab-reconciled-head.log`). At 06:40:06 UTC, fresh process readback found zero owned-path Node processes and no frozen controller (`reconciled-cleanup-summary.json`); slot B was released.

Feature Catalog: BLOCKED. No branch-complete entry is added while the required ordinary gate fails. The final closeout commit contains documentation only; the final clean-head Device Lab replay and documentation checks are retained separately. The implementation candidate's failed ordinary decision remains authoritative and is not replaced by documentation-only proof. No push, PR, protected-main merge, deployment, release or publication occurred.

### Minimal baseline compatibility recovery

The parent resumed unfinished qualification and reassigned slot B. A separate owned detached worktree executed only the three failing viewport cases on untouched protected-main `7284b0dfaa31037d074d27df0f27b968f3977000`, with a clean Git readback and its own declared isolation database. All three failures reproduced: desktop replay remained at `BOOK_SETTLING`, portrait skip navigated to the Library, and landscape opening was intercepted by contextual navigation. The fixture setup passed. Baseline source was not patched; task-local `CIRCLE_NODE_TOTAL=1` supplies the installed Next runtime's one-worker default. An initial dependency junction was rejected by Turbopack's filesystem-root guard; a local copy of the locked dependencies resolved setup without changing product source. Baseline evidence is retained under `artifacts/sounding-line/lanternwake-baseline-comparison`.

The compatibility repair is deliberately limited to two shared files, reported before edits. `src/styles/chronicle.css` raises the route only while its owned opening modal is present and bounds/wraps opening controls to the viewport. It does not alter the persistent Journal design, renderer, Crossdeck, progression or animation durations. The isolated CSS commit is `1d01b069d8895b6981409ade410ca616cd8f2997` (`fix(journal): keep owned opening dialogs reachable above shell navigation`).

`tests/e2e/phase3-accessibility-viewports.spec.ts` awaits the asynchronously mounted replay control before a normal actionable click. It removes forced opening/replay clicks, requires the same `JOURNAL_READY` destination, and accepts a disappeared control only if that destination is already reached. The replay poll and click share the previous two-click five-second action budget; final readiness assertions, the 180-second test limit, all viewport cases and accessibility assertions remain intact. This stronger actionability repair is isolated in `e892a139ef1079190bc331e1a02b7217864e962f`.

On the same clean repaired candidate, all three targeted cases pass, with one build/test worker and successful cleanup (`artifacts/sounding-line/lanternwake-repaired-comparison`). This establishes concrete protected-main red / repaired-candidate green proof for the original signatures. A malformed manually entered fixture filename was rejected before test execution on the first repaired invocation; the subsequent invocation derives the guarded path from the exact candidate SHA and retains the rejected setup log. No required check or fixture guard was weakened. Full ordinary qualification of the next frozen candidate remains pending at this checkpoint; the earlier failed ordinary decisions remain preserved history.

### Successful recovery and accepted-main reconciliation

Clean `04be433d824230290ea8e26e2f9b1ebe60469bb4` passed ordinary Sounding Line at
`2026-10-11T07:24:12.739Z`: 1,639 product tests in 263 files, all 78 selected
viewport cases, formatting, ESLint, full TypeScript, private-content scanning and
production build. The canonical finalizer closed ten required obligations with
zero remainder (seven fresh, three legitimately rebound). Evidence:
`artifacts/sounding-line/recovery-candidate-ordinary-decision.json` and
`artifacts-sounding-line-recovery-candidate.log`. All 36 clean source-bound
Sextant D0/D1 scenarios passed on that same candidate.

The additional seven-file browser comparison completed 34 of 35 cases successfully
on that candidate. Its performance case failed before measurement because a Node
`perf_hooks` import was serialized into a browser callback. Untouched accepted
Crossdeck main `d4f67cb8981d2834c3c614df221b74fa851b02eb` reproduced that error.
An exploratory clock-only repair on `9d894af623a3ed30c76cd11207e2e056123ac000`
then exposed a second stale assumption: the benchmark requires retired Companion
`forever:progression-receipt` events and six-section navigation, while the accepted
canonical journal deliberately has neither. Current event/motion/lifecycle tests
and the final Lanternwake performance report use canonical bounded ownership and
cleanup. Reverting the exploratory change restores the benchmark byte-for-byte
to accepted main; no new test omission, timeout, budget change or synthetic
performance pass is introduced. This optional historical benchmark is not a
completed production duration certification. Its failure remains preserved in
`artifacts/sounding-line/performance-clock-baseline-d4f67cb8`,
`artifacts/sounding-line/performance-clock-repaired-9d894af6` and
`artifacts/sounding-line/lanternwake-supplemental-04be-failure`.

Accepted Crossdeck main and then Parallax closeout main
`589d3f8ed43070d647cd5f905b3a93cc574a9fee` were merged into this isolated branch.
No unmerged sibling source was used. Shared registration/changelog changes remain
additive, Parallax's catalog and Drydock parser remain accepted, and this phase
introduces no migration or package-script changes. Clean reconciliation candidate
`0907cd953a1e5de89b1a9458e22ef17c213897ad` passes 59 focused tests in four files,
including the accepted Parallax/Drydock boundary, plus all 36 source-bound D0/D1
scenarios with clean owned resources. The registry remains 88 total declarations,
40 Sextant declarations and 17 Reach declarations; 36 is the executable Sextant
CLI subset, not the registry total.

At `2026-10-11T08:01:06.571Z`, the actual host helper again reports Windows,
no configured Android SDK/ADB/emulator and no Apple runtime. D2 is unavailable,
not passed. The first host-refresh invocation used an incorrect CJS module
projection and failed before discovery; the corrected harmless read succeeded.
Both results are retained under `artifacts/sounding-line`.

Subsequent explicit human overnight authorization permits normal branch
publication, protected merge and landed smoke. The parent cleared the merge hold
after Parallax landed. Deployment, later phases and physical owner sessions remain
outside scope. The reconciled final-head ordinary decision is still required.

## Remaining acceptance gates

- D2 Android execution requires an actual configured emulator/bridge. D3 native iOS and native transport parity remain Phase 4.
- D4 actual sensor/RF/camera/microphone/accessory accuracy, calibration, drift, interruption, power/thermal behavior and tactile output; D5 venue/weather/accessibility/field safety and weak-prop trials require physical evidence.
- Surface owners place reference controls, supply existing media factories/authentication, requalify local guidance, and accept their product integrations. This phase supplies reusable software contracts rather than implementing Reach, Watchglass, Crossdeck pairing or Parallax tracking.
- Owner/product acceptance and deployment remain separate; deployment and physical owner sessions are unauthorized here.
- Reconciled final-head ordinary qualification, protected publication/integration and landed smoke remain pending at this checkpoint. The earlier failed decisions and historical performance limitation are preserved above.

## Reconciled ordinary acceptance

The ordinary decision on `dc94fca909262993f96ec2831068f2c48b54255b`, against
accepted main `589d3f8ed43070d647cd5f905b3a93cc574a9fee`, is PASS at
`2026-10-11T08:11:54.355Z`. It passes 1,648 product tests in 266 files and all
78 required viewport cases. Ten obligations are closed with zero remainder;
seven ran fresh and three were legitimately rebound by the canonical finalizer.
The decision is retained as `artifacts/sounding-line/sextant-final-reconciled-decision.json`.
[Compact qualification evidence](Project_Sextant_Phase_3_Local_Qualification.json)
preserves exact source, counts, tier and host limits without private raw evidence.

The generated Ledgerlight inventory row was pending during that run; product
source did not change. Catalog entry FT-B103 is now eligible for branch-complete
status, bound to this actual accepted local candidate. A complete clean-head
ordinary check follows the documentation/catalog commit before publication.
The optional inherited Companion benchmark remains outside this required
canonical decision and is not represented as a pass. Physical/native/field and
owner/product gates remain open; normal protected integration and landed smoke
are authorized and still required before mainline catalog promotion.
