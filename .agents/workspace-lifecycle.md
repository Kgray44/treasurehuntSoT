---
title: Owned workspace lifecycle
audience: automation
status: current
canonical_for: owned-workspace-lifecycle
last_reviewed: 2026-10-23
---

# Owned workspace lifecycle

Use `scripts/workspaces/cli.mjs` as the single ownership and retirement interface.
The registry, immutable receipts and preservation archives live outside checkouts
at `%LOCALAPPDATA%/Voyagewright/Workspaces`. Preserve that directory and Codex chat
history. Keep one canonical main checkout; never retire it.

At task startup run `recover`, then `sweep`. Query `status` and `audit` before
admission. Prefer a suitable existing workspace. `create` registers a finite peak
before hydrating source and rejects duplicate task workspaces, insufficient C: or
D: reserve, incomplete measurements, and aggregate overcommit. Include dependency,
build, browser and temporary overhead in `--peak-bytes`. Do not bypass admission
with a direct worktree, clone, mirror or copied runtime. A sparse checkout is
available through `--sparse scripts,tests,...`. A second task workspace requires a
concrete `--additional-reason`; its allocation still counts against the ceiling.

```powershell
node scripts/workspaces/cli.mjs create --path D:\CodexWorkspaces\example --task <chat-id> --branch codex/example --peak-bytes 8589934592 --generated node_modules,.next
node scripts/workspaces/cli.mjs lease --id <workspace-id>
node scripts/workspaces/cli.mjs finish --id <workspace-id> --outcome completed --pr <number>
```

`finish` reconciles immediately. It may be called before the merge; the scheduled
reconciler rechecks the recorded hold. Never infer task success from a completed
assistant turn. Call `finish --outcome failed` or `cancelled` for terminal failures.
Renew active leases during continuing work, particularly work exceeding eight
hours. A live process still blocks cleanup after lease expiry. Do not stage the
ownership marker `.voyagewright-workspace.json`.

Retirement verifies the actual merged PR, protected-main check identity, source
landing for normal/squash/rebase merges, and an executable landed-source smoke.
Unique dirty source is retained. Ignored evidence is copied to a hash-verified
private archive; registered generated roots are disposable only after usage and
source checks. Revalidate source and processes immediately before removal. Use
Git's registered worktree operation; unlink junction descriptors without walking
their targets. Shared consumers, embedded repositories, invalid markers, busy
paths, content drift and platform denial fail closed with an exact receipt.
Never force a denied operation, erase a failed receipt, reset finite evidence
authority, or silently substitute another deletion mechanism.

For historical adopted checkouts merged before registry creation, the original
successful protected decision remains the functional qualification authority.
Their new landed-source integrity smoke verifies source custody and parses the
landed manifests; its receipt explicitly records `functionalProductRetest: false`.
New environments run the executable lifecycle smoke from their actual merge.

`adopt` requires an exact path, task, resource class and custody reason. It is for
audited legacy resources, not arbitrary path cleanup. Standalone clones and
unowned directories are held until their distinct Git/data custody is established.
Completed duplicate diagnostic checkouts can name a retained `refs/heads/codex/...`
through `--preserve-ref`; that ref must be reachable and checked out by another
registered worktree. This does not assert that an unfinished product PR merged.

Install the stable, hashed reconciler with `scripts/workspaces/install.ps1` after
focused tests pass. It installs one limited per-user Windows scheduled task with
15-minute and logon triggers, no resident service. `-InstallHooks` adds Codex
startup/turn/interrupt/end signals while preserving existing hooks. Codex requires
review and trust of the exact hook definitions; never bypass that review or claim
untrusted hooks are active. Verify the scheduled task's last result and actual
retirement receipts, not merely its registration or a start request.

The installer resolves native physical file paths and verifies that logical and
physical registry aliases identify the same file. This matters when a packaged
desktop application redirects Local AppData into its package LocalCache. Use the
returned physical paths for host-scheduled execution and the pinned physical path
of the existing reserve guard. The worker verifies installed source and tool-path
hashes and preserves each invocation's result outside disposable roots.

The 75 GiB aggregate and 12 GiB initial per-workspace ceilings are finite admission
limits, not OS quotas. The full tracked source measured about 5.51 GiB before
dependencies/builds; retain headroom within 12 GiB. Over-budget legacy storage
blocks new environments while verified recovery and active legitimate work
continue. The separate 30 GiB reserves apply to all admitted host writes. These
rules cannot stop external applications, cloud jobs or existing uninstrumented
writers. Recheck live capacity before each large allocation and every five minutes
during a long writer. Report net volume change separately from measured file bytes.
