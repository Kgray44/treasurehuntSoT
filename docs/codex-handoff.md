# Codex handoff

- Canonical repository: `Kgray44/treasurehuntSoT`
- Phase 3 branch: `feature/game-master-command-center`; base `origin/main` at `70bb654b78a84df15dba8d0f9ce5b3fd5782181d`
- Status: expanded Command Center implemented on its isolated feature branch; not integrated into `main`
- Routes: `/quartermaster` plus `/chapters`, `/hints`, `/voyage`, `/artifacts`, `/quests`, `/journal`, `/events`, `/player-view`, `/recovery`, `/audit`, `/diagnostics`
- Authentication: GM bcrypt/database session and CSRF; player session cannot call admin APIs
- Commands: prepare/release/solve/complete chapter, prepare/release hint, reveal map, award artifact, discover/advance quest, release journal entry, pause/resume, undo, reconciliation
- Events: six additive Phase 3 event names documented in `parallel-development-phase-3.md`
- Migration: `20260716233000_game_master_command_center` and MySQL `0002_game_master_command_center`
- Development data: four generic chapters, ordered hints, two artifacts, two map locations, two side quests, staged action, audit fixture
- Startup: `npm run dev:full`; validation: `npm run validate`; stop: `npm run dev:stop`
- Known limitations: no background scheduler, multi-event dependency rollback, production presence cleanup, Redis fan-out, real finale/story/private media, or deployment
- Phase 2 overlap: story event union, Prisma relation blocks, seed, player lifecycle, global CSS. Preserve Phase 2 visibility/player shell and reapply Phase 3 administrative additions.
- Required integration: follow `phase-2-phase-3-integration.md`, regenerate both clients, clean migrate, and rerun full two-browser validation
- Latest validated Phase 3 commit and pull request: populate after branch publication
- Recommended next task: controlled Phase 2/3 reconciliation, never a blind branch merge
