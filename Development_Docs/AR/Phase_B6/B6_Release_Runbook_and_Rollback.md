# Phase B-6 release runbook and rollback

## Candidate gate

1. Synchronize the authoritative branch without discarding local work.
2. Run fresh `npm ci`, full validation, full release replay, full bounded soak, dependency/license review, migration matrix, and packaged smoke.
3. Verify the persisted release dashboard and issue register. Stop if any release-blocking issue is open.
4. Complete real pilot, hardware/game-impact, clean-machine, independent security/privacy, external usability/accessibility, signing, hosted CI, and distribution-policy evidence.
5. Back up and restore-test database plus user project/package storage.
6. Build preview/stable with protected signing variables. Require valid timestamped Authenticode and signed canonical release metadata.
7. Verify hashes/provenance on a separate clean machine. Publish atomically to the pinned channel host.

## Rollback triggers

Rollback on signature/hash/provenance mismatch, startup/health failure, data compatibility failure, confirmed false accept, material privacy/security issue, inability to stop capture, duplicate/stale story advancement, or clean-machine uninstall/update failure. Pause the channel and retain evidence; do not relabel failures.

## Application rollback

The update manager restores the previous application version state after interrupted activation or failed health check. Revoke the bad manifest/artifact and publish a signed superseding metadata record. User projects, SQLite/MySQL data, Creator recordings, published packages, and audit history must remain outside the version swap.

## Source rollback

The B-6 branch starts at `f26ef7d9c3d3d6fbe4b60cf2c5cabed445186001`. A Git rollback should use normal revert commits or a new branch from that commit; never use force push, hard reset, or broad restore to discard shared work. B-6 database additions are non-destructive. Restore a verified pre-B-6 backup only after separately preserving the current database and confirming that history loss is intended.
