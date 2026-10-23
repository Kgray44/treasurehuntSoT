---
title: NCL-01 owned laptop preview operations
audience: automation
status: current
canonical_for: parallax-ncl01-laptop-preview-operations
last_reviewed: 2026-10-21
---

# NCL-01 laptop preview

## Current stable-origin operations

Use `https://ncl01.absoluterelativesystems.com` with ordinary public TLS and the
existing TestFlight **0.1.0 (7)**. Phone and laptop need not share Wi-Fi. The
laptop must remain awake and connected, with its existing Cloudflared service
and the owned loopback production/edge listeners on 3158/3159 running. No new
certificate profile, domain, tunnel, route, trust exception or Apple setup is
required. Keep the existing staging/audit routes and all unrelated services.

The preserved preview runs source
`47ff42e4cb8b67e5fa2bfbc481a34d3d33490a18`; it is not the new completion
candidate. Its build/database remain in the original private D: location.
Runtime ownership, temporary files, logs and reviewed procedures now live in
`C:\Users\kkids\.codex\tmp\ncl01-full-completion\preview-runtime`.
Use PowerShell 7.5 or newer (verified host: 7.6.5).

Check both known live components without restarting, starting or archiving them:

```powershell
$nclRuntime = Join-Path $env:USERPROFILE '.codex\tmp\ncl01-full-completion\preview-runtime'
pwsh -NoProfile -File (Join-Path $nclRuntime 'Start-OwnedPreview.ps1') --validate-current-live-only
```

After a reboot, use the same reviewed wrapper without the validation argument:

```powershell
$nclRuntime = Join-Path $env:USERPROFILE '.codex\tmp\ncl01-full-completion\preview-runtime'
pwsh -NoProfile -File (Join-Path $nclRuntime 'Start-OwnedPreview.ps1')
```

It verifies known live instances rather than restarting them, or starts the
production listener before the edge when absent. Before archiving exact C:
stale records/logs, it requires matching recorded source/instance and proof that
the recorded process and console creations are gone or their PIDs were reused.
Unknown processes/ports, partial bindings and live-but-unlistened processes
fail closed. Both components are preflighted before any start/archive.
Cloudflared must already be running; the wrapper does not change its service,
DNS, security policy or routes. Prepared reboot/start behavior is distinct from
the non-disruptive current-live verification; do not claim a reboot test that
was not performed.

`Stop-OwnedProduction.ps1` in that same directory stops only the exact held
3158 production creation and verifies expected console exit/port release. It
preserves the edge and Cloudflared; it is not a full-stack stop or a health
check. Do not blindly invoke the historical D: whole-stack Start/Stop helpers:
their original production process metadata is stale. Preserve those originals.

Earlier public TLS checks returned 200 for sign-in and all 25 referenced static
assets. A later fresh Chromium session returned a complete sign-in document and
24 actual successful CSS/JS responses (22 of 23 declared references plus two
dynamic chunks); one polyfill reference was unrequested. A distinct Python
client's HTTP403 is retained without an established cause or security change.
These anonymous checks do not prove private-account/database integrity or
physical AR. Only an inactive task-owned derived Gradle cache was relocated
to C:, retaining every file and its original D: path, to recover about 391 MiB.
That storage incident is historical. Preserve the pinned C: runtime metadata
and D: build/database paths. Keep new diagnostic output in owned D: storage
while C: is near its 30 GiB reserve; recheck current capacity before allocating.
See the current
[engineering ledger](../Development_Docs/Projects/Project_Parallax/NCL01_Full_Completion_20261021.md)
for recovery, health and source-bound evidence.

## Historical LAN preview and evidence

The addresses, local CA, no-enrollment/installation observations, D:-only Git
instructions and start commands below are retained historical snapshots. They
do not override the current stable-origin operations above or authorize
re-preparation of the private fixture.

These helpers operate only the synthetic NCL-01 fixture in
`D:\CodexTemp\ncl01-preview`, from the owned `codex/parallax-ncl01` worktree.
They preserve other databases, runtimes and checkouts. The current preferred laptop Ethernet
address is `192.168.0.18`; this is an address snapshot, not a reserved hostname.
Certificate and relay checks refuse an address no longer assigned to the laptop.

The physical checkout is now
`D:\CodexWorktrees\parallax-ncl01-physical-20261015\Codex_TreasureHunt`.
Its registered C: worktree path remains a junction to that directory. The legacy
Git registration and shared objects remain on C: at checkpoint `e6eb9659`.
Launch the app from the physical D: path so its dependency ownership check
compares physical paths. Do not stage, commit or dispatch through that legacy
Git administrative directory during the storage hold.
The artifact junction still points to `D:\CodexTemp\ncl01-device-lab-evidence`.

New candidate commits and hosted dispatch/harvest use the separate owned clone
`D:\CodexWorktrees\parallax-ncl01-git-20261016`. Its sparse working tree, index,
refs and objects are physically on D:, without C: alternates. Copy explicitly
reviewed source/evidence bytes into that clone, verify staged bytes against their
source digests, and preserve the full checkout's newer work. Its HEAD and the
legacy C: registration can differ; do not reset one from the other.

## Prepare and run

Use PowerShell 7.2 or newer and the exact locked dependencies in the worktree.
For this Windows runtime, `node_modules` must be physically inside the worktree:
Turbopack rejected the cross-drive junction, while webpack produced invalid
cross-drive entry paths. The successful development runtime uses webpack with
the same dependency bytes copied from its task-owned D: installation.

