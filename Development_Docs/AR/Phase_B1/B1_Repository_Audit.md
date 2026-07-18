# Phase B-1 Repository Audit

Status: complete before implementation  
Audit date: 2026-07-18  
Canonical repository: `https://github.com/Kgray44/treasurehuntSoT.git`  
Canonical integration branch: `main`  
Implementation branch: `codex/phase-b1-foundation`  
Starting commit: `0192a166699c7cb75d63d46d7acfc00ef6640ac6`

## Governing sources reviewed

The implementation is governed, in order, by:

1. `TT-VISION-GOV-001` version 1.0, Governing Baseline, 127 pages.
2. `TT-VISION-PHASE-B-001` version 1.0, Authorized Implementation Baseline, 147 pages.
3. Existing project architecture and security documentation.
4. Existing repository conventions.
5. The Phase B-1 implementation prompt supplied on 2026-07-18.

The two governing PDFs were verified with PDF metadata, extracted text, and rendered-page inspection. Canonical copies are stored under `Development_Docs/AR/Governing_Specification` and `Development_Docs/AR/Phase_B_Roadmap`. The source copies in the original checkout were not modified.

## Git and concurrent-work safety

The original checkout was on `main`, exactly synchronized with `origin/main` at the starting commit after `git fetch --prune origin` and a `0 0` upstream comparison. It contained two untracked governing PDFs. During this audit, a separate Tall Tale UI task also added an untracked `Development_Docs/Canonical_Player_Journal_Implementation_Record.md` in that checkout.

To avoid overwriting or interleaving the parallel UI work, B-1 uses the isolated worktree `C:\Users\kkids\Documents\Codex_TreasureHunt_Phase_B1` on `codex/phase-b1-foundation`. No file in the original checkout was changed, staged, removed, or renamed. Before final integration, B-1 must fetch again, inspect the other task's final tree, and merge or rebase without discarding either change set.

## Current platform inventory

| Area               | Audited implementation                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend           | Next.js 16.2.10 App Router, React 19.2.4, strict TypeScript 5                                                                                                            |
| Backend            | Next.js route handlers and server modules in the same application                                                                                                        |
| Package manager    | npm 11.9.0 with an exact `package-lock.json`; Node 24 is the documented runtime                                                                                          |
| Repository shape   | Single-package application, not a monorepo; `@/*` maps to `src/*`                                                                                                        |
| Database           | Prisma 6.19.3; SQLite is canonical for local/test and MySQL 8 has a maintained parallel schema                                                                           |
| Migrations         | Versioned SQLite migrations under `prisma/migrations`; forward-only MySQL SQL under `prisma/mysql-migrations`                                                            |
| Authentication     | Database-backed Game Master sessions with bcrypt and CSRF; durable Player identity sessions; legacy opaque playthrough cookies retained for compatibility                |
| Authorization      | Staff capabilities (`CAPTAIN`, `CREATE_TALES`, `PUBLISH_TALES`, `ADMIN`, and related scopes), Player membership checks, Creator ownership, and API-local resource checks |
| Runtime validation | Zod at route, draft, block, and verification boundaries                                                                                                                  |
| Logging and audit  | Pino structured logging with redaction; `PlatformAuditEvent` for correlated resource actions; ordered session events for runtime truth                                   |
| Testing            | Vitest 4.1.10, Testing Library, Playwright 1.56.1, axe accessibility checks, database invariant scripts, production build/restart proof                                  |
| Deployment         | Debian/Node/MySQL/NGINX/systemd documentation; no CI workflow is currently committed                                                                                     |
| PWA                | No manifest, service worker, install flow, offline shell, or update-state implementation exists                                                                          |
| Desktop/native     | No desktop shell, native bridge, Electron, Tauri, or packaged frontend implementation exists; Rust is not installed in the audited Windows environment                   |
| API documentation  | Route conventions and prose documents exist, but no generated OpenAPI description exists                                                                                 |

## Existing product and route structure

The existing application already satisfies the most important shared-product premise: Player, Captain, and Studio are one Next.js source tree and share the same domain, API, design tokens, animation director, and published story snapshots.

- Player families: `/player/*`, `/play/[taleSlug]/*`, and the original `/tale/[campaignSlug]` compatibility experience.
- Captain families: `/captain/*` plus `/quartermaster` and its Command Center workspaces.
- Studio families: `/studio/library`, `/studio/tales/*`, settings, assets, locations, artifacts, and version history.
- Dynamic catalog: `/tales`.

The desktop shell should therefore package the existing application rather than extract or copy three new applications.

## Story and persistence architecture

`TallTale` is the stable authored identity. `TaleDraft`, `TaleChapter`, `StoryBlock`, and `BlockConnection` form the editable graph. `PublishedTaleVersion` freezes a checksummed complete snapshot. `TaleSession` is a version-pinned playthrough aggregate with current chapter/block pointers, concurrency state, ordered events, inventory, variables, and membership.

