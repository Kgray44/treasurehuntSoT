---
title: Project Landfall Phase 4 native companion and restart design
audience: product-engineering
status: current
canonical_for: project-landfall-phase-4-native-companion-design
last_reviewed: 2026-10-04
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

Geofences retain one bounded encrypted released-objective region and categorical
wake hints. They do not retain location trails or complete a waypoint. Notifications use private
generic wording. Opening a return handle reaches the existing authenticated server
route, which checks current membership, published pin and Journey state. Fresh
foreground evidence remains necessary for location-based progression.

One-shot installation acquisition also handles native callbacks that arrive before
the bridge start reply. Its terminal result owns presentation; a late successful
or failed start reply cannot replace a verified identity with a scanning or
unavailable message. The matching scanner is stopped before verification. Thirteen
focused provider and Player tests pass, including both late-reply outcomes.

Android recovery now includes a non-exported boot receiver. It reads one encrypted
consented region after credential storage is unlocked, rejects an expired region
or downgraded permissions, and makes one bounded re-registration attempt. The
descriptor holds the opaque return handle, area, expiry and notification choice;
it never contains an account credential or a sampled position. A shared generation
guard prevents a late service-add callback from restoring cleared consent, including
across Activity instances. Clearing removes the encrypted descriptor, wake hints
and this companion's notifications before requesting OS removal. The UI reports
OS removal failure honestly. Backgrounding, teardown and Disable cancel unfinished
setup; an already enabled reminder survives ordinary Journal teardown as intended.
Replacement registration confirms OS removal of all of this companion's previous
regions before adding a new handle. Otherwise multiple expired or replaced handles
could accumulate in Play services despite the single encrypted descriptor. Failed
removal clears recovery consent and prevents another add; a controlled native test
checks that failure path. This latest replacement change is compiled, with new
hosted instrumentation still pending.
Hosted Android run37184428733 executes nine native tests, including encrypted
storage and deliberately delayed service callbacks, and five canonical location
and permission scenarios. All pass with cleanup. An actual reboot/OS-region
delivery receipt remains required. This recovery follows
[Android's geofence re-registration guidance](https://developer.android.com/develop/sensors-and-location/location/geofencing?hl=en).

The canonical `device-reboot` scenario now requires an actual Android guest reboot
on an explicitly enabled ephemeral hosted Linux runner. The executor requires a
changed kernel boot identity, completed boot, the same AVD identity, restoration
of only its owned reverse binding, and a new companion readiness acknowledgement.
Exported receipts contain categorical identity checks, never raw guest identifiers.
The scenario separates fresh fixes with reboot and asserts no canonical progression;
the logical provider translation does not claim a kernel reboot. Local and physical
devices cannot run this translation. Hosted Android run37185206080 on clean
sourceec339c/tree2ba9ef records a changed boot identity with the same AVD in30992ms,
fresh startup acknowledgements and zero canonical progression. Its separate offline
restart scenario restores the native lease and reconciles exactly one canonical
event. Both pass fixture and transport cleanup. This reboot scenario does not by
itself prove geofence re-registration or delivered wake events.

The installed emulator37.2.12 camera help advertises `imagefile:<filename>`.
The canonical `qr-native-camera-valid` scenario uses a1024px synthetic signed QR
image prepared before the owned emulator boots. The ephemeral signing key remains
in the preparation process; only a public verification key and fixed synthetic
scope reach the WebView. The decoded token is never supplied through JavaScript
or the control endpoint. It must traverse the emulated camera, CameraX, bundled
ML Kit, the production native callback and installation verifier. The scenario
asserts verified identity, no location acquisition, no completion request and zero
One Voyage progression. Image/token hashes and categorical outcomes bind receipts;
no native frame is retained. Provider simulation remains logical; hosted camera
execution is pending. Physical camera fidelity and tag presence remain external.
[Android's camera documentation](https://developer.android.com/studio/run/emulator-use-camera?hl=en)
also describes synthetic QR images for camera-based applications.

Android run37184872437 on source607450 reaches two measured API36 virtual devices
and reports actual native advertiser `STARTED`; discovery still fails and no scanner
state was retained by that source. Both fixture and process/ADB/port/AVD cleanup
pass. Source changes now preserve the correct BLE terminal projection and execution
stage on failure. Run37184876730 also passes both cleanup layers and reaches the
authenticated optimized Journal with HTTP200. Its diagnostic screenshot shows the
opening ceremony after the click-stage timeout. The lab now uses a normal click
without an implicit navigation wait, followed by a separate bounded Journal-tools
assertion. Actual native first-party pairing remains unaccepted until a fresh run.

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

The first canonical radio dispatch at `f26a5a61`, hosted run 37167100015,
compiled the Android APK but failed SDK-image setup because `sdkmanager` was not
on the runner PATH. No emulator or native scenario started, and no test artifacts
were produced. Harvest retains the exact-source CI log and NOT_PRODUCED artifact
state, with zero harvested artifacts and verified transport-branch cleanup.
The template now uses the SDK manager's explicit installed path. This correction
still requires a new hosted native run; the failed run is not qualification.

The second radio dispatch at `2addbb2e`, run 37167569946, passes explicit SDK
manager/image installation but fails SDK discovery before boot. That run did not
retain which tool was absent or failed its version probe; its categorical failure
does not establish a library or image defect. The template now explicitly installs
platform-tools as the [primary emulator runner does](https://github.com/ReactiveCircus/android-emulator-runner/blob/v2/src/sdk-installer.ts)
and retains both fixed-tool version probe outputs before attempting devices.
The second failure has zero scenario artifacts, retained source-bound CI logs and
verified transport cleanup. Native canonical radio qualification remains open.

Hosted provider run 37167228785 at clean `0879c887` passes all 125 canonical
scenarios on Windows and all 125 on Linux, with no unsupported or unconfigured
cases. Both source fingerprints are
`7b21a0f6ab506ec6d177e7819d95e3b47cde3ccb262a3576e402fd89ef4ae42b`.
The new UWB case records zero real canonical events and cleanup PASS in each
logical-provider run. All 268 artifacts are harvested and transport cleanup is
verified. These results do not qualify native radio or physical hardware.

The third hosted radio setup at `bf201ef1`, run 37167860956, retains two SDK
probe artifacts: ADB version succeeds, while the emulator binary fails loading
`libpulse.so.0` before any device boots. This establishes the missing runtime
library for that runner. Provisioning now installs `libpulse0` on the ephemeral
Linux host. The failed run remains failed, with both artifacts and CI logs
harvested and its transport branch deleted/verified.

Apple export run 37167222880 at clean `0879c887` passes native build, ten enabled
XCTest cases, six virtual navigation steps, zero canonical events, and cleanup.
One unrelated test is explicitly skipped. Its manifest binds the capability
attachment to `NearbyInteractionTests/testFrameworkCapabilityAndInactiveLifecycle()`
on iPhone 17e / iOS Simulator 26.5. The exported JSON reports precise distance
measurement unsupported, rangeSessionStarted false, observedRanges zero and
canComplete false. All 2875 artifacts are harvested with verified transport
cleanup. Simulator NI ranging is an explicit unsupported capability, while the
compiled adapter and native guards are verified; physical Apple ranging remains
a separate device gate.

Optional same-Player companion exchange now has a first-party broker, authorized
API and a Journal control surface. Each operation reauthorizes the current
released PHYSICAL waypoint, Player, session, pin and sequence. Codes and handles
are random 256-bit values stored as hashes, the join code is consumed once, and
Android peers receive one shared provisioned-STS key with complementary addresses.
Apple peers exchange bounded opaque discovery-token archives. Cross-platform,
reflected, stale, foreign-scope and coercive requests fail closed. These are
authorized companion parameters, not hardware identity or verified distance.
Every response and native projection keeps peerVerified and canComplete false.

Exchange state is bounded to 128 instances, four per Player, and 45 seconds.
Independent expiry drops token references and overwrites retained key buffers,
including when no subsequent request arrives. Clock rollback clears exchanges.
Nothing is persisted, and restarted or differently routed instances return an
unavailable exchange. The explicit deployment opt-in is
`LANDFALL_NEARBY_PAIRING_MODE=ephemeral-instance`; it requires one server instance
or sticky routing for this brief optional exchange. Default absence is truthful
NOT_CONFIGURED. Request bodies are limited to 8 KiB and three seconds, with CSRF,
membership/current-Chart authorization and per-Player rate limits. No coordinate,
raw range, discovery token, key or code is added to telemetry or progression.

The collapsed Journal panel explains the sharing and limitation, checks service
availability before a contextual native permission request, and requires separate
create/join/start actions. It cancels HTTP requests, native sessions and timers on
Stop, background, hidden document, low-power/thermal/unavailable power, private
clear, scope change or expiry. Replacement preparation waits for the old native
stop. Native host availability uses the external-store contract, and keyed scope
changes reset controls without stale async replies. There is no automatic resume,
location acquisition, exact distance display or progression callback.

Nine broker security tests, seven authorization/body-boundary API tests, eight
consent/lifecycle/race panel tests and seven existing Journal tests pass (31 total).
Full TypeScript, changed-code ESLint and documentation checks pass. The initial
race test found an ambiguous status selector; the readable nearby status now has
an accessible name and the focused panel rerun passes all eight tests. Optimized
browser/native first-party pairing integration remains pending. This source
checkpoint does not qualify secure physical peer identity, RF accuracy, BLE
beacons, inter-platform pairing or Project Landfall closure.

Hosted two-device run [37168243966](https://github.com/Kgray44/treasurehuntSoT/actions/runs/37168243966)
passes at clean candidate `98bfeeff57d918dba09ad131e43af3a2d9dbfc60`, tree
`def8fc8433fb4a03c1b881a990cdd9e87553f2e6`, source fingerprint
`b2ff2e0931d16bbd66c44a2c1bd0dc947899034a1a71aafe3da3ab1af7dc6c3d`.
Both Android 16 / API 36 low-resource emulators report 1,503,184 KiB guest memory
and each delivers a validated native UWB report through its origin-bound WebView.
Both project UNTRUSTED / UNKNOWN uncertainty / peerVerified false / canComplete
false, then UNAVAILABLE after disconnect. Real isolated One Voyage retains zero
progression events. Scenario, authority, app-data/reverse, owner-process/port/AVD,
and transport-branch cleanup receipts all pass. The lowest sampled host available
memory remains 10,498,740,224 bytes, above the stop threshold. Twelve sanitized
artifacts are harvested and hashed; APK SHA-256 is
`9a6f7fa96f25d0e11c5a30a8541e8a790c31ab24db5f71fab2617353c8d688ad`.
This is simulated-radio native OS evidence, with no pose-control or RF accuracy
claim. The lab supplies synthetic pairing parameters; the new first-party
exchange API and Journal controls still require integration verification.

An optimized-browser contract case now opens two same-Player Journal sessions
against the real first-party API. A deliberately synthetic native bridge isolates
web consent, matching server-issued configuration, lifecycle cancellation,
mobile accessibility and unchanged canonical progression. Default deployments
exercise truthful NOT_CONFIGURED before native preparation; the task-owned
ephemeral-instance opt-in exercises create/join/start/stop. Trace, video and
automatic screenshots are disabled for this private exchange; only a stopped
screen and categorical evidence are retained. Execution remains pending at this
source checkpoint; this case cannot substitute for native or physical proof.

Local optimized validation at `08885926574dafe534589eb501e84a076e80d2c9`
compiled successfully, then was deliberately interrupted during TypeScript when
available physical memory fell to 776,120 KiB. The exact owned process tree was
terminated and its absence verified; available memory recovered to 7,461,540 KiB.
No browser case executed, and this resource-interrupted build is not acceptance
evidence. The categorical abort receipt remains under the owned Device Lab
artifacts. Shared applications and services were preserved.

The hosted `android-journal` target now builds the native companion and optimized
application before provisioning any emulator. It reuses the bounded radio owner
with an explicitly identified production-Journal executor, private AVDs and ADB,
memory guard, three-minute executor watchdog, and awaited fixture cleanup. The
real Activity and two WebViews sign into the same synthetic Player, open the
current released objective, and use the real create/join/start API and controls.
The check requires a production-validated untrusted report on both devices,
actual OS background followed by native session/key clearance, no location
acquisition, unchanged One Voyage progression, and verified app-data/reverse,
connection, process, port and AVD cleanup. Actual API, model, memory and screen
configuration are checked against the selected profile. Only sanitized receipts
and a stopped screenshot are retained. Hosted execution is pending; neither
native first-party pairing acceptance nor Phase 4 completion is claimed yet.

The first hosted Journal run [37169429928](https://github.com/Kgray44/treasurehuntSoT/actions/runs/37169429928)
at `0bbabbbdf0460bee410bd51206b0eca5f59e2b6d` passes native compilation,
optimized application compilation, full TypeScript and static-page generation.
Playwright then rejects worker-affecting media settings inside a nested describe
group before any browser or emulator fixture runs. The failed runtime/profile
receipts are harvested and transport cleanup passes. Moving trace/video/automatic
screenshot settings to file scope corrects discovery; the local list command
finds all seven cases across the two files. This is a corrected test configuration,
not executed native pairing evidence. Redispatch is required.

## Deliberate online data adapters and application integration

The development candidate includes replaceable HTTPS adapters for Nominatim
forward/reverse place lookup, OSRM route suggestions and Open-Elevation terrain.
Their primary contracts are [Nominatim search](https://nominatim.org/release-docs/latest/api/Search/),
[reverse](https://nominatim.org/release-docs/latest/api/Reverse/),
[OSRM HTTP](https://project-osrm.org/docs/v26.4.0/http) and
[Open-Elevation API](https://github.com/Jorl17/open-elevation/blob/master/docs/api.md).
The public/demo endpoints are deliberately excluded, including trailing-dot and
subdomain aliases. The [public Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/)
does not authorize a generic platform to silently select its public service.
No real credentials or external-provider traffic were used for the unit fixtures.

Operators explicitly opt into `LANDFALL_REMOTE_DATA_MODE=ephemeral-instance`
and supply `LANDFALL_REMOTE_DATA_CONFIG`, a bounded JSON array with at most one
NOMINATIM, OSRM and OPEN_ELEVATION configuration. This mode is supported only
for one application instance; per-service quota/cooldown state is process-local.
Distributed deployments must keep these adapters disabled until they provide an
application-wide quota authority. Configuration requires HTTPS base URL, an
identifying user agent, license, attribution label/URL, accepted usage agreement
and NONE or BEARER authentication. BEARER names a `LANDFALL_*` server environment
variable; the value is never returned to clients. OSRM declares its actual
deployment's routing mode and profile. A profile string alone cannot certify
the backend data mode, safety or accessibility. `authoringRights` defaults to
PROHIBITED and may be ALLOWED only under the deployment's actual agreement.
Online result caching and offline packaging remain prohibited for these adapters.

The transport resolves IPv4 addresses for each request and pins an entirely
public DNS answer into the normal certificate-validated TLS connection. Private,
loopback, metadata, documentation, reserved and multicast destinations fail
closed. It follows no redirects, sends no ambient cookies, requests identity
encoding, accepts only bounded JSON, caps response bodies at 128 KiB and applies
a five-second DNS/TLS/body deadline. There is one in-flight operation and at
least one second between starts per configured service, with no queue or retry.
Provider Retry-After cooldown is retained internally for up to seven days; the
client's bounded check-back interval never shortens that internal cooldown.
Requests, results, coordinates and credentials are not persisted or logged.

The live PHYSICAL Journal offers a collapsed optional panel. It fetches nothing
at mount or during typing. A deliberate metadata check identifies recipients,
attribution and license before a separate sharing choice. Text search sends no
location. Reverse, route and terrain actions require an already acquired valid
location less than thirty seconds old, checked again at the action; they never
start acquisition. Each query carries the recipient hostname the user reviewed.
Private, approximate, fictional, paused, historical and virtual objectives are
excluded by both presentation and current server authorization. The server
reauthorizes after an external request and discards results when scope changes.
Abort/generation guards discard late results on cancellation; background,
hidden-document, power pressure, private reset, scope change, details close and
unmount clear ephemeral state and consent. Returning does not resume requests.

Returned places are external suggestions. Route geometry has a bounded schematic
preview, duration/distance and unassessed safety/accessibility. It does not
replace authored route progression. Terrain has UNKNOWN uncertainty and cannot
identify a floor. Open-Elevation's zero value may mean absent coverage; this is
explicit in the shared contract and readable output. None of these operations
submit Landfall evidence or write One Voyage progression.

Creator text lookup reuses the consent controls on a saved public physical draft.
The owner/CSRF guard, saved autosave version and Worldspace are checked before
work and again after an external request. It refuses reverse lookup, coordinate
bias/bounds and client-selected destinations. Selection populates the existing
manual placement fields only when authoring rights are ALLOWED; the Creator must
review and deliberately place the waypoint under the applicable attribution.
Unsaved/private/virtual contexts do not offer lookup.

The ordinary server authoring/publish validation receives deployment-scoped
metadata without sending authored coordinates or probing providers. CONFIGURED
does not become READY until the actual adapter returns a valid result; successful
health expires after five minutes. Declared OSRM mode, credential requirement and
prohibited offline rights constrain candidates. Local authored readiness stays
scoped to the individual requirement. Required unavailable capabilities retain
the existing blocker or truthful accessible-fallback warning.

Focused server, transport, consent and deployment-preflight tests pass against
synthetic payloads. Optimized browser cases cover actual default deployment
absence and explicitly synthetic configured responses at mobile/desktop sizes.
Those browser executions, actual configured-service acceptance and remaining
Phase 4 integration are pending. This is development source, not closure evidence.

Hosted optimized browser run 37172177354 at source 04a6ccff verifies both
online-data cases at mobile/desktop widths, default deployment absence and
deliberate background-map sharing, with seven cases passing. The unrelated
two-device pairing case fails while opening the second device's map; the job
does not qualify overall acceptance. Its 27 artifacts and transport cleanup are
retained. Real configured external services remain untested and disabled.

The permanent Device Lab corpus adds nine provider-simulation-only online-data
cases, bringing it to 134. Production protocol adapters run with synthetic
transport and logical time; no external network, credentials or OS claim is
made. Metadata does not make a request. Search, reverse lookup, route and terrain
results remain untrusted; absent configuration, quota cooldown, malformed replies
and late cancellation retain no completion authority. Local corpus consumption
passes all 30 tests with source-bound receipts and isolated authority cleanup.

Hosted provider run 37172717692 at 5d8c088ac1694006b9f01d17d49640cf078a65e7
passes 134/134 on Windows and 134/134 on Linux, with matching clean source
fingerprint a77eee2e1bdb292b3f59674633c480acb9d077f627460ee78b29802ba0ca76d6.
All 286 downloaded artifacts and transport cleanup are retained. Browser run
37172706992 passes seven cases but shows the second Player device restored the
already-open map drawer from saved reading preferences; clicking its covered
toolbar again times out. The opening helper must recognize this state. Native
run 37172723041 fails CONNECT_NATIVE_WEBVIEW, retains zero canonical events and
verified fixture/owner cleanup. Neither failed job is acceptance evidence.

## Optional signed physical installations

Physical waypoint definitions can carry up to eight optional QR/NFC installation
identities, labels and accessible alternatives. Required objectives retain their
existing Player, Captain or alternate fallback; VIRTUAL Worldspaces cannot claim
physical installations. Creator edits use the existing draft save/publish flow.
Token issuance uses only an owner/CSRF-authorized published snapshot, never an
unpublished draft. It produces a QR PNG or UTF-8 NDEF text payload, without
placing hardware or creating another progression writer.

Operator deployment secrets `LANDFALL_INSTALLATION_KEY_ID` and
`LANDFALL_INSTALLATION_SIGNING_KEY_PEM` must name a real Ed25519 PKCS8 key. Missing
or malformed configuration is NOT_CONFIGURED; no random production signing
fallback exists. The private key never enters responses, artifacts or logs.
Issuance binds Chronicle, published version, Worldspace, waypoint, medium and
installation identity, with a seven-day expiry. Online verification rejects
earlier keys after rotation; replace printed/written tokens and preserve readable
fallback. A previously loaded foreground key can still verify an unexpired token
offline. That signature cannot establish current revocation, availability or
access; the separate canonical confirmation reauthorizes against current server
state. Closing, backgrounding or changing scope clears loaded verification keys.
Public identifiers are carried by a token deliberately installed by its Creator;
coordinates, authored prose, actor credentials and session grants are absent.

Player deliberately obtains trusted public verification material through the
authorized current-objective API. A loaded foreground scope can verify the
bounded signature locally, including offline signed-text access. Keys are not
taken from tag content, permanently cached or automatically refreshed. Scope,
background, hidden document, privacy reset, low power and thermal pressure clear
scan state and require a fresh deliberate availability check. Copies authenticate
installation identity only: physical presence is NOT_PROVEN and canComplete is
always false. Readable/manual confirmation continues through the existing
reauthorized One Voyage action; scanning never emits arrival or progression.

Native QR/NFC requests carry one scan UUID and impose a 30-second limit, so stale
callbacks cannot satisfy a later acquisition. QR is the only supported camera
format. Android uses a same-Activity CameraX preview with the bundled ML Kit
17.3.0 QR decoder and latest-frame backpressure; it closes every image and
releases only its owned camera use cases/executor. This removes the separate
Google scanner Activity that conflicts with Landfall's background stop rule.
See [CameraX analysis ownership](https://developer.android.com/media/camera/camerax/analyze)
and [bundled barcode decoding](https://developers.google.com/ml-kit/vision/barcode-scanning/android).
iOS uses a bounded AVFoundation scanner and Core NFC text reading. Neither
scanner records or uploads image frames, executes links/scripts or supplies
location authority. Permission denial and unsupported hardware retain readable
alternatives. Native camera/NFC hardware acceptance remains open.

Current focused checks cover signature/scope/expiry/tampering/key rotation,
bounded replay, native scan lifecycle/UUID filtering, owner/Player authorization,
published-only issuance, late objective/access changes, deliberate UI controls
and offline local verification. Android debug and instrumentation APK builds
pass after exposing the already-resolved Guava dependency required by CameraX.
Fresh exact-source native builds, optimized browser visuals and the remaining
Phase 4 acceptance loop still precede qualification and closure.

The canonical corpus now contains 154 scenarios. Twenty QR/NFC installation
cases cover valid, replayed, expired, tampered, malformed, unknown-key and
wrong-scope payloads through the production verifier. All 154 pass locally with
30 scenario/provider regression tests. This is provider simulation evidence;
it does not prove a native camera decode, NFC radio or physical presence.
Two browser widths also exercise deliberate signed-text verification with real
Chromium WebCrypto and explicitly synthetic trusted-key transport. Actual
unconfigured first-party API behavior is checked separately. Hosted results
for this source remain pending. Apple XCTest records actual framework camera
and NFC capability plus inactive guards without starting acquisition.

Hosted source `893b61f65fbe38ea879ef6cae5b958bed91a628e` passed154/154 provider
scenarios on both Windows and Linux (run37181572965), with matching clean-source
fingerprint `d34846b2236a9c7cd559cd516db5a95a4f2143aabc653eae70b287035aae13fb`.
The optimized browser run37181560804 passed10 cases, including375/1280 signed
text, accessible alternatives, cleared screenshots and unchanged One Voyage
progression. Native Journal run37181585197 reached attachment/authentication but
failed opening the Journal; native fixture and owner cleanup passed. This is
diagnostic progress, not native Journal pairing acceptance.

### Deliberate Bluetooth discovery

The current Player PHYSICAL objective has optional foreground discovery in the
native companion. It scans for30seconds only after deliberate action; background,
hidden document, closed controls, scope change, privacy clear and constrained
power stop it. Native callbacks bind a scan UUID. Stop requests carry that UUID
and release only the matching BLE scan. Permission response never automatically
resumes discovery. Radio handles are salted separately for every scan. No names,
addresses or advertisement bytes are shown, persisted or uploaded.

Generic Bluetooth, bounded iBeacon advertisement layouts and Eddystone UID
frames can be classified when the operating system exposes those fields.
Classification is a spoofable protocol hint, never authenticated identity.
The shared adapter retains at most32 handles for5seconds, rejects stale/replayed/
cross-scan callbacks and reports only coarse signal bands. Walls, interference,
multiple peers, loss and multipath prevent RSSI from proving distance or position.
Every projection keeps physicalPresence NOT_PROVEN, peerVerified false and
canComplete false. No Bluetooth observation enters the progression writer.
The readable chart and existing fallback remain available without hardware.

The scanner follows the [Android BLE scan ownership API](https://developer.android.com/develop/connectivity/bluetooth/ble/find-ble-devices)
and [Apple Core Bluetooth manager state](https://developer.apple.com/documentation/corebluetooth/cbcentralmanager).
Apple discovery requires a powered-on manager; unsupported, denied and disabled
states end acquisition. Local lifecycle/UI checks do not prove emulator radio
discovery, physical beacon identity, RF fidelity or real-device background behavior.
Those acceptance gates remain open until corresponding source-bound lab evidence.

Source `99d8b7af037e33af99edcfd93c7413d746bccabe` passed12 optimized browser
cases in run37182306044, including both Bluetooth absence/fallback widths and
accessibility checks. These checks exercise the real shared web interface;
native radio discovery remains NOT_EXERCISED. Local TypeScript and Android APK
builds pass for this source. Installation stop requests now also carry the
original scan UUID, preventing an older scope's delayed teardown from stopping
a later acquisition. Apple camera teardown retains the owned capture session
until its queued stop executes. These corrective paths still require current
native Apple acceptance before phase closure.

At source `893b61f65fbe38ea879ef6cae5b958bed91a628e`, hosted Apple run37181600745
passed11 XCTest cases (one skipped) and all four selected canonical Simulator
scenarios. Cleanup passed and all four retained zero progression events. The
actual iPhone17e Simulator26.5 framework attachment reports camera unavailable,
NFC reading unavailable, no acquisition and no observed token. Nearby
Interaction precise ranging is also unsupported. These are real SDK capability
results, with scanner/radio fidelity still requiring applicable hardware.
The later BLE and scan cleanup changes are covered by clean source
`a5db24575ed19678ff3e421efe02e489e9f06404`, Apple run37183310626:11 XCTest passes,
one skip, all four canonical cases passing and zero progression events. Build,
scenario and transport cleanup passed. Its SDK attachment still reports no
camera/NFC acquisition; Bluetooth authorization is an OS category, not a radio
discovery receipt.

The canonical corpus now contains157 scenarios, including three protocol-specific
native BLE discovery cases. A debug-only20second advertiser Activity runs on the
owned second emulator; it has no WebView bridge, accounts, GPS or progression.
Its actual advertising callback produces only a bounded synthetic state receipt.
The first emulator exercises the production native scanner and shared unverified
projection. Generic Bluetooth, iBeacon layout and Eddystone UID use the same
scenario meaning in simulation and the OS lab. All157 provider cases pass
locally; hosted radio discovery evidence remains pending. Private synthetic lab
state, apps, bindings and device connections belong to the existing owned
two-device backend and its verified cleanup.

The unsigned, unconfigured Android release build at
`911ea0462eec880b155661c4b3b13f64967206b8` succeeds. SDK APK Analyzer inspection
of manifest and DEX confirms the lab advertiser Activity and advertising permission
are absent, cleartext and debugging are disabled, and the boot receiver is not
exported. APK SHA256 is
`aa105a419d854ce80a1616ead5030bcff9bc948e52955e50df079faec8e036dd`;
the receipt is under the owned Device Lab release-package artifact directory.
This is package separation proof; deployed companion availability and signing
remain operator gates.


## Current native recovery and operational evidence

Actual hosted Android source `ec339c24a4a8beaedb101c14d5bd2c3fc09dfb32`
run37185206080 verifies an owned emulator guest reboot: changed kernel boot
identity, same AVD, completed boot and a fresh companion startup acknowledgment.
The reboot scenario retains zero One Voyage events; a separate offline restart
restores the native protected lease and reconciles exactly one canonical event.
Cleanup passes. No region was registered in that reboot case, so it does not
prove BOOT_COMPLETED delivery or geofence restoration.

Source `ba1a77eb597a72266a1b9445c6300d47092832c7`, run37185542857,
passes ten native instrumentation tests and both reboot/offline restart cases
with cleanup. Native replacement waits for confirmed removal of prior OS
regions; failed removal prevents another add and leaves no encrypted recovery
descriptor. This instrumentation proves ordering and protected storage behavior,
not real geofence delivery.

At that source, radio run37185534986 starts an actual owned advertiser and
production scanner, but finds zero peers. Discovery remains unaccepted.
Journal run37185539114 passes the real opening ceremony and Journal tools,
then times out waiting for map-click navigation. Both runs prove fixture,
process, ADB listener, AVD and transport cleanup. The next diagnostic checks
categorical scan prerequisites and uses normal pointer clicks with separate
rendered-state assertions.

Source `5aa8e6fa41d6fdac0089783f3091ad4ca32b130c`, camera run37185834136,
builds and passes native instrumentation, accepts the emulator image-file camera
backend, but fails the canonical camera action. It retains zero GPS acquisitions,
completion requests and canonical events; cleanup passes. Camera acquisition and
verification are not accepted. The source-bound synthetic image contains a
public Ed25519 claim; no signing key, plaintext claim or frame is exported in
diagnostic JSON. The next run records only the finite failing stage and error
category to distinguish public-key import from native acquisition.

The production server now sends finite Landfall operation, outcome and coarse
duration categories through the existing platform Pino logger. Seven existing
Player API operations, remote data demand and notification returns are covered.
There is no new telemetry database, progression writer, client upload, request
body inspection or coordinate/identity label. Strict event parsing rejects
unknown fields; logger failure cannot alter a response or authority result.
Passive remote configuration status produces no availability-success metric.
HTTP success describes transport only; it does not establish provider health,
installation verification or arrival. Remote demand separately reports its
actual bounded service result. These logs support categorical aggregation in
the deployment's existing log sink; log level and retention remain existing
platform configuration.

Focused tests verify response identity/body preservation, rejected private
labels, finite timing bands and diagnostic failure isolation. Native permission
distributions, RF accuracy, battery use and physical performance have not been
measured by these server logs. Device Lab timing remains execution evidence,
not a claimed production service-level objective. Phase acceptance and ordinary
Sounding Line qualification remain pending.

### Native trust compatibility and region preparation

Camera diagnostic run37186583511 on `ea7ce5b21472785840e095010dd51d32b49234a8`
fails at PUBLIC_KEY_IMPORT with NotSupportedError, available crypto and a real
native bridge. The camera had not started. Production signed installations and
offline region trust now share a public Ed25519 verifier: WebCrypto is preferred;
only unsupported algorithm import selects the pinned `@noble/curves@2.4.0`
implementation with strict RFC8032 verification. DataError and other import
failures remain failures. Private JWK material, remote key URLs and noncanonical
key encodings are rejected. Compatibility keys are opaque process-local handles.
Signature, scope, lifetime and replay checks still precede acceptance. No signing
or private key is introduced into a client. The dependency's [verification policy](https://github.com/paulmillr/noble-curves)
and [current hardening history](https://github.com/paulmillr/noble-curves/blob/main/CHANGELOG.md)
informed the exact version and strict mode. Focused29 scanner/installation/package
and panel checks pass, including mutated signatures, malformed keys, small-order
forgery and rejected signature scalar tests. Fresh camera acceptance is required.

Offline region preparation now previews the signed manifest's size, included
released chart/routes/images and expiry before a separate deliberate download.
Progress counts only verified encrypted chunks; presentation callback errors
cannot alter installation. Partial and stale state, refresh, external exclusions
and Chronicle-history-preserving local removal are explained. Scope changes
remount the panel and invalidate late preparation/download presentation.

The existing bounded LandfallProviderHealthRegistry records actual online demand
in each RemoteLandfallDataService. Admiralty consumes these three finite provider
projections under its existing authorization and read audit. Reading makes no
Landfall network request. Success ages after five minutes; last successful and
failed demand, latency and rate recovery remain process-local metadata. Quota,
credential expiry and cross-instance aggregation are not inferred. No queries,
coordinates, credentials, endpoint URLs or private Worldspace IDs enter the
projection. Authored guidance and Player/Captain fallback remain separate.

A new optimized-browser measurement case exercises256 released physical
waypoints on a375px viewport, measuring cold, warm and offline whole-Journal/map
readiness against preliminary30second execution budgets, plus origin storage.
It asserts zero GPS requests and zero canonical writes. It does not infer
renderer-only latency, physical CPU, energy or sensor overhead. Hosted measured
results remain pending; budgets will be assessed against the recorded samples.

Apple run37185838103 on `5aa8e6fa41d6fdac0089783f3091ad4ca32b130c` passes
11 native XCTest cases (one skipped), physical offline canonical reconciliation
and physical offline restart canonical reconciliation. Virtual offline counts
time out; all three fixtures and transport clean up. Phase acceptance requires
repair and current evidence for that remaining case. Radio run37186592561 on
`ea7ce5b21472785840e095010dd51d32b49234a8` confirms granted precise permission,
enabled location and awake screens on both devices; discovery still returns no
peers. Journal run37186596891 fails before page interaction at the second native
bootstrap launch's15second ADB wait; cleanup passes. These failures are retained.

Further diagnostic automation distinguishes execution failure from an unsupported
lab: failed receipts now carry EXECUTION_FAILED and cannot be promoted to passing
native fidelity. The addendum permits broader classifications. Historical failed
receipts remain unchanged. Debug APK BLE diagnostics persist only bounded callback,
emission and error counts with an active flag; no address, payload, scan identity
or observation is retained. Release builds do not execute this diagnostic writer.
Actual hosted radio evidence will distinguish missing native callback delivery from
bridge filtering. The low-resource native bootstrap is bounded at45seconds;
ordinary rendered-state assertions still govern Journal success. Authority IPC
diagnostics record finite operation, outcome and elapsed/start-delay timings to
distinguish dispatch delay from an in-worker timeout; no request data is recorded.

Optimized Chromium run37187344378 on57b1a77 passes the browser suite and measures
256-waypoint375px Journal/map readiness at1506.99ms cold,660.78ms warm and346.02ms
offline, with7489755bytes whole-origin storage. No GPS request or canonical write
occurs. These are single browser samples, not phone memory, CPU or energy evidence.
Provider run37187347909 passes159 scenarios on each of Windows and Linux.
Camera run37187340476 passes public-key import but fails the native result check.
Its exact acquisition outcome was not previously retained. Diagnostic-only camera
counters now distinguish binding, delivered frames, decode failures and terminal
outcomes without retaining token text or image frames. The owned imagefile-camera
scenario captures its public synthetic QR preview for inspection. Production
camera frame privacy and identity-only verification remain unchanged.

The native-only geofence-native-background-wake scenario registers a real Play
services region, supplies an outside native fix, backgrounds the owned app,
delivers inside emulator GPS for180seconds and requires an encrypted ENTER hint
on return. It then clears the OS registration and asserts zero One Voyage writes.
No receiver broadcast, synthesized GeofencingEvent or native callback is injected.
The production two-minute responsiveness is preserved; [Android background
geofencing guidance](https://developer.android.com/develop/sensors-and-location/location/battery)
explains the bounded three-minute observation window. Actual execution remains
pending. Physical suspension, OEM scheduling and field timing remain external.
Ordinary Android task return now reuses the singleTop Activity and existing Chart;
only a valid opaque notification handle navigates to server reauthorization.

Radio run37187682729 on9dfdfd93 receives119 native callbacks, emits12 events and
records zero native errors, while its web provider accepts zero observations.
This narrows the retained failure to bridge delivery or event validation rather
than unsupported native scanning. Fixture and transport cleanup pass.

BLE lab bridge diagnostics reuse the production observation schema and retain
only bounded receive/valid/invalid/freshness/visibility counts and finite schema
field categories. Unknown field names collapse to UNRECOGNIZED_FIELD. Peer IDs,
scan IDs, RSSI values, timestamps and payloads are not retained. Production
acceptance remains strict; the diagnostic cannot turn a rejected sample into a
valid observation. Five focused BLE and diagnostic privacy tests pass.

Apple run37187691206 on9dfdfd93 passes11 XCTest cases with one unsupported hardware
skip and virtual offline canonical reconciliation. Its real One Voyage submit
takes142ms; first count takes424ms and later counts5-9ms. All cleanup passes.
The earlier transient authority failure remains retained as failure evidence.

Camera run37188026917 on d8234549 confirms binding, ten delivered frames, zero
decode errors and zero decoded values before the web scanner's expiry. Its
early preview is black before camera initialization finishes. The lab now waits
for a delivered frame before capture and gives its1024px public synthetic QR a
larger quiet margin to preserve the full code in a wide camera crop. This remains
camera input only. Journal run37187687095 fails a nested role locator while its
inspected screenshot shows the real opening button. The harness targets that
source-owned button, asserts its visible copy and performs an ordinary tap;
rendered tools/map/ranging assertions remain required. No success is inferred
from a screenshot or selector change. Failed Journal receipts now classify
EXECUTION_FAILED rather than EMULATOR_PROVEN.

The next configured browser run uses a fresh synthetic Ed25519 signing key held
only in the wrapper and child process environments. The wrapper requires a clean
exact candidate and an owned Sounding Line isolation database; it refuses existing
deployment signing configuration. Its first-party test prepares a released region
without fetching resources, interrupts the route download, resumes verified chunks,
decodes the restored image from a local blob while offline, rejects a changed signed
resource hash after reload, and removes local region data. Actual hosted proof is
pending. Refresh now reauthorizes the original unexpired issued-at value when the
revealed sequence is unchanged, preserving verified chunks across time buckets.

BLE run37188385826 on2dab39db rejects all12 delivered observations specifically
on RSSI validation. Fresh native diagnostics count valid,127-unavailable and other
out-of-range RSSI categories without retaining measurement values or identities.
The strict production observation schema remains unchanged. Geofence
run37188297805 on e2dbc2e fails actual registration before background observation;
GPS delivery alone is not wake proof. The next run retains only the finite native
registration reply category. Camera run37188685533 on ebbead90 binds and receives
12 frames with zero decoder errors, but expires without a decoded token. Its
delivered-frame preview shows the code cropped at the right edge. The synthetic
image quiet margin increases to128 modules; only camera image acquisition can
satisfy the verification assertion. Fifteen focused package, panel and BLE checks
pass. These candidate changes are not qualification or closure evidence.

Run37189267440 on8f4f98af receives117 native BLE callbacks and emits12 observations;
all12 have out-of-range RSSI, with zero valid or127-unavailable RSSI categories.
Native adapters now represent unusable signal strength as explicit null. The web
schema accepts that unknown state, still rejects invalid numeric RSSI, and projects
an UNKNOWN band when no usable samples exist. Protocol discovery remains untrusted
with unverified peer identity, physical presence NOT_PROVEN and canComplete false.
Six focused BLE/privacy checks pass, including unknown-strength discovery and
continued rejection of positive/out-of-range numeric observations. No synthetic
RSSI or distance is substituted.

Camera run37189263416 receives17 frames without decoding. Its delivered-frame
preview shows the smaller code still displaced outside the portrait view. The lab
now composites its320px public synthetic QR within the empirically visible left
portion of a1024px square image. Actual camera input remains the only acquisition
path. Browser run37189259116 passes13 ordinary Phase4 cases but the new region
case times out after offline shell navigation. The test reopens the online Journal
explicitly after reconnection, rather than reloading the offline shell. It removes
only the ordinary chart database inside its exclusively owned synthetic browser
context before offline reload, forcing restoration of the independently signed
region instead of allowing the older chart cache to satisfy image assertions.

Geofence run37189271605 reports actual native registration UNAVAILABLE. New
debug-only diagnostics retain registration stage and a finite failure category,
mapped from [Google Play services geofence status codes](https://developers.google.com/android/reference/com/google/android/gms/location/GeofenceStatusCodes),
without coordinates, handles, numeric codes or exception text. A native privacy
assertion checks that failed-removal diagnostics retain only their two categorical
fields. Actual backend reason and wake acceptance remain pending. Draft PR#677
publishes the reviewable candidate without implying qualification or closure.

First-party native Journal run37189571337 on be36dbc9 fails the opening interaction;
the inspected native screenshot shows the real ceremony already running, rather
than the opening control. The harness now permits recovery from a click timeout
only when the actual progress dialog or Journal tools are visible. If the ceremony
is still visible, it uses the ordinary Skip ceremony button and records the affected
device index. It still requires rendered tools/map/pairing and real native reports.
This exercises the product's readable opening path; it does not qualify animated
ceremony performance, synthesize an activation or force a ready state.
