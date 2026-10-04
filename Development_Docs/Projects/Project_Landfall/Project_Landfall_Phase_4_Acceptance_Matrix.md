---
title: Project Landfall Phase 4 acceptance matrix and external gates
audience: product-engineering
status: current
canonical_for: project-landfall-phase-4-acceptance-matrix
last_reviewed: 2026-10-04
---

# Hold the Bearing acceptance matrix

Phase 4 remains in development. This current engineering record consolidates
provider/native capability acceptance, privacy/security review, measured performance
and external gates. It is not a completion receipt. The [design record](Project_Landfall_Phase_4_Native_Companion_Design.md)
contains implementation detail and chronological evidence; the [operations record](Project_Landfall_Phase_4_Operations_Record.md)
contains containment and recovery. The [Device Lab addendum](Project_Landfall_Phase_4_Device_Lab_Addendum.md)
controls evidence classification. Every source-changing candidate still needs
fresh qualification before protected integration.

## Implemented capability and evidence boundaries

Current clean source `8e6e3e19` passes **478 unit files / 2,714 tests** in an
owned detached worktree with fresh SQLite (214.59 seconds). Selected formatting
(244 files), lint (218 files, zero errors), TypeScript and exact tracked-source
privacy scanning (zero violations, six classifications) pass. The schema and
dependency inputs remain unchanged from the earlier validated candidate.

Frozen source `c8e8b1de` passes the optimized build/client privacy scan. Its full
hosted run **37219804462 remains FAILED**, with 19,773 hashed artifacts and
successful transport cleanup. Browser (53 scenarios), Windows/Linux providers
(159 cases each), both first-party Journal pairs, both signed notice/reboot
flows and Android primary/low-resource/tablet (60 scenarios) pass. Compatibility
reboot and primary UWB fail in that run. Full sequence rechecks on `01bab29b`
pass compatibility 20/20 plus 12 instrumentation tests (37221706364), and radio
4/4 on each primary/low-resource profile (37221708792). Android therefore has
80 passing profile scenarios and eight passing radio cases, with original failed
results retained. Diagnostic-only rechecks establish no deterministic root cause.

The frozen Apple matrix passes 23/27: primary 8/9, compatibility 7/9, tablet 8/9.
The four failures are primary background observation, compatibility region OS
input termination, compatibility offline-restart final-fix loss, and tablet
offline input termination. Diagnostics identify an actual native drop-only
throttle bug. One latest transient fix is now coalesced with its original
timestamp and consent/freshness/generation gates. Permission/precision changes,
system pause, stop and restart cancel pending delivery.

Focused primary region wake **37223287847 on 4341f2e5 passes all ten steps**:
actual background/foreground, encrypted delegate hints, removal, canonical zero
and cleanup PASS. Xcode reports **17 passed / zero failed / one unconfigured-driver
skip**, including four throttle regressions; the lifecycle UI test passes.
Compatibility offline-restart/region run37223293060 passes both scenarios:
the second native callback is forwarded (2/2), qualifies in947ms, and restart
reconciliation writes exactly one expected canonical event. Region wake writes
zero. Both clean up; its harvest retains5,640hashed artifacts and successful
transport cleanup. The native suite again reports17passes/one unconfigured-driver skip.
Full three-profile iOS run37224038483 on `2654d7b8` finishes **25/27**:
tablet9/9, primary8/9 and compatibility8/9. Both failures are offline restart.
Primary's read-only count IPC times out; compatibility's117,815ms UIKit relaunch
outlasts the unchanged90-second outbox. Current lab handling uses documented
OS launch followed by actual foreground/client/lease assertions, plus at most
one fresh read-only count redispatch while the same owned child remains live.
No evidence lifetime or authority/write deadline is extended. Full primary and
compatibility rechecks37228402022 on `8e6e3e19` remain active.

Focused tablet input run37224452331 on `80b8dbe4` passes, including one actual
input deadline followed by acknowledgment, native qualified fixes and exactly
one canonical event. Acknowledgment never substitutes for an actual native fix.
The wrapper's12 guard tests and the count reader'ssix guard tests pass.

Actual Apple notification/deep-link case37226211477 fails at notification
permission; canonical zero and cleanup pass. Main-queue reply correction and
finite DEBUG diagnostics are under actual recheck37227624737 on `18c2f4a0`.
This additional acceptance gate requires real permission UI, background notice,
SpringBoard tap and native same-origin return. Its synthetic nonce landing proves
OS handoff only; production signed authorization has separate shared and Android
first-party coverage. No notice return is yet claimed.

Retained input comparisons show production web, dependency and schema trees
unchanged from C8; native Android unchanged from01bab29b; and native iOS unchanged
from2654d7b8. The shared executor's later bounded input wrapper receives separate
focused actual execution. Every receipt retains its original source identity.
No final protected qualification, merge or closure has occurred.

