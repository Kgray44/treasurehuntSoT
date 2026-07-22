# Private Content Backup and Recovery Phase 2

**Status:** current helper produces/verifies a bounded encrypted package snapshot from a legacy import; it is not yet the required consistent private backup/restore system.

## Required backup unit

A production backup is a consistent manifest of selected private canonical records, `PrivateContentImport`/mapping/asset metadata, referenced object digests/locations, scan state, and wrapped-key metadata. It is encrypted, checksum-verified, stored in the private backup namespace, and excludes credentials, server master keys, user passphrases, invitations, sessions, and unrelated runtime state.

Object capture must be referentially closed and stable with the database snapshot. The manifest records schema/package versions, source identifiers, object digest/length, wrapped-key provider/version, and backup digest. Missing/corrupt objects or a manifest/object digest mismatch rejects backup verification.

## Restore boundary

Restore targets an isolated database and isolated object-store prefix only. It verifies encryption/tamper resistance, object hashes, canonical closure, mapping integrity, scan/quarantine state, key-version availability, and owner authorization after restore. It must not create production publication/runtime side effects. Cleanup removes only the isolated synthetic test environment after results are captured.

## Present limitation

`createPrivateBackup` currently delegates to legacy export and `verifyPrivateBackup` decrypts/verifies that package. It does not yet capture canonical state, object-store contents, wrapped-key metadata, or perform isolated restore. Those gaps remain explicit acceptance tests rather than implied by the helper name.
