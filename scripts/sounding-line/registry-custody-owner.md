# Private owner recovery preparation

This internal tool prepares a new registry recipient without enabling it. The
production recovered-recipient pin remains unset. Existing encrypted evidence,
original recipient identities and protected release authority remain intact.

After this source has passed ordinary protected qualification and landed, the
owner can open a visible **Windows PowerShell** window on this host and run:

```powershell
powershell.exe -NoProfile -File D:\CodexWorkspaces\sounding-line-modernization-20261031\scripts\sounding-line\registry-custody-owner-console.ps1 -Operation check-private-console
```

When ready to create and verify the two copies, repeat that command with
`-Operation owner-prepare`. This is an owner action in that private window.
Never run it through a captured agent terminal. Never paste the passphrase,
decrypted key or console input into chat. The script inherits the host execution
policy; a policy refusal is a stop, not a reason to bypass it.

The launcher checks a specific signed OpenJS Node runtime and clears environment
injection variables. The tool verifies installed age 1.3.2, current protected main,
owner account, live storage reserve, physical device identities and restrictive
folder permissions before key generation. It creates a 3072-bit RSA key in memory
and uses age's native non-echoing passphrase prompt. The private DER travels only
through binary pipes. A fresh passphrase must be supplied again to recover each
selected copy. No passphrase is stored by this tool.

The fixed destinations are:

- `C:\VoyagewrightRecovery\SoundingLine\B\generation-0001\registry-key.pkcs8.age`
- `D:\VoyagewrightRecovery\SoundingLine\B\generation-0001\registry-key.pkcs8.age`

The two drives are internal devices on one laptop. This profile does not prove
off-host, laptop-loss, clean-host or physical-device-failure recovery. Replaced
hardware requires an independently reviewed device-baseline change. No cloud or
external-drive copy is made.

Existing generation folders or files are never overwritten. Cancellation and
partial failure preserve existing content; only verified empty folders created
by this invocation can be retired. Do not delete an incomplete generation to
retry. Preserve its public journal and have its state reviewed first.

Each encrypted copy has a public creation record. On success, each drive also
contains `custody.public.json` and recovery notes. The public operation journal
is under `%LOCALAPPDATA%\Voyagewright\CustodyReceipts`. It contains public keys,
fingerprints, ciphertext hashes, source identities and failure stages, never the
private DER or passphrase. Journal failure cannot replace the original failure
result. Managed DER buffers are cleared on exit; complete process-memory or
pagefile erasure is not proved.

The recovery canary uses the existing RSA-OAEP SHA-256 label. Passing it proves
only that the selected encrypted file recovers the generated key locally. It
does not prove registry-decoder, provider, coverage or context-isolation
acceptance and cannot enable evidence reuse. Independent public-receipt review
and a separate protected source amendment are required before any new recipient
pin can become active.

The workspace must remain under its recorded mission hold while this entry point
is needed. Before final workspace retirement, preserve a source-bound recovery
entry point and its immutable source identity; never leave recovery instructions
silently pointing at a retired checkout.

Focused tests use fixed public bytes and instrumented temporary directories.
They do not launch an owner prompt or touch the real generation destinations.