| Requirement                                     | Accepted source/evidence                                                                                                                                                                                | Remaining acceptance                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sole progression / Worldspaces                  | One Voyage remains the sole writer; physical and virtual contexts retain shared canonical contracts. Full unit and retained browser suites pass.                                                        | Final ordinary qualification and landed verification.                                                    |
| Android companion                               | 80 profile scenarios, 12 native instrumentation tests per profile; unsigned debug/release builds and release exclusion inspection.                                                                      | Final qualification; signed distribution and physical acceptance.                                        |
| Apple companion                                 | Origin-bound WKWebView/Core Location; 17 XCTest passes and one unconfigured-driver skip; focused actual wake passes.                                                                                    | Complete new three-profile native matrix, final qualification; signed distribution and devices.          |
| Renderer / Creator / Player / Drydock / Captain | Canonical released chart, authored routes, semantic navigation and current surfaces; 53 optimized browser scenarios with bounded visual review.                                                         | Final qualification; physical assistive technology and owner acceptance.                                 |
| Remote suggestions                              | Concrete Nominatim-compatible forward/reverse geocoding, OSRM routing and Open-Elevation; 159 provider scenarios on each Windows/Linux host.                                                            | Production licensed endpoints, credentials and quotas are NOT_CONFIGURED.                                |
| Signed offline regions                          | Ed25519/hash/AES-GCM scoped packages, current released authorization, interrupted resume, image decode, corruption rejection and removal; native reconciliation goes through One Voyage.                | New complete Apple offline/restart matrix and final qualification; deployment keys and physical restart. |
| Background wake / signed notice return          | Both Android signed first-party flows pass actual notice tap, registered same-guest reboot, fresh membership denial, native clear, canonical zero and cleanup. Focused Apple real delegate wake passes. | New complete Apple matrix; field latency, OEM scheduling and physical energy.                            |
| BLE / iBeacon / Eddystone / UWB                 | Eight radio profile cases pass actual callbacks/ranges, bounded stop, canonical zero and cleanup. Both Journal pairs pass real ceremony/report/stop with all HTTP200.                                   | Physical RF, authenticated peer identity and accuracy.                                                   |
| QR / NFC identity                               | Real imagefile-camera decode and signed identity/context verification; acquisition remains deliberate. Identity never proves arrival.                                                                   | Physical camera conditions and NFC radio.                                                                |
| Motion / heading / barometer / fusion           | Bounded optional native hints and measured Android stop intervals; freshness, uncertainty and correlated-root rules preserve confidence truth.                                                          | Physical calibration, indoor/floor, energy and thermal measurements.                                     |

Earlier chronological development receipts and failed attempts remain in the
[design record](Project_Landfall_Phase_4_Native_Companion_Design.md). They are not
reclassified as current passing acceptance.

## Security and privacy review

Review scope includes both native hosts, bridge authorization, optional providers,
signed/encrypted packages, notification returns, first-party pairing, remote network
configuration and operational/lab artifacts. This is a source review of the candidate;
no independent penetration test or production certification is claimed.

The updated production dependency audit reports zero findings after compatible
Next/Sharp/PostCSS/Fastify-static/deepmerge-ts remediation. The full audit retains
five high development-only ESLint recursive glob/brace findings; repository-owned
patterns are not accepted from Landfall requests. Prisma generation and isolated
schema validation pass; Bridgewatch regression passes24files/80tests. This does not
claim an independent security certification.

