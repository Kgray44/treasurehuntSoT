# Private Content Worker and Outbox Architecture

**Status:** durable job schema and claim/retry helpers implemented; full worker handlers and restart evidence remain required.

## Durable authority

`PrivateContentOperation` is the durable aggregate for state, cancellation, idempotency, correlation, progress, and optional lease data. `PrivateContentJob` is the Sealed Hold queue; Harborlight's outbox is not repurposed. A job has a schema-versioned sanitized payload, idempotency key, availability timestamp, bounded attempts, lease owner/expiry, progress, completion/cancellation, and failure code.

`enqueuePrivateJob` upserts by idempotency key. `claimPrivateJobs` conditionally claims pending, available, unexpired rows; `finishPrivateJob` requires the claimant; `retryPrivateJob` backoffs by attempt and fails at its maximum. These primitives mean process memory is not authoritative, but they do not by themselves demonstrate every operation's transactional enqueue or handler.

## Worker protocol

Within the transaction that changes a private aggregate, enqueue the corresponding job with only IDs, schema version, and correlation data. A worker claims, renews its lease while active, observes cancellation, executes idempotently, persists sanitized progress, and marks completion only after its side effect. Expired claims become reclaimable; shutdown relinquishes/recoverably expires claims. A development inline executor must invoke the same durable rows and transitions.

Job types include upload verification, inspection, normalization, materialization, scanning/finalization, export, backup/restore verification, key rewrap, reconciliation, and cleanup. A handler must validate its payload version and refuse unknown versions.

## Observability and privacy

Correlation IDs and coarse counts/bytes may appear in progress. No passphrase, plaintext entry, storage credential, signed URL, or private asset name belongs in job payloads, logs, or error messages. Failures shown to untrusted callers are opaque; detailed reasons remain restricted operational evidence.
