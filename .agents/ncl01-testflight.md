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

Laptop is now on Wi-Fi 155.42.98.171/24. Guarded same-CA relay restoration and
owned process/port cleanup passed, including 11 authenticated asset checks;
preserve the October 17 StrictMode/HMR helpers. The owner subsequently confirmed
Safari opens https://155.42.98.171:8449 without a warning, establishing owner-reported
phone reachability/trust only. Release app origin/app-bound host are immutable,
so build 0.1.0 (3) targets this verified origin. It was unused at preflight and
passed run 39434900108 against candidate 3ac0dafc0174f4a7b7b5fb63c91aa49b01694730.
Apple build fdb879e6-ac3c-49a5-9728-6634bf8b0a1f is VALID/IN_BETA_TESTING,
attached to the existing NCL-01 Owner internal group. Build 3 is consumed; never
re-upload it. Archive/export/validate/upload, signing cleanup and exact owned
transport deletion/absence checks passed. Existing sole tester state INSTALLED
does not prove build 3 installation. No duplicate invitation was sent.
The IPA stays in ignored artifacts, while public source-bound receipts are
retained under signed-39434900108 and the build 3 readiness receipt. Existing
OS-only encryption audit supports explicit
ITSAppUsesNonExemptEncryption=false with an archive assertion. Do not infer native
build 3 connectivity, classroom registration or measured AR quality from Safari.

Native supports original chest/compass only, static local/surface placement.
It cannot recognize a classroom from photos, supply adaptive Environment evidence
or resolve FIXED_WORLDSPACE anchors. Reuse the actual private reconstructed layout
as authoring input and state estimated scale/manual floor-origin alignment honestly.
Do not fabricate Environment pins, measured geometry or registration evidence.
Canonical classroom publication is now complete: Voyage cmvgr299f000v25o8koydyrcd,
Scene 13c1178ec10faae82ef92a7095b376380bcfbf0a1b436caaa7d51beb005edf6d,
one shared horizontal anchor with a 40 cm middle-table chest and two 16 cm
compasses. Independent HTTPS/API 11/11 and ordinary library/Journal/Lens/three
accessible Guided cards passed; Guided has zero canvases and proves no 3D.
The opening presentation fell back with its explicit usable-Journal notice;
animation quality did not pass. Both Voyages' canonical progression stayed
unchanged and the verifiers revoked only their own sessions. Public receipts
are under evidence/ncl01-testflight-20261019/classroom-20261020; private photos,
geometry/plans/helper/backup stay outside Git. Initial floor placement is automatic;
Place repositions the shared anchor. No rotation/nudge or automatic room alignment.
The owner subsequently confirmed the correct Classroom Compass Trail Lens title,
native camera opening and an initially empty view without status/error text.
Panning in that same session without replacement revealed objects. Owner wording:
"Yes, objects appear when I look around". They do not accept the authored scene's
appearance/placement. New immutable phone-native-visibility.owner-report.json
records this tier; preserve earlier false-flag readiness/software snapshots.
Exact phone build, all three objects, Inspect/Pick/Place, measured tracking/drift
and alignment are unverified. Full authored Scene/room-registration integration
remains unfinished; do not classify rendering visibility as NCL-01 completion.
The official artwork was unavailable for builds2/3/4. The owner has now attached
and designated the dark brass compass PNG as the official VoyageWright icon.
Its exact1254RGB original is retained at native/ios/Branding/VoyageWright-AppIcon.source.png,
SHA71a2979a8a2ab6a43f3ec9fa1d7f14fb7147deda5887883f22a22a382cd240bc.
The iOS AppIcon uses the entire artwork resized1024RGB with Pillow12.2.0 LANCZOS;
fileSHAf60c10774d2e206cee973f62d2528cc3a989d422cf2ec2aa3df80c4d40562b3b.
Source/output and exact decoded pixels were independently reviewed. Preserve
composition, background and margins; no generative redraw. Build0.1.0(5) is next,
same stable origin and signing setup. Require real archive/export/upload/Apple
processing, existing internal group, cleanup and compiled icon verification.
Do not equate compiled-resource bytes with the source PNG hash. This cosmetic
change does not alter AR behavior or require restarting the private preview.

Success is the owner installing this exact beta through TestFlight, opening
native ARKit camera placement, seeing the original interactive 3D chest and
compass anchored in the physical environment, and recording actual tracking,
interaction and lifecycle observations. Simulator/raster proof, upload,
processing, internal-test availability and Safari Guided View never complete it.
Adaptive/native environment evidence and broader Crossdeck registry integration
remain separate limitations; use the existing non-adaptive synthetic local/
surface Scene for the first physical test. No duplicate demo state or engine.

## Stable origin continuation

The owner selected Cloudflare and owns absoluterelativesystems.com, with existing
staging.absoluterelativesystems.com. Read-only public audit observed valid TLS and
302 to Cloudflare Access, not app HTML or NCL source/database identity. Existing
remotely managed Cloudflared Windows service is running/healthy and preserved;
staging checkout and database remain unknown. Never repoint shared
staging or alter its connector without first proving ownership/target. Current
native exact-origin navigation blocks external Access-login redirects; review
authentication deliberately, retaining TLS and app/API authorization.

