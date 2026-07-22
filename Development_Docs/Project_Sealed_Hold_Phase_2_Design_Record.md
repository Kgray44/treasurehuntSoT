# Project Sealed Hold Phase 2 Design Record: Fortify the Hold

**Status:** implementation closed subject to the shared-route browser gate recorded below.

## 2026-07-22 continuation closure addendum

The owner-authorized V2 amendment supersedes every earlier `blocked-governing` statement. V1 compatibility remains intact; V2 uses the authenticated framed contract in `Private_Content_Streaming_Package_Format.md`. Client generation, isolated SQLite materialization/export, full automated validation, static gates, build, and scans passed as recorded in the validation record. Browser acceptance is scope-rejected rather than passed because a shared Harborlight route conflict prevents the app from rendering and is outside this branch's authorization.
**Branch:** `codex/project-sealed-hold-phase2-fortify-the-hold`
**Base:** `origin/main` `f4bfc4b4f3585bc8f60ce4d94375dc77a7092da2`
**Date:** 2026-07-22 America/New_York

## Governing ownership

One Voyage remains the only canonical Chronicle authoring and runtime authority. Sealed Hold creates canonical Chronicle drafts and immutable published versions through One Voyage records; it does not introduce a private Story, Campaign, person, session, invitation, or publication model. Wayfarer owns `UserAccount`, roles, sessions, profiles, preferences, providers, and privacy. Sealed Hold stores only canonical account relations and historical actor snapshots. Harborlight remains responsible for Community releases, installation, dependencies, and public lineage; this phase never creates a Community Listing or Release. Lanternwake remains the animation/runtime-policy owner; this phase adds no animation truth.

## Frozen compatibility and package decisions

1. Valid v1 `.ftprivate` JSON envelopes remain readable with their original 32 MiB ceiling, AES-256-GCM/scrypt parameters, authenticated envelope, and payload semantics. V1 is a compatibility reader only and is never reinterpreted as streaming.
2. New large packages use a version-2 framed private container. A fixed authenticated header is followed by bounded, ordered encrypted frames and a required authenticated terminal frame. Each frame has a sequence number, declared cipher/plain lengths, SHA-256, and authenticated metadata. A duplicate, gap, reorder, excessive length, missing terminal frame, or authentication failure rejects the operation and cleans staging.
3. V2 uses Node's maintained AES-256-GCM primitive for independent frames with random 96-bit nonces. Its authenticated additional data includes package ID, stream ID, frame sequence, frame kind, and declared length. The implementation documents nonce generation and tests corrupted/truncated/reordered streams; it does not invent a cipher or a derived nonce scheme.
4. Receipt and storage are streams. V2 avoids base64 transport and whole-package/whole-asset buffers. V1's small base64 endpoint remains a deprecated adapter with the old bound, telemetry, and no separate business logic.

## Upload, staging, and operation state

Creators create a durable upload operation, receive an opaque operation ID, and upload encrypted bytes using application streaming or provider multipart upload. Part digests, byte counts, cancellation, expiration, and resume cursors are durable. Passphrases are accepted only in a protected inspection request body, are redacted, never enter an upload object, job, outbox payload, URL, browser persistence, or logs, and are cleared by the UI after the request.

The frozen operation states and legal transitions live in `src/private-content/contracts.ts`. `PrivateContentOperation` is the source of progress, cancellation, idempotency, correlation, and lease state. Transitions are conditional database updates; process memory is never authoritative. Partial staging is deleted on cancellation/failure unless it is the durable encrypted retry object needed by a resumable operation.

## Storage, scanning, keys, and delivery

`PrivateStorageProvider` is private-content-scoped and exposes private upload, normalized, object, quarantine, and backup namespaces. Local storage remains supported for development/single-server operation. An S3-compatible adapter is implemented behind the same contract and is never called configured merely because the adapter exists. Promotion is immutable and checksum verified. No provider key/path is exposed to a client.

`PrivateScannerProvider` returns `CLEAN`, `SUSPICIOUS`, `MALICIOUS`, `FAILED`, or `NOT_CONFIGURED`; neither failure nor absence of a configured scanner is clean. Untrusted assets remain unavailable until clean. Suspicious/malicious data is moved to the separate quarantine namespace; access remains an opaque denial. Bounded media checks run before promotion.

After user-passphrase inspection, retry material is normalized then encrypted with a random server data-encryption key. The DEK is wrapped by `PrivateKeyProvider`, whose wrapped-key version is stored. User passphrases and plaintext buffers are discarded. The development key provider is isolated and explicitly non-production; the production KMS adapter reports truthful health. Rewrap is idempotent and retains old keys until a verified retirement gate.

Private delivery remains application-authorized and range-capable. Creator access must resolve the canonical owner account; Player access additionally requires the relevant canonical membership and reveal state. Quarantined, unscanned, removed, foreign-account, and anonymous requests receive opaque denials. A short-lived signed URL is allowed only for revocable policy-safe objects; immediate-revocation content is streamed by the application.

## Materialization, jobs, and recovery

Confirmed package content is materialized transactionally into canonical Chronicle/TaleDraft/StoryBlock/BlockConnection/TaleLocation/TaleArtifact/TaleAsset records. Logical IDs are mapped deterministically through `PrivateContentImportMapping`. Draft packages make a private canonical Chronicle/draft; published packages additionally make an immutable version. Conflicts produce a plan requiring explicit resolution. Materialization never publishes, starts a Voyage, creates an invitation, grants Player access, or writes Harborlight data.

The existing Harborlight outbox is not repurposed as a second global queue. Sealed Hold owns private job records and uses the same transaction/lease/idempotency pattern. Enqueued work is in the database transaction that changes the private aggregate; a worker marks it complete only after the side effect. Jobs use typed, schema-versioned sanitized payloads, bounded retry, leases, renewal, cancellation, and expired-claim recovery. The inline executor is development-only and uses those durable records.

Backups capture a consistent canonical-private record set and referenced object manifest, encrypt the result, verify hashes, and restore only to an isolated environment. Reconciliation detects missing/corrupt/orphaned objects, unsafe availability, unknown key versions, and missing mappings. Repairs are dry-run by default; garbage collection has a grace period and never deletes referenced or ambiguous objects.

## Schema, migration, and rollback

The reserved Phase 2 range is frozen as SQLite `20260722130000`, `20260722131000`, `20260722132000` and MySQL `0016`, `0017`, `0018`. The migrations are additive only: operations/uploads/object references, keys/scans/jobs/backups/integrity, then canonical materialization. Existing Phase 1 migrations are never modified. `PrivateContentImport.contentJson` remains nullable compatibility data while dual-read backfill prefers verified encrypted normalized payloads; no new import writes plaintext `contentJson`. SQL migrations never invoke KMS.

Rollback is application routing plus restore of a matching encrypted database/object backup. No destructive column/table drop is permitted until every row has migrated, a backup/isolated restore is verified, no reader remains, and a separately approved removal gate is met.

## Budgets and completion gates

V1 retains its conservative limits. V2 enforces receipt, plaintext, manifest, per-media, file-count, and metadata caps while streaming. Memory is bounded by a frame plus parser/staging buffer, not package size. Completion requires v1 fixtures, V2 corruption/resume/cancellation proof, canonical materialization, encrypted retry data, scan/quarantine enforcement, durable restart-safe jobs, private delivery, backup/isolated restore, SQLite/MySQL evidence, leak scans, full attainable validation, documentation matching implementation, a pushed branch, and remote SHA parity. External S3, scanner, KMS, or MySQL credentials are reported as unconfigured/blocked rather than passed.
