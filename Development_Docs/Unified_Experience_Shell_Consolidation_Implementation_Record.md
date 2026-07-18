# Unified Experience Shell Consolidation Implementation Record

Date: 2026-07-18  
Implementation branch: `codex/unified-experience-shell`  
Canonical repository: `Kgray44/treasurehuntSoT`

## Scope and integration safety

This branch consolidates the cumulative Phase B1-B6 product work, the restored physical journal, routed Experience sections, semantic themes, product navigation, strict port-3000 startup, and route-lifecycle hooks into the canonical Next.js application. It was created as a separate Git worktree because other Codex tasks were concurrently polishing product wording and rebuilding application-wide animation. Their main worktree, processes, index, and uncommitted files were not modified or stopped.

This separation is intentional integration safety, not a second product. The deliverable has one `src/app/layout.tsx`, one Next.js route tree, and one canonical runtime configuration. Before this branch is merged, compare its small shared-motion overlap in `ProductShell.tsx` and `TallTaleJournalSession.tsx` with the animation-overhaul task; retain the route identity, persistent-provider, reduced-motion, and focus contracts while choosing the newer motion vocabulary where both branches touched the same lines.

## Architecture changes

### Canonical application entry point and runtime

- `src/app/layout.tsx` is the only browser application root.
- `npm run dev:full` is the canonical setup/start command; `npm run dev` is the prepared-checkout shortcut.
- Development and production scripts bind explicitly to `127.0.0.1:3000`.
- `scripts/start-dev.ps1` has no alternate-port parameter or fallback. A port conflict fails clearly, and the “already running” path now requires matching runtime root, recorded port, PID, listener ownership, and HTTP health.
- Playwright and the full validation gate default to port 3000. Explicit environment overrides are reserved for disposable validation isolation and are not product runtime choices.

### Shared shell and route structure

`ThemeProvider`, `AnimationProvider`, and `ProductShell` are long-lived root providers. Role-aware global navigation remains outside nested workspace and Experience navigation.

Active compatibility routes:

- `/play/[taleSlug]/session/[sessionId]/chapters`
- `/play/[taleSlug]/session/[sessionId]/map`
- `/play/[taleSlug]/session/[sessionId]/artifacts`
- `/play/[taleSlug]/session/[sessionId]/messages`

Durable Player and completed-history routes:

- `/player/playthroughs/[playthroughId]/journal/chapters`
- `/player/playthroughs/[playthroughId]/journal/map`
- `/player/playthroughs/[playthroughId]/journal/artifacts`
- `/player/playthroughs/[playthroughId]/journal/messages`

Base and archive URLs redirect to Chapters. Invalid section segments use the framework not-found boundary. Both families render one persistent `TallTaleJournalSession`; child pages validate route identity and do not duplicate the Experience implementation.

### Experience pages

- **Chapters** retains `PhysicalJournalBook`, two-page spreads, page turns, chapter tabs, edition/endpaper pages, current-page persistence, and read-only completed mode.
- **Map** is a full chart with released markers, current/completed/released legend, selected-location detail, zoom, and a route back to the relevant book leaf.
- **Artifacts** is a responsive gallery and inspection layout with imagery, discovery state, chapter association, timestamp, annotation, and privacy-preserving sealed empty state.
- **Messages** is a full history/letter layout with selection, read/unread persistence, timestamps, chapter association, imagery, and readable empty state.
- The former right-side section buttons and essential drawer layout were removed. A horizontal parchment/brass tablist drives real routes and remains scrollable at narrow widths.
- Connection state is compact in the header and expands only to a non-overlay inline notice when not live. The objective and historical checksum sit in normal document flow below content.

### Theme architecture

`src/styles/tokens.css` owns one semantic layer, including background, surface, border, text, accent, state, parchment, brass, glow, water, fog, and navigation aliases.

