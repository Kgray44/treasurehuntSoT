---
title: Sextant Phase 4 owned implementation context
audience: automation
status: active
canonical_for: sextant-phase4-owned-context
last_reviewed: 2026-10-11
---

# Sextant Phase 4 — Take It Afield

Profile: UNATTENDED_CONTINUATION. Context class: product-phase. This is a
minimum-sufficient source summary adapted from Project Trim, not a canonical
packet-v2 receipt or a release decision.

Base: `f458bf2dc1176016c2d166180f038f0f15ac9f7c`, fetched protected main.
Accepted main `efa689f2` (Crossdeck #706/#708 and synthetic Pilot #707) was
reconciled additively after the second candidate. Accepted Parallax Phase 3 and
its records-only closeout are also reconciled from protected main
`af867c011eb0c3c4d39cfe0d0bfef7c596fdbbbf`, tree
`2456cb6cf7091048d17d5e5d52b865b97ded9d6e`. Preserve its approved workstation,
field schema and all scenario declarations. New combined qualification binds this
base and the exact candidate from the latest checkpoint. Phone sign-in/local-HTTP
PR #712 is additionally reconciled from `678dd1156d39537d288ba3c2e5ce5c6efc2259d0`
through owned merge `18f3515c`; normal native sign-in proof must include it.
Owned branch: `codex/sextant-phase4-take-it-afield`. Phase 3 product #701 merged
as `787d406b382f251baa691a536cdaa41446e8e0ac`; evidence #702 merged as
`508ee106d8bc8cacbebaf169372dda75d15f2f18`. Actual GitHub merge readback and
current Phase 3 receipt establish software acceptance; native/D4 gates remain.

Authority: Sextant v1.0 section 55.4 and native/provider/privacy sections;
Sextant v1.1 Reach amendment; Spatial Experience effective authority and ownership
registries; Landfall v1.2 boundary; Sounding Line Device Lab annex v1.0/v1.1 and
effective software authority. Expand targeted slices when implementation requires.

Scope: activate existing shared lab first; canonical real Android/iOS native
providers and lifecycle/power/permission/haptic/nearby integration; deterministic
physically coordinated sensor scenarios and faults; real D2/D3 execution;
consumer integration and accessible ordinary capability surfaces; source-bound
evidence, current docs, indexes and catalog assessment; reviewable PR.

Preserve: Landfall world/navigation, Parallax anchors/scenes, Crossdeck pairing
and synchronization, Watchglass perception, Reach intent/camera acquisition,
Storytide/Lanternwake presentation, Drydock validation, One Voyage progression.
Sextant owns generic acquisition. Retain accepted Landfall wire contracts through
delegation; do not run competing sensor subscriptions.

Non-goals: Phase 5; owner's personal devices/accounts; private content;
new billing; invented hardware proof; release or acceptance without required D4.
Use hosted ephemeral environments and synthetic content. Investigate existing
remote-device access; keep exact external blockers without abandoning other work.

First operational experiment: hosted accepted-base Android primary profile with
motion-walk and native instrumentation; hosted iOS primary profile with actual
native XCTest and permission-denied-native. Historical UNSUPPORTED stays unchanged.
Local Windows has no configured SDK/AVD. Installed locked dependencies are owned.

Completion: all technically attainable engineering and isolated checks, faithful
receipts with injection/OS/physical distinctions and cleanup, normal Sounding Line
qualification and clean reviewable PR. Formal Phase 4 acceptance/merge requires
core D4 bring-up; virtual evidence cannot waive it.

## Qualification handoff

Source under development contains native generic acquisition/hardware/power and
position ownership, shared companion transport, ordinary Devices controls, 17
additional D0 scenarios, and registered `unit.sextant` / `browser.sextant` coverage.
The reconciled 284-test focused boundary regression passes. Owned hosted run
38170318327 passed the unfiltered root (3205 tests/526 files) and retained desktop/
mobile screenshots for exact source0f8ac197. The formerly unclaimed root contract
is consumed; do not duplicate it. Ordinary38169764018 also passed that source.
Android primary38169456020 and profiles38169916074 passed all20 registered cases
per profile; native consumer38169900062 passed real WebView/OS controls and cleanup.
Keep original receipt source identities and failed historical results intact.
Visual/control follow-up requires fresh ordinary/browser and native consumer
qualification; it does not justify repeating unchanged native profile matrices.

Candidate identity is resolved from the published branch HEAD/tree and recorded
in the native turn and ignored `artifacts/sextant-phase4-checkpoint.json` after
publication. The first published source `d53b3d8876fee85b20875071848fd1a5f0820b5a`
has Android PASS run38164052885 and iOS FAIL run38164057697. These qualify only
that source. New location/hardware/consumer changes require fresh native receipts.

Preparation: Node24.19.0, npm11.x, locked `npm ci --ignore-scripts`, then
`npx --no-install prisma generate --schema prisma/schema.sqlite.prisma`.
Local feedback used Node24.18.0/npm11.9.0. Hosted formal qualification must use
the pinned Node24.19.0; local feedback does not prove that exact toolchain.
Current reconciled lock SHA256:
`1dc07127fe4874a0d63baaf36fd4b644b1cbb0c37860312b11873c103a56b373`.
Earlier receipts retain their original lock checksum. Accepted main changed package
and Prisma inputs; one fresh combined root/browser run is intentional. Preserve
the old consumed root contract and bind a distinct new dispatch to the new source.
Use a clean owned checkout, synthetic fixtures, no inherited production DB/token
configuration. Full root command is `npx --no-install vitest run`; ordinary
qualification uses trusted protected-main `scripts/sounding-line/ordinary.mjs`
against exact base/candidate, or the existing hosted Sounding Line workflow.

Registered browser proof must run through the existing generic profile wrapper,
which owns the absolute nonce-bound SQLite clone, HTTP port, build and Chromium.
Do not call the browser test directly against shared runtime. The new D1 route is
`tests/e2e/sextant-phase4.spec.ts`; its native transport double is never D3 proof.
Actual Android Devices UI runs in the existing owned native Journal pair harness,
with real WebView/bridge/OS observations, pause/fallback, unchanged progression and
both viewport/native screenshots. Preserve its original pairing/radio checks.

Native dispatch: `node --import tsx scripts/landfall/device-lab/hosted.ts <sha>`
followed by target/tier/scenario/profile. Development primary jobs use Android
`android development motion-walk primary-phone` and Apple
`ios development permission-denied-native primary-phone`. Broader profile and
native Journal/presentation runs are intentional candidate/closure checks once
primary compilation succeeds. Harvest with `scripts/landfall/device-lab/harvest-hosted.ts`
and the exact run ID + dispatch.json; cleanup is mandatory and failure is retained.

Other active owners: Parallax Studio/Lens visuals and placement; Pilot narrative
acceptance; A1 Assistant proposals/provider/quota/Admiralty. Do not change shared
editor, Lens, authoring or Prisma seams without the recorded bilateral contract.
This branch adds only canonical device seams and its ordinary Devices panel.

Follow-up evidence: e03ffe37 ordinary38171494446, corrected browser38171503151,
actual native Devices38171499881 (ten OS samples, no progression) and primary
UWB38171814218 passed. Android OS lifecycle38171250062 passed at0f8ac197.
Apple presentation38170965786 passed31 tests/one expected skip; its UIKit
unconfigured-shell screenshot is not normal Devices-page Apple UX proof.
Android background38170904429 failed Google geofence registration NOT_AVAILABLE.
The public Location Accuracy entry probe has a bounded observed-entry wait with
race/absence tests. Source-bound Android38173731438 passed full signed notice
return, actual reboot/registration, revoked return, zero progression and cleanup.
Retain the earlier failure. Primary iOS38169460273 ended at its hosted limit;
compatibility/tablet38170962062 ended with eight/seven passing canonical cases.
All18 completed scenario cleanup receipts passed. Narrow38174199753 ended FAIL:
lost-response location input passed but authority rejected stale evidence; geofence
foreground XCTest passed but the WebView client timed out. Both cases cleaned up.
Do not repeat completed matrices or relabel old receipts. Lost-response synthetic
policy now uses the same authored ten-minute retry window as native restart, with
original timestamps and expiration/stale regression tests; product defaults stay.
Bounded debug-loopback lifecycle delivery counters and client stages are diagnostic,
not a geofence fix or a qualification pass. Obtain their actual source-bound proof.

The independently selected `sextant-native-apple-devices.spec.ts` invokes an actual
normal sign-in/Personal Harbor/Devices XCTest using the existing generic isolated
runtime. Require actual screenshot/test/cleanup receipts before Apple UX claims.
Baseline apple-build explicitly excludes this independent product journey.
One owned primary Mac job can compile native source, run only the two failed
canonical scenarios and execute the separate product journey; do not create a
second Device Lab or duplicate the consumed root runs. At c21c8cd9, combined root
38173786484 passed3268/533 and ordinary38173726401 passed all10 obligations.

At candidate4f3e3a42, owned Mac38177781664 ended FAIL in UI-test compilation:
`XCUIElement` has no `count`. The query now selects firstMatch and requires actual
existence. No native test/scenario/product journey ran in that failed job. Preserve
the compiler/result/cleanup artifacts and use a distinct corrected-source contract
for the same bounded primary Mac scope. Ordinary38177846432 completed PASS for
4f3e3a42/base678dd115: all10 obligations,2173tests/322files,two D1 PASS and two
opt-in native SKIP. Never relabel it or duplicate it to debug the Swift test.

Native artifacts are stored at
`D:\Codex_Task_Artifacts\Sextant_Phase4_01a12c17_20261011\landfall-device-lab`;
the original ignored worktree artifact path is a junction. Relocation retained
40154 files and verified21 historical receipts/39882 hashes. Preserve all result
bundles, screenshots, failed transfers and receipt identities. New collectors use
the original paths and append; do not delete historical proof to recover space.

When only hosted/external results remain, preserve exact HEAD/tree/dirty state,
run IDs, completed checks, ownership and resume triggers; end the native turn.
Ending that turn does not complete this goal or accept Phase4. On resume, verify
current branch/PR identities and receipts before further action. D4 access/signing
remains externally unavailable; all attainable source/virtual qualification and
reviewable PR publication must finish before closeout.
