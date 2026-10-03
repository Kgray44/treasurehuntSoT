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

## Development evidence and remaining proof

The shared corpus exercises production contracts under explicitly logical provider
time. Canonical scenarios use a dedicated child process and fresh owned SQLite
database containing the real One Voyage writer. Native scenarios acquire OS fixes
through the restricted WebView bridge, preserve their actual timestamps and inspect
actual canonical events. Receipts bind source, fixture, platform, artifacts and
cleanup. Step translations distinguish OS controls from controlled service faults.

The local Android restart development case force-stopped and relaunched the app,
restored the encrypted native lease, used the production public worker with a
synthetic public shell, reopened its encrypted outbox and wrote exactly one
canonical event. This proves the shared restart path on that emulator; it does not
prove the full rendered Player Journal, physical storage persistence or iOS restart.
Hosted Apple native tests previously passed while end-to-end cases failed; updated
hosted evidence is pending. Device profiles, power orchestration, optional hardware
handoffs, provider deployment preflight, full product UX, security/performance
acceptance and final protected qualification remain required work.
