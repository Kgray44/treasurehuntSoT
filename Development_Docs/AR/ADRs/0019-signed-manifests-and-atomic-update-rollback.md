# ADR 0019: Signed manifests and atomic update rollback

- Status: accepted for Phase B-6
- Date: 2026-07-18

## Context

An updater that accepts only a transport URL or checksum cannot establish publisher trust, and replacing an active application in place makes interrupted activation destructive. Updates must not modify Creator projects, published stories, waypoint packages, or the application database.

## Decision

Release metadata uses canonical JSON and an Ed25519 signature with a pinned key ID, trust scope, channel, platform, architecture, semantic version, artifact length, and SHA-256 digest. Preview and stable channels reject unsigned metadata or artifacts. The desktop release manager downloads to a bounded staging location, verifies before activation, defers while a scan or story is active, atomically switches application-owned version state, performs a health check, and rolls back on failure or interrupted startup.

Windows Authenticode remains a separate outer trust layer. `scripts/build-release.ps1` requires a protected PFX for preview/stable builds and verifies valid timestamped signatures. No certificate or private key is stored in the repository.

## Consequences

- Development artifacts may remain visibly unsigned, but cannot be promoted to preview or stable.
- A checksum mismatch, wrong channel/platform, unsafe path, unsupported version, or untrusted signature fails before activation.
- User projects and historical evidence are outside the update store and survive rollback.
- Clean-machine upgrade and rollback evidence is still required before release.
