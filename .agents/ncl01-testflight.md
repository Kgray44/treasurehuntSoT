---
title: NCL-01 isolated TestFlight deployment
audience: automation
status: current
canonical_for: ncl01-testflight-deployment-context
last_reviewed: 2026-10-19
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
certificate/profile/API configuration, signed distribution, Apple processing,
installation and physical tracking are separate unproved gates.

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
and validate the certificate. October 19 laptop Wi-Fi is `10.4.48.166`, while
retained relay configuration is `192.168.0.24`; the latter is currently not
assigned. Do not mistake an unsigned archive origin for verified phone reachability.

Success is the owner installing this exact beta through TestFlight, opening
native ARKit camera placement, seeing the original interactive 3D chest and
compass anchored in the physical environment, and recording actual tracking,
interaction and lifecycle observations. Simulator/raster proof, upload,
processing, internal-test availability and Safari Guided View never complete it.
Adaptive/native environment evidence and broader Crossdeck registry integration
remain separate limitations; use the existing non-adaptive synthetic local/
surface Scene for the first physical test. No duplicate demo state or engine.
