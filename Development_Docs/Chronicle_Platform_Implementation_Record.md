# Chronicle Platform implementation record

Status: implemented and release-gate validated on 2026-07-17  
Specification: `Chronicle_Platform_Codex_Implementation_Specification.pdf`
Repository baseline: `main` at `d0906e2`, synchronized with `origin/main` on 2026-07-17

## Repository inventory before implementation

The current application already provides two additive but connected domains:

- The original `Campaign` companion supports password-only Player access, the Quartermaster/Game Master command center, ordered progression events, presence, server-side public projections, CSRF-protected Captain mutations, audit records, and sanitized SSE.
- Chronicle Studio Phase 1 provides `Chronicle`, editable `TaleDraft` graphs, immutable checksummed `PublishedTaleVersion` snapshots, version-pinned `TaleSession` runtime records, ordered idempotent session events, authorized media variants, Creator validation/publishing, Captain session controls, helper verification, and Player runtime pages.

Current primary routes are `/`, `/tale/[campaignSlug]`, `/quartermaster`, `/tales`, `/play/[taleSlug]`, `/play/[taleSlug]/session/[sessionId]`, `/captain`, and `/studio`. Existing GM credentials and server-side sessions are shared by Captain and Creator capabilities. Existing Chronicle Player sessions use an opaque random token whose hash is persisted and whose clear value is stored only in an HttpOnly cookie, but they do not yet provide a durable Player identity, library, invitation lifecycle, or multi-playthrough history selector.

## Architecture decision

The platform implementation will extend the existing domain rather than introduce a disconnected replacement:

- `Chronicle` remains the authored identity.
- `PublishedTaleVersion` remains the immutable release and historical rendering source.
- `TaleSession` becomes the persisted playthrough aggregate. Existing preview-session behavior remains isolated through `previewMode`; every real new playthrough must reference one published version.
- New Player profile/session, membership, invitation, invitation-event, reveal-state, scoped-role, and platform-audit records provide identity, library access, invitation lifecycle, revocation, and traceability.
- Existing `GameMasterUser` credentials remain the strong account authority. Scoped role assignments supplement existing capability checks without invalidating current Captain/Creator logins.
- Workspace-specific services return explicit Player-safe, Captain, and Creator view models. Raw Prisma entities and complete published snapshots are never serialized to Player library or invitation clients.
- Existing `/tales`, `/play/[taleSlug]`, and `/captain` paths receive safe compatibility behavior while `/player/*`, `/join/*`, `/captain/library`, `/captain/invitations`, and `/studio/library` become the canonical platform families.

## Migration and compatibility risks

1. Existing `TaleSession` rows may already be active or completed. The migration must preserve their identifiers, access-token hashes, version binding, state, event order, inventory, variables, and timestamps.
2. Legacy sessions do not have a durable Player profile or membership. Backfill must create deterministic guest profiles and memberships without changing their current runtime cookie behavior.
3. Existing status values start at `ACTIVE`; new setup and invitation states must be accepted without breaking the progression engine, which may mutate only `ACTIVE` or `PAUSED` sessions and must keep `COMPLETED` terminal.
4. Existing GM role/capability behavior must remain functional while explicit Captain and Creator denial is enforced on every new route and API.
5. Published asset responses currently authorize by version identity. Player requests must additionally prove membership/session access and reveal scope; public-safe cover variants require a narrowly defined exception.
6. SQLite is the supported local and test database, while a MySQL-parity migration must be maintained. The migration is additive and rollback is backup/restore plus application rollback; destructive down-migrations are not automated.
7. The repository is public. Seeded accounts, invitations, story copy, names, PINs, and media remain fictional development data only.

## Vertical implementation slices

1. Add additive schema/migrations, domain state machines, authorization policies, token hashing, backfill, and development fixtures.
2. Add secure Player session/sign-in, invitation resolution/acceptance/decline, library projection, waiting room, archive projection, and protected asset policy.
3. Add Captain library, atomic playthrough/invitation creation, secure link/QR/short-code delivery, lifecycle management, launch synchronization, and audit history.
4. Add the three-role cinematic gateway, role-aware sign-in and workspace switching, responsive Player/Captain screens, reduced-motion behavior, and compatibility redirects.
5. Complete version comparison, restore/fork ancestry, immutable-release guards, authorization/concurrency tests, full role-journey browser coverage, migration validation, and documentation.

## Completion evidence

The implementation is complete against the specification and is integrated with the existing Campaign, Quartermaster, and Chronicle Studio domains.

- Additive SQLite migration deployment succeeded from an empty validation database across all five repository migrations. A matching forward-only MySQL migration and schema were syntax-validated; a live MySQL service was not available in this workspace, so production MySQL deployment remains an operator-controlled rollout step with a verified backup.
- The normal development seed created the platform foundation without resetting progress. A dedicated legacy-shaped playthrough proof then ran the same seed path and verified that the original playthrough ID, published-version binding, event history, timestamps, reveal history, and new membership all survived intact. A second seed after the complete browser journey preserved all accepted progress and backfilled zero additional playthroughs.
- Static and unit gates passed: Prettier, ESLint, strict TypeScript, local animation assets, 25 Vitest files, and 80 unit/component tests.
- The complete browser matrix passed 21 tests with 7 intentionally skipped mutation-heavy mobile permutations. Chromium exercised the full invitation-to-archive platform journey and the established Campaign, Command Center, animation, and Studio journeys. Mobile WebKit exercised protected access, the role gateway, reduced motion, responsive layouts, and accessibility.
- Acceptance-state verification found 5 persisted playthroughs, 16 progression events, 18 legacy audit entries, and 14 platform audit events. It also proved immutable-version pinning, exact-version archive rendering, Player-safe projections, role/resource denial, CSRF enforcement, invitation replacement/revocation, idempotent acceptance, and per-membership archive preferences.
- The optimized Next.js production build completed successfully, followed by two clean production start/health/stop cycles. `npm audit` reported zero known vulnerabilities after the dependency security updates.

The remaining deployment risks are operational rather than hidden implementation gaps: production secrets must replace development credentials, MySQL migration must be applied only after a backup in a maintenance window, persistent multi-instance rate limiting needs a shared backend, and uploaded assets need object storage plus malware scanning for multi-instance production. The implementation commit is `e469b12`; the subsequent path-scoped synchronization commit records this implementation document and the associated Codex transcript.
