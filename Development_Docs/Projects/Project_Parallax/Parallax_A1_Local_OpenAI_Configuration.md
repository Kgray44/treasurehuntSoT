---
title: Parallax A1 local OpenAI configuration
audience: developer-operator
status: current
canonical_for: parallax-a1-local-openai-configuration
last_reviewed: 2026-10-14
---

# Shared local OpenAI configuration

The server-side OpenAI provider reads `process.env.OPENAI_API_KEY`. On Windows,
configure this as a **user-level environment variable** through Windows Environment
Variables. Every worktree can inherit the same credential. No worktree needs this
key in `.env.local`; no credentials belong in source, commits, logs, browser data,
or command-line arguments. The adapter has no directory-based credential loader.

Windows processes inherit their environment when launched. Restart the terminal
or Codex application after setting or changing the user variable, then restart
the development server from the intended worktree. An existing development server
does not acquire a newly set user variable automatically. To refresh the current
PowerShell launch environment without printing or persisting the credential:

```powershell
$env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY', 'User')
npm run dev
```

Run this from the intended checkout. This refresh affects only the current shell
and its subsequently launched processes. Do not restart or replace another task's
server. Existing unrelated `.env.local` settings remain intact. Next's installed
environment loader preserves an already inherited process variable.

An absent or whitespace-only credential reports **Unconfigured**. Manual authoring
remains available. A configured credential does not enable assistance by itself:
the durable Admiralty policy and user allowance must also admit the request.
The server dispatches through the fixed OpenAI Responses HTTPS adapter. Only its
authorization header receives the credential; request bodies and safe diagnostic
projections exclude it. No live call is made by the diagnostics below.

## Resume the existing owner Studio preview

For the owned Windows preview on port 3130, retain its runtime record under
`tmp/parallax-a1/owner-studio-preview/runtime.json`. After stopping only that
verified preview, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/parallax/resume-owner-studio-preview.ps1 -EnableOwnerPhotoDevelopment
```

The launcher reuses the recorded database and never resets or seeds scenes. It
refreshes the shared Windows user OpenAI credential in memory. Photo development
uses the existing local private-content providers, with a database-scoped storage
directory outside all checkouts and a persistent CurrentUser DPAPI-protected
master key. Its directory ACL grants the current Windows user access. Keep this
directory with the database; losing its key can make stored private content
unreadable. No credentials are written into tracked files or `.env.local`.

`-CheckOnly` verifies configuration without starting a server or making API calls.
The explicit photo flag uses the synthetic development scanner, which does not
certify malware protection. The Studio reports this limitation. Production
scanner and key-management requirements are unchanged. File validation, explicit
processing consent, private storage and permission withdrawal remain enforced.

The initial restoration changed processing timeout to 90 seconds through
the existing Admiralty preview, reauthentication and audited execution path,
while preserving request/model/monetary settings. A subsequent owner-authorized
[model-routing increment](AI_Model_Routing_and_Overrides_20261014.md) uses Sol
for photos and Luna for standard Assistant requests, with a 180-second timeout
and a bounded USD 0.40 local-preview cap inside the remaining USD 5 task ceiling.
Historical usage and unknown cancellation exposure are preserved.
Photo reconstruction can still return a geometric clarification or failure;
configuration readiness does not establish reconstruction fidelity.

## Safe worktree diagnostic

From the A1 candidate checkout with dependencies installed:

```powershell
./scripts/parallax/check-local-openai.ps1 -WorktreePaths @(
  'C:\path\to\original-checkout',
  'C:\path\to\independent-worktree'
)
```

The diagnostic starts short-lived hidden child processes in each named Git
checkout, supplies the Windows user variable in memory, and loads the candidate
server adapter. It prints only paths, configured booleans, provider identity,
restart status and a zero network-request count. It creates no credential file,
changes no registry value, starts no development server, and runs no paid request.
`adapterSource` identifies the candidate implementation used for each check;
different working directories do not imply older branches contain this change.

For a probe of the current process's inherited environment alone:

```powershell
npx tsx scripts/parallax/check-openai-configuration.ts
```

Admiralty's **AI Usage & Quotas → Provider Health** also shows safe server
configuration status. Per-user usage and exceptions appear in **People → account
dossier → AI usage & quotas**, using the existing People search. Inspecting the
section requires account and configuration observation; changes retain policy
preview, recent privileged assurance, explicit confirmation and audit receipts.

## Verification record

On 2026-10-11 the Windows user variable was configured, while the current Codex
process had no inherited credential and required environment refresh/restart.
Fresh probes from the original checkout, owned A1 worktree and independent
Phase 3 worktree each reported configured, using the A1 candidate adapter.
No credential was copied to disk and no upstream request was made. Mocked adapter
tests additionally verify absent-key behavior, shared-variable dispatch, safe
configuration output and exclusion from request bodies. These checks establish
local credential loading, not live-provider availability or integrated Studio
acceptance.

Refreshed zero-network probes again passed from all three directories after the
bounded live canary. That diagnostic process now reported an inherited credential
and no restart requirement. Six authorized real calls through the server adapter
returned structured responses and settled usage; the
[qualification record](Parallax_A1_Evaluation_and_Qualification.md) preserves the
source, cost and semantic-evaluation limitations. No credential value was emitted.

Codex Cloud Personal Vault is a separate execution environment. Its network
secret is not automatically inherited by Windows processes. Local configuration
does not need cloud secret managers, containers or additional services.
