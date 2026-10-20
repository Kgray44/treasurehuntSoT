---
title: NCL-01 isolated TestFlight deployment
audience: automation
status: current
canonical_for: ncl01-testflight-deployment-context
last_reviewed: 2026-10-20
---

# NCL-01 first physical iPhone beta

LAUNCHDECK_PROJECT_TRIM_ADAPTATION; profile security-sensitive infrastructure;
execution UNATTENDED_CONTINUATION. No hard token budget. The owner authorizes an
isolated development beta, signing and upload after credentials are configured.

## Source and ownership

- Preserve PR #741 / `codex/parallax-ncl01` at
  `76d1787e1340e396bc95747293d43e57130b00ed`. Extend its exact source on the separate
  owned `codex/ncl01-testflight` branch/worktree; do not merge either branch.
- Read current `AGENTS.md` and the owner scope. The owner's explicit prohibition
  overrides generic main-start, PR qualification and merge instructions for this
  beta. No protected main, Crossdeck or Sounding Line changes or broad qualification.
- Existing native source: `native/ios/project.yml`, `LandfallCompanion/`, pinned
  GLTFKit2 `e69e354c4f31ea07b7816b8cbe2ddb28e897d073`. Preserve original SC02 model
  bytes and canonical Scene/Player observation authority.
- Retained NCL proof and limits: [native record](../Development_Docs/Projects/Project_Parallax/NCL01_Native_Scene_Vertical_Slice.md).
- [Deployment record and owner checklist](../Development_Docs/Projects/Project_Parallax/NCL01_TestFlight_Deployment.md).
- [Laptop preview operations](ncl01-local-preview.md) is historical for its start
  commands: the private reviewed October 17 runtime copies retain the later
  StrictMode/HMR corrections. Preserve them, the CA and private fixture.

## Deployment contract

Team ID `X2JZ9N65V2`; bundle ID `com.voyagewright.landfall`; iPhone 17 Pro.
Paid membership and TestFlight installation are owner-reported. App record,
identifier and team are now visible in the owner's Apple screenshots; numeric app
Apple ID `6824734220` is configured as `NCL01_ASC_APP_ID` in the dedicated GitHub
environment. The owner completed certificate/profile/team API key setup. All four
signing secrets and API metadata are configured there; exact app API lookup passed.
The matching private signing key and App Store profile passed local validation
and hosted keychain preflight. The verified NCL-01 Owner internal group contains
only the existing account holder. A real signed device archive and App Store IPA
export passed in run 39361959547. Run 39363249446 uploaded build 0.1.0 (2) at
`484183ac15badcfefd5b08cfd187e330e567fbf8`; Apple processing is VALID. Current
internal beta is IN_BETA_TESTING in NCL-01 Owner, sole account-holder INVITED.
On October 20 the owner reported TestFlight installation and a working app shell,
then confirmed successful sign-in and seeing the original 3D objects through the
native AR camera. This is owner-reported physical display, not measured alignment,
Inspect/lifecycle or tracking-quality qualification. Exact build readback and
phone trust remain separate gates. Do not repeat
certificate creation for a pipeline repair.

The template `.agents/ncl01-testflight-hosted.yml` is transported as one generated
workflow file on an owned `codex/ncl01-testflight-*` push branch. The job checks
out the exact candidate; it does not change main. Unsigned archive jobs receive
no credentials. Signed jobs use environment `ncl01-testflight`, restricted to
those branches. Archive a real generic iOS device application with Xcode 26+;
export an App Store Connect IPA and upload only in explicit upload mode. Do not
reuse simulator-specific plist/ATS mutation from the Device Lab builder.

Private preparation stays outside Git under the owner-only
`D:\CodexTemp\ncl01-apple-signing` directory. The CSR is public; private RSA is
protected with Windows CurrentUser DPAPI. Downloaded credentials are never pasted
into chat or logged. Configure environment secrets using stdin. Do not overwrite
existing environment protections. Runner cleanup must remove its keychain,
profile and API key, including on failure. Public receipts contain only bounded
metadata and explicitly retain false physical-acceptance claims.

## Required verification and acceptance

Focused input/security tests, real hosted device archive, archive metadata/icon/
privacy checks, review of signing configuration, documentation/index validation,
feature sync/validation. Keep failed receipts and exact candidate identities.
Do not use broad repository qualification to produce this isolated beta.

Before a signed build bind the actual intended testing LAN origin, preserve TLS
and validate the certificate. The initial October 19 observation found the laptop
on `10.4.48.166`; it has since returned to configured Wi-Fi `192.168.0.24`.
Fresh read-only probes returned 200 for bootstrap, HTTPS app and both original
GLBs with normal TLS 1.3 validation. Existing services and CA are unchanged.
The laptop subsequently selected Ethernet `192.168.0.18`; the retained `.18` leaf
and configuration were restored without changing CA, keys, public profile or
fixture. Owned process/port cleanup and 11 authenticated asset checks passed;
current origin is `https://192.168.0.18:8449`. The CA expires October 22 at
20:08:04 UTC. Phone reachability/trust remains an owner check explicitly deferred
until later; do not infer it from laptop probes or keep asking during preparation.

