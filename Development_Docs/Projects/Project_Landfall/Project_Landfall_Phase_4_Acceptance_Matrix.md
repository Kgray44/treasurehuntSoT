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

| Requirement                                 | Candidate source / available evidence                                                                                                                                                                                                                                                                                                                                                                                                                    | Remaining acceptance                                                                                                                                                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sole progression authority                  | Shared authorized evidence/reconciliation calls One Voyage. Native providers, package installation and return navigation are not writers. Actual offline/restart reconciliation has written one expected canonical event through real isolated SQLite.                                                                                                                                                                                                   | Final candidate regression, exact-head ordinary Sounding Line and landed verification.                                                                                                                                                                            |
| PHYSICAL and VIRTUAL Worldspaces            | Existing Player rendering/context contracts remain canonical. Virtual offline reconciliation on Apple run37187691206 passes with zero physical acquisition.                                                                                                                                                                                                                                                                                              | Final complete Android/Apple profile matrices and regression of accepted Phases1–3.                                                                                                                                                                               |
| Android companion                           | First-party WebView, contextual permissions, encrypted private leases, power/lifecycle, foreground native location and optional native operations. Run37192590886 on e981edec passes80cases across primary, compatibility, low-resource and tablet profiles, including actual reboot/offline canonical reconciliation.                                                                                                                                   | Final exact-source qualification and signed distribution/physical hardware acceptance.                                                                                                                                                                            |
| Apple companion                             | First-party WKWebView, Core Location and optional capabilities/private storage. Actual hosted macOS/Xcode/iOS Simulator execution is available; run37187691206 passes11 XCTest cases with one unsupported hardware skip and real virtual offline reconciliation.                                                                                                                                                                                         | Final three-profile hosted matrix; signed distribution and real iPhone suspension/power/radio/field acceptance. Hosted Apple availability is not an external blocker.                                                                                             |
| Released map/route/place guidance           | First-party renderer and released views are preserved. Optimized browser run37187344378 passes13 cases including narrow/wide physical/virtual presentation and optional fallbacks.                                                                                                                                                                                                                                                                       | Final candidate configured/unconfigured browser coverage and visual QA.                                                                                                                                                                                           |
| Remote suggestions                          | Nominatim-compatible geocoding, OSRM routing and Open Elevation use server-only consented configuration, bounded requests, licensed summaries and authored fallback. Provider run37187347909 passes159 scenarios on each hosted Windows/Linux matrix.                                                                                                                                                                                                    | Final source scenario matrix. Production service agreements, credentials, quota and endpoint operation are `NOT_CONFIGURED` unless actually supplied and verified.                                                                                                |
| Signed offline regions                      | Server prepares only current authorized released chart/routes/first-party images. Ed25519, resource hashes, scoped AES-GCM storage and expiring leases gate use. Configured browser run37189971931 on9a355f07 passes preview, interrupted download, verified resume, signed-region offline image decode, corrupt-resource rejection after reload and local removal through real first-party API/UI. Its key exists only in the synthetic runner process. | Final source qualification. Deployment key/signing availability and physical restart remain separate.                                                                                                                                                             |
| Background geofence wake                    | Native OS registration/removal and encrypted bounded hint journals; fresh foreground evidence still required. Replacement fails closed when old OS removal fails. Run37195548575 on dea776cb passes actual Play services registration, OS receiver delivery, one encrypted hint and one generic notice using a separate debug APK's documented FLP mock input. All10steps pass, zero canonical writes and cleanup PASS.                                  | Registered-region reboot and actual first-party reauthorized notification tap remain local work. Mock coordinates do not prove physical geofence accuracy, wake latency or OEM scheduling.                                                                        |
| Notification return                         | Opaque authenticated encrypted actor/session/version/expiry claim; fresh sign-in, membership and current session status checked by server. Navigation only.                                                                                                                                                                                                                                                                                              | Actual OS notice/tap with real first-party return and revoked/expired access cases. Shared signing configuration is a documented coupling, not an independent kill switch.                                                                                        |
| BLE / iBeacon / Eddystone UID               | Deliberate bounded scan, native salted peer identifiers, strict fresh observations and no arrival authority. Radio run37197120565 on c546143c passes all three BLE protocols on primary and low-resource profiles through actual native callbacks, with null/UNKNOWN when RSSI is unusable, zero canonical writes and cleanup PASS.                                                                                                                      | Final exact-source qualification. Physical beacons/RF and authenticated peer identity remain required separately.                                                                                                                                                 |
| UWB / Nearby Interaction                    | Bounded native session negotiation and first-party same-account ephemeral pairing. Radio run37197120565 on c546143c passes actual untrusted UWB observations on both primary and low-resource profiles with zero canonical writes and verified cleanup.                                                                                                                                                                                                  | First-party native Journal run37197116855 fails at its first APK install under a15second tool limit before opening or HTTP. Install90sec/pair600sec envelope now awaits a new actual run. Real RF accuracy, pose and authenticated peer identity remain unproved. |
| QR / NFC installation identity              | Signed scoped tokens are identity/context, not proof of physical arrival. CameraX/ML Kit and native NFC reader are deliberate bounded acquisition. QR case in run37189975707 on9a355f07 passes real imagefile-camera decoding and signature verification: one frame, one decode, no decoder errors. Physical presence remains NOT_PROVEN and canComplete false.                                                                                          | Final profile qualification. NFC radio and physical installation acquisition require hardware. No decoded JavaScript injection qualifies as camera proof.                                                                                                         |
| Motion / orientation / heading / barometer  | Optional sensor hints with uncertainty and lifecycle/power checks; none independently confirms floor, coordinates or arrival. Four-profile Android run37192590886 passes actual sensor cases and12measured intervals with stop verified.                                                                                                                                                                                                                 | Final exact-source qualification. Real indoor/multifloor calibration and battery/thermal behavior require devices/field evidence.                                                                                                                                 |
| Creator / Drydock / Captain / accessibility | Existing authored policies, canonical previews and readable guidance remain; unsupported optional capabilities degrade explicitly. Browser mobile cases have run.                                                                                                                                                                                                                                                                                        | Final source regression and rendered verification; physical assistive-technology and owner usability acceptance remain external.                                                                                                                                  |

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

