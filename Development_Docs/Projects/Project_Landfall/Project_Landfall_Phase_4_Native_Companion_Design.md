---
title: Project Landfall Phase 4 native companion and restart design
audience: product-engineering
status: current
canonical_for: project-landfall-phase-4-native-companion-design
last_reviewed: 2026-10-03
---

# Hold the Bearing native companion design

This engineering design describes the development candidate. Phase 4 acceptance,
protected integration, deployed companion availability, physical-device qualification
and Project Landfall closure remain open. The [Device Lab addendum](Project_Landfall_Phase_4_Device_Lab_Addendum.md)
governs evidence fidelity. Active execution instructions remain under `.agents`.

## Acquisition and authority

The Android Activity and iOS WKWebView host the existing first-party Player.
The restricted main-frame bridge supplies physical OS locations, optional ephemeral
sensor hints and deliberate scanner operations. Released Worldspace policy still
controls accepted sources. Physical acquisition cannot provide virtual positions.
`NativeLocationProvider` applies timestamp, schema, consent and lifecycle checks
before the existing Landfall runtime. The authorized server requalifies submitted
evidence; One Voyage alone writes progression and Passage completion.

Native background transitions pause the shared runtime, clear ephemeral samples
and stop foreground providers even when WebView document visibility remains visible.
Returning to the foreground does not resume Player acquisition without deliberate
action. Serialized driver operations prevent an obsolete asynchronous start or stop
from disabling a newer user request.

Geofences retain bounded encrypted opaque return handles and categorical wake hints.
They do not retain location trails or complete a waypoint. Notifications use private
generic wording. Opening a return handle reaches the existing authenticated server
route, which checks current membership, published pin and Journey state. Fresh
foreground evidence remains necessary for location-based progression.

## Origin and deployment configuration

Android uses the Gradle property `landfallOrigin`, accepting one HTTPS origin.
iOS builds require both `LANDFALL_ORIGIN` and its matching hostname in
`LANDFALL_HOST`; the latter populates `WKAppBoundDomains`. An incomplete iOS domain
configuration stays unconfigured. Release navigation and native messages are
restricted to the configured origin and main frame. Neither native shell opens
arbitrary token URLs. Debug-only owned loopback overrides are for the Device Lab.

