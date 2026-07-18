# Codex handoff

- Canonical repository: `Kgray44/treasurehuntSoT`
- Integrated branches: `feature/game-master-command-center` and `feature/cinematic-animation-rebuild`
- Integration method: normal merge commits on `main`, preserving both source histories
- Status: expanded Command Center, complete Player Companion, cinematic animation architecture, and Tall Tale Studio share one integrated tree
- Command Center routes: `/quartermaster` plus `/chapters`, `/hints`, `/voyage`, `/artifacts`, `/quests`, `/journal`, `/events`, `/player-view`, `/recovery`, `/audit`, `/diagnostics`
- Authentication: GM bcrypt/database session and CSRF; player sessions cannot call admin APIs
- Commands: prepare/release/solve/complete chapter, prepare/release hint, reveal map, award artifact, discover/advance quest, release journal entry, pause/resume, undo, reconciliation
- Migration: Phase 2 `20260716223000_player_companion_shell`, then Phase 3 `20260716233000_game_master_command_center`; connector-parity MySQL SQL exists and is wired through `npm run db:migrate:mysql:command-center`
- Development data: Phase 2 multi-state presets plus Phase 3 prepared-action and audit fixtures; normal launcher restarts preserve campaign state, while `npm run db:preset -- <preset>` is the explicit reset path
- Startup: `npm run dev:full`; validation: `npm run validate`; stop: `npm run dev:stop`
- Known limitations: no background scheduler, multi-event rollback, automated presence cleanup, Redis fan-out, real finale/story/private media, or deployment
- Latest full validation: 19 unit tests, 10 executed browser tests with 2 intentional shared-database skips, 16 accepted progression events, 18 audit records, preserved sequence after seed ensure, production build, and two production restart proofs
- Source pull requests: `https://github.com/Kgray44/treasurehuntSoT/pull/1` and `https://github.com/Kgray44/treasurehuntSoT/pull/2`
- Required gate: complete post-merge validation and synchronize project records before pushing `main`

## Cinematic and Studio handoff

- Source branch: `feature/cinematic-animation-rebuild`
- Baseline commit: `2c07497f148707a72eac15783b88293ff0b3413d`
- Phase completed: cinematic animation architecture and full interface rebuild
- Version: `0.2.0`
- Repository visibility: **public** as verified 2026-07-17; only fictional development content is permitted
- Updated: 2026-07-17

## Product surfaces

- Landing: `http://127.0.0.1:3000/`
- Player: `http://127.0.0.1:3000/tale/development-forever-treasure`
- Game Master: `http://127.0.0.1:3000/quartermaster`
- Development showcase: `http://127.0.0.1:3000/dev/animations`
- Player sections: `journal`, `chart`, `treasures`, `quests`, `log`, `finale`

The landing, access gate, player journal workspace, chart, treasure altar, quest ledger, ship's log, finale chamber, and quartermaster dashboard share the physical moonlit-journal design system. The development showcase proves every authored scene, runtime control, fallback, motion mode, and the serial trailer without calling progression APIs. The showcase route returns 404 in production.

## Animation architecture

- `AnimationDirector` is the single transport for scene registration, playback, pause, resume, seek, speed, skip, reverse, cancellation, cleanup, and observable state.
- GSAP owns authored timeline transforms, SVG drawing, masks, SplitText, MotionPath, labels, and callbacks.
- Motion owns React mount/unmount, layout, navigation, dialog, and press interactions.
- StPageFlip owns physical page turns over a shared React page model; reduced motion uses a semantic static page reader.
- Rive is dynamically loaded from a local WebGL2 binary with CDN fallback disabled and SVG failure fallbacks.
- Lottie is dynamically loaded from three original local JSON assets and exposes play, pause, segment, speed, direction, visibility, and destruction controls.
- Full, gentle, and reduced policies preserve state and semantic reading order. Document and element visibility pause expensive runtimes.
- Procedural Web Audio cues are optional, user-unlocked, disposable, and never block navigation or state transitions.

See `docs/animation/` for scene inventory, ownership rules, asset contracts, provenance, showcase operation, testing, and performance notes.

## Data and security boundaries

- Existing Prisma, session, allowlist projection, SSE, event ordering, and audit boundaries remain intact.
- The showcase uses deterministic fictional props and makes no player or GM mutation requests.
- Local animation assets are validated for expected paths, JSON shape, Rive magic bytes, and remote URL exclusion.
- No production secrets, private story content, photographs, analytics, or new third-party network calls were added.

## Development commands

- Start: `npm run dev:full`
- Stop: `npm run dev:stop`
- Full validation: `npm run validate`
- Animation asset validation: `npm run assets:validate`
- Unit tests: `npm test`
- Production build: `npm run build`

On a UNC checkout, the PowerShell scripts mirror into `%LOCALAPPDATA%/ForeverTreasureCompanion` so Node, Prisma, Next.js, and Playwright operate on a local filesystem. Local development defaults remain `development-moonwake` for the player and `kato` / `development-captain-only` for the GM; never reuse them outside the disposable local database.

## Validation state

- Strict TypeScript: passing
- ESLint: passing with zero findings
- Formatting: passing
- Animation asset validator: 3 Lottie JSON files, 1 Rive binary, and local SVG fallbacks passing
- Unit tests: 50 passing across 16 files
- In-app browser: responsive landing/access/player/GM/showcase flows inspected; clean showcase load has no console warnings or errors
- Showcase diagnostics: 60 FPS idle estimate, zero-to-one initial development long task depending on cache, expected 1 Rive / 2 Lottie / 1 PageFlip full-mode steady-state counts, no asset failures
- Horizontal overflow: none at 390, 1440, or 2560 CSS pixels in the showcase audit
- Full `npm run validate`: passing on 2026-07-17 with 8 applicable Playwright tests passing, 2 intentional heavy-suite project skips, 8 ordered events/audits verified, optimized production build passing, two production restarts passing, and the development showcase returning 404 in production
- Validation artifacts: `%LOCALAPPDATA%/ForeverTreasureCompanion/validation/artifacts/validation`

## Remaining production work

- Replace the documented development Rive sample and all fictional copy with commissioned/private production art and story content after the repository becomes private.
- Profile real production art on target low-end mobile hardware and repeat memory traces after sustained navigation.
- SSE fan-out remains process-local; add Redis or equivalent before multi-instance deployment.
- Exercise the parallel MySQL migration against MySQL 8 in CI.
- The finale remains a safe shell until private requirements and ending content are authored.