- **Verdant Depths** is the root/default green-black maritime palette.
- **Moonlit Blue** is a selectable navy/cyan semantic override.
- Application preferences persist in `PlayerProfile.preferences` or `GameMasterUser.preferences`; browser storage is only an offline/anonymous fallback.
- Tall Tales support `APPLICATION`, `VERDANT_DEPTHS`, and `MOONLIT_BLUE` in new/edit settings.
- Precedence is explicit Tale override, persisted application preference, then Verdant Depths.
- The Tale override is a scoped `data-theme` on the Experience root, so leaving the route reveals the unchanged application preference.
- Library, shell, platform, Vision Waypoint, Companion, forms, settings, statuses, and surrounding atmosphere use the shared semantic values. Stable parchment pigments and media-black preview surfaces remain intentional physical/material values.

### Navigation hierarchy

1. `ProductShell`: role-aware application workspace destinations and active state.
2. Captain/Creator workspace: stable Library and Tall Tale authoring sections.
3. Experience: Chapters, Map, Artifacts, Messages.
4. Context: page turns, marker/detail controls, filters, and actions.

Nested Studio and Captain pages add explicit breadcrumbs to known parents. Player History and Captain Active Sessions have stable first-class routes. Back links use explicit parent URLs; browser history remains normal because tab navigation uses real links/routes.

### Animation architecture and lifecycle

- The global ProductShell remains mounted while a pathname-keyed content wrapper enters/exits.
- The Experience layout remains mounted while its pathname-keyed tabpanel transitions; session identity, SSE, theme, audio/motion state, reading context, and header remain stable.
- Libraries settle vertically, Studio scales subtly, Captain pages move laterally, settings settle, Chapters uses the book, Map unfolds, Artifacts rise, and Messages arrive like correspondence.
- Returning, refreshing, browser history, and tab changes produce a new route identity rather than relying on one-time session flags.
- State-change animation still depends on ordered event/sequence identity and is not replayed merely because a route mounted.
- Reduced motion replaces spatial transforms with fast opacity and preserves focus transfer and state announcements.

The app-wide animation overhaul running concurrently may supersede variant details. The consolidation contract that must survive integration is: keyed content regions, persistent providers/connections, cleanup via React presence/unmount behavior, event-ID state changes, and reduced-motion/focus semantics.

## Files changed by responsibility

### Routing

- `src/lib/experience-routes.ts`
- active session layout, base redirect, section validators, and legacy journal redirects below `src/app/play/[taleSlug]/session/[sessionId]/`
- durable Player journal layout, base redirect, section validator, and archive redirect below `src/app/player/playthroughs/[playthroughId]/`
- `src/app/player/history/page.tsx`
- `src/app/captain/sessions/page.tsx`
- application/role settings pages

### Components

- `TallTaleJournalSession.tsx`
- `ExperienceSectionPages.tsx`
- `PlayerLibrary.tsx`
- `PlayerVoyageRoom.tsx`
- `ThemeProvider.tsx`
- `ThemeSettings.tsx`

### Themes and persistence

- `src/styles/tokens.css`, `shell.css`, `tall-tale.css`, `platform.css`, `vision.css`, and `companion.css`
- `src/theme/theme.ts`
- `/api/preferences/theme`
- both Prisma schemas and additive SQLite/MySQL migrations
- `NewTaleForm.tsx`, `TaleEditor.tsx`, and preference readers in `src/platform/libraries.ts`

### Navigation and animation

- `ProductShell.tsx`
- persistent Experience layout and tabpanel route transitions in `TallTaleJournalSession.tsx`
- related shell/Experience CSS

### Runtime configuration

- `package.json`
- `playwright.config.ts`
- `scripts/start-dev.ps1`
- `scripts/test-all.ps1`

### Tests

- Experience route and theme preference unit tests
- full-page Map/Artifacts/Messages component tests
- ProductShell navigation/breadcrumb/transition tests
- journal reading-state defaults
- Tall Tale Platform E2E direct-route and tab checks

### Documentation

- `README.md`
- `docs/architecture.md`
- `docs/design-system.md`
- `docs/journal-system.md`
- `docs/local-development.md`
- `docs/responsive-behavior.md`
- `docs/testing.md`
- this implementation record

## Legacy consolidation and runtime audit

