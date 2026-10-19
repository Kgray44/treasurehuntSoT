---
title: Sextant Phase 4 virtual completion continuation
audience: engineering
status: in-progress-not-phase-acceptance
canonical_for: sextant-phase4-virtual-completion-20261019
last_reviewed: 2026-10-19
---

# Sextant Phase 4 virtual completion continuation

## Source and scope

The owner authorized maximum attainable Phase 4 software and virtual completion
on 2026-10-19. Continue existing draft PR #709; preserve Phase 1–3, the native
architecture, historical failures and original receipt identities. No Phase 5,
personal iPhone/Mac use, manual Apple account setup, provisioning or signing.
This record is current engineering documentation. Linked JSON is engineering
evidence; `.agents/scripts/sextant-phase4-reconcile.mjs` is active automation.

Initial candidate: `5ff2739776513b8f8ed20c1cb661c164216d0eeb`.
Fetched protected main: `f6af0b0e151f15f1a23808413ccee531b9827ca7`.
Crossdeck #721 is OPEN/unmerged at `b55f5a32b7a6c42ba309db756f944e50145de123`.
Only accepted main may supply its shared contracts. Protected Reach diagnostics
are available on main; their former unavailability is stale.

## Remaining-work inventory before implementation

The governing authority is Sextant v1.0 §55.4, read with the Sextant v1.1,
Landfall v1.2, Spatial Experience and shared Device Lab amendments. Earlier
Phase 3 acceptance is retained through PR #701/#702. Historical qualification
does not qualify this combined candidate.

| Requirement                                                 | Initial classification                          | Remaining work                                                                                                   |
| ----------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| iOS Core Motion and Core Location seams                     | Implemented but untested on current source      | Reconcile main, inspect contracts, compile and run supported hosted XCTest/simulator cases                       |
| Android sensor and position providers                       | Implemented but untested on current source      | Reconcile main, compile/instrument and exercise supported emulator controls                                      |
| Haptics                                                     | Implemented but untested on current source      | Confirm semantic output, lifecycle refusal and visual fallback; physical sensation deferred                      |
| BLE/NFC/UWB/Nearby Interaction                              | Partially implemented with capability fallbacks | Verify supported/unsupported and reconnect semantics; RF/accuracy deferred                                       |
| Permissions, manifest and entitlements                      | Implemented but untested on current source      | Grant/deny/revoke/restore checks and no unsolicited acquisition                                                  |
| Foreground/background/lock/power                            | Partially validated historically                | Refresh supported lifecycle tests; retain Apple foreground and Devices failures until corrected-source execution |
| Deterministic provider lab                                  | Implemented and validated on historical source  | Current-source scenarios plus gap checks for suspend, restoration, stale/dropout/conflicts and semantic outputs  |
| Crossdeck projection                                        | Dependent on another current project            | Test accepted contract only; do not consume unmerged #721                                                        |
| Landfall/Watchglass/Reach/Parallax/Storytide seams          | Implemented but untested on current source      | Canonical ownership regression and supported consumer tests                                                      |
| Device controls and accessible fallback                     | Partially implemented                           | Actual natural entry/action/return on desktop/mobile and reduced motion                                          |
| Experience registrations                                    | Partially implemented                           | Recompute historical 141 paths/13 families and current planner, register actual journeys and fixture gaps        |
| Synthetic consumer acceptance                               | Missing for final source                        | Build, source-bound capture, independent review and continuity checks                                            |
| D2 Android execution                                        | Validated historically only                     | One bounded exact-source supported emulator dispatch; retain cleanup/logs/screenshots                            |
| D3 iOS execution                                            | Partial historical failures                     | One bounded exact-source supported hosted simulator dispatch; no signing credentials                             |
| Production build, TypeScript, privacy, focused verification | Missing for final source                        | Run after source reconciliation and focused repairs                                                              |
| Protected readiness                                         | Dependent on acceptance gates                   | Assess final exact-source evidence; no bypass of exhausted review/protected custody                              |
| D4 core bring-up                                            | External/physical only                          | Explicitly deferred: representative hardware, signing/provisioning and actual sensing/haptics/RF                 |
| Owner acceptance                                            | External/physical only                          | Owner decision remains separate                                                                                  |

The historical 141 obligations are an inventory to reconcile, not a current
count or accepted experience. The source-only reconciliation receipt records
each historical path, its present existence/affected status and exact current
declarations, plus the authoritative planner disposition. Registration alone
qualifies no surface. The previous 3/3 Sextant campaign, Crossdeck 10/3 and R1
2/3 accounting remain immutable. This continuation does not mint additional
protected campaign allowances.

## Focused source corrections

Independent read-only source review of combined source `a0a5f9c373ca727a854568852daecdc1913af210`
identified location pause, permanent quarantine after normal native expiry,
incompatible implicit absolute-orientation acquisition, cross-owner haptic
cancellation and misleading radio declarations. The builder also reproduced a
late cadence failure crossing a stop/restart boundary. Seven provider regression
cases and one haptic regression failed before correction; the original results
are retained separately from passing evidence.

Pause/resume/revoke now apply to every capability permission group. Expected
EXPIRED/BACKGROUND/POWER/PERMISSION termination ends consumers without permanently
quarantining the provider. Fresh explicit acquisition is required; 60-second
native bounds remain. Absolute orientation has its own family, so relative
attitude does not implicitly request a conflicting north reference. Cadence and
output replies retain their original generation/owner. Radio state keeps support,
permission, operational availability and foreground lifecycle independent.

Focused validation passes 273 tests in 38 suites, including the existing
Sextant, coordinated-sensor, Crossdeck and Drydock boundaries. TypeScript passes
on local Node 24.18.0/npm 11.9.0. Hosted native jobs use repository-pinned Node
24.19.0; local feedback is not proof of that hosted toolchain or native execution.
The Feature Catalog decision is NO CHANGE REQUIRED: these are corrections to an
unaccepted candidate, not a completed major capability.

