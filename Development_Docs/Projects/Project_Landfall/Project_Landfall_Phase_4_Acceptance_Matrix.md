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

Current clean source `9514f185` passes **477 unit files / 2,707 tests** in an
owned detached worktree with fresh SQLite (237.18 seconds). Selected formatting
(242 files), lint (216 files, zero errors), TypeScript and exact tracked-source
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
and cleanup PASS. Xcode reports **17 passed / zero failed / one hardware-only
skip**, including four throttle regressions; the lifecycle UI test passes.
Compatibility offline-restart/region run37223293060 passes both scenarios:
the second native callback is forwarded (2/2), qualifies in947ms, and restart
reconciliation writes exactly one expected canonical event. Region wake writes
zero. Both clean up; its harvest retains5,640hashed artifacts and successful
transport cleanup. The native suite again reports17passes/one hardware skip.
Full three-profile iOS
run37224038483 on `2654d7b8` remains active. Focused tablet input run37224452331
on `80b8dbe4` remains active. A lab-only bounded Simulator input wrapper passes
12 unit cases; acknowledgment never substitutes for an actual native fix.

Retained input comparisons show production web, dependency and schema trees
unchanged from C8; native Android unchanged from01bab29b; and native iOS unchanged
from2654d7b8. The shared executor's later bounded input wrapper receives separate
focused actual execution. Every receipt retains its original source identity.
No final protected qualification, merge or closure has occurred.

| Requirement                                     | Accepted source/evidence                                                                                                                                                                                | Remaining acceptance                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sole progression / Worldspaces                  | One Voyage remains the sole writer; physical and virtual contexts retain shared canonical contracts. Full unit and retained browser suites pass.                                                        | Final ordinary qualification and landed verification.                                                    |
| Android companion                               | 80 profile scenarios, 12 native instrumentation tests per profile; unsigned debug/release builds and release exclusion inspection.                                                                      | Final qualification; signed distribution and physical acceptance.                                        |
| Apple companion                                 | Origin-bound WKWebView/Core Location; 17 XCTest passes and one unsupported hardware skip; focused actual wake passes.                                                                                   | Complete new three-profile native matrix, final qualification; signed distribution and devices.          |
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

Frozen37219804462 signed-notice receipts on clean c8e8b1de measure actual
current-Journal returns45,387/50,691ms and revoked-membership returns13,061/14,029ms
on primary/low-resource guests, all below60,000ms. Reboots33,406/32,499ms preserve
guest identity and change boot identity; registered recovery reaches GRANTED.
Full-Journal PSS peaks at108,001/122,264KiB below the preliminary512MiB bound.
Native-parent CPU samples span0.849–1.333percent of all guest vCPU capacity;
whole-guest activity spans8.722–92.936percent and includes renderer/OS activity
without separate attribution. Both actual notices, authorized return, removed
membership denial, native clearing, canonical0, source unchanged and cleanup PASS.
These measurements establish bounded virtual execution; they do not establish
whole-app CPU percentages, sustained thermal behavior, physical battery or field
latency. The earlier observations below remain source-bound historical samples.

Optimized Chromium run37187344378 on57b1a77e1094 measures a375px Journal with256
released waypoints: cold1506.99ms, warm660.78ms and offline346.02ms. The measured
origin usage is7,489,755bytes; it includes the whole isolated origin and is not a
region size, native RAM measure or phone battery result. These are single observed
samples under a preliminary30-second full-Journal budget, not percentiles.

Apple run37187691206 on9dfdfd93 measures real isolated authority count424ms first,
5–9ms subsequent, authorize44ms and submit142ms. Earlier transient failures remain
in the evidence set. Android prior reboot observations were30,992ms and25,598ms;
those cases did not register a geofence and cannot prove region reboot recovery.

Configured region browser run37191302966 on04311162 measures preparation225.20ms,
resume163.11ms, offline restoration274.81ms, corrupt rejection228.79ms, verified
installation148.92ms and removal179.57ms under preliminary15-second operation
bounds. All14 optimized cases pass with zero canonical writes. Verified resources
total5,576bytes; whole-origin usage grows from3,830,710to5,865,625bytes.

Android run37190933685 on2685ee0f passes11 instrumentation tests. Three real sensor
intervals report159/9/6process CPU milliseconds,59,826/54,597/54,391KiB PSS and
20/23/24callbacks, with stop verified. This unconfigured-Activity process measurement
does not establish full-Journal RAM or physical energy. Apple run37190937839 passes
12 XCTest tests and one unsupported-hardware skip. Four observed encrypted-lease
batches (warmup plus three configured iterations) take49.26–75.43ms and store
33,704–33,712bytes for eight4KiB records. Actual CPU/memory metrics remain in xcresult.

These are observed samples rather than percentiles. Final profile/action budgets,
first native fix, suspend/resume and notification return still need measurement.
Physical battery drain, thermal and OEM scheduling remain device/field gates.
No performance closure is claimed.

The newer Android four-profile run37192590886 records44first-qualified-fix samples
of24.8–6224.5ms and passing preliminary action bounds. Twelve two-second native
sensor intervals measure process CPU at most25ms, PSS25,117–53,329KiB and incremental
PSS at most106KiB; stop is verified throughout. These are bounded observed samples,
not full-Journal RAM or physical energy. The newer optimized browser run37192540400
passes14Phase4cases, with cold1669.44ms/warm651.51ms/offline430.71ms at375px and256
waypoints. Expanded50case regression run37192939572 finds four failures (46pass),
now addressed by live static-map position, hidden-map focus and legacy Worldspace
source-policy fixes; a fresh complete browser receipt remains required.

