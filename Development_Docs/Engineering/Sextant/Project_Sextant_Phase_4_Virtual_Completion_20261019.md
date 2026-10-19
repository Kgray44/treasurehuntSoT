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
