---
title: NCL-01 first physical iPhone TestFlight deployment
audience: engineering-owner
status: preparation-in-progress
canonical_for: ncl01-testflight-deployment-record
last_reviewed: 2026-10-20
---

# NCL-01 TestFlight deployment

The owner requests a private development beta of the existing native companion.
This record is engineering preparation, not a release approval or physical
acceptance. PR #741 remains unmerged. Protected main, Crossdeck and Sounding Line
are outside this deployment change.

Team ID: `X2JZ9N65V2`. Bundle ID: `com.voyagewright.landfall`. Source baseline:
`76d1787e1340e396bc95747293d43e57130b00ed`. Owned preparation branch:
`codex/ncl01-testflight`. Paid Apple Developer enrollment and TestFlight installed
on iPhone 17 Pro are owner-reported. On October 20 the owner reported installing
the app through TestFlight, successfully signing in and seeing the original 3D
objects through its native AR camera. This is owner-reported physical display;
exact build readback, measured tracking/alignment, Inspect and lifecycle behavior
have not been verified.

**Current gate:** private beta **0.1.0 (2)** passed upload, processing and internal
testing setup. [Its retained readiness receipt](evidence/ncl01-testflight-20261019/internal-testflight-ready-20261019.receipt.json)
binds candidate `484183ac15badcfefd5b08cfd187e330e567fbf8`. The owner subsequently
reported native sign-in and physical camera display of the original models.
The laptop has moved to classroom Wi-Fi `155.42.98.171`; build 2 still binds the
old `.18` origin. **0.1.0 (3)** is being prepared for the verified new HTTPS
origin. Current-network phone reachability/trust, exact build readback, measured
physical behavior and owner acceptance remain separate gates. Build 2 is consumed;
do not upload it again.

The owner has now created the explicit identifier and app record. Their screenshots
show the correct team/bundle, **VoyageWright Landfall**, app Apple ID `6824734220`,
and version 1.0 in **Prepare for Submission**. The owner subsequently completed
the distribution certificate, matching NFC-enabled profile and team API key.
Those inputs passed local validation; the dedicated GitHub environment contains
all four required secrets and API metadata. Exact bundle API lookup passed. The
following steps retain the completed owner setup as a reference; do not repeat
certificate creation to repair a build-tool failure.

## Actions the account owner completes