```powershell
Set-Location -LiteralPath D:\CodexWorktrees\parallax-ncl01-physical-20261015\Codex_TreasureHunt
$env:TEMP = 'D:\CodexTemp'
$env:TMP = 'D:\CodexTemp'
$env:npm_config_cache = 'D:\CodexTemp\ncl01-npm-cache'
$env:NEXT_TELEMETRY_DISABLED = '1'
npx tsx scripts/parallax/ncl01-preview.ts prepare https://192.168.0.18:8449
pwsh -NoProfile -File .agents/scripts/ncl01-local-cert.ps1 -LanIp 192.168.0.18
node .agents/scripts/ncl01-local-https.mjs --self-test
node .agents/scripts/ncl01-local-app.mjs
```

In a separate task-owned terminal:

```powershell
Set-Location -LiteralPath D:\CodexWorktrees\parallax-ncl01-physical-20261015\Codex_TreasureHunt
$env:TEMP = 'D:\CodexTemp'
$env:TMP = 'D:\CodexTemp'
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

Same-LAN reachability must be verified on the phone. The public certificate
bootstrap is `http://192.168.0.18:8448`; the app is
`https://192.168.0.18:8449`. The generated test CA expires after seven days.
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

For a future owner iOS build, set
`LANDFALL_ORIGIN=https://192.168.0.18:8449` and
`LANDFALL_HOST=192.168.0.18` (host only). Native asset downloads use iOS
local-network permission even when a WebKit page is reachable. The app declares
its purpose and waits for connectivity within a 45-second resource deadline and
the existing 55-second activation limit. Ordinary TLS validation remains enabled;
no ATS exception is added. The simulator cannot validate the physical permission
prompt. Fixed-address unicast HTTPS needs no Bonjour declaration or multicast
entitlement. See [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy).

## Stop and evidence

After the later laptop/network interruption, the original `155.42.98.160`
listeners were absent. A guarded one-off rebind first refused the deprecated
Wi-Fi address before mutation, then accepted the preferred Ethernet address
`192.168.0.18`. It retained the existing CA, private keys, public profile and
expiry (`2026-10-22T20:08:04Z`), and backed up the five replaced leaf/configuration
files in protected task-private storage. The reviewed app helper now obtains
its origin from relay validation, after canonical private-storage protection.
It does not contain a fixed LAN address.

The [rebind evidence](../Development_Docs/Projects/Project_Parallax/evidence/ncl01-20261015/preview-rebind-20261016/receipt.json)
records five restore checks (two HTTP and three normally verified HTTPS) and
eleven authenticated asset checks.
The one-off rebind/rollback script and TLS backup remain private under
`D:\CodexTemp\ncl01-preview`; do not publish key hashes, private manifests or logs.
Rollback requires stopping and verifying every owned process first. It restores
only the five backed-up files and preserves the backup. The certificate helper
above is for initial preparation; do not invoke it against this running preview
as a substitute for that reviewed rebind or rollback.

The complete original checkout was copied and verified against 45,817 file
lengths/digests and 5,534 directories before switching the C: alias. The original
duplicate is retained at
`C:\Users\kkids\.codex\worktrees\parallax-ncl01\Codex_TreasureHunt.relocation-original-20261015`.
Automatic approval review rejected its removal as "blocked by policy" before
execution. No disk recovery is claimed. The original backup's artifact junction
still points at the same D: evidence; it is not a second copy of those artifacts.
The [relocation receipt](../Development_Docs/Projects/Project_Parallax/evidence/ncl01-20261015/checkout-relocation-20261015/receipt.json)
preserves source/destination manifest hashes, identical Git snapshots, copy logs,
the blocked cleanup and five successful restored transport checks.

Stop each owned terminal with Ctrl+C, then verify the recorded task PIDs and
ports before declaring cleanup. A parent exit alone does not prove descendant
shutdown. The relay removes only its matching instance record. Do not stop
unrelated Node processes or remove the synthetic database, private files or proof.
Next dev may append its generated AGENTS block and dist paths to tsconfig; inspect
and restore only those task-generated changes before committing.

For hosted collection, keep Git operations on D: while resolving TypeScript
aliases from the full source's configuration. After the exact owned run finishes,
the positional arguments are its dispatch JSON followed by its run ID:

```powershell
$taskSourceRoot = 'D:\CodexWorktrees\parallax-ncl01-physical-20261015\Codex_TreasureHunt'
Set-Location -LiteralPath D:\CodexWorktrees\parallax-ncl01-git-20261016
$env:TEMP = 'D:\CodexTemp'
$env:TMP = 'D:\CodexTemp'
$env:npm_config_cache = 'D:\CodexTemp\ncl01-npm-cache'
node "$taskSourceRoot\node_modules\tsx\dist\cli.mjs" --tsconfig "$taskSourceRoot\tsconfig.json" "$taskSourceRoot\scripts\landfall\device-lab\harvest-hosted.ts" 'D:\CodexTemp\ncl01-device-lab-evidence\hosted-9314c749e426-1792118655710\dispatch.json' '38841961822'
```

Use the canonical collector's actual run/dispatch arguments for the single owned
run. A quiet live fetch or job is not evidence of failure; inspect that same
process/run before retrying. Do not create a second dispatch while one is active.

Keep browser, native compilation, physical tracking and owner acceptance as
separate evidence. The governed experience plan is held by the existing
`crossdeck.phase2.continuity` experience-design prerequisite; supporting browser
captures do not waive that gate. See the
[engineering record](../Development_Docs/Projects/Project_Parallax/NCL01_Native_Scene_Vertical_Slice.md).
