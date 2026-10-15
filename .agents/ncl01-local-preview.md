---
title: NCL-01 owned laptop preview operations
audience: automation
status: current
canonical_for: parallax-ncl01-laptop-preview-operations
last_reviewed: 2026-10-15
---

# NCL-01 laptop preview

These helpers operate only the synthetic NCL-01 fixture in
`D:\CodexTemp\ncl01-preview`, from the owned `codex/parallax-ncl01` worktree.
They preserve other databases, runtimes and checkouts. The current laptop Wi-Fi
address is `155.42.98.160`; this is an address snapshot, not a reserved hostname.
Certificate and relay checks refuse an address no longer assigned to the laptop.

## Prepare and run

Use PowerShell 7.2 or newer and the exact locked dependencies in the worktree.
For this Windows runtime, `node_modules` must be physically inside the worktree:
Turbopack rejected the cross-drive junction, while webpack produced invalid
cross-drive entry paths. The successful development runtime uses webpack with
the same dependency bytes copied from its task-owned D: installation.

```powershell
npx tsx scripts/parallax/ncl01-preview.ts prepare https://155.42.98.160:8449
pwsh -NoProfile -File .agents/scripts/ncl01-local-cert.ps1
node .agents/scripts/ncl01-local-https.mjs --self-test
node .agents/scripts/ncl01-local-app.mjs
```

In a separate task-owned terminal:

```powershell
node .agents/scripts/ncl01-local-https.mjs --bootstrap
```

The app listens only on `127.0.0.1:3149`. HTTPS listens on the assigned laptop
address at port 8449. The optional HTTP port 8448 serves only help and the public
test CA/profile. It cannot serve app routes, keys, credentials or configuration.
The HTTPS relay fixes its upstream, validates Host and upgrade paths, replaces
forwarded headers and adds Secure to upstream cookies. It logs no request paths,
cookies or headers. The task helpers never install trust or change firewall rules.

Preparation creates a synthetic verified account, released Chronicle/Scene and
active Voyage through existing services. Repeated preparation/status preserves
those identities and credentials. The preview root and named private files have
protected Windows ACLs granting only the current user and SYSTEM. Credentials,
environment, database and CA private keys stay outside Git. Read the local
`access.private.json` privately when owner login is needed; never publish it.

The current Journal path is
`/player/playthroughs/cmv9yxc3u001i25do46ylmr89/journal`.
The released Scene checksum is
`3742976133f66aea45c4da97d628fc8b0bd951289aba2abe0712664b544cdf35`.

## Phone preview and installation boundary

Same-network reachability must be verified on the phone. The public certificate
bootstrap is `http://155.42.98.160:8448`; the app is
`https://155.42.98.160:8449`. The generated test CA expires after seven days.
Its DER SHA-256 is
`17ad9c5ccd0eb37f00b0062d6c8dcff72a368fb85553175402be5016b21ac8b6`.
Certificate installation and full trust are manual owner actions following
[Apple's certificate instructions](https://support.apple.com/en-us/102390).
Remove the test profile after testing. No trust installation has been performed
by this task.

The owner has an iPhone 17 Pro, no physical Android device, no existing companion
installation or Apple Developer setup, and prefers not to borrow a Mac. Use
hosted macOS for software build checks. Safari can exercise the existing Guided
experience; it cannot establish native ARKit acceptance. A signed iOS installation
is still required for native testing. Apple's free Personal Team path uses Xcode;
it must not be represented as a Windows-only installation path or as proof that
all existing companion entitlements are available. See
[Apple's account overview](https://developer.apple.com/help/account/basics/about-your-developer-account).
No enrollment, purchase, credentials, signing certificate or provisioning profile
has been obtained by this task.

## Stop and evidence

Stop each owned terminal with Ctrl+C, then verify the recorded task PIDs and
ports before declaring cleanup. A parent exit alone does not prove descendant
shutdown. The relay removes only its matching instance record. Do not stop
unrelated Node processes or remove the synthetic database, private files or proof.
Next dev may append its generated AGENTS block and dist paths to tsconfig; inspect
and restore only those task-generated changes before committing.

Keep browser, native compilation, physical tracking and owner acceptance as
separate evidence. The governed experience plan is held by the existing
`crossdeck.phase2.continuity` experience-design prerequisite; supporting browser
captures do not waive that gate. See the
[engineering record](../Development_Docs/Projects/Project_Parallax/NCL01_Native_Scene_Vertical_Slice.md).