`src/tall-tale/progression.ts` is the authoritative runtime engine. `TaleSessionEvent.idempotencyKey` and per-session sequence constraints protect progression. `TaleVerificationRequest` and `TaleVerificationEvent` already provide a versioned provider seam that checks session, published version, current block, provider, request state, observation time, and duplicate idempotency before completion. This seam currently marks `visionLocation` as future-only; B-1 can activate it behind the new server-enforced feature flag instead of building a second progression engine.

The Studio editor registry already owns block identity, defaults, fields, runtime Zod schemas, and provider selection. The B-1 story block should extend that registry and preserve its graph/publishing rules. Because Studio autosave replaces chapter/block rows transactionally, `StoryWaypointBinding` synchronization must occur inside that same save transaction so real bindings cannot disappear or point to drafts.

## Existing event and verification boundaries

The system already has the correct truth boundary for B-1:

```text
published block activates
  -> TaleVerificationRequest is persisted
  -> a provider submits versioned evidence
  -> current session/version/block/request are rechecked
  -> TaleVerificationEvent is persisted
  -> an ordered TaleSessionEvent is appended
  -> the same completion engine advances exactly once
```

B-1 will add a versioned Vision protocol and persistent `VerificationAttempt` state machine around this seam. The deterministic verifier remains mock-only, while storage, adapter invocation, stale checks, event delivery, and idempotency remain real.

## Build and validation workflow

`npm run validate` is the repository release gate. It creates a clean disposable SQLite database, deploys migrations, seeds generic data, checks database invariants, runs formatting, lint, strict type checking, Vitest, local asset validation, Chromium/WebKit Playwright coverage, post-acceptance database checks, an optimized production build, and two production restart proofs. Shared-database mutations run in Chromium only; WebKit remains appropriate for read-only, accessibility, responsive, and reduced-motion checks.

B-1 must extend this gate with protocol, lifecycle, migration, adapter, PWA, desktop-boundary, and end-to-end mock verification coverage. A desktop packaging command must also run separately because the existing gate has no native packaging stage.

## Architecture fit decisions from the audit

1. Keep the single Next.js application as the shared web UI and server. Introduce bounded `src/vision/*` modules rather than force a monorepo migration during B-1.
2. Select Electron for the B-1 desktop shell. The current application depends on dynamic Next.js server components, route handlers, Prisma, and authentication. Electron can package and launch the existing Next standalone server and render the exact same routes from local bundled assets. Tauri would require a new Rust toolchain plus a separately bundled Node sidecar for the same server runtime, adding two native toolchains without reducing the B-1 trust boundary. This choice requires an ADR and a narrow, context-isolated IPC allowlist.
3. Add a service worker manually with explicit cache allowlists. Never cache `/api/*`, authentication, mutable story state, attempts, pairing data, or staff data.
4. Extend both Prisma schemas additively. Published waypoint versions use `publishedAt` plus an immutable publication row and service guards; stories pin an exact `waypointVersionId`.
5. Reuse `TaleVerificationRequest`, `TaleVerificationEvent`, and the authoritative progression engine for story delivery. Add the B-1 attempt record and transitions; do not fork progression logic.
6. Use Zod as the canonical runtime protocol and draft/package validation technology because it is already used across both web and server runtimes.
7. Keep feature flags typed and centralized. Server authorization and server-enforced flags remain authoritative; browser flags only control presentation and adapter selection.
8. Preserve existing visual structure. New pages and controls use the current parchment, ocean, brass, focus, reduced-motion, and responsive conventions.

## Principal risks and controls

- Concurrent UI work: isolate the branch/worktree, re-fetch before final integration, and resolve textual overlap explicitly.
- Autosave row replacement: recreate and validate waypoint bindings inside the draft transaction.
- Mock leakage: development/test flags, production-off defaults, explicit adapter names, and production-wiring tests.
- Published mutation: database uniqueness, publication identity/hash, service-level edit guards, and immutable-version tests.
- Desktop native abuse: `contextIsolation`, no Node integration in the renderer, fixed IPC channels, no arbitrary path/command arguments, and local packaged application content.
- PWA data leakage: static-asset allowlist only, network-only APIs, versioned cache names, and tests that enumerate prohibited paths.
- MySQL drift: maintain matching SQL and run Prisma schema validation plus syntax/invariant checks even though a live MySQL service is not currently available.

## Audit conclusion

The repository can support B-1 additively. Its existing immutable Tall Tale snapshots, provider seam, ordered idempotent events, staff/Player security model, and shared UI reduce implementation risk. The primary new foundations are the persistent waypoint/version domain, typed protocol, adapter boundary, attempt state machine, Studio waypoint surfaces, story binding, Player/Captain mock workflow, safe PWA, locally packaged desktop shell, and evidence-backed documentation.
