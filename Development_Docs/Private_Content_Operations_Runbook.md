# Private Content operations runbook

Set `PRIVATE_CONTENT_ROOT` and `PRIVATE_CONTENT_STAGING_ROOT` to distinct absolute service-account-owned directories outside the repository, `public`, `.next`, and static deployment output. Do not place keys in `.env`, command arguments, URLs, browser storage, logs, or source control. Use an interactive prompt or controlled standard input for a passphrase.

Use `private-content:inspect` for a no-mutation assessment and `private-content:import -- --commit` only after reviewing a dry-run plan and explicitly confirming it. Imports remain draft/private: they do not publish a Chronicle, create a Voyage, or deliver invitations. On failure, retain only the sanitized receipt and retry eligibility; staging is removed whenever the operation can safely roll back.

Export and backup destinations must be outside the repository. Record package SHA-256, package ID/revision, and backup hash separately from the key. A successful export/backup is one that round-trips through authentication, manifest/checksum validation, and closure verification. `restore-verify` restores only into an isolated temporary store and removes it after reporting safe counts.

SQLite development databases and production MySQL databases can contain imported private prose and are sensitive backup material. For production, take an application-consistent encrypted database backup and a matching private-object backup, record both hashes and timestamps, restore database first into isolation, restore private objects, then run verification before replacing anything. Rehearse recovery regularly; a lost package passphrase cannot be recovered by this system. No production restore or service change is performed by this phase.