| Threat                                                          | Candidate defense reviewed                                                                                                                                                                                                                              | Acceptance boundary                                                                                                                                                        |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Untrusted iframe/origin calls native operations                 | Android listener requires allowed origin, main frame and bounded message; production origin is configured HTTPS. Apple main-frame/origin restrictions and origin tests remain. Loopback HTTP lab overrides are debug-only.                              | Final native manifests/package analysis and hosted tests; deployment origin certificate/configuration needs release owner proof.                                           |
| Hidden/replayed/private content in offline data                 | Membership, pinned published version and revealed projection are checked server-side. Scope/expiry/signature/hash/AES-GCM protect package metadata and resources. Cached content is bounded historical authorization, not current online authorization. | Actual corruption/resume/revocation/restart test matrix; unknown future membership revocation cannot be discovered while wholly offline.                                   |
| Forged or ambiguous Ed25519 verification                        | Public-only canonical key validation, strict signatures and conservative WebCrypto fallback; shared verifier's29 focused tests include mutation, malformed/private keys and forgery cases.                                                              | Final dependency audit and qualification; no private key/client bundle or saved lab key. Existing unrelated dependency findings remain separately recorded.                |
| Geofence/notification/token promoted into arrival               | Wake hints and return handles contain no arrival receipt. Return reauthorizes current identity/membership/version/status; signed installation identity still reports physical presence `NOT_PROVEN`.                                                    | Actual OS wake/tap and canonical zero-write assertions remain required.                                                                                                    |
| Radio tracking, pairing disclosure or peer trust escalation     | BLE addresses salted per scan; bounded ephemeral discovery. Pairing code/key exchange is same-account/current membership and expires; session protection does not authenticate Chronicle peer identity.                                                 | No code/key/address/raw sample retained in screenshots or receipt. Two-profile first-party native pairing passes on37204106963; physical peer identity remains unverified. |
| Optional remote endpoint or credential injection                | Server-only endpoint/profile/credential references, request bounds, explicit consent and configuration validation; client cannot supply URLs/headers as provider authority.                                                                             | Live credential/network/SSRF deployment review remains necessary; only configured licensed demand may be enabled.                                                          |
| Continuous coordinate/sensor logs or real content in validation | Finite operational categories exclude identities, precise coordinates, queries, keys and raw streams. Lab fixtures are public synthetic, owned and isolated; debug acquisition diagnostics retain bounded categories/counters.                          | Final artifact/static privacy scan and native release exclusion verification. Real private content is never a troubleshooting fixture.                                     |

An authorization failure must remove current authority even if a saved chart remains
readable. Permission revocation, power constraint, lifecycle stop and logout/private
data clearing are tested independently from provider success. A failed receipt
must not be relabeled as passing because fallback guidance is readable.

## Performance evidence and gaps

Measurements are observed samples with preliminary regression ceilings, not
percentiles, service-level guarantees or physical-device energy qualification.
Each source-bound receipt retains its configuration and measurement scope.

| Workload / source                                              | Actual measured result                                                                                                                                                  | Scope and preliminary ceiling                                                                                                                                     |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C8 optimized Journal, 256 released waypoints,375px, one sample | Cold1,611.314ms; warm593.865ms; offline370.830ms; whole-origin usage8,125,207bytes.                                                                                     | Complete Journal readiness, including navigation/hydration; each below30,000ms. Storage is whole-origin usage, not region bytes or RAM.                           |
| C8 signed region, three resources /5,576bytes                  | Prepare166.926ms, resume148.176ms, offline restore280.495ms, corrupt rejection260.786ms, fresh install153.939ms, removal82.176ms. Origin usage5,636,128→5,691,288bytes. | Each below15,000ms; verified resource bytes and whole-origin growth are separately measured. Actual browser decode/corruption/removal, no physical restart claim. |
| C8 Android signed return, primary / low-resource               | Authorized45,387/50,691ms; revoked13,061/14,029ms; same-guest reboot33,406/32,499ms; registered recovery GRANTED.                                                       | Real native notice/return, all return actions below60,000ms; no physical field/OEM latency claim.                                                                 |
| C8 full-Journal Android memory                                 | PSS peaks108,001/122,264KiB.                                                                                                                                            | Observed guest processes below preliminary512MiB; no physical memory/thermal guarantee.                                                                           |
| C8 Android CPU                                                 | Native-parent0.849–1.333percent of all guest vCPU capacity; whole-guest8.722–92.936percent.                                                                             | Parent and guest counters are separate; guest includes OS/renderer without attribution. No whole-app CPU or energy claim.                                         |
| Prior four-profile Android native sensors                      | Twelve two-second intervals: process CPU at most25ms; PSS25,117–53,329KiB; incremental PSS at most106KiB; stop verified.                                                | Native unconfigured-Activity process, not full-Journal or physical energy. Original run37192590886 remains historical source-bound proof.                         |
| Apple primary focused wake,4341f2e5                            | Native first fix6,745ms; background observation2,715ms; held region input364,782ms; foreground return3,280ms; UI finalization50,627ms.                                  | OS action wall clock; region input below390,000ms and finalization below240,000ms. Intentional two180-second waits are included, not inferred field wake latency. |
| Apple compatibility focused restart,4341f2e5                   | First qualified fix10,402ms; second947ms; native callbacks2/forwarded2; exactly one canonical event.                                                                    | Actual Core Location observations and One Voyage reconciliation; no simulated delegate or physical GPS claim.                                                     |
| Prior Apple encrypted-lease batches                            | Four observed batches49.26–75.43ms; eight4KiB records occupy33,704–33,712bytes; xcresult preserves CPU/memory metrics.                                                  | Native encrypted metadata storage only; original run37190937839. No full-Journal physical RAM/energy claim.                                                       |

