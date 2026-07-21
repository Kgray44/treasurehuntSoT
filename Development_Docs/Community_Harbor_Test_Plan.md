# Community Harbor Phase 1 test plan

| Requirement group | Evidence file | Database/actor | Expected result | Command |
| --- | --- | --- | --- | --- |
| Taxonomy, handle, transition, manifest | `src/community/domain.test.ts` | unit | typed taxonomy, strict input, stable checksum, unsafe data rejection | `vitest run src/community/domain.test.ts` |
| Storage namespaces/path safety | `src/community/storage.test.ts` | isolated temp root | staging/release/quarantine, checksum, traversal and immutable overwrite rejection | `vitest run src/community/storage.test.ts` |
| Future Lanternwake contracts | `src/animation/community/community-scene-contracts.test.ts` | unit | sixteen unique future-only contracts with existing ownership/reduced-motion vocabulary | `vitest run src/animation/community/community-scene-contracts.test.ts` |
| Profile/listing/release services | `src/community/services.ts` | isolated SQLite fixture | owner-only mutation, strict schema, immutable source, transaction/outbox/audit receipt | closure SQLite integration command |
| Authorization/privacy/enumeration | `src/community/authorization.ts`, API routes | anonymous, owner, crew, unrelated player, moderator, admin, suspended | safe not-found and allowlisted projection | closure API/security suite |
| Outbox | `src/community/outbox.ts` | isolated SQLite fixture | conditional claim, retry, terminal failure, processed after success | closure outbox suite |
| Assets | `src/community/assets.ts` | isolated temp root/SQLite fixture | owner-only reads, immutable attach, quarantine | closure storage suite |
| Migrations | `prisma/migrations/*harborlight*` | disposable SQLite/MySQL | tables/indexes/constraints and prior data preservation | Prisma migrate deploy |

The final closure command set must record passed/failed/skipped counts rather than treating a skipped browser or MySQL environment as a pass. Phase 1 keeps public discovery, uploads, package installation, 3D processing, reviews, follows, comments, collections, moderation UI, production scanner/object store/workers, and final scenes out of scope.
