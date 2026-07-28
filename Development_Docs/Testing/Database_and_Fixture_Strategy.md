# Database and Fixture Strategy

## Immutable baselines and fixtures

Versioned baseline families are empty schema, canonical core, Player journey, Wayfarer history/artifacts, Harborlight community, Sealed Hold operations, Lanternwake lifecycle, Drydock authored Chronicle, Landfall fixtures, and full integration. A baseline has schema/fixture version, checksum, source provenance, and allowed consumers. Fixture builders replace repeated ad hoc setup and produce synthetic, minimal, deterministic, idempotent, privacy-safe data attributable to a suite.

## SQLite and MySQL

SQLite uses an immutable source baseline, checksum verification, a per-run copied or copy-on-write clone, an explicit migration state, and marker-gated cleanup. The existing harness already fingerprints canonical database families and copies a nonce-marked mutable database; that protection must remain. A clone corruption or checksum mismatch fails the run.

MySQL uses a unique run schema/database, migration account, runtime account, worker account where necessary, randomized but traceable naming, cleanup only of the matching run prefix, and a separate `external-provider` classification. Local SQLite success is not MySQL proof.

No test may mutate canonical development, production, another run's DB, another branch's fixture DB, or real private-content roots. Database data and artifact receipts retain hashes/identifiers, not sensitive values.