Independent re-review found two further source gaps. Pending native cleanup is
now shared by every stop caller and awaited before successor acquisition; the
broker rejects callbacks from a superseded active generation. The declaration
cache now refreshes on native nearby/permission/termination transitions using a
single coherent snapshot. Three additional regressions failed before these
repairs and pass afterward. The passive state subscription remains until runtime
disposal; actual sensor subscriptions end with the final acquisition.

All 53 deterministic D0/D1 scenarios passed at clean source
`a1c465ba79f6779c33b96d635486e1805b8fb526`. Android run `39301316984` and iOS run
`39301326349` bind that source, not the later cleanup/cache corrections. Their
native input blobs are unchanged by those subsequent TypeScript fixes; their
receipts must nevertheless retain their original full-source identity. They
remain development evidence, not final combined-candidate qualification.

## Consumer laboratory and remaining OS proof

Six additional D0 scenarios exercise actual permission/lease acquisition and
semantic consumers: pitch and roll, seeded noise and contradictory motion,
silent dropout with fresh dwell after recovery, capability loss/restoration,
fresh-process restoration and independent local sensing through peer disconnect.
The capability case exposed a further broker gap: a refreshed unsupported
declaration could leave existing leases consuming observations. Revalidation now
ends only affected leases; sample delivery checks current availability, and
restoration requires explicit reacquisition. Available shared-provider consumers
remain acquired. The native runtime regression verifies those distinctions.
Independent review identified a queue race in the first revalidation version.
Captured lost consumers now receive ENDED synchronously, before queued resource
cleanup; immediate restoration cannot revive their observation delivery. A
regression holds an unrelated provider stop unresolved across that transition.
The dispose/recreate D0 case proves fresh consent and dwell. A separate native
transport regression delivers an actual stale lease and mismatched generation
to a restored runtime and verifies ignored old ownership or fail-closed output,
without treating a detached synthetic provider as generation evidence.

The focused Sextant/consumer/Android-idle suite passed 323 tests before the two
additional OS-scenario declaration checks. Original failed oracle reports are
retained; the early offline fixture failure was a missing synthetic reacquisition
cooldown/security mode, not a product defect.

Baseline Android run `39301316984` reports 11 PASS, zero FAIL and one UNSUPPORTED
Doze step. Its native instrumentation and all completed scenario cleanup passed.
iOS run `39301326349` reports 31 native PASS, one expected SKIP and three selected
canonical scenarios PASS, including the formerly failed foreground geofence
return. Both retain source `a1c465ba79f6779c33b96d635486e1805b8fb526`.

Hosted focused browser run `39304482251` passed the two desktop/mobile ordinary
Devices refusal/fallback/accessibility cases at source
`939d6dd3778db602318a3c29af4e3343c01f99f1`, with supervised cleanup. This is
DEVELOPMENT_ONLY, qualification false. Local production compilation also passed
at that source; its Windows development preparation then failed the immutable
build link check, before browser execution. Neither result grants experience
acceptance.

