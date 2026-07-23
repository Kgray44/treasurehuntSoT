# Project Harborlight Phase 2 Integration Manifest

Repository: `Kgray44/treasurehuntSoT`  
Convergence branch: `codex/project-harborlight-phase2-complete-convergence`  
Base: `origin/main` `4a84b9fd2dfa439127c35b8ce865ff8b7a5742b7`  
Harborlight implementation commit: `5455d55b8ae6c8af773b62c5fd6559bad291b882`

Implementation manifest SHA-256: `85419068e24d015e3770035bfc46c6cbb5e1267631abc01a10147b280e348a89`

## Incorporated branches and order

1. One Voyage: `3f0b126806adee21705b57b806ae3d480fb4848a`, merged as `dfc3562cf`.
2. Wayfarer: `331274855b7e1e71ff81c71aa13724d096a70022`, merged as `e6c0c961a`.
3. Sealed Hold: `2c28f06183d7c68a90613f3d0bfaf4da8f72f6eb`, merged without conflicts.
4. Harborlight v2: `df11c2dd01f03461872e966c51056eb5f04bb757`, merged as `1cd4e2f27`.

The merge ledger records nontrivial resolutions. Ownership remains: One Voyage for Chronicle and active-session state, Wayfarer for accounts and identity, Sealed Hold for private storage/scanning/workers, and Harborlight for releases, package exchange, installation, lineage, and updates.

## Delivered Harborlight layer

- Typed package manifests covering all releasable Phase 2 item types, checksum and path/MIME/dependency validation, truthful scanner status enforcement, and GLB safety checks.
- Typed 2D/3D artifact metadata, GLB resource budgets, collection/assembly graph and licence validation, and keyboard/reduced-motion preview contracts.
- Publication preflight and package persistence endpoints, strict canonical-account/CSRF boundary, explicit clean-scan handling, and immutable-source guard.
- Library-reference, editable-copy, fork, draft-import, and nonmutating preview-sandbox install plans with deterministic mappings, retry identity, local-edit protection, and explicit update actions.
- Accessible presentation components for publication validation, install review, and 2D/3D previews.

## Migration chain

SQLite: `20260722110000`, `20260722120000`, `20260722121000`, `20260722130000`, `20260722131000`, `20260722132000`, `20260722133000`, `20260722140000` through `20260722145000`.

MySQL: `0011`, reserved `0012`, `0013`, `0014`, `0015`, `0016`, `0017`, `0018`, and `0019` through `0024`.

## Validation

Ordered isolated SQLite rehearsal completed with 101 tables and `PRAGMA foreign_key_check` returning zero rows. Prisma validates for SQLite and MySQL schemas. Focused Harborlight tests: 17 passing. Full Vitest: 110 files and 931 tests passing. TypeScript, product-language validation, and production `next build --webpack` passed. Live MySQL, configured production scanner/storage/worker, and browser acceptance remain deployment/external proof, not claims of completion.