First signed attempt 39361584467 at `fe6624fb` passed signing identity/profile
checks but failed after XcodeGen succeeded, in the old generated-project mutation
step. Cleanup passed; no archive/export/upload occurred. The repair uses a private
XcodeGen include overlay scoped only to app Release signing, then checks all five
effective signing settings before archive. Retain the failure; that attempt did
not consume build 2.

Second signed attempt 39361959547 at `66089613` passed the effective signing
settings, real device archive, signed entitlements, app record and IPA export.
It failed at ASC_VALIDATE before upload; cleanup passed. Raw altool response was
discarded, so the exact rejection is unknown. The retained Xcode 26.40.1 tool help
documents positional archive arguments and kebab-case API authentication flags;
the retry uses those and retains only parsed, bounded, redacted error fields.
That attempt did not consume build 2. Original failure logs and the signed IPA
are retained.

Run 39362740884 at `c2aff376` then reached actual Apple validation and received
90778: shipped NFC NDEF disallowed, TAG missing. Existing profile authorizes TAG
and passed the updated validator; no new owner signing setup. App entitlement is
now exactly TAG, preserving NFCNDEFReaderSession and purpose text. Signed-app
assertion requires TAG only; profile validators require TAG authorization while
allowing Apple's profile superset. Retain the failed diagnostic; that attempt
did not consume build 2.

Current build 2 is now consumed by run 39363249446; never re-upload it. The upload
run passed validation/upload/processing and retained overall failure at group
attachment while MISSING_EXPORT_COMPLIANCE. The operator answered the displayed
OS-excluding encryption question from the inspected Apple CryptoKit/Security/
HTTPS implementation; usesNonExemptEncryption=false. No no-encryption claim or
new agreement. Same existing internal group was attached after compliance cleared;
API/browser confirm Testing and Invited. Original failure stays immutable.
Resume only observe mode for this build; future binary uploads need a new number.
See the deployment record and current readiness receipt. Owner phone checks are
now in progress; completion remains successful native sign-in and real AR behavior.
Observation run 39364087090 passed against the same compiled candidate/version/
build without archive/re-upload or distribution secrets; retained originals bind
Apple VALID, existing internal group and successful API-key cleanup. Its false
uploadAccepted is specific to observe mode, not a reversal of the upload proof.

October 20 sign-in diagnosis: existing file credential matches the ACTIVE account
in the exact isolated runtime database. An ordinary POST over verified HTTPS .18
returned 200, set a Secure session cookie, and authenticated the session context.
The owned probe session was signed out and verified revoked. No password/database/
TLS/runtime change. Password input is exact, not trimmed. An owner-only plaintext
login aid at D:\CodexTemp\ncl01-preview\VoyageWright-Sign-In.private.txt presents the
same existing values without JSON punctuation. Never publish its contents. Owner
must retry only the email/password value lines after clearing autofill; do not
infer a native phone sign-in or AR success from the server probe.

## October 20 classroom continuation

The owner subsequently confirmed visible original 3D models through the physical
iPhone native AR camera. They request ANOTHER private test Chronicle and NEW Scene
using the retained IMG_8690/IMG_8691 classroom reconstruction, with objects placed
for a further phone test. Preserve the original Chronicle/Voyage and account.
Use canonical library, Chronicle publication and Voyage services in the existing
owned isolated preview database; keep source photos/derived private geometry out
of Git and do not rerun paid inference. No Crossdeck/Sounding Line/main changes.

Laptop is now on Wi-Fi 155.42.98.171/24; old .18 listener is stale. The preview
restoration agent owns guarded same-CA rebind and process/port cleanup; preserve
October 17 StrictMode/HMR helpers. Release app origin/app-bound host are immutable,
so build 0.1.0 (3) must target verified https://155.42.98.171:8449 after TLS health
passes. Build 3 was unused at preflight. Existing OS-only encryption audit now
supports explicit ITSAppUsesNonExemptEncryption=false with an archive assertion.

Native supports original chest/compass only, static local/surface placement.
It cannot recognize a classroom from photos, supply adaptive Environment evidence
or resolve FIXED_WORLDSPACE anchors. Reuse the actual private reconstructed layout
as authoring input and state estimated scale/manual floor-origin alignment honestly.
Do not fabricate Environment pins, measured geometry or registration evidence.
The requested official dark icon still awaits the exact owner-supplied artwork;
do not substitute another design or let that missing asset block network testing.

Success is the owner installing this exact beta through TestFlight, opening
native ARKit camera placement, seeing the original interactive 3D chest and
compass anchored in the physical environment, and recording actual tracking,
interaction and lifecycle observations. Simulator/raster proof, upload,
processing, internal-test availability and Safari Guided View never complete it.
Adaptive/native environment evidence and broader Crossdeck registry integration
remain separate limitations; use the existing non-adaptive synthetic local/
surface Scene for the first physical test. No duplicate demo state or engine.
