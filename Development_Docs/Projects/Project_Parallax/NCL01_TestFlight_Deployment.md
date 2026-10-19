---
title: NCL-01 first physical iPhone TestFlight deployment
audience: engineering-owner
status: preparation-in-progress
canonical_for: ncl01-testflight-deployment-record
last_reviewed: 2026-10-19
---

# NCL-01 TestFlight deployment

The owner requests a private development beta of the existing native companion.
This record is engineering preparation, not a release approval or physical
acceptance. PR #741 remains unmerged. Protected main, Crossdeck and Sounding Line
are outside this deployment change.

Team ID: `X2JZ9N65V2`. Bundle ID: `com.voyagewright.landfall`. Source baseline:
`76d1787e1340e396bc95747293d43e57130b00ed`. Owned preparation branch:
`codex/ncl01-testflight`. Paid Apple Developer enrollment and TestFlight installed
on iPhone 17 Pro are owner-reported. No signed installation is established.

## Actions the account owner completes

1. Open [Apple Developer Identifiers](https://developer.apple.com/account/resources/identifiers/list)
   with team `X2JZ9N65V2`. Reuse or register an **App ID / App**, description
   **VoyageWright Landfall**, **Explicit** bundle ID `com.voyagewright.landfall`.
   Enable **Near Field Communication Tag Reading**, matching the existing NDEF
   entitlement. ARKit and camera access do not require a separate portal capability.
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
and profile contents before archive. No credentials are currently configured.

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

On October 19 the retained configured origin is `https://192.168.0.24:8449`, but
the laptop is on Wi-Fi `10.4.48.166`. The saved IP is unassigned and its public
probe times out. Local application port 3149 returns HTTP 200; this does not prove
phone reachability. Before signing, return to the intended testing LAN or rebind
only the owned relay leaf/configuration while retaining its existing CA. Confirm
the actual assigned address and validate normal TLS; then bind that origin into
the beta. A network-address change after installation may require a new beta.

The existing CA SHA-256 is
`17ad9c5ccd0eb37f00b0062d6c8dcff72a368fb85553175402be5016b21ac8b6`;
it expires October 22, 2026 at 20:08:04 UTC. Renewal is an explicit later operation,
not a TLS exception. The private reviewed October 17 runtime copies retain the
Safari StrictMode/HMR corrections. After validating the network identity and
verifying shutdown of any existing owned copies, run in separate terminals:

```powershell
node D:\CodexTemp\ncl01-preview\restore-runtime-20261017\start-owned-app.mjs
```

```powershell
node D:\CodexTemp\ncl01-preview\restore-runtime-20261017\https-preview-runtime.mjs --bootstrap
```

Use the physical NCL checkout as the working directory. The startup scripts
refuse stale IP/certificate configuration. Do not run initial preparation over
the retained fixture, disable TLS, change global trust, or stop unrelated processes.

On the same Wi-Fi, the iPhone must first reach `http://<verified-laptop-ip>:8448`.
That page serves only the public test CA/help. Install its profile under
**Settings → General → VPN & Device Management**, then enable its full trust under
**Settings → General → About → Certificate Trust Settings**. Verify the fingerprint
against the retained CA and open the HTTPS origin without a certificate warning.
Allow the native app's Local Network and Camera prompts when testing. Actual
phone reachability and trust must be observed on the phone; laptop probes cannot
substitute for them.

## Processing, installation and physical acceptance

After secure credentials and a verified origin are available, run the signed
pipeline, record the IPA digest/delivery result and observe Apple's processing.
An upload success is not a processed build. Resolve actual export-compliance
questions using the app's real encryption use; do not invent an exemption answer.
In the app's **TestFlight → Internal Testing**, create **NCL-01 Owner**, add the
owner's existing App Store Connect user and the processed build. No external
public testing group or App Store release is requested. See Apple's
[upload](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
and [internal testing](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers)
instructions.

Open the internal invitation on the iPhone, accept it in TestFlight, confirm
**VoyageWright Landfall** and the expected version/build, then tap **Install** and
**Open**. Sign into the existing synthetic NCL account through the laptop origin.
Open its released Voyage Journal, **Open Chronicle Lens**, then the explicitly
offered native camera placement action. Scan a well-lit textured horizontal
surface and deliberately place the original chest and compass. Observe actual
3D depth/parallax while walking around them and test Inspect/Pick/Place as offered.
Record tracking loss/recovery, background/foreground return and camera closure.
Interactions remain observations; they do not independently advance One Voyage.

Record separate outcomes for (1) signed upload, (2) processed/internal-test
availability, (3) exact-build TestFlight installation, (4) native camera/ARKit
tracking and visible original models, (5) physical interaction/lifecycle behavior,
and (6) owner acceptance. All are pending unless supported by new evidence.

The first physical fixture is the existing non-adaptive local/surface Scene.
Native activation can use the companion's existing local host path; broader
Crossdeck registry/browser-adapter integration is unfinished. Native adaptive
environment evidence and HIGHLIGHT remain limitations; unsupported requirements
must fall back honestly. Do not claim those capabilities or shared multi-device
qualification from this isolated beta.