Owner sign-in is complete. Dashboard readback binds existing ars-local-staging
routes staging -> http://localhost:3000 and audit -> http://localhost:3110, with
default route settings. The exact-host staging Access app uses Test Users; no
wildcard Access app was observed. Neither existing target has a current listener;
that does not authorize reuse of its port or repointing. Preserve both routes.
The owner explicitly approved publication of the prepared separate ncl01 route.
Cloudflare confirmed Route added successfully and the automatic CNAME; the final
three-route list preserves staging/audit and adds ncl01 -> http://127.0.0.1:3159,
defaults. Its existing VoyageWright account/authenticated assets remain required.
Do not repeat publication approval or weaken existing Access protections.

Private runtime preparation is sealed under
D:\CodexTemp\ncl01-preview\cloudflare-ncl01-20261020. Its tracked source snapshot is
47ff42e4cb8b67e5fa2bfbc481a34d3d33490a18; the dedicated production webpack build and
TypeScript check passed without bypasses. New loopback-only Next 3158 and strict
proxy 3159 preserve the canonical isolated database and original laptop services.
Local exact-public-Origin gates now pass: 10/10 edge guards and 14/14 canonical
sign-in/asset/Journal/stream/logout checks, independently reviewed. This is
loopback HTTP proof, not public TLS or phone proof. Full Crossdeck streaming was
not exercised; its authenticated request reached schema validation without
creating a surface. Failed origin/cwd/wrong-Journal-path diagnostics are retained
under cloudflare-20261020. The corrected private server uses its dedicated cwd,
fixed Host/proto guards and Next 16.3.8 URL normalization; product Origin/auth/CORS
checks are unchanged. Following approved publication, normal PUBLIC HTTPS checks
passed 14/14 using default platform trust/no CA override: Secure sign-in, original
GLBs, Journal HTML/current-events SSE, authorization and own-session revocation;
both Voyages stayed unchanged. Independent review passed. Ordinary Edge root,
Player entry and account sign-in HTML navigation was reachable; no browser login
or progression action was used. This was not CSS/hydration/presentation proof.
The owner then reported phone cellular reachability and supplied an unstyled
desktop sign-in screenshot; root reproduced it. All 25 referenced 7 CSS/18 JS
failed 404 despite existing built files. API proofs remain scoped, not visual
acceptance. The private 3158 router seam is now repaired using ordinary Next
router/static handling, fixed advertised hostname/443 and actual loopback3158.
Only the old owned3158 instance was stopped with creation/held-handle proof;
edge3159 and all previous services stayed unchanged. Failed static/cache receipts
are preserved. Exact25URL purge followed by only the new host's /_next/static
prefix purge cleared cached Origin variants; no zone/staging/audit purge or cache
configuration/Access change. Final150/150 checks cover three pages x25references
x two header cases, ordinary URLs/no query bypass, exact types/bytes/hashes.
Post-router normal public auth/asset/JournalSSE14/14 passed with owned revocation
and unchanged Voyages. Root actual account sign-in normal reload has styled
pixels and settled provider availability (hydration). Final readiness SHA
a8102f434ef1efb64d4488f3f8cd5d6a00cf625225af82cc36c4924a37a6faa1;
independent review verified all29 members and live router195824/edge195316.
Corrected phone presentation/native build4 remain owner gates.

Build 0.1.0 (4) was unused at preflight and run39444433227 is SUCCESS against
exact47ff42e4 and https://ncl01.absoluterelativesystems.com. Actual device archive,
App Store export/validation/upload and processing VALID passed; existing NCL-01
Owner group is IN_BETA_TESTING. All13 IPA checks and credentials cleanup passed;
the exact owned transport was deleted with SHA lease/absence proof. Builds2/3/4
are consumed; never duplicate an upload. Harvest's presentation-pending snapshot
is retained alongside later final public/router readiness. Build3 still targets
the LAN origin and needs this one-time TestFlight4 update with the same account.
Existing Cloudflared service, staging/audit, LAN3149/8448/8449, firewall, global
trust and private credentials are unchanged. No domain purchase occurred.
Phone installation/native connectivity and full authored Scene fidelity remain
separate gates; public software proof does not complete them.

Start/check only the new services using private Start-OwnedCloudflarePreview.ps1;
intentional shutdown uses matching Stop-OwnedCloudflarePreview.ps1. Both are under
the private runtime directory above. Helpers verify exact creation identity,
instance/script hash and loopback listener; Stop uses a held process handle and
checks exit/port release. New-launch failure cleanup only affects its newly
created instance. Current immutable runtime script is serve-owned-production-router.mjs.
Start idempotency passed; final Stop was reviewed, not executed
against the healthy public runtime. Preserve its private records/identity helper.