The app-bound iOS configuration enables the public offline service-worker path
within WebKit's restricted domain model. See [WebKit's app-bound domains design](https://webkit.org/blog/10882/app-bound-domains/)
and [the WebKit service-worker support record](https://bugs.webkit.org/show_bug.cgi?id=206741).
Source configuration does not establish App Store signing, entitlements on physical
hardware, deployment or successful offline presentation on iOS; those need receipts.

## Power and optional sensors

Both native bridges distinguish passive foreground-permission inspection from an
explicit Player permission request. Device Lab readiness and revocation checks use
the passive operation. Its Android executor verifies actual fine/coarse OS grants
and handles grant-change process termination by relaunching only the owned app.
Denied acquisition is checked against the real native start operation. A denied
grant cannot become a synthetic location fix, and request-count assertions retain
the maximum observed count across app restarts. The local Android permission
development suite passes; updated Apple compilation and grant execution remain
required. Approximate-permission control is unsupported in the current iOS lab.

Native power snapshots report bounded current OS categories. Android observes
PowerManager saver/thermal changes and current low battery; iOS observes ProcessInfo
power/thermal changes and low battery. Constrained acquisition requests at least
15-second location cadence, optional sensors pause, and critical thermal state
stops location and intensive scanning. Recovery does not restart stopped optional
providers. Player clears revoked sensor hints while preserving current position
guidance. Region downloads pause under native power constraints or unavailable
power status. Shared policy remains the presentation and test interpretation seam.

The policy follows [Android PowerManager](https://developer.android.com/reference/android/os/PowerManager)
and [Apple power notification guidance](https://developer.apple.com/documentation/xcode/responding-to-power-notifications).
An emulator's controlled battery/saver state proves adaptation; it does not prove
physical battery endurance, heat or vendor suspension behavior.

Android sensor scenarios discover enabled emulator controls, preserve their initial
values, inject bounded vectors and verify readback. Native SensorManager callbacks
cross the restricted bridge and the production `NativeContextProvider`; matching
requires the same raw-frame identity and derived context category. Heading controls
also supply gravity and magnetic vectors because the production provider uses the
OS fused rotation vector. Checks preserve its declared angular uncertainty. Pressure
uses successive inputs through the same relative-height adapter; it does not
establish a calibrated floor. Cleanup restores and verifies every changed input.
Conflicting or malformed native sensor frames stop optional hints and report
unavailable, so the Player clears prior hints and must deliberately restart them.
Physical calibration, magnetic interference, pressure drift and iOS sensor injection
remain separate fidelity or unsupported-lab gates.

## Offline bytes and restart leases

The public service worker caches only the public offline shell and bounded
first-party static code. Authenticated responses, private media and external tiles
do not enter CacheStorage. Released charts, authorized first-party resources and
delivery evidence remain in the existing bounded encrypted IndexedDB repositories.
Signed region manifests bind actor, Journey, published edition and Worldspace;
resource integrity, rights, capacity, expiry and revocation checks precede use.

The native private store mirrors only authorization metadata and trusted same-origin
package descriptors. It does not receive map or resource bytes. Android uses
origin-specific Android Keystore AES-GCM and no-backup files. iOS uses an
origin-specific device-only Keychain key, AES-GCM, file protection and backup
exclusion. Both stores enforce allowlisted keys, 128 records, 8 KiB values and a
maximum 24-hour expiry. Large descriptors use bounded chunks; SHA-256 metadata is
committed last. Partial, corrupt, expired or foreign-origin leases cannot restore
access. Surplus chunks are removed after smaller replacements.

An encrypted valid lease can select only a fixed Journal path for its bound Journey.
Web startup restores native metadata before actor-change checks or offline opening.
The private bytes still require their matching cryptographic binding. Logout and
explicit clearing revoke web data, region URLs, native hints and native leases;
generation checks prevent asynchronous writes from resurrecting cleared authority.
Browser-only leases remain tab-scoped. A saved native lease alone does not prove
the public shell is cached and controlling the page.

## Reconciliation and lost responses

The same `LandfallOutboxReconciler` serves Player delivery and Device Lab execution.
It coalesces concurrent sends, reauthorizes the current actor and published pin,
and checks a bounded actor-bound canonical receipt before stale-sequence handling.
If the server committed but its response was lost, the readonly receipt acknowledges
that event and clears the pending delivery without a second progression write.
Revocation and conflicting authority fail closed. Transient network failures retain
pending evidence within its lease; expired location evidence requires a fresh check.
The current location outbox expires after 90 seconds and never establishes an
unlimited offline arrival queue.

## Local lookup and authored readiness

The Player Chart searches only the released map scenes on the device. Search
does not index evaluation geometry, internal waypoint names or another Worldspace.
Both physical and virtual labels are available; approximate regions retain their
withheld centers. Selecting a result chooses the released map and highlights its
feature. A displayed physical point may move the viewing camera at the existing
zoom. Selection does not acquire a location, generate an observation, infer a
floor or submit progression. Search text and selection stay in component memory.
The coordinate lookup separately excludes approximate centers and honors public
labels. An unknown address still needs a configured external geocoder.

The focused production browser journey exercises both Worldspaces at phone and
desktop widths with synthetic accounts and a nonce-bound database. It verifies
keyboard selection, scoped accessibility, no location acquisition, no Landfall
mutation requests and unchanged canonical events/sequence. Capture review remains
separate from those assertions; it is not native WebView or physical-device proof.

Creator and the existing Drydock authoring findings use capability-scoped local
preflight for implemented authored search, routes, floor labels, virtual regions
and semantic maps. Data in one Worldspace cannot satisfy a requirement in another.
Explicit runtime statuses override the local data check. Device availability,
permissions, credentials and external health remain unestablished until their
adapters provide evidence. Authored routes do not establish an accessibility
assessment, and approximate labels cannot provide reverse-coordinate lookup.

## Development evidence and remaining proof

### Provisioned device profiles

Device Lab profile labels now require measured configuration. Android receipts
include actual API level, model, memory, pixel dimensions and density. Primary
phones use API 36; compatibility phones use API 35; low-resource phones use API 36
with at most 2 GiB of measured memory; tablet profiles require a smallest dimension
of at least 600 density-independent pixels. A mismatched profile fails rather than
relabeling the existing emulator. The hosted closure template provisions four
distinct Android jobs, including a 1536 MiB low-resource allocation.

Apple builds choose available device types in the detected iOS runtime: a current
numbered iPhone, a distinct older available iPhone, or an iPad. Receipts bind the
created device type and runtime. The compatibility profile exercises a different
device type on that runtime; it does not claim a previous iOS version. Apple
resource throttling is unsupported. Development and candidate tiers keep narrower
matrices. The expanded hosted matrices still require execution and successful
source-bound receipts before acceptance.

### Canonical and native evidence

The shared corpus exercises production contracts under explicitly logical provider
time. Canonical scenarios use a dedicated child process and fresh owned SQLite
database containing the real One Voyage writer. Native scenarios acquire OS fixes
through the restricted WebView bridge, preserve their actual timestamps and inspect
actual canonical events. Receipts bind source, fixture, platform, artifacts and
cleanup. Step translations distinguish OS controls from controlled service faults.

Version 2 native arrival scenarios request two distinct nearby route points. The
host does not fabricate another observation when repeated Simulator commands at
an unchanged point do not emit another Core Location callback. Actual OS timestamps
and accuracy continue through the production provider. Hosted impact selection
accepts only bounded, unique canonical scenario IDs compatible with the selected
platform; full matrix defaults remain available. The transport receipt records the
selected corpus and profiles.

### Verification consumers

The declarative Sounding Line registration includes a Device Lab provider suite.
Its Vitest entry executes the canonical CLI corpus and consumes the generated
receipts, checking exact source/fixture versions, evidence classes, external gates,
actual One Voyage event counts and cleanup. This is provider evidence; it does not
replace the hosted native matrix. Authority workers coalesce database cleanup and
exit when their caller disconnects or the worker receives POSIX termination, including
failure paths that never sent the explicit cleanup command.
Windows Node signal termination force-stops the worker; graceful cleanup uses IPC
disconnection. A failed forced-exit development fixture was retained after local
deletion was rejected by automatic approval review. That fixture is an explicit
cleanup exception, not successful cleanup evidence.

Drydock's existing Administrator/CSRF-protected external-evidence route accepts a
strict Device Lab metadata reference. It keeps Chronicle source checksum, code
commit/tree, scenario/version, target/profile, provider family, fixture digest and
receipt digest distinct. Unknown/raw payload extensions, stale scenarios, wrong
capability scope and inflated fidelity are rejected. A changed Chronicle source
rejects the reference before recording it. Profiles/targets have separate reference
kinds. A referenced PASS remains EXTERNAL_VALIDATION_REQUIRED; it is not promoted
to a Chronicle-specific launch acceptance or physical proof. Drydock references
the evidence and does not duplicate execution.

Hosted Android profiles use both the AVD RAM setting and the emulator's explicit
memory override. Runs 37156247496 and 37160106080 correctly reject the low-resource
profile: Emulator 37.2.12 still increases 1536 MB to 2560 MB with that override.
Low-resource provisioning now also uses the tool's -lowram option, which removes
its minimum-memory policy. This awaits measured hosted verification; actual guest
memory must still meet the <=2 GiB rule. Configuration measurements are retained
even when profile validation fails. The memory override follows the
[Android emulator command-line interface](https://developer.android.com/studio/run/emulator-commandline).
The low-RAM option is confirmed by the installed tool's help and
[the emulator's memory policy source](https://android.googlesource.com/platform/external/qemu/+/emu-master-dev/android/android-emu/android/main-common.c).
Apple test builds archive structured xcresult summaries on success and failure,
including cases where quiet build output contains no test summary text.

The corpus also covers Virtual Worldspace manual navigation and encrypted offline
reconciliation. Its native WebView executor selects the virtual definition without
requesting location permission or starting native acquisition. The owned canonical
fixture publishes that virtual objective and uses the same One Voyage writer.
Local Android development execution wrote one canonical event after reconciliation,
with zero acquisition starts and successful cleanup. These synthetic controls prove
shared software behavior, not full rendered Player interaction or physical travel.

Five-minute and thirty-minute synthetic walks preserve a 1.4 m/s route under logical
provider time. Native executors use wall-clock time for the same definitions.
Logical execution does not measure physical battery endurance or OS suspension.

The local Android restart development case force-stopped and relaunched the app,
restored the encrypted native lease, used the production public worker with a
synthetic public shell, reopened its encrypted outbox and wrote exactly one
canonical event. This proves the shared restart path on that emulator; it does not
prove the full rendered Player Journal, physical storage persistence or iOS restart.
Hosted Apple GPS end-to-end run 37159079087 passes on clean source 91a3b47e:
two distinct Core Location fixes reach the production native provider and all five
scenario steps pass. Receipts classify it SIMULATOR_PROVEN, retain the field gate,
and verify simulator/server/database and transport-branch cleanup. The Xcode build
and test invocation succeeded; its archived result bundle remains the detailed
native test record. This focused subset does not establish the broader Apple
offline/lifecycle matrix. Successful profile matrices, power orchestration, optional hardware
handoffs, provider deployment preflight, full product UX, security/performance
acceptance and final protected qualification remain required work.

The optimized Player search journeys exercise phone/desktop physical and virtual
projections, keyboard selection, scoped accessibility, unchanged progression and
zero acquisition. The physical degraded chart now renders only released geometry
as a read-only SVG until the interactive renderer is ready. Withheld centers are
excluded; route and location lists remain the accessible alternative.

Native location diagnostics retain categorical counters only: delivered, invalid,
stale, future, outside bounds, insufficient accuracy and canonical observations.
The Android fixture verifies/restores the master location switch without granting
permission. Activity recreation changes measured rotation, requires a fresh WebView
startup within the same process and restores the original settings. Its local
development case passes; emulator proof does not establish OEM suspension fidelity.

Earlier background scenario assertions passed but screenshot transfer failed,
including temporary-file cleanup omissions. Later bounded recovery verifies those
exact files absent and preserves the original failures. Native Android screenshots
now use binary exec-out directly, validate the PNG signature and create no device
temporary file, following the [ADB screenshot interface](https://developer.android.com/tools/adb#screencap).
The subsequent background run passes with a reviewed home-screen capture, zero
canonical progression events and cleanup PASS; this remains emulator evidence.

The opt-in native Journal suite now installs the exact debug APK, attaches to an
explicitly owned emulator through a separate ADB server and opens the actual
optimized production Player Journal. PHYSICAL and VIRTUAL journeys pass together:
two Android location fixes cause one One Voyage arrival; the virtual chart renders
and searches authored geometry with zero location fixes or progression. The
receipt records actual and requested worldspace, source fingerprint, installed
APK checksum, measured foreground state and cleanup. System-bar/cutout insets keep
fixed Journal controls inside the native viewport. Debug WebView inspection is
enabled only for debug builds; authenticated protocol traces are not retained.
These journeys do not establish full Journal offline/restart behavior or physical
field accuracy. Earlier fixture failures remain recorded, including an incorrectly
labelled failed virtual fixture; that receipt is excluded from virtual proof.

Hosted Android run 37161305817 passes GPS/background/activity recreation on its
primary and compatibility phones. Low-resource GPS and recreation pass with
1503184 KiB measured guest RAM, satisfying the unchanged <=2 GiB rule. Its
background failure prompted a bounded check of the actual OS transition. The
Pixel Tablet SDK hardware profile omits GPS; the next tablet profile uses the
GPS-capable generic medium tablet and retains measured device configuration.
Software evidence from it makes no claim about physical Pixel Tablet GPS hardware.
Hosted impact selection is bounded by the governed tier and canonical profiles.

Hosted Apple run 37160106099 passes 21 of 24 cases (7/8 per profile), including
GPS and permission changes everywhere. Offline canonical and lost-response
reconciliation pass everywhere with one canonical event per successful scenario.
Compatibility/tablet restart and primary virtual-offline cases have recorded
failures; the run is not closure proof. All scenario cleanup and owned transport
branch cleanup pass. Structured build summaries report seven native tests passed,
one skipped and zero failed per profile. Lifecycle launch now belongs solely to
XCTest, avoiding competing app launches. A separate bounded 120-second deadline
allows xcodebuild to finalize results after assertions finish; categorical counts
and tool-exit state remain distinct. Fresh hosted verification remains required.

The deployment raster configuration replaces the hardcoded automatic public tile
request. A built-in physical map renders released geometry first. Its public,
first-party metadata endpoint supplies only a validated HTTPS tile template,
attribution and zoom limit; absent/unsafe settings are NOT_CONFIGURED. No provider
request or reachability claim occurs during configuration lookup. Credentials in
URL authority/query, local endpoints, malformed templates and executable attribution
are rejected. Deployment values must be public and must never contain secret path
components. `.env.example` documents these settings without a real endpoint.

Player/Creator choose whether to load online background maps after seeing the
service hostname and map-area sharing disclosure. Stopping removes the raster
source; switching maps destroys that renderer and resets consent. Authored/released
features and semantic lists remain usable. No location acquisition or progression
request accompanies this choice. Browser HTTP cache rules apply; these tiles are
not package inputs or an offline download source. Deployed service license and
availability remain operator responsibilities. The
[OSMF tile policy](https://operations.osmfoundation.org/policies/tiles/) requires
visible attribution and forbids bulk/offline downloads of its standard service;
that public service is no longer an implicit production dependency. Six focused
test files pass 20 tests across configuration, renderer, projection/privacy and
the public endpoint. Uncached full TypeScript and changed-code ESLint pass.
The optimized production build and all five Phase 4 Player browser journeys pass,
including the phone sharing choice with synthetic intercepted endpoints, zero
acquisition and unchanged canonical progression. Its capture was reviewed.
This development proof does not establish deployed provider licensing/availability
or ordinary final acceptance. Injected application map-style providers also require
the sharing choice unless they explicitly declare LOCAL or FIRST_PARTY privacy.
The style function itself is not invoked before third-party consent. LOCAL styles
cannot contain network URLs; FIRST_PARTY URLs must match the page origin. Twelve
focused style/renderer/configuration tests pass, including those mismatch checks
and consent revocation. Remote geocoding/routing/elevation integration remains open.

Hosted Android focus run 37162816491 at clean source `8821f56004bc` passes all
three low-resource cases and two of three generic-tablet cases. Tablet background
and recreation deliver actual OS fixes; its first GPS case receives no callbacks.
Every scenario and transport-branch cleanup passes. Both native instrumentation
receipts pass. The generic profile therefore supplies GPS, but cold delivery is
not yet qualified. The next lab revision delivers repeated coordinates through
the OS within the original 120-second observation budget rather than relying on
one injection. It does not retry the scenario or invent success. Redacted control
receipts record injection count and elapsed time; Android acquisition diagnostics
record only selected provider, registration, enabled state and permission.
Provider selection remains an observed category, not an inferred failure cause.
Fresh hosted proof is required for this revision.

Hosted Apple focus run 37162819902 at clean `8821f56004bc` passes both selected
cases on compatibility phone and tablet, and virtual offline reconciliation on
primary phone: five of six cases pass, each successful case observing exactly
one canonical event. The primary physical restart case times out before its web
client ready handshake and records zero startup acknowledgments. All three
XCTest lifecycle drivers pass their one test and finalize inside the new tool
deadline. All six scenario cleanup and transport-branch cleanup pass. This
narrows the remaining failure to initial client readiness; it is not final proof.

Android tablet GPS focus 37163762628 at clean `16dc7ff237dd` still fails. Both
steps record GPS selected, registered, enabled and permission granted, with 120
OS injections and zero received callbacks within each 120-second budget. No
canonical event is written; cleanup passes. Neither one-shot control nor provider
fallback explains this observed run. Further native/OS delivery diagnostics are
needed before changing timing or declaring a platform gate.

Android UWB now has an optional stable AndroidX 1.0.0/RxJava3 foreground driver.
It capability-checks provisioned STS (Android 14+), prompts contextually, validates
short-lived session parameters, bounds preparation to 60 seconds and ranging to
five minutes, cancels on background/critical power/privacy clear, and clears key
bytes. Distance reports have UNKNOWN uncertainty and unverified peer identity;
they never become precise position or completion authority. The typed web adapter
keeps these reports untrusted, redacts its projection, rejects wrong-peer/stale
reports and stops on background. Five focused adapter tests pass. Both native
APKs build. Five native instrumentation tests pass on the current Android 16
emulator, including foreground preparation gating; this is not ranging proof.
That emulator exposes BLE, UWB and camera features. Its native receipt binds the
dirty source and exact APK checksums; field RF accuracy remains external.

Optional AndroidX packages declare minSdk 31. The manifest merge override preserves
the companion's API-28 baseline only because an isolated API-34 factory keeps UWB
classes out of older/unsupported initialization paths. API-28 startup still needs
runtime verification before acceptance. Secure first-party peer pairing, actual
multi-device ranging, supported BLE session scenarios and Player controls remain
open. No hardware feature is required for ordinary location/offline navigation.
API decisions were checked against the [Android UWB guide](https://developer.android.com/develop/connectivity/uwb),
[stable release](https://developer.android.com/jetpack/androidx/releases/core-uwb)
and published 1.0.0 source archives.

The next focused diagnostics distinguish native callback delivery from WebView
bridge delivery with a bounded native callback count. Acquisition state is read
again when a location step ends, including timeout. Test-only startup telemetry
accepts a strict categorical stage enum, limits retained acknowledgments to 128,
and records document/worker/script request counts. Diagnostic posts expire after
three seconds and cannot change readiness. No coordinates, native payloads,
session tokens or arbitrary logs enter the readiness artifact. Three focused
files pass seven tests; full TypeScript, changed-code ESLint and both Android
APKs pass. Hosted verification remains required; these diagnostics do not repair
or qualify the observed Apple startup or tablet GPS failures.

Hosted tablet GPS focus 37164959426 at clean `adf2ed1bfa5d` passes. Two native
callbacks deliver two distinct bridge fixes and two canonical observations, each
within the unchanged requested bounds and accuracy. The scenario writes zero
canonical progression events and verifies cleanup; native instrumentation also
passes. The readiness artifact records a complete initial startup sequence.
Earlier cold-delivery failures remain; the diagnostic change alone does not prove
a root cause or final matrix reliability. Apple focus 37164957171 remains pending.

Apple Nearby Interaction now has a foreground-only optional native driver using
`NISession` and secure-coded `NIDiscoveryToken` archives. Preparation expires in
60 seconds; pair parameters expire within five minutes. Wrong/oversized/noncanonical
archives, arbitrary identity claims and replay windows are rejected. Invalidation,
suspension, peer removal, background, critical power and private clear end the
session. The native and web projections do not claim that a discovery token
verifies Player identity or supplies known measurement uncertainty. Native ranges
remain untrusted hints with no completion authority. The web adapter rejects
forged/stale/wrong-peer reports and does not expose tokens, peer IDs or raw ranges
in its presentation projection. Android preparation now also expires truthfully
and clears on background before ranging starts.

Eleven focused web tests pass across both platform adapters, including an old
expiry/new-preparation race. Apple XCTest covers hostile pairing input, unsupported
capability, inactive lifecycle and an actual framework capability attachment.
The Swift path has not yet been built on hosted macOS; no native/ranging proof is
claimed for this checkpoint. Secure first-party pairing and Player controls remain
open. Apple's [Nearby Interaction session guidance](https://developer.apple.com/documentation/nearbyinteraction/initiating-and-maintaining-a-session)
defines discovery-token exchange and capability checks; its
[peer configuration](https://developer.apple.com/documentation/nearbyinteraction/ninearbypeerconfiguration)
does not replace application-level authorization.

Installed Netsim 1.0.23 answers bounded Wi-Fi/cell gRPC probes, while
FrontendService GetVersion/ListDevice return UNIMPLEMENTED even on an owned
standalone daemon with the CLI enabled by omission of the disabling flag.
The newer primary source branch reports version 1.0.24 and implements those
methods. This is a runtime control limitation for the installed binary, not
evidence that every BLE/UWB multi-device software path is unavailable. Probe
processes/ports are absent after cleanup; no range/RF claim follows from the probe.

Apple primary offline restart focus 37164957171 at clean `adf2ed1bfa5d` passes:
two startup acknowledgments span termination/relaunch, the encrypted lease and
public offline shell are restored, and exactly one canonical progression event is
observed. Scenario and transport cleanup pass; 2868 artifacts are harvested.
Native build XCTest reports seven passed, one explicitly skipped and no failures.
The shared source fingerprint is
`fe4265b812e668eea2a9827752bc3e32152355a6d9e1980bb56a39598a32d07f`.
Earlier failures are retained; this focused success is not closure qualification.

The Android 16 public `RangingManager` backend supplies a second replaceable UWB
implementation without Play services. An API-36 factory isolates its classes from
older OS startup. Contextual RANGING permission, actual technology availability,
distance/provisioned-STS capability, channel/preamble/update-rate checks precede
preparation. Raw one-peer sessions retain five-minute expiry, background/critical
power/private-clear cancellation and key clearing. Timestamp freshness uses the
documented elapsed-realtime clock. Reports retain UNKNOWN uncertainty and no
verified peer or completion claim. Both backends reject additional payload fields
and numeric string/boolean/fractional/overflow coercion. Both APKs build.
Implementation was checked against the [public Ranging guide](https://developer.android.com/develop/connectivity/ranging)
and installed API-36 signatures; [measurement timestamps](https://developer.android.com/reference/android/ranging/RangingData#getTimestampMillis())
are not wall-clock timestamps.

The owned two-emulator source probe first found AndroidX preparation unavailable
on both Android 16 devices. The public backend then prepared both and delivered
three native ranges on one device and one on its peer. It did not establish peer
loss, trustworthy uncertainty or physical RF accuracy. A host-memory floor below
500 MiB prompted owned emulator shutdown during cleanup; the original receipt's
range probe result and failed cleanup are retained together and are not qualified.
The subsequent native instrumentation command failed because the devices had been
shut down; no test pass is inferred for that command. A bounded single-peer restart
with Vulkan disabled cleared the retained synthetic app state and showed no reverse
bindings. Six native instrumentation tests then passed, including hostile pairing
coercion and no unsolicited radio preparation, with cleanup PASS. A final source
and APK snapshot check is pending; real RF and canonical multi-device scenario
integration remain open.

Native instrumentation receipts now snapshot source fingerprint and exact APK
hashes before installation and reject source/APK changes during the run. Active
companion processes are refused before mutation. Tool failures retain categorical
failure and nullable unavailable OS metadata. The snapshot binds the tested binary
and checkout; it does not independently prove how an externally supplied APK was
built. Hosted clean-checkout build provenance remains separate evidence.

The final six-test Android instrumentation run passes with source unchanged and
fingerprint `a5a3fe801b12831986918973abfd937a2f1eaac969097613c59fd851a4dcd49e`.
The app APK hash is
`1c6254800047a57c9c91c50dba011300259227046b2f4b28fb2e368c3aed9087`;
the test APK hash is
`7076bbb2e99b0075ee3bdafe736b3d211e6d965c33063e438ceec8a4708458d8`.
`radio-resource-recovery-20261004.json` records recovery separately: app processes
and reverse bindings absent, native cleanup PASS, owned emulator/daemon processes
and ports absent after shutdown. Original two-peer cleanup failure remains FAIL.
This final run validates the native guards; it does not rerun the paired range
probe or prove first-party peer authorization.

Hosted NI checkpoint `1923e15c9d1e`, run 37165444615, passes native build/XCTest
and all six virtual-navigation steps. Ten enabled native tests pass, including
three Nearby Interaction tests; one unrelated lifecycle test is explicitly
skipped and no test fails. Virtual navigation records zero canonical progression
events and cleanup PASS. All 2872 artifacts are harvested and the owned transport
branch is deleted/verified. Clean source fingerprint is
`c4b9f3d23143c99077d68eb26d34c4d91ce984dd8975f68b67e88495ac2c2aee`.
This verifies compilation and native software guards; it does not establish an
Apple peer ranging session, physical UWB support or distance accuracy. The
framework capability XCTest attachment remains in its result bundle; no
unextracted capability value is inferred from a passing assertion.

Generated `artifacts/**` are excluded from TypeScript's repository-wide file glob.
Retained SDKs and hosted result archives are evidence inputs, not application
compiler inputs. Source and test paths retain their existing compilation scope.

The canonical corpus now contains `uwb-native-peer-session`, bringing its total
to 125 scenarios. Its provider run passes with zero real One Voyage events. The
Android executor pairs two explicitly owned API-36 emulators through the
production web/native provider, requires validated native reports on both peers,
checks native sessions are stopped, and measures the real authority's zero
progression. Reports remain untrusted, with UNKNOWN uncertainty and no verified
identity; no RF accuracy or pose-control claim follows. This separately bundled
lab client is not part of the product's Player interface.

The dedicated hosted `android-radio` transport builds before boot, creates two
private Pixel-2 AVDs, binds the emulator and clients to an owned ADB server, checks
the actual device profiles, and enforces host-memory preflight and a running
floor. Process cleanup uses executable/start-time identities, including owned
child process groups, and verifies emulator/daemon processes and ports are gone
before deleting its private synthetic AVDs. Hosted source-bound native execution
and cleanup remain pending. This automation does not claim first-party pairing,
Player controls, radio peer loss, physical RF behavior or Phase 4 completion.

Apple build automation now exports native XCTest attachments with the installed
`xcresulttool` after recording its command help. This follows the attachment
export command introduced in [Xcode 16](https://developer.apple.com/documentation/xcode-release-notes/xcode-16_3-release-notes).
The next hosted run must verify this export and retain the actual NI capability
JSON; no capability value or successful Apple ranging session is assumed yet.
