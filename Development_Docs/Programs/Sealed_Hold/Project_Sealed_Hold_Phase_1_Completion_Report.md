# Project Sealed Hold Phase 1 completion report

## Delivery state

- Implementation: candidate committed on the dedicated Sealed Hold branch.
- Project validation: focused fixture and repository scan proof completed; the
  network-hosted worktree prevented Vitest worker startup and full browser/
  database execution in this run.
- Repository-wide release validation: not an acceptance declaration.
- Integration: not accepted or merged. `main` and Wayfarer remain untouched.

## Delivered boundary

The branch provides `.ftprivate` envelope/payload v1 using AES-256-GCM with
scrypt, random salt/nonce, authenticated AAD, checksum validation, typed
manifest validation, canonical base64 decoding, version rejection, bounded
virtual archive paths, media checks, and redacted errors. Private asset storage
requires two configured absolute roots outside the repository/public/build tree,
uses content-addressed object paths and staging/finalization, and has no static
web mapping.

Dry-run inspection decrypts and validates without domain mutation. Explicit
import records package uniqueness, stages objects, finalizes them before making
references available, remains unpublished, and returns an idempotent receipt.
Retry finalization is an explicit operation. Export and backup reuse the same
encrypted codec and authenticate/decrypt/validate before a receipt is issued.
The Studio route and CLI call shared domain services. Private delivery uses the
authorization seam, indistinguishable denial, no-store headers, and authorized
byte ranges.

## Validation evidence

- `scripts/private-content/verify-fixtures.ts`: passed with synthetic content.
- Repository scan: rerun after its narrow structural PEM rule and synthetic
  sentinel handling; no archived-chat allowlist was added.
- TypeScript direct invocation completed without diagnostics before the final
  documentation-only updates.
- Webpack build reached generated route checking after the prior
  `PLAYER_EVENT_*` Next route-export defect was moved to
  `src/platform/player-event-stream.ts`.

The source includes focused codec, archive-path, storage-root, scanner, and
route-limit tests. Full Vitest/browser/database validation could not complete
from this UNC worktree: the Vitest worker pool timed out even in one-fork mode,
and Git worktree relocation was refused by the share. This is an execution
limitation, not a pass; it must be rerun from an owned local runtime mirror
before integration acceptance.

## Scanner disposition

The former archived-chat match was a false positive: only an incomplete private
key header fragment was present. The scanner now requires a complete
header/body/footer structural PEM match. A focused regression test proves a
synthetic complete key and sentinel are still detected. No private value was
printed, copied, or allowlisted.

## Reconciliation

Sealed Hold branch: `codex/project-sealed-hold-phase1`.

Base: `origin/main` at `0ecd2f9cca6116e2f7f9ab4408ade749fb061e72`.

Wayfarer remained on `codex/project-wayfarer-phase1-unified-identity` and was
not modified. Expected integration work is retained migration ordering,
Wayfarer identity-adapter mapping, lockfile review, Studio navigation, and
combined authorization/build validation. Recommended order remains Wayfarer,
then Sealed Hold, on a fresh integration branch. No merge occurred.
