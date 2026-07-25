# Project Sealed Hold · Phase 3: Stand the Watch

**Formal scope:** Production Provider Realization, Integrity Operations, Recovery Drills, and Operational Readiness.  **Status:** implementation in progress; no production-readiness claim.

## Current-state audit and reconciliation

Repository: `Kgray44/treasurehuntSoT`. Canonical checkout: `\\gwplastics.com\VT\Users\kgray\My Documents\treasurehunt\forever-treasure-companion` (preserved untouched and dirty). Phase 3 worktree: `C:\Users\kgray\AppData\Local\ForeverTreasureCompanion\treasurehuntSoT-sealed-hold-phase3`. Branch: `codex/project-sealed-hold-phase3-stand-the-watch`. Known accepted SHA and fetched `origin/main` at start: `6bd8209d2d7f0edc73da9566fd06e825ae51a602`; branch base is the same and upstream is `origin/main`.

The governing Phase 1/2 records contain no newer formal Phase 3 name, so this execution contract's name **Stand the Watch** is retained. Phase 2's package codecs, encrypted retry material, local storage, scanner contract, durable jobs, canonical materialization, delivery, and manifest helper are reused without rebuilding them. Phase 3 adds typed configuration/readiness, real S3/KMS protocol clients, operational records, repair gates, recovery snapshots, worker process composition, and deployment/runbook work. Public sharing, new package formats, multi-tenant infrastructure, and later Sealed Hold phases are excluded.

The reserved ranges were checked on fetched `origin/main`: SQLite `20260725130000`-`20260725132999`, MySQL `0028`-`0030`; this branch uses SQLite `20260725130000`, `20260725131000` and MySQL `0028`, `0029`. Historical migrations remain unchanged.

The shell initially had no Node/npm on PATH. Validation uses the bundled Node 24.14.0 and pnpm 11.9.0. No Docker/Podman, MySQL, MinIO/S3, ClamAV, KMS command, or known provider port was found; environment inspection recorded names only and read no values. Provider live evidence is therefore blocked unless an isolated configured service becomes available.

## Frozen security architecture

`src/private-content/config.ts` is the sole server-side parser. Production rejects local storage/key fallback, missing scanner/KMS/MySQL, non-TLS S3, invalid roots, unsafe worker bounds, and malformed context. Factories build S3/MinIO, ClamAV, and AWS KMS only from this configuration. Health contains kind, safe state/code, capabilities, and version metadata only; it contains no endpoint, object key, credentials, private prose, or ciphertext.

Process readiness is role-specific. Web/worker writes fail closed when their required database/storage/scanner/KMS health is absent. Existing clean delivery remains a separately governed read path; no scanner failure is ever clean. Repair plans are immutable, digest-bound, dry-run by default, explicitly approved, revalidated against a current snapshot, and permit deletion only for confirmed orphan targets. Backups are referentially closed snapshot manifests; restore targets must be technically isolated and never names resembling canonical or production environments. Key retirement requires no live or backup references, restore verification, and explicit approval.

## External boundary

Local deterministic tests prove adapter contracts but are labelled `simulated-local`. They are not S3, ClamAV, AWS KMS, or MySQL live validation. No production data, credentials, canonical development database, public bucket, or real private content is in scope.

## Continuation remaining-local-work ledger

The pushed foundations checkpoint was reverified at `5922853ef8b156070648d8b36b7afa25bd6c592f`, with local/remote parity and no `origin/main` merge. The local ledger is: (1) durable encrypted backup creation, verification, retention, and two isolated restore drills; (2) durable repair execution and leases; (3) complete composed worker handlers, scheduling, metrics, and alerting; (4) operational API/UI and browser acceptance; (5) forward migration ledger and isolated SQLite rehearsal; (6) documentation, scans, focused/full validation. These are locally attainable and remain in progress. Live MySQL, S3/MinIO, ClamAV, AWS KMS, external alert dispatch, and Linux systemd restart evidence are separate external gates only.
