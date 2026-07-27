# Isolated validation baselines

Dedicated worktrees intentionally do not need a mutable `prisma/dev.db`. The
validation harness creates its seed and mutation databases only under the
task-owned validation runtime. It never creates a worktree-local canonical
database as a prerequisite for browser validation.

## Supported baseline sources

The ordinary command retains automatic discovery when the active checkout has
a legitimate canonical database:

```powershell
scripts/test-all.ps1 -SkipBrowserInstall
```

For a dedicated worktree, supply the understood, compatible baseline file
explicitly:

```powershell
scripts/test-all.ps1 -SkipBrowserInstall -BaselineDatabasePath "C:\absolute\baseline\dev.db"
```

`BaselineDatabasePath` must be an existing absolute file path. Directories and
relative paths are rejected. An explicit value overrides discovery; it is not
an instruction to locate another worktree's database.

For a focused browser journey, use the opt-in browser-only mode and a test file
inside `tests/e2e`:

```powershell
scripts/test-all.ps1 -SkipBrowserInstall -BrowserOnly `
  -BaselineDatabasePath "C:\absolute\baseline\dev.db" `
  -BrowserTestPath "tests/e2e/harborlight-phase2.spec.ts"
```

This mode still migrates the disposable seed, starts the nonce-proven owned
server, runs Playwright, verifies the isolated mutation, and proves the
baseline unchanged. It deliberately does not represent the ordinary full
repository gate, which continues to run animation and production-performance
release checks.

## Isolation contract

Before validation, the harness fingerprints the baseline SQLite family
(`.db`, `-wal`, `-shm`, and `-journal`) three times and records its SHA-256,
size, and timestamp. It then migrates a disposable seed inside the validation
runtime, copies that seed into a uniquely named isolated mutation database,
and writes a nonce to that copy. The server must return the nonce-bound
identity before Playwright runs.

The baseline remains read-only from the harness's perspective. The final
receipt proves that its file family, hash, size, and timestamp are unchanged;
the isolated copy is separately fingerprinted and must show the expected
browser mutation. A baseline can never equal the isolated mutation database.

The harness owns and releases its validation server and ports, and its
temporary runtime is reset only under the validation root. No baseline,
canonical storage root, or worktree `prisma/dev.db` is cleaned or deleted.
