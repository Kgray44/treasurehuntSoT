# Project Sealed Hold - Phase 3: Stand the Watch

**Scope:** production-provider realization, integrity operations, recovery drills, and operational readiness.
**Current status:** `PROJECT SEALED HOLD PHASE 3 LOCALLY COMPLETE — EXTERNAL GATES BLOCKED`; this is not a production-readiness claim.

## Boundary and ownership

Phase 3 work is confined to `codex/project-sealed-hold-phase3-stand-the-watch`, based on `6bd8209d2d7f0edc73da9566fd06e825ae51a602`. The canonical checkout, canonical development data, production data, and `main` are out of scope. Phase 2 package codecs, encryption, scanning, canonical materialization, and private delivery are reused; Phase 3 introduces neither public sharing nor a new package format or Community release path.

The additive migrations are SQLite `20260725130000`, `20260725131000`, and `20260725132000`; MySQL `0028`, `0029`, and `0030`. Historical migrations remain immutable. The focused ledger discovers the full governed sequence deterministically and records checksums before applying pending migrations.

## Security architecture

`src/private-content/config.ts` remains the server-side configuration boundary. Production rejects local storage/key fallback, missing required services, unsafe roots, non-TLS S3 configuration, and malformed worker limits. Provider factories expose only safe health codes and capabilities; never credentials, endpoints, object keys, local roots, private prose, or ciphertext.

Private delivery is a separate authorization path. Pending, failed, unavailable, and quarantined scan states are unavailable. Scanner absence is never clean. Operational receipts, metrics, alerts, audit metadata, and the UI use opaque identifiers and safe codes only.

Backups encrypt a sealed manifest and bounded object envelopes through the selected key provider. Verification authenticates the manifest, checks digests, lengths, hashes, required key versions, and referential closure. Restore rejects source-equivalent, canonical, and production-like targets before writes. Two independent synthetic database-and-object restore drills exercised the ordered SQLite path and verified semantic record counts and object digests.

Repair plans persist immutable actions, source-state digest, expiry, dry-run state, digest, and explicit Administrator approval. Worker composition loads the stored plan only. Each action is lease-checked before its provider boundary and receipt; completed receipts are never replayed. Expired crashed execution leases are reclaimed, while active owners are never displaced. Quarantine destinations are deterministic, review is availability-only, and deletion remains limited to a proven orphan. The governed action, refusal, provider interruption, crash, retry, cancellation, lease-loss, and replacement-worker matrix is locally accepted.

## Local evidence and tooling limitation

Bundled Node was used in this worktree. Prisma schema validation and SQLite client generation succeed. Prisma `db push` fails against a short ASCII-only empty SQLite target even though the schema-engine launches, Python can mutate that target, all 29 governed SQLite migrations apply through the ordered SQL path, and the path produces 108 tables. This is a local Prisma tooling limitation, not provider evidence.

All provider, key, scanner, backup, restore, and worker tests use synthetic data and deterministic local providers. They are `simulated-local`, never live-provider evidence. Full Vitest passed `122` files / `967` tests; source and staged-diff privacy scans passed. The production build compiled, then stopped on the unrelated declared `@rive-app/webgl2` TypeScript resolution failure in `scripts/validate-animation-assets.ts`, so no build sentinel is claimed.

## Closure ledger

All locally attainable Phase 3 requirements are complete: guarded repair catalog and failure proof; owned web restart and durable worker handoff proof; operational authorization/CSRF/error/idempotency taxonomy; desktop and `430 x 932` browser/accessibility acceptance; final tests, scans, manifests, and review. Live S3/MinIO, ClamAV, AWS KMS, MySQL, external alert delivery, and Linux/systemd restart evidence are the only remaining external gates.