The shared lab now includes separate Android OS-only idle and standby recovery
scenarios. They use [documented Android controls](https://developer.android.com/training/monitoring-device-state/doze-standby),
verify actual idle/app-inactive readback while backgrounded, check no canonical
progression, recover a fresh foreground fix and verify restoration. They require
a measured virtual guest. The original unsupported Doze result is preserved.
The existing hosted lab also has a bounded development `ios-devices` target for
the existing normal Devices XCTest through the generic isolated product runtime.
These added paths still require actual hosted results before any execution claim.

## Ordinary consumer journey development

The existing guarded synthetic experience producer is shared with a focused
browser case; its CLI database/source/nonce guards remain. The case uses ordinary
sign-in, account-menu workspace entry, the actual Player library, Journal full
replay, contextual Devices, keyboard screen fallback, the same Voyage return,
Guided Lens and ordinary Personal Harbor return. It records desktop/mobile and
normal/reduced-motion variants, and checks the published checksum and active
Voyage progression. No cookie authentication, reader-state preparation, hidden
progression or unmerged Crossdeck contract substitutes for the visible journey.

A new additive workspace declaration covers its existing Player-resource branch
and two previously unregistered source paths. Captain/Creator resource acceptance
remains explicitly separate. The historical 141/13 mapping is preserved, and the
remaining registrations, canonical fixtures and protected capture/review still
require source-bound completion. Neither adding a declaration nor a development
recording grants experience or Phase 4 acceptance.

Consumer development run `39307522697` at `1c8fc3ab` failed before browser
execution: the shared hosted template lacked the current required private
failure-publication nonce. Its original log and harvested receipt are retained.
The corrected template supplies the existing nonce-bound collector and uploads
only its exact encrypted failure paths on failure; passing synthetic recordings
remain separately publishable. The iOS product successor compiles with an
explicit BUILD_ONLY scope and does not repeat the completed companion matrix.
Build-only output carries no native-test pass claim and still verifies the
actual app binary and owned simulator cleanup.

## Published evidence and current gates

The [machine-readable completion ledger](phase4-virtual-completion-ledger-20261019.json)
separates source corrections, development checks, original hosted results,
remaining software and physical gates. The [publication index](evidence/20261019-virtual/publication-index.json)
records 405 selected original files, copied byte for byte; complete native
bundles and original failures remain in the owned artifact directories. Scoped
Git attributes and formatter exclusion preserve those receipt bytes.

Expanded source `58d3e51db2948d206be0a62f5a47cb022f27d286` passed 327 focused
tests and 59 shared lab scenarios (44 D0, 15 D1). Android run `39306503567`
passed both actual OS idle and standby scenarios with entry/wake readback,
fresh foreground recovery, zero canonical progression and verified cleanup.
Its earlier unsupported Doze result remains preserved at the earlier source.

At `1c8fc3ab`, source reconciliation reports 170 affected surfaces and 116
unregistered surfaces. The two Player-workspace declarations do not complete
Captain/Creator acceptance. The remaining canonical fixtures, registrations,
captures/reviews and protected qualification remain software gates, distinct
from unmerged Crossdeck and D4/owner gates. No full Phase 4, protected integration
or Phase 5 claim is made.

## Product execution failures and diagnostic continuation

At `fb937bbd`, browser run `39308990232` passed the first 1280 px ordinary-motion
consumer journey, including released-clue Inspect and unchanged canonical
progression and edition checks. The next reduced-motion case failed to reach
Overview after ordinary sign-in; the serial suite skipped the remaining mobile
variants. Runtime cleanup passed. This partial result does not complete the
four-variant matrix. The custom context omitted the standard failure attachments,
so the successor records screenshot, video, trace and rendered synthetic context
through the existing encrypted failure collector. Assertions and timeouts remain
unchanged; independent variants continue even when another fails.

iOS run `39306514221` at `58d3e51d` passed 31 companion tests with one expected
skip and verified native cleanup, then exhausted the approximately 2 GB V8 heap
during Next production type checking before the normal Devices journey ran.
The Apple product job now has a bounded 4096 MB heap. Type checking remains
enabled, and this launch repair does not repeat the companion matrix or establish
a product pass. Both original failed results remain preserved.

The subsequent `fb937bbd` Apple run `39309002270` prepared the native product
test build but stopped at the private-publication unit preflight (1 PASS,
13 FAIL). Its fixture used macOS's aliased temporary path; the unchanged
publication authority correctly rejects noncanonical paths. The test producer
now resolves its own newly created temporary root before creating inputs.
All output-security assertions remain. This is a fixture portability correction,
not permission to relax publication checks or a normal Devices execution claim.

Android product run `39309009723` passed all 14 selected development cases at
`fb937bbd04a98b07dd94b325682ceb654c8c4c5c`. Actual Android WebView Device controls
observed four OS samples, paused input and reached screen fallback. The paired
Journal case used the optimized application and canonical SQLite, observed native
stop and zero canonical progression events, and verified both emulator cleanup
and runtime cleanup. Its peerVerified field remains false; real RF remains open.
The [product publication index](evidence/20261019-product/publication-index.json)
preserves 59 original files: Android receipts and captures, failed-run custody,
and the Apple prepared-build/cleanup records. Complete bundles remain preserved
in the owner artifact directories. No protected experience acceptance is granted.

Independent rendered development review found the viewport Device controls
legible and consistent with paused input and screen fallback. The native
full-page capture repeats header strips and cannot establish complete-page
coverage; retain that original defect. The stopped nearby panel has minor label
wrapping/background clutter. Its receipt records four failed first-party requests,
so the pass does not establish error-free networking. The reviewer did not run
the software, grant protected capture custody, or provide owner acceptance.

Run `39310970101` reached ordinary sign-in in all four variants. One full journey
passed; three failed when the test's Continue Voyage selector matched the
legitimate rows retained by earlier devices. The repair gives the current device
an ordinary visible label, selects its exact row and asserts one added row while
preserving previous rows. It does not clear registrations or change Crossdeck.
The generic wrapper lacked diagnostic custody, so those failed-run captures
were not published. The fixed consumer wrapper now mints the existing development
source binding and retains the existing encrypted collector/publication contract.

The additional Passport declaration covers the actual overview and eight section
routes with normal account entry/return and response-rendered collection/insight
outcomes. Empty Memories, artifacts and saved items remain empty. The active
Voyage is not completed to populate history; detail/book/replay, granted artifact
detail and the unused legacy Passport component remain separate obligations.

Apple run `39311000104` passed native test-build preparation, all 14 publication
preflight tests and the bounded-heap production build. Its canonical browser
runtime then invoked Linux subreaper supervision on Darwin and failed before
browser execution. Runtime cleanup reports FAIL, although no product worker
started and the ports were released; native build cleanup is a separate receipt.
The current canonical host does not support this product-runtime launch. Normal
iOS Devices proof remains open pending that host contract; supervision is not
bypassed and passing native companion results are not promoted to product proof.

Current main advanced to `40491dd68ace88ee033b53fd264ddbfe303c6d28` with the
approved R20 Crossdeck acceptance-boundary policy. This continuation reconciles
that accepted policy without consuming the still-unmerged Crossdeck product
candidate or its capture allowance. Source reconciliation of `e2b791d96` against
that base reports 170 affected surfaces and 104 without declarations. The new
Passport contract has 14 actual source paths, 12 currently affected; this does
not grant any capture/acceptance credit. All 141 historical paths remain present.
The [complete source reconciliation](phase4-source-reconciliation-passport-20261019.json)
lists every current affected path, matching declarations, historical family and
remaining support gap. Its blocked planner result is preserved unchanged.

Run `39320340580` stopped before build or browser execution: the TypeScript
launcher transformed the canonical development helper as CommonJS and rejected
its guarded top-level ESM await. Native Node ESM now invokes that same canonical
fingerprint/binding helper before creating the diagnostic scope. No authority,
consumer assertion or feedback target is changed; the zero-artifact failed run
and original CI log remain preserved in the owner artifact directory.

The corrected launch `39321477293` at `998d684bd2` reached the browser matrix.
All four variants exposed the same Voyage Atlas accessibility defect: its named
availability aside was nested inside the Passport main landmark. It now uses a
named section with the same content and CSS class. The existing axe assertions
and 3000 ms feedback targets remain. Other product guides remain accurate; this
is an ordinary accessibility correction, not a feature-availability promotion.
Runtime and transport cleanup passed. Canonical encrypted failure publication
succeeded, but its fixed 64 MB raw limit retained only 15 diagnostic members;
the receipt remains INCOMPLETE with LIMIT/FAILURE_ATTACHMENTS_INCOMPLETE. No
complete diagnostic, experience or protected acceptance is inferred.

The next resource design uses an actual Captain/Creator owner and a distinct
crew member for active Player participation. Ordinary workspace entry reaches
the real crew roster, command console, non-mutating Player preview and owned
Chronicle settings. The development journey reviews and cancels a pause command,
then saves, reopens and ordinarily restores a working title. Each viewport/motion
variant owns separate mutable resources; failures retain their state. Published
checksums and both active-Voyage baselines must remain unchanged. Active-Voyage
chat is correctly disabled; no chat-send success is claimed. These are source
registrations and unexecuted development cases until a bound run says otherwise.

Independent source review predicted a second nested complementary landmark in
Muster's Chronicle card. The named section repair preserves its content and CSS;
this finding was source-predicted, not reproduced by the resource browser case.
Existing accepted account references guide hierarchy and return paths. Source
review, real rendered review and protected acceptance remain distinct.

The older native-context Creator journey assumes the active Player can enter
Creator Studio. Current canonical Homeport safety locking prevents that
transition (`src/homeport/current-user.server.ts`). The separate resource owner
has no Player membership and does not weaken that lock. Its settings journey
does not satisfy the older Parallax working-clue-to-Player requirement. A
compatible canonical paired-persona handoff remains a software/contract gate;
it is neither physical-only nor accepted by this continuation.

Run `39323401270` passed all four Chromium viewport/motion variants at
`450af3f4794e8e290db8484b36d17631390086ff`, with 98 harvested original artifacts
and runtime/port/transport cleanup. It covered all nine Passport routes, actual
Player workspace entry, the uniquely named current Device row, keyboard screen
fallback, same-Voyage Journal return and released Guided Lens clue/Inspect.
Progression and published-edition checksums remained unchanged. These are
development results at that source, not protected experience acceptance.
Independent rendered review identified a washed-out Passport intro heading on
the pale gold card despite axe passing. It now inherits the existing dark card
text color. The mobile reduced-motion overview capture was scrolled beyond the
intro, so the next case brings that actual heading into view after recording
ordinary readiness. Original captures and the review finding remain retained.
The reviewer inspected all 48 distinct captures; no other material visual defect
was found. Maximum recorded Passport readiness was 1602.4 ms. One desktop Lens
background showed opening-animation fallback, so usable continuation does not
prove universally successful animation. Static captures do not establish all
viewport behavior, native sensing or protected/owner acceptance.
The [original consumer evidence index](evidence/20261019-consumers/publication-index.json)
preserves all 98 harvested members plus the hosted receipt, dispatch and CI log.
Every copied file retains its SHA-256; the visual defect remains part of that
passing development run's independent disposition.

At source `99cbb4b8ebacf0655a2ccfa964bff00e397890f5`, resource registration
reconciliation reports 171 affected surfaces and 92 without declarations. It
preserves the 141 historical paths and remains blocked for protected planning.
Source-only declarations qualify no surface. The fixed Captain/Creator resource
matrix is dispatched separately as development run `39324450092`; no outcome is
claimed before harvest. Existing component tests (5/5), TypeScript, privacy D0,
documentation and feature validation passed at the resource checkpoint.

Resource run `39324450092` subsequently passed all four development variants at
`99cbb4b8ebacf0655a2ccfa964bff00e397890f5`, with 34 original harvested members,
unchanged progression/published checksums and supervised tree/port/transport
cleanup. Maximum measured resource feedback was 1342.9 ms. Independent rendered
review found the safe Player preview's projected Passage and metadata too pale
against its gold sheet in every variant. The scoped sheet now sets its existing
heading/body tokens to parchment ink and uses dark metadata; the warning remains.
The original passing captures retain that P2 disposition. A fresh corrected-source
resource run is required before claiming the rendered repair.
The same review found mobile authoring navigation covering the application
masthead. Its sticky inset now follows the existing shell-header height and its
layer sits below the shell navigation. The resource journey retains all prior
assertions and adds actual header/rail non-overlap geometry plus preview axe.
All 34 harvested member hashes match inventory. Review inspected 16 screenshots;
chat and the cancelled command dialog are not directly shown, and recordings
were not independently played. This remains development review only.
The [original resource evidence index](evidence/20261019-resources/publication-index.json)
preserves all 34 harvested members plus hosted receipt, dispatch and CI log with
original hashes and both unresolved rendered findings.

The next independent software case compares two genuine personas on one pinned
synthetic Voyage. The resource owner enters Creator Studio ordinarily; the crew
Player signs in separately and retains the active-Player Creator safety lock.
Each viewport/motion case owns distinct resources and a canonical synthetic
Spatial Moment. The Creator saves a distinguishing working title, refreshes the
URL bound by the actual Save action and observes the persisted title. The Crew
then refreshes its actual Journal and compares the original released experience
title, clue and Inspect result before the working title is ordinarily restored.
Progression and the pinned edition checksum must remain unchanged. This case
does not amend or satisfy the older single-persona capture contract, publish a
new edition or establish native tracking. It remains unexecuted until a bound
hosted result is harvested.

Source review corrected cached Player comparison, a non-distinguishing clue
assertion, partial-setup context cleanup and Crew attachment kind names before
execution. The private collector retains its canonical names/budget. Two named
Spatial Studio panels become sections within main; this was a source-predicted
landmark correction. Existing named-role lookups retain their assertions against
the new region semantics, including the original component absence assertions.
The existing eight Spatial Studio component tests pass with those updated roles.

The corrected consumer run 39325122288 passed all four variants at
`23d697925d2a2505f4c9d91f8c6660337bedf266`. Independent review found the
Passport intro visible and readable in all four; no new material defect appeared
in sampled Atlas, Device and Lens captures. All 98 original hashes agree. Maximum
Passport readiness was 2071.5 ms. Full-page Device captures still place a sticky
header across card text, so they do not establish unobscured complete-page proof.
Static review does not establish animation success, native behavior or protected
acceptance. The [fresh consumer originals](evidence/20261019-contrast-repair/publication-index.json)
preserve 98 members plus hosted receipt, dispatch and CI log.

The corrected resource run 39326967341 passed all four variants at
`716985c1afbfa1dc55aff644fc54dc554f57edb8`. Independent review confirms
readable safe-preview text and an authoring rail that clears the masthead in all
four variants, with no new material defect in the eight repair captures. All 38
original hashes match; maximum recorded resource readiness was 1269.0 ms. Both
runs passed supervised process reaping, port release and transport cleanup.
The [fresh resource originals](evidence/20261019-resource-repair/publication-index.json)
preserve 38 members plus hosted receipt, dispatch and CI log. Neither run grants
protected custody, native/physical proof or owner acceptance. Older defective
passing captures and their original review findings remain unchanged.

Paired run 39327507704 at 727ff58ff336 failed before sign-in because manual Crew
trace start conflicted with the runner. Its [original failure](evidence/20261019-paired-setup-failure/publication-index.json)
remains retained. Run 39329558470 at 928dd936fc reached the real Crew Journal,
released clue and Inspect, then all four variants failed at an axe selector that
required an explicit role attribute on a native HTML dialog. No Creator save or
after-save comparison is proved by that run. Runtime/tree/port/transport cleanup
passed. Its canonical diagnostic retention remains INCOMPLETE: MANIFEST_INVALID,
25 members, 42052355 raw bytes and 74779850 encrypted bytes. The original CI list
repeats the same automatic screenshot path per variant; collector rejection is
preserved. The [original receipt/log subset](evidence/20261019-paired-dialog-failure/publication-index.json)
records the encrypted bundle hash and owned artifact location without copying
that private bundle into Git. The source repair uses the actual open dialog and
distinct explicit owner/Crew failure captures, including setup and cleanup-only
failures. Trace/video ownership, primary failures and fixed limits remain intact.
Run 39331079907 at `a9d8bdd7b4d8e4822de879c5be4d1fdc015f9167` is dispatched;
no outcome is claimed here.

The [stylesheet checkpoint](phase 4-source-reconciliation-styles-20261019.json)
binds 174 affected surfaces/92 gaps to 0d413da1d2. The subsequent
[Community checkpoint](phase 4-source-reconciliation-community-20261019.json)
binds 175 affected surfaces/74 gaps to `4e1afbc0158bdd1cd496a5bfecc131110f086528`.
Its 21 declared paths include the ten districts, actual public details and visited
components; 18 previous registration gaps are covered. Historical 141 paths remain
intact and protected planning stays blocked. Declarations grant no acceptance.
The canonical Homeport Phase 4 producer and synthetic manifest are adopted unchanged
once inside the nonce-owned database. Preflight rejects all producer namespace
and unique-key collisions; an exclusive attempt receipt preserves partial work.
Reuse reads the real public projection and release eligibility. Ordinary anonymous
entry, ten districts, eight details, empty Creator/collection/search, comment
sign-in gating and independent active-Voyage/edition preservation are declared.
Independent source review cleared fixture and formal contract corrections. Two
source-predicted nested landmark containers became sections; existing six comment/
review tests and TypeScript/privacy/docs/features checks pass. Run 39330479919 is
dispatched from 4e1afbc015; no browser outcome is claimed here. Historical Community
captures are supplemental context; protected generic references establish general
hierarchy only, with Community-specific reference/layout acceptance still open.

Paired run 39331079907 subsequently passed all four variants at
`a9d8bdd7b4d8e4822de879c5be4d1fdc015f9167`. Independent review found no
material defect in all 12 captures: each reopened Creator title differs while
the refreshed Crew Lens keeps the original released title, clue and Inspect.
All 42 original hashes match, maximum measured readiness is 955.9 ms, and supervised
process trees, ports and transport resources are cleaned up. The Creator inspector
is outside the mobile viewport captures. Videos, full-page completeness, animation
behavior, native sensing, protected custody, the older single-persona contract and
owner acceptance remain unestablished. The [paired originals](evidence/20261019-paired-clue/publication-index.json)
preserve 42 members plus hosted receipt, dispatch and CI log.

Community run 39330479919 at 4e1afbc015 failed all four variants at duplicate review
landmarks after ordinary entry and all ten districts. Its [receipt/log subset](evidence/20261019-community-landmark-failure/publication-index.json)
preserves original diagnostics: INCOMPLETE, LIMIT/FAILURE_ATTACHMENTS_INCOMPLETE,
63 members, 50910077 raw bytes and 90550950 encrypted bytes. The wrapper repair
cleared that point in run 39331845535 at cf06d1d855. Three variants subsequently
failed actual empty-search recovery: returning to the default URL restored its
older unsent query. One mobile variant with normal motion instead stopped at the Guide heading;
its cause remains unconfirmed and is not explained by the clear-state repair.
The [second original failure](evidence/20261019-community-clear-failure/publication-index.json)
remains INCOMPLETE with LIMIT/FAILURE_ATTACHMENTS_INCOMPLETE, 90 members, 64726615
raw bytes and 115132058 encrypted bytes. Both private encrypted bundles remain in
owned artifacts with exact hashes; the Git indexes explicitly publish metadata/log
subsets only. No diagnostic budget or collector validation is relaxed.
The clear action now resets query and advanced drafts against its destination
URL; the default-to-query-to-clear regression and all six component tests pass.
Independent source review is clear. Run 39333117664 at `e49241ca31` subsequently
passes three variants, including actual empty search and Clear. The 390-pixel
normal-motion variant repeats the Guide heading failure; its cause is still
unconfirmed. The [original receipt/log subset](evidence/20261019-community-guide-failure/publication-index.json)
records COMPLETE private diagnostics: 22 members, 54917710 raw bytes and 97647670
encrypted bytes. Runtime trees, ports and transport cleanup pass. This failed
whole run grants no rendered or protected acceptance. A bounded navigation
observation will diagnose the remaining Guide failure without changing assertions.

The [authoring source checkpoint](phase4-source-reconciliation-authoring-20261019.json)
binds 175 affected surfaces and 63 registration gaps to `0e657cc757933df775fd6047bda13a1f489e7ff0`,
covering 11 previous gaps without changing historical 141-path accounting. The new
13-path declaration covers six actual owned Creator authoring panes and their
visited components. It reuses the existing separate-owner/Crew fixture unchanged.
Empty media/Waypoint/Artifact libraries, absent Living Chart, loaded current server
Drydock checks and immutable Version review have ordinary navigation/return and
unchanged two-Voyage/progress/edition/count assertions. Populated libraries/chart
tools, uploads, installation/place/field-test panels, actual trials and publication
remain separate requirements. Source-predicted corrections label existing controls
and use same-named Asset drawer/Scenario ledger sections, retaining ledger styling
and existing named-role assertions. The three existing component files pass 26
tests; TypeScript, discovery, contract/docs/features checks and independent source
review pass. Canonical Drydock state capture waits for all three loaded panels.
Run 39332800305 at `0e657cc757` fails all four variants because the test assumes
the Asset drawer is already visible. The intended page state hides it until the
ordinary Upload media action. The [original receipt/log subset](evidence/20261019-authoring-drawer-failure/publication-index.json)
records COMPLETE private diagnostics: 17 members, 20930133 raw bytes and 37222050
encrypted bytes; runtime trees, ports and transport cleanup pass. Corrected source
`637f5de345142b67fe8e77055e7384f22bc74609` opens the drawer ordinarily, retains its
content assertion, audits axe, captures it, closes it and verifies it is hidden.
The formal contract now includes the same open/close sequence. Independent source
review, TypeScript and documentation/catalog checks pass. Run 39334344712 binds
that source and is dispatched; no browser outcome is claimed yet. No media upload
or authoring mutation is performed by this correction.

The [Captain dashboard source checkpoint](phase4-source-reconciliation-dashboard-20261019.json)
at `0b76873e4ba45670c2c94378d785956fcbaad9a8` records 176 affected surfaces and
60 missing declarations. The live PlayerLibrary already exercised by the ordinary
consumer journey now has its narrow declaration. Captain Library's actual
Published Chronicles card opens the existing Chronicle dashboard; the extended
resource test verifies its loaded Chronicle, one session card, exact same-session
control link, axe and ordinary return, retaining every existing assertion and both
active-Voyage/checksum baselines. The dashboard's nested aside becomes a named
section, with all eight styling selectors retained against its explicit class.
This source-predicted semantic correction grants no rendered acceptance.
Independent source review is clear after distinguishing Chronicle title from
separate Voyage/edition continuity checks. TypeScript, contract validation,
four-variant discovery and documentation/catalog checks pass. Run 39335372914
subsequently passes all four browser variants, with the original assertions intact.
Independent review of all 20 PNGs finds two defects: R39335372914-01 infers
Guest Crew from an absent legacy label despite the actual named account-backed
membership; R39335372914-02 shows the desktop sticky editor topbar covering the
masthead and rail after scroll. This run signs in only the resource owner; its
Muster view is not Crew-authentication proof. All 46 original hashes and the frozen
source fingerprint/tree match. All 28 recorded activations are below 3000 ms,
maximum 1168.53 ms; dashboard entry is 171.32–202.30 ms and same-controls return
148.10–184.40 ms. Runtime and transport cleanup pass. The
[49 original files](evidence/20261019-captain-dashboard/publication-index.json)
include the defective passing captures. Videos are hashed but unreviewed; mobile
dashboard return controls lie below the captured viewport. The pending repair
uses neutral Crew wording and one desktop sticky container for editor actions
and sections below the canonical masthead height. Mobile retains its compact
sticky section rail. New assertions cover desktop toolbar/rail placement and
actual masthead hit-test exposure after the same autosave scroll. Fresh browser
and independent rendered re-review are required.

Authoring run 39334344712 subsequently fails all four variants. One audits the
open drawer during an allowed 240 ms opening fade and reports ratio 1.57 on three
controls; the existing final-state controls already specify white text. Three
other variants reach Sea Trials but fail its loaded heading, with cause still
unconfirmed. The [original subset](evidence/20261019-authoring-readiness-failure/publication-index.json)
has COMPLETE diagnostics: 33 members, 47312710 raw bytes and 84135270 encrypted
bytes. Runtime trees, ports and transport cleanup pass. The pending correction
requires drawer opacity 1 within the existing 3000 ms measurement and observes
only the fixed synthetic Chronicle's bounded Sea Trials response metadata. It
preserves the animation, colors, assertions and limits.
Source `fe7350036e5ded86eb68d832f5bf76b43396f85a` contains the settled-visible
predicate and bounded response listener. Run 39336072158 passes the settled drawer
audit in all four variants, then fails all four loaded Sea Trials headings. The
bounded diagnostics identify `/scenarios` returning 400 because the fixture Passage
does not satisfy its Drydock publishing contract; suites and runs return 200.
The closure producer supplies runtime legacy fields and nextBlockId-only edges.
The separate working draft now uses canonical defaults for its two known block
types, retains narrative prose, adds explicit DEFAULT edges, and validates through
production `snapshotFromStudio(getStudioTale(...))`. The pinned released snapshot
and checksum remain unchanged by this draft construction. Existing fixture reuse
does not reset failed state; no parser or publishing gate changes. Independent
source review finds no remaining issue; fresh execution remains required. The
[original failure subset](evidence/20261019-authoring-contract-failure/publication-index.json)
records COMPLETE diagnostics: 37 members, 55299307 raw bytes and 98336378 encrypted
bytes. Runtime and transport cleanup pass. The reviewer also confirms readiness
and primary-error preservation in the previous test correction.

Community diagnostic run 39334808571 at `32cfbe022f` again passes three variants.
For 390-pixel normal motion, the Guide click returns but the path remains
`/community/guides` through the heading timeout. Its incoming route remains
interactive. This proves neither a failed detail response nor a product cause.
The [original diagnostic subset](evidence/20261019-community-navigation-diagnostic/publication-index.json)
records COMPLETE retention: 22 members, 56255407 raw bytes and 100025798 encrypted
bytes, with runtime trees, ports and transport cleanup passing. The later source
also makes failed navigation observation best-effort so it cannot replace the
primary test error. Assertions and budgets remain unchanged.

Independent source review of the preserved 175/63 checkpoint distinguishes the
remaining software families without removing obligations: account lifecycle (8),
Admiralty assurance/support (4), live Captain dashboard (2), public catalog and
Tideglass (7), historical Passport/provenance (6), invitation/lobby/compatibility
(9), Creator new/private resources (4), conditional Landfall/recovery panels (17),
accepted Crossdeck display limits (1), authorized Spatial pilot (1), and retained
components without found production imports (4). The dashboard's two paths and
the existing PlayerLibrary declaration explain the three-gap reduction at the
new 176/60 checkpoint. Legacy/source disposition still requires governance;
compatibility redirects do not discharge entry/return evidence. The next bounded
historical journey should genuinely complete its separate synthetic Voyage through
production Player controls and grant an artifact through canonical recipient
resolution, then use ordinary Passport materialization, Book, replay and Cabinet
provenance. Direct history rows or seeded completion statuses cannot prove that
production journey. Canonical Darwin process ownership remains a software
prerequisite separate from deferred manual Apple provisioning.

At source `926a170b0fe6f8f78df449c884352ae1a2c14f56`, authoring run
39337654035 passes all four variants, including the settled Asset drawer and
loaded Sea Trials. Independent review verifies all 66 hashes, the frozen source
fingerprint/tree and all 28 PNGs. All 28 activations are below 3000 ms, maximum
699.91 ms. It retains R39337654035-01: both mobile publication reviews clip stage
content horizontally and the Scenario ledger exceeds its card. The
[69 original files](evidence/20261019-authoring-mobile-overflow/publication-index.json)
preserve this defective passing result. Drydock still honestly reports missing
evidence and NEEDS REPAIR; this is not publication readiness. The pending layout
repair uses shrinkable grid/form tracks and checksum wrapping without clipping,
adds card/descendant bounds and captures the publication confirmation by ordinary
scrolling. Eight existing publishing/Scenario unit tests, TypeScript, source review
and documentation/catalog checks pass; fresh browser and rendered proof remain.

The same source's resource run 39337646202 passes three variants; desktop normal
fails because a raw toolbar selector also finds an inert outgoing snapshot. Its
[six-file original subset](evidence/20261019-resource-selector-failure/publication-index.json)
retains COMPLETE diagnostics and the exact encrypted original's owned location and
hash. No assertions or timing bounds were removed. Source
`ff7b5d0e4f9fe9e6bb5a1902ff0e1015dfe8ed25` scopes the same toolbar/menu
checks to the accessible current main. Run 39338716275 passes all four variants;
independent review of all 24 PNGs resolves R39335372914-01 and -02 across all
four. Neutral Voyage crew is visible, and the masthead, toolbar, rail and More
menu paint without the reported overlap. All 50 hashes and the frozen source
fingerprint/tree match. All 28 activations remain below 3000 ms, maximum
1112.73 ms. The [53 originals](evidence/20261019-resource-chrome-repair/publication-index.json)
include receipts and captures. All three runs report successful runtime trees,
streams, ports and transport cleanup. Their videos were hashed, not reviewed;
viewport samples do not establish full-page motion, native, protected or owner
acceptance.

Community's exact-link passive pointer/network diagnostic is frozen at
`bdb99837af8e0067a5f212c164ef71047404a33c` and dispatched as development
run 39339458097. It preserves the ordinary click, original assertions and limits.
The observer closes over the actual clicked node rather than an outgoing clone;
source review and TypeScript pass. No Guide product cause is inferred yet.

The completed-history family is now prepared for development execution, with
independent source review clear. Four separate guarded ACTIVE Voyages use ordinary
Crew authentication and three real Player Continue controls, then authoritative
completion, event-time artifact recipient resolution and actual Passport history
materialization. Ordinary links lead to Voyage Detail, Book, read-only replay,
Cabinet and exact personal provenance. Final assertions preserve completed
progress/events/grants, pinned release bytes and the independent ACTIVE baseline.
No completion status, history row or grant receipt is directly seeded. A separate
fixed generic-capture precondition invokes production progression after exact
membership/source preflight and explicitly grants no browser completion/auth proof.
Partial and ineligible fixtures are refused without resetting them. Dynamic record
URLs are checked against actual database identities in development; the formal
contract retains dynamic link/outcome semantics without inventing static IDs.
The historical notice changes only from aside to the same named section. Existing
Journal tests pass 28/28; TypeScript, four-variant discovery and experience-contract
validation pass. No new registration count or rendered acceptance is claimed until
the source is frozen/reconciled and the actual browser evidence is reviewed.

The [completed-history reconciliation](phase4-source-reconciliation-history-20261019.json)
freezes `b601c604c34ce2182c49ea2962d5ce5edd559be6` against accepted main
`40491dd68ace88ee033b53fd264ddbfe303c6d28`: 176 affected surfaces, 54 still
unregistered. The six declared historical paths explain the reduction from 60;
the historical 141-path/13-family inventory and all older checkpoints remain
unchanged. The authoritative planner remains blocked. This is source declaration
accounting, with no protected capture or acceptance credit.

Community run 39339458097 passes all four variants at `bdb99837af`. Independent
review verifies all 170 hashes, frozen source/tree/fingerprint and all 80 PNGs.
All 112 activations meet 3000 ms, maximum 2413.92254 ms; each Guide detail returns
one 200 response. Earlier dead-click cause remains unconfirmed. Review retains
R39339458097-01: the hovered Search glyph has dark ink on the global dark hover
background. Lower comment/install restrictions and empty-Creator outcomes mostly
lie outside these viewports, and the desktop reduced empty-result panel is also
offscreen. The [173 originals](evidence/20261019-community-hover-finding/publication-index.json)
preserve this passing result with its limitation. The prepared repair scopes the
primary hover to light gold/ink, waits for that opaque settled state inside a
3000 ms measurement, checks contrast, and captures actual lower outcomes/comment
gating/empty results using explicit scroll targets. Bounded Guide summaries now
return from the browser and remove listeners in finally; the earlier browser
console messages were not Node stdout. Independent source review is clear after
correcting the capture helper's original automatic return to H1. No assertion,
timing bound or earlier failure is removed.

Authoring run 39339880666 at `79a49bbe9c` passes both desktop cases; both mobile
cases fail the new Sea Trials bounds. The card is contained, but one descendant
overflows by 16 pixels. Its [six-file original subset](evidence/20261019-authoring-bounds-failure/publication-index.json)
identifies the retained encrypted diagnostic original. An isolated actual
component/CSS experiment with mock JSON does not reproduce that width, so no
specific element cause or further CSS fix is inferred. The successor adds only
failure-time tag/class/label and geometry for at most eight offending nodes,
preserving the identical three-value bounds oracle. Mobile publication review
has not been reached in this failed successor and remains unqualified.

History run 39340010047 at `b601c604c3` passes three cases. Desktop normal motion
reaches read-only replay and fails axe because both visible artifact spread pages
share the name The Sextant compass. The [six-file original subset](evidence/20261019-history-landmark-failure/publication-index.json)
preserves the whole-run failure. The secondary artifact/map/illustrated-story
section now adds the same continued suffix already shown in its H3, leaving the
primary label, content, spread and motion intact. Its owning experience declaration
includes this page renderer. Source review is clear; fresh browser and rendered
verification remain required. All three runs report runtime tree/stream/port and
transport cleanup passing; private encrypted originals remain outside Git with
exact hashes/locations. Videos were hashed, not reviewed. These are development
results, with no protected, native, physical or owner acceptance.

At `08adc7effd0cc96c3456e13421fd5c106bae7978`, history run39341796252
passes all four. Independent review checks all49hashes, all24PNGs and the frozen
source/tree/fingerprint. Its32feedback timings meet3000ms, maximum1637.662678ms;
separate replay opening reaches1080.727289ms. No new material issue is visible.
The [52 originals](evidence/20261019-history-spread-repair/publication-index.json)
retain both successful receipts and capture limits: Book heading/content images
are effectively duplicate covers on mobile; most lower Detail actions, Book
source sections and provenance authority are offscreen. Historical Captain is
honestly Unavailable, with no populated-attribution proof. Two replay captures
show readable page-turn fallback. The next source adds explicit ordinary scroll
targets for Detail actions, Book source/people sections and the authority sentence.

Authoring diagnostic39341788210 at the same source again passes desktop and
fails both mobile cases. The [six-file original subset](evidence/20261019-authoring-node-diagnostic/publication-index.json)
records a324px Scenario editor with one103px button extending15px beyond its
right edge and16px scroll overflow. An isolated actual-component/CSS render
with mock JSON and Arial reproduces3px overflow in the Suite save row; making
its flexible input shrinkable and wrapping the row removes that local overflow.
The narrow repair changes only those two rules and retains all bounds. It is
source-reviewed clear; the isolated font result does not prove the exact hosted
cause or product repair. Fresh production capture remains required.

Community diagnostic39341802638 at the same source passes three variants. The
390normal Guide case again fails. Its [six-file original subset](evidence/20261019-community-pointer-diagnostic/publication-index.json)
now shows trusted pointerdown/up/click landing on a SPAN outside an anchor,
defaultPrevented false and zero Guide requests/responses. The closed-over link
remains connected/incoming and non-inert but reports y950 beyond the844px
viewport at scrollY519. Reduced motion reaches the actual anchor, returns200
and reports link y411/scrollY1058. Even a passing desktop capture reports the
original observed node below its viewport, so node replacement or geometry
interactions still require investigation; no exact scroll/product cause is
inferred. This narrows the failure to activation before any detail request.
All three runs report successful runtime tree/stream/port and transport cleanup.
Videos are hashed, not viewed; private encrypted originals remain at exact owned
locations with hashes, without decryption or budget changes.

The [08adc frontier checkpoint](phase4-source-reconciliation-frontier-20261019.json)
records178affected/55unregistered: adding the page renderer and Community
stylesheet increases the affected inventory by two; only the new page renderer
was declared there. The [d1dbe style checkpoint](phase4-source-reconciliation-community-style-20261019.json)
then explicitly binds the actual hover stylesheet to its tested Community
journey, yielding178affected/54unregistered. Neither checkpoint grants acceptance
or replaces the historical141paths/13families or any earlier source receipt.

The next consumer increment prepares an isolated public Chronicle with two
immutable synthetic editions and an independent anonymous guest Voyage. The
fixture checks all metadata, version identities, release bytes/checksums and the
actual public/Tideglass projections, refusing reuse mismatches. A fixed
development-only catalog target covers natural catalog search/empty/clear,
preview, loaded comparison/details, preparation, empty browser history, actual
guest creation, Journal and ordinary brand-home/catalog return to that Voyage.
Private baselines and public edition bytes remain asserted. Its new formal
declaration names the actual catalog, comparison and compatibility route sources;
the frozen reconciliation and execution are still pending. Source review is clear,
the three related component suites pass11tests, and TypeScript/contract validation
pass. A TypeScript-only failure from unsupported Testing Library exact options was
corrected without changing its default exact accessible-name matching. Tideglass's
current-edition status and loaded comparison result now have distinct landmark
names, including a realistic UP_TO_DATE response with a projection. No completed
catalog experience, publishing readiness or protected acceptance is claimed.
Authenticated catalog and populated-cookie history conditions remain separate,
as do formal reference/layout review and the existing native/physical/owner gates.