| Threat                                                          | Candidate defense reviewed                                                                                                                                                                                                                              | Acceptance boundary                                                                                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Untrusted iframe/origin calls native operations                 | Android listener requires allowed origin, main frame and bounded message; production origin is configured HTTPS. Apple main-frame/origin restrictions and origin tests remain. Loopback HTTP lab overrides are debug-only.                              | Final native manifests/package analysis and hosted tests; deployment origin certificate/configuration needs release owner proof.                            |
| Hidden/replayed/private content in offline data                 | Membership, pinned published version and revealed projection are checked server-side. Scope/expiry/signature/hash/AES-GCM protect package metadata and resources. Cached content is bounded historical authorization, not current online authorization. | Actual corruption/resume/revocation/restart test matrix; unknown future membership revocation cannot be discovered while wholly offline.                    |
| Forged or ambiguous Ed25519 verification                        | Public-only canonical key validation, strict signatures and conservative WebCrypto fallback; shared verifier's29 focused tests include mutation, malformed/private keys and forgery cases.                                                              | Final dependency audit and qualification; no private key/client bundle or saved lab key. Existing unrelated dependency findings remain separately recorded. |
| Geofence/notification/token promoted into arrival               | Wake hints and return handles contain no arrival receipt. Return reauthorizes current identity/membership/version/status; signed installation identity still reports physical presence `NOT_PROVEN`.                                                    | Actual OS wake/tap and canonical zero-write assertions remain required.                                                                                     |
| Radio tracking, pairing disclosure or peer trust escalation     | BLE addresses salted per scan; bounded ephemeral discovery. Pairing code/key exchange is same-account/current membership and expires; session protection does not authenticate Chronicle peer identity.                                                 | No code/key/address/raw sample retained in screenshots or receipt. Actual first-party native pairing remains unresolved.                                    |
| Optional remote endpoint or credential injection                | Server-only endpoint/profile/credential references, request bounds, explicit consent and configuration validation; client cannot supply URLs/headers as provider authority.                                                                             | Live credential/network/SSRF deployment review remains necessary; only configured licensed demand may be enabled.                                           |
| Continuous coordinate/sensor logs or real content in validation | Finite operational categories exclude identities, precise coordinates, queries, keys and raw streams. Lab fixtures are public synthetic, owned and isolated; debug acquisition diagnostics retain bounded categories/counters.                          | Final artifact/static privacy scan and native release exclusion verification. Real private content is never a troubleshooting fixture.                      |

An authorization failure must remove current authority even if a saved chart remains
readable. Permission revocation, power constraint, lifecycle stop and logout/private
data clearing are tested independently from provider success. A failed receipt
must not be relabeled as passing because fallback guidance is readable.

## Performance evidence and gaps

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

## External-gate ledger

| Missing resource                                      | Implemented path / automated evidence                                                         | Required owner action and honest fallback                                                                                                                                                                                                   |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real Android/iPhone and assistive-technology device   | Native source, hosted APK/XCTest and selected emulator/simulator checks exist.                | Qualify signed origin-bound releases on owned real devices; verify permissions, suspension, power, safe areas and assistive interaction. Continue through readable first-party web guidance when optional native functions are unavailable. |
| BLE beacons, NFC installation and UWB/NI peers        | Native adapters and strict context/identity tests; some actual virtualized radio acquisition. | Test actual hardware, protocol acquisition, radio accuracy/pose, authenticated identity limits and cancellation. Never label simulation as real RF or field proof.                                                                          |
| Indoor/multifloor and outdoor field route             | Contextual confidence and optional sensor contracts.                                          | Conduct consented real field runs for multipath, floors, battery, background/OEM timing and safety/accessibility. Authored guidance remains uncertified; automatic evidence must stay qualified.                                            |
| Production provider account/rights/credentials        | Server-only optional provider configuration and simulation matrices.                          | Supply an approved licensed service configuration and verify demand/quota/recovery. Until then show `NOT_CONFIGURED` and keep authored guidance.                                                                                            |
| Native signing/distribution and production deployment | Candidate builds and unsigned manifest analysis; no deployed native availability claim.       | Release owner qualifies signing, package identity, store/distribution, origin and update/rollback. Unsigned lab builds are not a public release.                                                                                            |
| Live Watchglass                                       | Intentional `NOT_CONFIGURED` boundary and contextual interface only.                          | A separately governed recognition integration would require its own authority and evidence. Phase4 does not introduce a recognition engine or Phase5.                                                                                       |

Unresolved first-party pairing, registered-region reboot/reauthorized OS notification return,
final matrix/performance/security checks,
documentation integration and protected closure are **local work**. They are not
external gates. Completion requires finishing that work, ordinary exact-candidate
qualification, protected merge, landed verification and the final accepted capsule
and completion receipt.
