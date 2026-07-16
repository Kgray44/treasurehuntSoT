# Codex handoff

- Canonical repository: `Kgray44/treasurehuntSoT`
- Phase 3 branch: `feature/game-master-command-center`; original base `70bb654b78a84df15dba8d0f9ce5b3fd5782181d`
- Integration base: Phase 2 merged `origin/main` at `ede3764`; reconciled by a normal merge, preserving both histories
- Status: expanded Command Center plus complete Phase 2 Player Companion; not integrated back into `main`
- Command Center routes: `/quartermaster` plus `/chapters`, `/hints`, `/voyage`, `/artifacts`, `/quests`, `/journal`, `/events`, `/player-view`, `/recovery`, `/audit`, `/diagnostics`
- Authentication: GM bcrypt/database session and CSRF; player sessions cannot call admin APIs
- Commands: prepare/release/solve/complete chapter, prepare/release hint, reveal map, award artifact, discover/advance quest, release journal entry, pause/resume, undo, reconciliation
- Migration: Phase 2 `20260716223000_player_companion_shell`, then Phase 3 `20260716233000_game_master_command_center`; connector-parity MySQL SQL exists
- Development data: Phase 2 multi-state presets plus Phase 3 prepared-action and audit fixtures
- Startup: `npm run dev:full`; validation: `npm run validate`; stop: `npm run dev:stop`
- Known limitations: no background scheduler, multi-event rollback, automated presence cleanup, Redis fan-out, real finale/story/private media, or deployment
- Latest validated Phase 3 commit and pull request: populate after reconciled validation/publication
- Recommended next task: controlled integration review and production-readiness work; do not merge the PR without the post-merge checklist