1. Open [Apple Developer Identifiers](https://developer.apple.com/account/resources/identifiers/list)
   with team `X2JZ9N65V2`. Reuse or register an **App ID / App**, description
   **VoyageWright Landfall**, **Explicit** bundle ID `com.voyagewright.landfall`.
   Enable **Near Field Communication Tag Reading**, authorizing the app's current
   `TAG` entitlement. NDEF payload reading remains the existing runtime behavior.
   ARKit and camera access do not require a separate portal capability.
2. Open [App Store Connect Apps](https://appstoreconnect.apple.com/apps), **+ → New
   App**. Choose **iOS**, name **VoyageWright Landfall**, primary language **English
   (U.S.)**, the exact bundle ID, SKU **voyagewright-landfall-ios**, **Full Access**,
   then **Create**. If the name is unavailable, use **VoyageWright Landfall NCL**;
   retain the bundle ID. Accept any pending account agreement in **Business** if
   creation is blocked. In **App Information**, record the numeric **Apple ID**.
   This Apple ID is distinct from the team ID and personal login.
3. In [Certificates](https://developer.apple.com/account/resources/certificates/list),
   **+ → Apple Distribution**. Upload the prepared public certificate request
   `D:\CodexTemp\ncl01-apple-signing\VoyageWright-Landfall-Distribution.certSigningRequest`.
   Download the resulting `.cer` to this laptop. The matching private key already
   exists protected for this Windows user; no borrowed Mac is needed for this step.
4. In [Profiles](https://developer.apple.com/account/resources/profiles/list),
   **+ → Distribution → App Store Connect**. Choose the exact App ID and the new
   Apple Distribution certificate. Name it **VoyageWright Landfall App Store**,
   generate and download its `.mobileprovision`. Do not choose Development or Ad Hoc.
   TestFlight does not need the iPhone's UDID registered in this profile.
5. In App Store Connect **Users and Access → Integrations → App Store Connect API →
   Team Keys**, request API access if shown, then create **VoyageWright NCL-01 CI**
   with **App Manager** access. Download the `.p8` once and retain it privately on
   this laptop. Record its **Key ID** and the page's **Issuer ID**. This role permits
   beta upload/configuration; Apple team keys apply across the account's apps.
6. Provide only the numeric app Apple ID, Key ID, Issuer ID and local downloaded
   file paths to the deployment operator. Never paste the `.p8`, private key,
   certificate payload, password or token into chat. The owner-local helper sends
   the credentials directly into the prepared GitHub environment.

The certificate request may be uploaded to Apple; the protected `.dpapi` file
must remain local. Do not create another certificate request after Apple issues
the certificate unless deliberately replacing the signing identity.

These steps follow Apple's [app record](https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/),
[identifier](https://developer.apple.com/help/account/identifiers/register-an-app-id/),
[distribution profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile)
and [API key](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)
instructions. Creating the app record does not publish the app.

## Prepared signing boundary

Dedicated GitHub environment: `ncl01-testflight`, allowing only branches matching
`codex/ncl01-testflight-*`. Main and unrelated workflow configuration are untouched.
The signing helper is `.agents/scripts/ncl01-apple-signing.ps1`. It validates the
certificate's current validity, Apple Distribution name, team and private-key
match before constructing an in-memory PKCS#12 and sending secrets over stdin.
The private RSA is CurrentUser DPAPI-protected with an owner/SYSTEM-only directory.

Environment secrets:

- `NCL01_DISTRIBUTION_P12_BASE64`
- `NCL01_DISTRIBUTION_P12_PASSWORD`
- `NCL01_APPSTORE_PROFILE_BASE64`
- `NCL01_ASC_PRIVATE_KEY_P8`

Non-secret environment variables: `NCL01_ASC_KEY_ID`, `NCL01_ASC_ISSUER_ID`,
`NCL01_ASC_APP_ID`. An internal group's identifier can be supplied as
`NCL01_INTERNAL_GROUP_ID` after it exists. The runner validates actual certificate
and profile contents before archive. Credentials are configured; their contents
remain outside source, logs and chat.

The initial browser file-attachment restriction was resolved by the owner's manual
CSR selection. No browser-permission expansion was required. The existing account
holder is verified as the sole tester in NCL-01 Owner, an internal group with no
public link. Its identifier is configured for processed-build attachment. No
external testing group was created.

The source-bound workflow uses a hosted macOS runner, verifies Xcode 26 or later,
generates the Xcode project, archives the real iOS target, exports an App Store
Connect IPA, and uploads in explicit upload mode. An unsigned mode verifies device
compilation/resources without accessing signing secrets. A push transport avoids
merging a new workflow into main merely to enable it. Each run binds the candidate,
version, build number and HTTPS origin. Build numbers must increase for uploads;
rerunning an existing uploaded build number is not a safe retry strategy.

## Native app and distribution metadata

The beta retains `ARSCNView`, `ARWorldTrackingConfiguration`, surface raycasts,
native mesh picking, and authenticated checksum-verified GLTFKit2 model loading.
It is the existing companion's native presenter, reached through the same released
Player Scene; a Safari Guided View is not the native test.

The source adds explicit marketing/build versions and a 1024-pixel opaque app icon.
Icon artwork comes from existing `public/animations/stills/compass-fallback.svg`
(SHA-256 `110c7aaca2ef27b4c1c63d31538fe062cea810637a89b4d869b20ec7bdbc3088`),
flattened on its dark teal `#102729` background. Packaged PNG SHA-256:
`41f3169ad68559c7d3b64ac9dbddb3a31560232d14ecc256c5b3247d18367104`.
Conversion used sharp 0.35.5/libvips 8.18.7, density 288, resize 1024×1024,
flatten, remove alpha, PNG compression 9/adaptiveFiltering false/palette false;
the existing artwork's Georgia font came from the Windows host. Original artwork
and model bytes are unchanged. The output has been visually inspected.

The bundled privacy manifest declares app-local UserDefaults reason `CA92.1`
and elapsed-time system-uptime reason `35F9.1`. It does not claim a complete
collected-data inventory. Public App Store privacy/contact/age-rating/store
metadata remain owner-reviewed work before public submission. This task does not
submit an App Store release. Camera and local-network permission explanations,
app-bound HTTPS origin, location explanations and NFC entitlement are preserved.
There is no production ATS exception or certificate-validation bypass.

Product features, Player guide, project status, feature status and catalog were
reviewed: this preparation does not promote native availability or physical
acceptance. The existing guide's pending signed-distribution/tracking statements
remain true until new evidence establishes those gates.

## Laptop service and iPhone trust

An initial October 19 check found the laptop on Wi-Fi `10.4.48.166`, making its
saved `.24` origin unreachable. A later read-only recheck after the owner returned
to Wi-Fi `192.168.0.24/24` passed: `https://192.168.0.24:8449` and both original
GLB endpoints returned 200 with normal TLS 1.3 validation; bootstrap port 8448
also returned 200. The laptop later selected Ethernet `.18` as preferred, leaving
`.24` deprecated. The retained `.18` leaf/configuration were restored with the
same CA and keys after verified owned process shutdown and port release. App,
bootstrap and all 11 authenticated model/revision/session-cleanup checks passed
at `https://192.168.0.18:8449`; the synthetic Voyage and Scene stayed unchanged.
[The sanitized restoration receipt](evidence/ncl01-testflight-20261019/https-origin-192168018-20261019.receipt.json)
records this gate. The `.18` origin is bound into the signed beta attempt. Phone
reachability/trust remain separate owner checks, explicitly deferred until later.
A subsequent network-address change may require a new beta.

On October 20 the laptop moved to Wi-Fi `155.42.98.171/24`. The owned relay was
rebound to `https://155.42.98.171:8449` while preserving the existing CA, keys,
public profile, original fixture and reviewed runtime helpers. The
[sanitized classroom network receipt](evidence/ncl01-testflight-20261019/https-origin-1554298171-20261020.receipt.json)
records normal TLS 1.3, HTTP 200 for the app/bootstrap, all 11 authenticated asset
checks, and cleanup of only the probe's own session. These laptop checks do not
establish iPhone reachability on the classroom network. Build 3 binds the new
origin and app-bound host; there is no runtime server-address setting in build 2.

The existing CA SHA-256 is
`17ad9c5ccd0eb37f00b0062d6c8dcff72a368fb85553175402be5016b21ac8b6`;
it expires October 22, 2026 at 20:08:04 UTC. Renewal is an explicit later operation,
not a TLS exception. The private reviewed October 17 runtime copies retain the
Safari StrictMode/HMR corrections. After validating the network identity and
verifying shutdown of any existing owned copies, run in separate terminals:

```powershell
Set-Location -LiteralPath D:\CodexWorktrees\parallax-ncl01-physical-20261015\Codex_TreasureHunt
$env:TEMP = 'D:\CodexTemp'
$env:TMP = 'D:\CodexTemp'
node D:\CodexTemp\ncl01-preview\restore-runtime-20261017\start-owned-app.mjs
```

```powershell
Set-Location -LiteralPath D:\CodexWorktrees\parallax-ncl01-physical-20261015\Codex_TreasureHunt
$env:TEMP = 'D:\CodexTemp'
$env:TMP = 'D:\CodexTemp'
node D:\CodexTemp\ncl01-preview\restore-runtime-20261017\https-preview-runtime.mjs --bootstrap
```

The two services are currently running; these commands are for a later restart.
Keep the laptop awake on Wi-Fi `155.42.98.171` and the phone on the same LAN.
The startup scripts refuse stale IP/certificate configuration. Do not run initial preparation over
the retained fixture, disable TLS, change global trust, or stop unrelated processes.

On the same LAN, the iPhone must first reach `http://155.42.98.171:8448`.
That page serves only the public test CA/help. Install its profile under
**Settings → General → VPN & Device Management**, then enable its full trust under
**Settings → General → About → Certificate Trust Settings**. Verify the fingerprint
against the retained CA and open the HTTPS origin without a certificate warning.
An already installed and fully trusted copy of this unchanged CA can be retained;
changing the laptop address does not require another CA profile.
Allow the native app's Local Network and Camera prompts when testing. Actual
phone reachability and trust must be observed on the phone; laptop probes cannot
substitute for them.

## Processing, installation and physical acceptance

The signed pipeline uploaded build 2, Apple processing reached `VALID`, and the
processed build was assigned to **TestFlight → Internal Testing → NCL-01 Owner**.
The sole account holder was invited and subsequently reported installation and
native AR display. No duplicate invitation, external public testing group or
App Store release is requested. Build 3 will use the same app and internal group
for the classroom network. See Apple's
[upload](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
and [internal testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers)
instructions.

Once build 3 is available, open TestFlight, select **VoyageWright Landfall** and
confirm **0.1.0 (3)**, then tap **Update** and **Open**. A new invitation is not
needed for the existing tester. Sign into the existing
synthetic NCL account through the laptop origin; its login remains in the private
local `D:\CodexTemp\ncl01-preview\access.private.json` file, outside Git/chat.
Open its released Voyage Journal, **Open Chronicle Lens**, then the explicitly
offered **Use camera for local placement** action. Scan a well-lit textured horizontal
surface and deliberately place the original chest and compass. Observe actual
3D depth/parallax while walking around them and test Inspect/Pick/Place as offered.
Record tracking loss/recovery, background/foreground return and camera closure.
Interactions remain observations; they do not independently advance One Voyage.
Begin slowly scanning the surface immediately: the initial surface-resolution
window is 15 seconds, after which failure to find one returns to Guided View.
This retained Scene authors the chest at 40 cm and compass at 16 cm. Models are
static PBR objects; chest-lid and compass-needle articulation are unsupported.

Record separate outcomes for (1) signed upload, (2) processed/internal-test
availability, (3) exact-build TestFlight installation, (4) native camera/ARKit
tracking and visible original models, (5) physical interaction/lifecycle behavior,
and (6) owner acceptance. Build 2 upload/internal-test availability have retained
software proof; installation, native sign-in and physical camera display are
owner-reported. Exact build readback, the new classroom network on the phone,
measured tracking/alignment, Inspect/lifecycle and final owner acceptance remain
pending.

The first physical fixture is the existing non-adaptive local/surface Scene.
Native activation can use the companion's existing local host path; broader
Crossdeck registry/browser-adapter integration is unfinished. Native adaptive
environment evidence and HIGHLIGHT remain limitations; unsupported requirements
must fall back honestly. Do not claim those capabilities or shared multi-device
qualification from this isolated beta.

## Preparation verification

Preparation commit `526b5c0a879e9164302718ae8a4ae5cc75508bcb` adds only the
isolated beta tools/metadata and their documentation. Focused transport tests
passed 3/3, runner boundary tests 4/4, and Windows credential checks 18/18 with
synthetic in-memory certificates/profiles/keys. The latter validate CMS signature
integrity, not Apple's signing trust chain. Reusing the real public CSR verifies
its signature and match with the protected local private key. Public CSR SHA-256:
`2bf6d580a6d1b1d0185cf34567aadbf219722628a7a514705623013d2d55a0b0`.
Independent source review found no blocker to an unsigned device archive.

The first [hosted device archive](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39342258297)
binds that preparation commit through owned transport
`814885f4dee5522741cc6dc3945ce39a764ccf13`. Its origin is the retained `.24` value
for compilation/metadata checks only; phone reachability is not established.
That initial run was canceled during its full-repository checkout before app
compilation. A bounded checkout now selects the iOS app, pipeline, original model
resources and referenced test fixtures, avoiding unrelated retained evidence.
The replacement run remains an unsigned device archive and cannot produce a
TestFlight-installable build. No signing secrets had been installed at that point.

The [replacement archive passed](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39342416557)
for candidate `bcca4fba851686b1cced11604daf5790a467b8bb`, transport
`0050884d36499a4c42e7e78b99edc6d822e1805f`. Xcode 26.6 build 17F113 and
iPhoneOS SDK 26.5 compiled the generic iOS Release application. Its bundle ID,
version/build, origin, app-bound domain, camera/local-network explanations,
absence of ATS exceptions, app icon, app privacy manifest and actual embedded
GLTFKit2 privacy manifest passed archive assertions. The installed `altool`
advertises an explicit `.p8` path option, which the signed path will use.
Credential/temp cleanup passed. Both owned transport branches were removed
with their expected head SHAs and absence verified; source branch is retained.

[The verification receipt](evidence/ncl01-testflight-20261019/verification.json)
hashes nine byte-exact original run/dispatch/cleanup/log records. The empty
device archive log is retained as emitted by successful quiet Xcode output.
The app executable digest is recorded in the original receipt. No IPA export,
signing, upload, Apple processing, phone reachability, installation or physical
AR behavior was established by this unsigned run.

## First signed attempt and focused repair

[Run 39361584467](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39361584467)
at `fe6624fb62106794fd479e5f57e0e50c35c2d08c` passed profile/private signing
identity validation but failed in PROJECT_GENERATION after XcodeGen succeeded.
Its [original failure and cleanup proof](evidence/ncl01-testflight-20261019/signed-39361584467/verification.json)
are retained. No device archive, export or upload occurred; build 2 remains unused.
The exact failing plutil command was not logged, so a specific root cause is not
claimed. The old path attempted post-generation mutation of an OpenStep project.

The correction uses XcodeGen's supported include/merge mechanism: a private JSON
overlay references the unchanged project specification and overrides only the
app's Release signing settings. Both spec root and project output remain native/ios.
Before archive, effective settings must match all five expected signing fields.
Dependency/test targets retain their unsigned defaults. Failed commands now retain
only tool name and exit code; command arguments and credential output stay private.
Focused checks pass 3 transport and 5 runner tests, including app-only scope.
Independent source review found no blocker to the fresh hosted signed retry.

## Signed archive/export and Apple tool compatibility

[Run 39361959547](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39361959547)
at `6608961356252381a2c1d53a92d460377f1f743b` passed all five effective signing
settings, the real iOS device archive, signed entitlements, exact app-record lookup
and App Store IPA export. The 1,975,041-byte IPA SHA-256 is
`f7ba1697b248fd52f3efbe2fe64178c1de5af760b0a391d60a43ad695a8487df`.
It remains in the owned artifact directory and GitHub run artifact. The
[byte-exact original receipts and logs](evidence/ncl01-testflight-20261019/signed-39361959547/verification.json)
are retained; the temporary transport branch was removed with its expected SHA
and absence verified. Credential cleanup passed.

Apple validation exited 1 before upload. Its response was discarded by the old
runner, so no specific Apple validation error is claimed. The actual retained
altool 26.40.1 help documents `--validate-app <filepath>`,
`--upload-package <filepath>`, `--api-key` and `--api-issuer`; the old runner mixed
legacy arguments. The correction follows that exact help and saves only parsed,
bounded error fields with known secrets, PEM material, JWTs and email addresses
redacted. Unstructured responses and private nested fields are not published.
Seven focused runner tests and three transport tests pass. Build 2 has not been
uploaded; signed installation and physical AR remain pending.

## NFC distribution entitlement correction

[Run 39362740884](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39362740884)
at `c2aff376990900a356f802fd639e5cf6cdaf099e` again passed signing, device archive
and IPA export. The corrected tool invocation returned Apple's actual validation
error 90778: the shipped NFC `NDEF` entitlement value is disallowed and `TAG` is
missing for this SDK/deployment target. Upload did not begin. The
[original diagnostic and failure proof](evidence/ncl01-testflight-20261019/signed-39362740884/verification.json)
are retained with successful credential cleanup.

The app now requests only `TAG`, as listed in Apple's
[current entitlement documentation](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.nfc.readersession.formats).
An [Apple engineer confirms the deprecated NDEF value was replaced by TAG](https://developer.apple.com/forums/thread/781403?answerId=835720022#835720022).
The existing `NFCNDEFReaderSession` implementation and NFC purpose text are
unchanged. This is a distribution compatibility correction, not physical NFC
qualification. The owner's existing profile already authorizes `TAG` alongside
older values; it passed the updated exact-app/certificate/profile validator.
No certificate, provisioning-profile or credential replacement is required.

Both local and hosted preflights require profile authorization for `TAG`.
The signed application's entitlement must equal `[TAG]`, rejecting deprecated
formats before export. Seven runner tests and 19 synthetic Windows signing cases
pass, including rejection of NDEF-only profiles. Build 2 remains unused pending
a fresh signed retry; all original model and native AR source bytes are preserved.

## Uploaded beta and internal-test availability

[Run 39363249446](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39363249446)
at `484183ac15badcfefd5b08cfd187e330e567fbf8` passed signing, real device archive,
App Store export, Apple validation and upload. Apple processed build
`6964a888-1759-4982-8254-b0005dbad00f` as `VALID`. IPA size is 1,975,043 bytes;
SHA-256 `6752f16f7a56a8a6816e0eb450a4d6fafa4d32783546e69316760eb3b03e9b6f`.
[Original run evidence](evidence/ncl01-testflight-20261019/signed-39363249446/verification.json)
preserves its overall failure: group attachment returned HTTP 422 while the
build's beta detail was `MISSING_EXPORT_COMPLIANCE`. Upload itself succeeded;
the failed original receipt is not rewritten. Credential cleanup passed.

The app uses Apple CryptoKit AES-GCM for local encrypted storage, Security/
Keychain key management, SHA-256 and Apple-managed HTTPS. No separate crypto
implementation was found in the inspected native source, actual embedded
GLTFKit2 binary/dependencies or targeted first-party client-library search.
Apple's [documentation table](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/)
requires no App Store Connect documentation for encryption limited to Apple's
operating system. The displayed question separately excluded Apple's OS services
from its standard-algorithm choice. The operator selected **None of the algorithms
mentioned above** and saved that verified technical metadata. This does not mean
the app uses no encryption; `usesNonExemptEncryption` is now `false` in Apple's
build record. No new agreement or public App Store submission was made.

After compliance cleared, the same build was attached to the existing internal
group without re-upload. Fresh API and browser checks show **Testing** /
`IN_BETA_TESTING`, exactly one matching account-holder tester, and **Invited**.
The automatic invitation state was observed before any resend, so no duplicate
invitation was sent. The readiness receipt records these distinct current gates;
it explicitly leaves physical phone trust, installation and AR proof false.

[Observation run 39364087090 passed](https://github.com/Kgray44/treasurehuntSoT/actions/runs/39364087090)
against the same exact compiled candidate, version and build. This API-only mode
rechecked processing and the existing group attachment without receiving the
distribution certificate/profile secrets or uploading again. Its
[original observation and cleanup receipt](evidence/ncl01-testflight-20261019/observe-39364087090/verification.json)
records `PASS`, Apple `VALID` and the existing internal-group attachment. The
mode's `uploadAccepted: false` means that observation did not upload; it does not
undo the separate successful upload receipt. No physical acceptance is inferred.

## Owner installation and sign-in diagnosis, October 20

The owner initially reported installing the TestFlight app and opening a working
app shell, followed by **Those credentials were not accepted** during sign-in.
They later confirmed successful sign-in and visible original 3D objects through
the native camera. This later owner report does not supply exact build readback
or measured physical tracking/interaction evidence. Earlier readiness and failed
sign-in receipts remain immutable snapshots.

The [scoped sign-in diagnostic](evidence/ncl01-testflight-20261019/sign-in-20261020.receipt.json)
verified the exact isolated runtime database, ACTIVE account/profile and a match
between the stored password hash and the existing private credential file. An
ordinary sign-in request to the same `.18` origin passed normal certificate
validation, returned 200, set a Secure session cookie and authenticated the
session context. Only the diagnostic's own session was then signed out and
verified revoked. Credentials, fixture, services, TLS and app source are unchanged.

The running preview and beta use identical sign-in source. That exact 401 message
comes from account/password validation; the UI uses a different message if a
successful login cannot establish its session. The password is exact and is not
trimmed. The cause of the phone's rejected attempt is not observed.
An owner-only plaintext login aid at
`D:\CodexTemp\ncl01-preview\VoyageWright-Sign-In.private.txt` shows the same email
and password without JSON quotation marks or trailing commas. Clear saved
autofill and copy only each value line. Its contents remain outside Git and chat.

## Classroom continuation, October 20

The owner requests another private test Chronicle and a new Scene using the
retained classroom reconstruction. That fixture is being prepared through the
existing library, Chronicle publication and Voyage services. The original
Chronicle/Voyage and account are preserved. Classroom photos and derived private
geometry remain outside Git; no new paid reconstruction is part of this work.

The current native provider supports the original chest and compass, static
local/surface placement and authored layout offsets. The reconstruction is
authoring input with estimated scale and manual floor-origin registration; it
does not establish a measured room map. Native adaptive Environment evidence,
automatic classroom recognition and FIXED_WORLDSPACE registration remain
unsupported. New classroom publication and owner placement proof are pending.

Build 3 changes only the configured network origin and declares the previously
audited OS-only encryption metadata explicitly as
`ITSAppUsesNonExemptEncryption=false`; the archive must verify that value. The
requested official dark compass icon still awaits the exact artwork and is not
being replaced with another design as part of this network update.