The complete new iOS profile matrix remains an acceptance gate. Physical battery
drain, thermal behavior, renderer CPU attribution and field/OEM scheduling remain
explicit device/field gates. Source observability exposes bounded coordinate-free
outcomes; process-local demand history does not claim fleet uptime. Earlier failed
timings and diagnostic attempts remain in the design record with original identity.

## External-gate ledger

| Missing resource                                      | Implemented path / automated evidence                                                         | Required owner action and honest fallback                                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real Android/iPhone and assistive-technology device   | Native source, hosted APK/XCTest and selected emulator/simulator checks exist.                | Qualify signed origin-bound releases on owned real devices; verify permissions, suspension, power, safe areas and assistive interaction. Continue through readable first-party web guidance when optional native functions are unavailable. |
| BLE beacons, NFC installation and UWB/NI peers        | Native adapters and strict context/identity tests; some actual virtualized radio acquisition. | Test actual hardware, protocol acquisition, radio accuracy/pose, authenticated identity limits and cancellation. Never label simulation as real RF or field proof.                                                                          |
| Indoor/multifloor and outdoor field route             | Contextual confidence and optional sensor contracts.                                          | Conduct consented real field runs for multipath, floors, battery, background/OEM timing and safety/accessibility. Authored guidance remains uncertified; automatic evidence must stay qualified.                                            |
| Production provider account/rights/credentials        | Server-only optional provider configuration and simulation matrices.                          | Supply an approved licensed service configuration and verify demand/quota/recovery. Until then show `NOT_CONFIGURED` and keep authored guidance.                                                                                            |
| Native signing/distribution and production deployment | Candidate builds and unsigned manifest analysis; no deployed native availability claim.       | Release owner qualifies signing, package identity, store/distribution, origin and update/rollback. Unsigned lab builds are not a public release.                                                                                            |
| Live Watchglass                                       | Intentional `NOT_CONFIGURED` boundary and contextual interface only.                          | A separately governed recognition integration would require its own authority and evidence. Phase4 does not introduce a recognition engine or Phase5.                                                                                       |

The remaining complete Apple matrix, final exact-source qualification,
documentation integration and protected closure are **local work**. They are not
external gates. Completion requires finishing that work, ordinary exact-candidate
qualification, protected merge, landed verification and the final accepted capsule
and completion receipt.

Each resource row above is **nonblocking for local source closure** once its
implemented path, actual attainable evidence and limitation are accepted. It
blocks production use or claims of the corresponding capability as follows:

- Real native devices and assistive technology: install the exact signed,
  origin-bound candidate on an owned Android and iPhone; exercise precise,
  approximate, denied and revoked permissions, foreground/background return,
  actual registered reboot, offline restart and local clearing. Repeat the
  Journal ceremony, chart, readable guidance and optional controls with TalkBack
  and VoiceOver, enlarged text and reduced motion. Native production qualification
  remains blocked until these device results are recorded.
- Optional BLE/NFC/UWB/NI hardware: run the published acquisition/session cases
  on actual peers and installations; record model/OS/provider versions, measured
  range/pose uncertainty, stop and power/lifecycle cleanup. Verify that unsigned
  or wrong installation identity and unverified peers cannot complete anything.
  Only the corresponding physical hardware claims are blocked; authored fallback
  remains available.
- Real field route: obtain consent for one indoor/multifloor and one outdoor
  authored route; record categorical permission/confidence outcomes, measured
  first fix, wake/return latency, power and uncertainty, then compare foreground
  server reconciliation with the authored objective. Check stairs/floors,
  multipath, cancellation and safety/readable fallback. Field accuracy, energy
  and OEM suspension claims remain blocked; no emulator result substitutes.
- Production provider resources: configure an approved licensed account through
  server-only references, exercise demand, attribution, quota/rate limiting,
  outage, rotation and recovery using synthetic authorized requests, and verify
  that private keys and raw locations never enter public projections. That
  service remains NOT_CONFIGURED until qualified; it does not block other
  configured providers or authored guidance.
- Native distribution/deployment: bind the final source to signed Android and
  Apple package identities, HTTPS origin and release hashes; verify install,
  upgrade, rollback, private-data clearing and same-authority reconciliation on
  the intended deployment. Native/public deployment is blocked until this
  release evidence exists. Unsigned diagnostic packages are not distribution.
- Watchglass: preserve the intentional NOT_CONFIGURED boundary. A future
  separately authorized integration must qualify its own recognition interface
  and context/expiry/privacy constraints. It blocks recognition availability,
  and does not block Phase4 production guidance or authorize new phase work.

## Historical diagnostic evidence

Original failed clock, notification, reboot, Apple input and restart receipts remain
in the [design record](Project_Landfall_Phase_4_Native_Companion_Design.md). Passing
rechecks do not erase their failures or rebind them to current source. Current
accepted results and still-open gates appear above.