| Port | Audit result                                                       | Consolidation decision                                                                                                                          |
| ---- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 3000 | Canonical Next.js application from the main checkout               | Retained as the only supported frontend origin                                                                                                  |
| 3101 | A verified Next.js process from the Phase B2 worktree during audit | Its cumulative unique B1-B6 code was merged from the Phase B6 descendant; the process/worktree was not stopped because concurrent work owned it |
| 3106 | No listener during audit and no source runtime reference           | No implementation or entry point to retain                                                                                                      |

The B1-B6 branches were a linear cumulative implementation sequence. Merging the Phase B6 tip therefore brought the restored book, Vision foundation/capture/authoring/runtime/integration/release work into this single route tree without copying another app. Source references that launched or defaulted to alternate frontend ports were removed. No phase worktree or branch was deleted: they remain Git history and may still be in use by another task, but the canonical app does not depend on them.

Removed or replaced legacy behavior:

- right-side vertical section navigation and essential side drawers;
- base journal URLs as terminal pages (now explicit Chapters redirects);
- alternate/fallback frontend port selection;
- Vision/Companion hardcoded root-blue surfaces as an independent theme family;
- duplicated active/completed Experience renderers;
- ambiguous stale-state “already running” success.

## Verification record

The full repository validation gate ran in the isolated worktree with disposable ports 3210 and 3211 so the concurrent applications on 3000 and 3101 were not disturbed:

- all 12 SQLite migrations applied, including the additive unified-experience preference migration;
- Prisma generation, strict TypeScript, ESLint, and Windows PowerShell 5.1 parser checks passed;
- Vitest passed 44 files and 136 tests;
- desktop integration passed 6 checks and Companion integration passed 34 checks;
- the B6 authority gate truthfully remained `NO_GO` because its documented field-evidence blockers are still open, while synthetic replay and soak verification passed without being represented as field evidence;
- the animation asset audit, database checks/backfill, and B1-B6 verification scripts passed;
- Playwright completed 37 passing checks with 13 intentional WebKit/mobile mutation skips (50 total); mutation journeys remained Chromium-only as required by the shared-database policy;
- the production build passed and two isolated production restart probes passed;
- accepted-database preservation was demonstrated across validation with 16 legacy events, 18 audit events, 21 playthroughs, and 90 platform audit rows retained after the seed/start sequence;
- validation artifacts were written outside the repository to `C:\Users\kkids\AppData\Local\ForeverTreasureCompanion\validation\artifacts\validation`.

Manual production-browser validation on port 3212 confirmed:

- Verdant Depths and Moonlit Blue application themes render without horizontal overflow;
- widths 375, 430, 768, 1024, 1440, and 1920 switch cleanly between mobile and desktop navigation and preserve the settings layout;
- a Moonlit Blue application preference remained on the document root while a Verdant Tall Tale scoped its Experience shell to Verdant, proving Tale override > application preference without mutating the preference;
- Chapters, Map, Artifacts, and Messages each selected the correct tabpanel, changed to a distinct real route, changed the keyed route identity, and retained the persistent journal shell with zero horizontal overflow;
- the full-page secret-safe empty state rendered correctly when the test voyage had no released map marks.

The canonical-port conflict proof ran while the existing main-checkout application owned `127.0.0.1:3000`. `npm run dev` exited 1 with `EADDRINUSE`; ownership remained unchanged and no listener appeared on 3001 or 3106. The disposable 3212 validation server was then stopped by its verified PID, while the concurrent 3000 and 3101 processes remained running.

After the final semantic-token replacement in `VisionRegionEditor.tsx`, formatting, ESLint, strict TypeScript, the complete Vitest suite, and a production build were rerun on the final source state.

## Remaining integration risks

- The app-wide animation overhaul and wording-polish tasks are concurrent. Their uncommitted main-worktree changes were deliberately not consumed after this branch was created. Merge by comparing overlapping shell/motion/copy files; do not blindly choose either side wholesale.
- The externally running 3101 worktree process was not killed. It is not required by this branch, but its owner must stop it when that task is finished.
- Application themes persist per Player or staff profile. Anonymous public pages correctly use browser-local fallback because they have no authenticated server identity.
- Locked Player content remains unnamed by design. Full-page Map/Artifact empty states preserve the secret boundary rather than inventing or leaking unreleased labels.