That expanded browser repair is now verified: run37194193502 on c2ff9517 passes
all50Phase1–4optimized scenarios. Frozen989e684e broad regression passes469root
unit files /2,662tests using fresh SQLite. The b813ccec exact tracked-source scan
finds zero private-content violations and six classifications. Bridgewatch's
independent24-file /80-test suite passes with one worker on b813ccec; a preceding
two-worker run hit the existing five-second data-fabric test timeout, while that
test also passes alone. No test timeout or protected testing authority is changed.

Signed native run37198352248 measures initial Journal process PSS96,282KiB and
103,292KiB after actual notice return. Its first notice follows inside input in
6171.96ms; actual reauthorized return takes45,116.43ms, within the preliminary
60second bound. The later registered-reboot failure still prevents acceptance of
the complete journey. New15second foreground intervals measure parent-process
and whole-guest CPU separately; primary run37200023666 measures parent1.216%/8.875% and guest75.263%/21.5%. These counters do not
attribute isolated renderer CPU or qualify physical battery/thermal behavior.

## External-gate ledger

| Missing resource                                      | Implemented path / automated evidence                                                         | Required owner action and honest fallback                                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real Android/iPhone and assistive-technology device   | Native source, hosted APK/XCTest and selected emulator/simulator checks exist.                | Qualify signed origin-bound releases on owned real devices; verify permissions, suspension, power, safe areas and assistive interaction. Continue through readable first-party web guidance when optional native functions are unavailable. |
| BLE beacons, NFC installation and UWB/NI peers        | Native adapters and strict context/identity tests; some actual virtualized radio acquisition. | Test actual hardware, protocol acquisition, radio accuracy/pose, authenticated identity limits and cancellation. Never label simulation as real RF or field proof.                                                                          |
| Indoor/multifloor and outdoor field route             | Contextual confidence and optional sensor contracts.                                          | Conduct consented real field runs for multipath, floors, battery, background/OEM timing and safety/accessibility. Authored guidance remains uncertified; automatic evidence must stay qualified.                                            |
| Production provider account/rights/credentials        | Server-only optional provider configuration and simulation matrices.                          | Supply an approved licensed service configuration and verify demand/quota/recovery. Until then show `NOT_CONFIGURED` and keep authored guidance.                                                                                            |
| Native signing/distribution and production deployment | Candidate builds and unsigned manifest analysis; no deployed native availability claim.       | Release owner qualifies signing, package identity, store/distribution, origin and update/rollback. Unsigned lab builds are not a public release.                                                                                            |
| Live Watchglass                                       | Intentional `NOT_CONFIGURED` boundary and contextual interface only.                          | A separately governed recognition integration would require its own authority and evidence. Phase4 does not introduce a recognition engine or Phase5.                                                                                       |

Cold authenticated revoked-membership OS notification return,
final matrix/performance/security checks,
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

## October 4 clock, cold-return and Apple follow-up

Run37200528339 on2a1b93df opens both real native Journals/Maps and returns
STATUS/CREATE/STOP200. CREATE reports BEYOND_CLIENT_45S and the client rejects
PAIR_CHANGED. The broker now returns bounded server remaining time while retaining
absolute server expiry and authorization. Client timers subtract the full measured
request duration, use a monotonic deadline, reject changed expiry/clock rollback,
and never extend a previous deadline. Only remaining native-session time is
translated to the device clock; actual native acceptance remains pending.

Primary signed run37200023666 onb813ccec proves first actual notice/HTTP307/current
Journal return, a changed boot ID after34,857ms, actual BootReceiver GRANTED
observed36,209ms after guest readiness, and a second actual notice after1091.55ms.
The revoked-membership return fails: the existing platform operation reports DENIED,
not the required UNAVAILABLE. Session persistence is being corrected; this failure
remains retained, with zero canonical writes and cleanup PASS. Parent CPU is
1.216%/8.875% over actual15second foreground intervals; whole-guest active CPU is
75.263%/21.5%, including OS and renderer without separate attribution. PSS is
89,809/104,048KiB; first notice5194.4ms and return23,902.96ms. New preliminary
parent ceiling50% of all guest vCPU capacity is a gross emulator regression bound,
not a physical energy or renderer budget.

The Android activity now requests one off-thread CookieManager flush at pause and
destruction. It never reads, logs or extends credentials; storage failure does not
grant authorization. Android documents flush as persistent-storage blocking I/O
([CookieManager](<https://developer.android.com/reference/android/webkit/CookieManager#flush()>)).
The actual harness checks persistent HttpOnly session configuration in memory,
retaining only a boolean. A source-bound observer projects existing platform return
logs to finite outcome/duration categories, with no raw logs, claims, URLs, epochs
or credentials. Actual notice UI observations are bounded and ambiguity fails closed.

Apple compatibility run37199621143 passes all10 lost-response steps with exactly
one canonical event and cleanup PASS. Restart gets two actual CoreLocation fixes,
then a readonly counts IPC request times out after23,299ms under XCTest load; the
following cleanup counts call takes87ms. This does not establish SQL duration.
The completionRequests assertion now uses the actual native-page counter without
an unrelated discarded DB read. Canonical/server-confirmed assertions continue
fresh real DB reads; only readonly counts IPC has a30second deadline. Writes,
authorization and cleanup retain their15second bounds. Fresh hosted restart proof
remains required.

The corrected TypeScript source passes473 root unit files /2,676tests on fresh
SQLite (unit-regression-c25ca0140b8849978176f74dafd191d5). This precedes the Android
cookie persistence and additional e2e diagnostics; no full native acceptance,
protected qualification, mainline availability or phase closure is claimed.
