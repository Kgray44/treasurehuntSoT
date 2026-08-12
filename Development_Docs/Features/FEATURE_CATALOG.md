# Forever Treasure Feature Catalog

This generated catalog records completed, meaningful platform capabilities. It is not a changelog, task ledger, roadmap, or list of implementation trivia. Machine-readable fragments under `Development_Docs/Features/` are the source of truth.

## Audited repository and commit

Repository: `Kgray44/treasurehuntSoT`
Audited source commit: `920d92a51a16d60a2dfe35278598e6d921be7e4c`

## Status vocabulary

- **MAINLINE**: available on the audited mainline source.
- **BRANCH COMPLETE NOT MERGED**: accepted on a named branch but not available on main.
- **COMPATIBILITY**: intentionally retained adapter capability that delegates to canonical systems.

# Mainline Features

## FT-001 - Unified Chronicle Platform

**Status:** MAINLINE
**Program or subsystem:** Platform

Canonical authored Chronicles, immutable editions, live Voyages, memberships, and compatibility adapters share explicit ownership boundaries.

### Important subfeatures

- Checksummed published editions
- Version-pinned Voyage sessions
- Ordered session events
- Cross-project ownership boundaries
- Compatibility observation

### Primary surfaces

`/`, `/player`, `/captain`, `/studio`

### Evidence

- path: `prisma/schema.sqlite.prisma`
- path: `src/compatibility/compatibility-observation.ts`

---

## FT-002 - Secure Account, Session, and Role System

**Status:** MAINLINE
**Program or subsystem:** Platform

One protected account can hold person, role, session, recovery, and authorization state across product workspaces.

### Important subfeatures

- Canonical account identity
- Hashed session tokens
- CSRF-protected mutations
- Scoped roles
- Security audit events

### Primary surfaces

`/account`, `/verify-email`, `/forgot-password`

### Evidence

- path: `src/platform/auth.ts`
- path: `src/platform/policy.ts`

---

## FT-003 - Cinematic Role Gateway and Workspace Routing

**Status:** MAINLINE
**Program or subsystem:** Platform

The role-aware arrival flow routes Players, Captains, and Creators to protected workspaces with accessible alternatives.

### Important subfeatures

- Role-specific arrivals
- Remembered-session continuation
- Destination authorization
- Keyboard navigation
- Reduced-motion behavior

### Primary surfaces

`/`, `/player`, `/captain`, `/studio`

### Evidence

- path: `src/app/page.tsx`
- path: `src/components/landing/HarborLanding.tsx`

---

## FT-004 - Chronicle Passport and Public Profile

**Status:** MAINLINE
**Program or subsystem:** Wayfarer

Wayfarer separates a private Chronicle Passport from a privacy-governed public identity.

### Important subfeatures

- Canonical handles
- Historical redirects
- Granular visibility
- Typed preferences
- External identity simulator

### Primary surfaces

`/passport`, `/profile/[handle]`

### Evidence

- path: `src/wayfarer/profile.ts`
- path: `src/wayfarer/providers.ts`

---

## FT-005 - Invitation and Crew Lifecycle

**Status:** MAINLINE
**Program or subsystem:** Player

Captains assemble exact-edition crews through individualized invitations with auditable, revocable lifecycle transitions.

### Important subfeatures

- Per-Player invitation credentials
- Hash-only credential storage
- Account-required acceptance
- Atomic membership activation
- Terminal access revocation

### Primary surfaces

`/join/[token]`, `/player/invitation`, `/player/library`

### Evidence

- path: `src/platform/invitations.ts`
- path: `src/platform/audit.ts`

---

## FT-006 - Player Library and Voyage Lifecycle

**Status:** MAINLINE
**Program or subsystem:** Player

Players can discover, resume, archive, and reconcile exact-edition Voyage experiences across lifecycle states.

### Important subfeatures

- State-aware Voyage groups
- Edition metadata
- Pinned and hidden items
- Historical archive
- Realtime and polling reconciliation

### Primary surfaces

`/player`

### Evidence

- path: `src/platform/libraries.ts`
- path: `src/platform/state.ts`

---

## FT-007 - Captain Voyage Operations

**Status:** MAINLINE
**Program or subsystem:** Captain

Captains create, launch, operate, recover, and reconcile live Voyages through authoritative commands, with an explicit option to join the same Voyage as an ordinary Player.

### Important subfeatures

- Voyage creation wizard
- Crew readiness
- Command idempotency
- Pause and resume
- Operational audit trail
- Independent Captain authority and Player membership
- Captain-only and Captain plus Player participation modes
- Player-safe perspective switching
- Membership-bounded personal history and artifact eligibility

### Primary surfaces

`/captain`, `/captain/library`, `/captain/sessions/[sessionId]`, `/captain/voyages/[playthroughId]/player-preview`, `/player/playthroughs/[playthroughId]`

### Evidence

- path: `src/server/admin-command.ts`
- path: `src/domain/admin.ts`
- path: `src/helm/captain-participation.ts`
- path: `src/components/platform/CaptainLibrary.tsx`
- path: `src/app/api/captain/playthroughs/[playthroughId]/participation/route.ts`

---

## FT-008 - Creator Studio

**Status:** MAINLINE
**Program or subsystem:** Studio

Creator Studio supports protected Chronicle authoring, graph editing, previews, and controlled archive actions.

### Important subfeatures

- Chronicle library
- Block graph editing
- Optimistic autosave
- Accessible movement controls
- Whole-Passage drag reordering and additive or range selection
- Published Passage opening, leaving, and active-state motion presets
- Plain-language validation findings with blocking and attention severity presentation
- Draft preview sessions

### Primary surfaces

`/studio`

### Evidence

- path: `src/chronicle/studio-service.ts`
- path: `src/chronicle/api.ts`

---

## FT-009 - Twenty-Three-Type Story Block System

**Status:** MAINLINE
**Program or subsystem:** Studio

Strict versioned contracts define all twenty-three Story Block types with canonical parsing and serialization, typed variables and bounded expressions, deterministic content migration, stable issues, and compatibility-safe validation.

### Important subfeatures

- Strict configuration, presentation, and completion contracts
- Canonical parsing and deterministic serialization
- Typed variable scopes, operations, usage indexing, and safe rename propagation
- Typed deterministic expression AST, checking, and bounded evaluation
- Versioned migration registry with frozen historical compatibility fixtures
- Stable issues and incremental validation with current Studio and runtime compatibility

### Primary surfaces

`/studio/chronicles/[id]`

### Meaningful limitations

- Whole-Chronicle static analysis, repair and waiver workflows, and simulation remain outside Phase 1.
- Provider contracts without configured owner adapters remain explicitly unavailable.

### Evidence

- path: `src/drydock/index.ts`
- path: `src/drydock/contracts/registry.ts`
- test: `src/drydock`
- completion-record: `Development_Docs/Projects/Project Drydock/Project_Drydock_Phase_1_Completion_Receipt.md`

---

## FT-010 - Immutable Publishing, Editions, and Forks

**Status:** MAINLINE
**Program or subsystem:** Studio

Published Chronicle versions are immutable checksummed editions that active Voyages can pin safely.

### Important subfeatures

- Graph validation
- Immutable snapshots
- Checksums
- Edition comparison
- Fork provenance

### Primary surfaces

`/studio/chronicles/[id]/versions`

### Evidence

- path: `src/chronicle/publishing.ts`
- path: `src/chronicle/validation.ts`

---

## FT-011 - Asset Library and Media Pipeline

**Status:** MAINLINE
**Program or subsystem:** Studio

Creators manage validated reusable assets and safe derivative media through a version-aware library.

### Important subfeatures

- MIME and magic-byte validation
- Checksums
- Derivative variants
- Usage lookup
- Authorized originals

### Primary surfaces

`/studio/assets`

### Evidence

- path: `src/chronicle/assets.ts`
- path: `src/private-content/media-validation.ts`

---

## FT-012 - Waypoint and Reference Library

**Status:** MAINLINE
**Program or subsystem:** Studio

Reusable Waypoints and references support authored directions and future provider integration without exposing private notes.

### Important subfeatures

- Searchable Waypoints
- Reference collections
- Positive and negative references
- Published snapshots
- Player-safe projection

### Primary surfaces

`/studio/waypoints`

### Evidence

- path: `src/domain/story.ts`
- path: `src/chronicle/publishing.ts`

---

## FT-013 - Chronicle Artifact Definitions

**Status:** MAINLINE
**Program or subsystem:** Studio

Creators define reusable artifacts with visual, collection, relationship, and published-edition metadata.

### Important subfeatures

- Artwork and reveal media
- Inventory category
- Assembly metadata
- Artifact relationships
- Published capture

### Primary surfaces

`/studio/artifacts`

### Evidence

- path: `src/domain/story.ts`
- path: `src/chronicle/publishing.ts`

---

## FT-014 - Authoritative Progression Engine

**Status:** MAINLINE
**Program or subsystem:** Studio and One Voyage

One transaction-aware progression engine evaluates authored rules and emits ordered canonical Voyage events.

### Important subfeatures

- Monotonic sequence
- Idempotency keys
- Typed variables
- Rule evaluation
- Transactional notifications

### Primary surfaces

`/api/voyages`, `/captain`

### Evidence

- path: `src/chronicle/progression.ts`
- path: `src/server/progression.ts`

---

## FT-015 - Canonical Player Journal

**Status:** MAINLINE
**Program or subsystem:** Player

A Player-safe Journal represents active and historical Chronicles with physical and accessible reading modes.

### Important subfeatures

- Secret-filtered page model
- Stable page identity
- Physical PageFlip reader
- Reduced-motion fallback
- Historical presentation

### Primary surfaces

`/player/playthroughs/[playthroughId]/journal`

### Evidence

- path: `src/chronicle/journal-page-model.ts`
- path: `src/chronicle/journal-contract.ts`

---

## FT-016 - Voyage Chart

**Status:** MAINLINE
**Program or subsystem:** Player

The Player chart presents safe geography, progression, revealed routes, and current objectives.

### Important subfeatures

- Authored locations
- Reveal state
- Route progression
- Player-safe labels
- Reduced-motion chart state

### Primary surfaces

`/player/playthroughs/[playthroughId]/journal`

### Evidence

- path: `src/domain/story.ts`
- path: `src/chronicle/api.ts`

---

## FT-017 - Treasure Altar and Artifact Reveal

**Status:** MAINLINE
**Program or subsystem:** Player

Awarded artifacts have authoritative reveal, inspection, collection, and fallback presentation states.

### Important subfeatures

- Unknown through awarded states
- Collection grants
- Artifact relationships
- Inspection behavior
- Server-confirmed success

### Primary surfaces

`/player/playthroughs/[playthroughId]/journal`

### Evidence

- path: `src/chronicle/progression.ts`
- path: `src/domain/story.ts`

---

## FT-018 - Side-Quest Ledger

**Status:** MAINLINE
**Program or subsystem:** Player

Optional Chronicle branches retain independent discovery, progression, reward, and completion behavior.

### Important subfeatures

- Optional objectives
- Waypoint and artifact links
- Captain commands
- Player filters
- Replay-safe presentation

### Primary surfaces

`/player/playthroughs/[playthroughId]/journal`

### Evidence

- path: `src/domain/story.ts`
- path: `src/chronicle/progression.ts`

---

## FT-019 - Ship's Log

**Status:** MAINLINE
**Program or subsystem:** Player

A readable, filterable, Player-safe event history records the Voyage's ordered narrative and operational moments.

### Important subfeatures

- Ordered event history
- Captain annotations
- Read state
- Search and filters
- Realtime insertion

### Primary surfaces

`/player/playthroughs/[playthroughId]/journal`

### Evidence

- path: `src/domain/ships-log.ts`
- path: `src/platform/player-event-stream.ts`

---

## FT-020 - Finale Chamber

**Status:** MAINLINE
**Program or subsystem:** Player

The finale has explicit protected release states and replay behavior that never repeats authoritative mutation.

### Important subfeatures

- Sealed and unlocked states
- Requirement progress
- Captain controls
- Static fallback
- Nonmutating replay

### Primary surfaces

`/player/playthroughs/[playthroughId]/journal`

### Evidence

- path: `src/chronicle/progression.ts`
- path: `src/animation/scenes/story.scene.ts`

---

## FT-021 - Realtime Delivery, Presence, and Replay

**Status:** MAINLINE
**Program or subsystem:** Player

Authenticated event delivery separates durable server replay from observed and acknowledged Player presentation.

### Important subfeatures

- Authenticated SSE
- Durable replay
- Idempotent acknowledgment
- Access revalidation
- Polling fallback

### Primary surfaces

`/api/player/[campaignSlug]/events`, `/api/player/[campaignSlug]/presence`, `/player/playthroughs/[playthroughId]/journal`

### Evidence

- path: `src/platform/player-event-stream.ts`
- path: `src/domain/replay.ts`

---

## FT-022 - Project Lanternwake Cinematic System

**Status:** MAINLINE
**Program or subsystem:** Lanternwake

A governed cinematic runtime coordinates authored presentation while preserving server truth, accessibility, cleanup, and scene ownership.

### Important subfeatures

- AnimationDirector and scene contracts
- Scoped target resolution
- Semantic presentation receipts
- Authoritative replay queue
- Reduced-motion static fallbacks
- Lifecycle leak validation

### Primary surfaces

`/player`, `/captain`, `/dev/animations`

### Evidence

- path: `src/animation`
- completion-record: `Development_Docs/Programs/Lanternwake/Project_Lanternwake_Completion_Receipt.md`

---

## FT-023 - Verification Provider Framework

**Status:** MAINLINE
**Program or subsystem:** One Voyage

A narrow versioned verification boundary accepts trusted evidence without giving helpers or providers unrestricted progression control.

### Important subfeatures

- Bound verification requests
- Versioned evidence envelope
- Idempotent recovery
- Captain override
- Development simulator

### Primary surfaces

`/api/helper/verification`, `/captain/sessions/[sessionId]`

### Meaningful limitations

- Real camera capture and recognition are not implemented.

### Evidence

- path: `src/server/progression.ts`
- path: `src/domain/story.ts`

---

## FT-024 - Project Sealed Hold Private Chronicle Protection

**Status:** MAINLINE
**Program or subsystem:** Sealed Hold Phases 1 through 4

The public engine can import, store, deliver, recover, and govern protected Chronicle packages and media without placing private story content in the repository.

### Important subfeatures

- Authenticated encrypted package format
- Streaming package handling
- Import review and rollback
- Content-addressed protected objects
- Fail-closed scanner states
- Protected media delivery
- Durable operations, backup, restore, and repair
- Key lifecycle safeguards
- Opaque grants, consent, derivatives, and withdrawal

### Primary surfaces

`/studio/private-content`, `CLI`

### Evidence

- path: `src/private-content/package.ts`
- completion-record: `Development_Docs/Project_Sealed_Hold_Phase_4_Completion_Receipt.md`

---

## FT-025 - Project Harborlight Community Exchange

**Status:** MAINLINE
**Program or subsystem:** Harborlight Phases 1 through 4

A governed community system supports immutable reusable Chronicle packages, licensing, attribution, installation, remix lineage, discovery, consent-aware social projections, and durable moderated operations.

### Important subfeatures

- Stable listings and immutable releases
- Spoiler and visibility controls
- License and attribution snapshots
- Scanner-gated packages
- Rollback-safe installation
- Remix lineage
- Discovery and search projections
- Reviews, comments, reports, and collections
- Consent-aware keepsakes and voyage logs
- Durable moderation cases, actions, sanctions, appeals, and governed restoration
- Fail-closed scanner receipts and quarantine eligibility
- Durable worker, scheduler, database rate limiting, and logical backup operations

### Primary surfaces

`/community`, `/studio/exchange`

### Evidence

- path: `src/community/exchange-service.ts`
- completion-record: `Development_Docs/Project_Harborlight_Phase_3_Completion_Report.md`
- completion-record: `Development_Docs/Project_Harborlight_Phase_4_Completion_Receipt.md`
- completion-record: `Development_Docs/Project_Harborlight_Phase_4_Mainline_Integration_Receipt.md`

---

## FT-026 - Universal Language and Chronicle Design System

**Status:** MAINLINE
**Program or subsystem:** Universal Language

A shared product language and accessible visual system joins Player, Captain, Creator, Community, private operations, and cinematic surfaces.

### Important subfeatures

- Canonical terminology
- Role-aware shell
- Responsive navigation
- Keyboard-first controls
- Reduced-motion alternatives
- Resilient state presentation

### Primary surfaces

`/`, `/player`, `/captain`, `/studio`

### Evidence

- path: `src/language/canonical-terms.ts`
- path: `src/components/shell/ProductShell.tsx`

---

## FT-027 - Security and Privacy Platform

**Status:** MAINLINE
**Program or subsystem:** Security

Authorization, safe projections, transport protection, and private-content controls are integrated across product systems.

### Important subfeatures

- Hash-only credentials
- Explicit projection boundaries
- Rate limiting
- Optimistic concurrency
- Private-content scanning

### Primary surfaces

`/account/security`, `/api`

### Evidence

- path: `src/lib/security.ts`
- path: `scripts/private-content/scan.ts`

---

## FT-028 - Validation, Local Development, and Operational Tooling

**Status:** MAINLINE
**Program or subsystem:** Operations

The repository provides repeatable local setup, parity checks, release validation, and operational rehearsal tooling.

### Important subfeatures

- One-command development runtime
- Prisma migration generation
- SQLite and MySQL parity
- Static and browser validation
- Controlled restart proof

### Primary surfaces

`npm scripts`, `scripts/test-all.ps1`

### Evidence

- path: `scripts/test-all.ps1`
- path: `scripts/prepare-validation-isolation.ts`

---

## FT-029 - True North Role-Aware Navigation Shell

**Status:** MAINLINE
**Program or subsystem:** True North

A persistent, accessible navigation shell provides role-aware workspace routing without weakening authorization boundaries.

### Important subfeatures

- Persistent workspace navigation
- Role-aware destinations
- Keyboard and reduced-motion support
- Responsive information hierarchy

### Primary surfaces

`/`, `/player`, `/captain`, `/studio`

### Evidence

- path: `src/components/shell/ProductShell.tsx`
- completion-record: `Development_Docs/Project_True_North_Completion_Receipt.md`

---

## FT-030 - Personal Chronicle History

**Status:** MAINLINE
**Program or subsystem:** Wayfarer Phase 3

Private, version-pinned Voyage history preserves personal records, reflections, keepsakes, and consent-aware participant context.

### Important subfeatures

- Personal Chronicle records
- Version and participant snapshots
- Lifecycle and timing history
- Private reflections
- Consent grants and revocation

### Primary surfaces

`/passport/history`

### Evidence

- path: `src/wayfarer/chronicle-history.ts`
- completion-record: `Development_Docs/Project_Wayfarer_Phase_3_Completion_Receipt.md`

---

## FT-031 - Artifact Cabinet and Achievements

**Status:** MAINLINE
**Program or subsystem:** Wayfarer Phase 4

Person-level artifact provenance, custody, display, assembly, and achievements remain separate from shared Voyage inventory.

### Important subfeatures

- Immutable grant receipts
- Recipient-policy evidence
- Personal artifact records
- Display cases
- Assembly recipes
- Versioned achievements

### Primary surfaces

`/passport/artifacts`

### Evidence

- path: `src/wayfarer/artifacts.ts`
- path: `prisma/migrations/20260725120000_wayfarer_phase4_artifacts_achievements/migration.sql`

---

## FT-032 - Ledgerlight Documentation Governance and Feature Catalog

**Status:** MAINLINE
**Program or subsystem:** Ledgerlight

Audience-separated current documentation, indexed engineering records, and a fragment-driven capability catalog keep mainline claims reviewable.

### Important subfeatures

- Audience and canonical-topic governance
- Generated engineering-record index
- Historical archive classification
- Machine-readable capability fragments
- Generated Feature Catalog validation

### Primary surfaces

`docs`, `Development_Docs`, `npm run docs:validate`, `npm run features:validate`

### Evidence

- path: `scripts/validate-documentation.mjs`
- path: `scripts/features/build-feature-catalog.ts`

---

## FT-033 - Sounding Line Governed Verification Control Plane

**Status:** MAINLINE
**Program or subsystem:** Sounding Line Phases 1-4

A nonauthoritative, provider-neutral local verification control plane provides sealed plans, reviewed adapters, marker-verified resource leases, durable history, fail-closed worker and evidence controls, isolated SQLite/browser state, and narrowly certified Harborlight moderator browser lanes without weakening release authority.

### Important subfeatures

- Deterministic signed-identity plan records
- Fixed command adapter catalogue with bounded receipts
- Marker and process-identity ownership proof
- Deterministic impact analysis, history, and root/cascade classification
- Fail-closed local worker enrollment, sealed assignments, evidence, and attestations
- Immutable SQLite baseline clone boundary
- Two isolated Harborlight Phase 4 browser lanes
- Explicit emergency-serial legacy release authority

### Primary surfaces

`npm run test:policy`, `scripts/sounding-line`, `scripts/test-all.ps1`

### Evidence

- path: `scripts/sounding-line/runtime.mjs`
- path: `scripts/sounding-line/adapters.mjs`
- path: `scripts/sounding-line/phase3.mjs`
- path: `scripts/sounding-line/phase4.mjs`
- completion-record: `Development_Docs/Programs/Sounding_Line/Project_Sounding_Line_Final_Program_Closeout_Receipt.md`

---

## FT-034 - Bridgewatch Development Mission Control

**Status:** MAINLINE
**Program or subsystem:** Project Bridgewatch Phase 1

A private, standalone, read-only development mission-control dashboard projects explicit project truth and GitHub repository state without acquiring authority over source, pull requests, tests, releases, or project completion.

### Important subfeatures

- Loopback-first Fastify service with a static dashboard
- Server-side read-only GitHub collection with conditional cache retention
- SQLite-backed local operational cache without token persistence
- Explicit measured versus unmeasured milestone progress
- Read-only API routes, security headers, and no dashboard controls

### Primary surfaces

`bridgewatch`, `GET /api/summary`, `GET /api/projects`, `GET /api/attention`

### Meaningful limitations

- Phase 1 does not ingest Sounding Line worker, queue, node, or finalizer telemetry.
- Private deployment and operator acceptance remain separate from mainline integration.

### Evidence

- branch: `codex/project-bridgewatch-phase1-raise-the-board`
- commit: `8fe1d5b416d96142815b747920ed3b1556cffbf5`
- path: `bridgewatch/lib/server.ts`
- completion-record: `Development_Docs/Project_Bridgewatch_Phase_1_Design_Record.md`

---

## FT-035 - Bridgewatch Governed Signal Projection

**Status:** MAINLINE
**Program or subsystem:** Project Bridgewatch Phase 2

A private Bridgewatch extension that projects explicit Project Registry and Sounding Line observer evidence into durable local operational state while keeping test, release, merge, and project-completion authority outside the dashboard.

### Important subfeatures

- Read-only Sounding Line runtime projection with explicit lifecycle normalization
- Durable SQLite worker, test-node, and test-run history with idempotent migrations
- Opt-in bearer-authenticated activity telemetry with rate, skew, stale-state, and credential-redaction controls
- Lifecycle tabs, project biography, worker/test summaries, responsive layout, and reduced-motion support

### Primary surfaces

`bridgewatch`, `POST /api/telemetry/heartbeat`, `GET /api/history`, `GET /api/tests`

### Meaningful limitations

- Bridgewatch remains an observer and cannot create, approve, merge, retry, or authorize work.
- Mainline integration does not claim a private deployment, provider proof, or owner-acceptance record.

### Evidence

- commit: `9b950a5fd603be27c813f9298b0b14888fbce6cf`
- path: `bridgewatch/lib/store.ts`
- path: `bridgewatch/src/sounding-line.ts`
- test: `bridgewatch/test/sounding-line.test.ts`
- completion-record: `Development_Docs/Project_Bridgewatch_Phase_2_Completion_Receipt.md`

---

## FT-B001 - Unified Identity and Session Authority

**Status:** MAINLINE
**Program or subsystem:** Project Homeport Phase 1

One server-resolved account session now drives current-user state, ordinary Player, Captain, and Creator workspace entry, resource-scoped authorization, lifecycle invalidation, and bounded legacy-session rotation across product surfaces.

### Important subfeatures

- Canonical AccountSession current-user projection
- One ordinary account sign-in lifecycle
- Explicit workspace capability decisions
- Canonical Captain and Creator authorization with per-resource ownership and scoped collaboration
- Cross-tab and focus session invalidation
- Safe intended-return authorization
- Bounded legacy Player and staff session rotation

### Primary surfaces

`/sign-in`, `/register`, `/api/auth/context`, `/player/sign-in`, `/captain/sign-in`, `/studio/sign-in`, `/passport`

### Meaningful limitations

- Available on main through protected PR #9; deployment and owner acceptance remain separate
- Legacy global-session readers remain observe-and-rotate compatibility paths
- Deployment, live-user validation, and owner acceptance are not established
- Owner Re-Review Round 3 remains PENDING_OWNER_DECISION

### Evidence

- commit: `43c0fdc701de1425e651acb06924051fbd3a4a34`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_1_Validation_Record.md`
- path: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_1_Compatibility_Cutover_Ledger.csv`

---

## FT-B002 - Global Shell and Wayfinding

**Status:** MAINLINE
**Program or subsystem:** Project Homeport Phase 2

One route-classified product shell now provides global, workspace, account, and contextual wayfinding with equivalent desktop/mobile destinations and safe focused-surface exits.

### Important subfeatures

- Eight-mode exclusive page-shell classification
- One four-layer navigation registry and projection
- Structured anonymous and authenticated account orientation
- Capability-projected workspace switching without second sign-in
- Equivalent desktop and mobile functional destinations
- Governed compact and immersive workspace exits
- Global Community Harbor and Explore Chronicles reachability

### Primary surfaces

`/`, `/tales`, `/community`, `/player/library`, `/captain/library`, `/studio/library`, `/passport`

### Meaningful limitations

- Available on main through protected PR #9; deployment and owner acceptance remain separate
- Not deployed; live-user validation and owner acceptance are not established
- Owner Re-Review Round 3 remains PENDING_OWNER_DECISION

### Evidence

- commit: `ce9fd8e70f0e906416cf41cd508ec5f2063570cc`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_2_Validation_Record.md`
- test: `tests/e2e/homeport-phase2.spec.ts`

---

## FT-B003 - Personal Harbor and Chronicle Passport

**Status:** MAINLINE
**Program or subsystem:** Project Homeport Phase 3

A coherent Personal Harbor now separates public Profile projection from the private Chronicle Passport while unifying preferences, privacy, connected identities, history, Memories, artifacts, saved content, security, and sessions.

### Important subfeatures

- Persistent desktop and equivalent mobile Personal Harbor navigation
- Server-enforced public Profile projection and optimistic owner editing
- Typed experience, accessibility, notification, and privacy preferences
- Safe linked-identity summaries and protected unlinking
- Record-led Chronicle Passport with version-pinned history
- Owner-authorized Memories, participant-consented Keepsakes, and artifact provenance
- Eligible saved Community content with cross-surface reconciliation
- Separate Security, Sessions and Devices, and Data and Account surfaces
- Explicit unsaved, pending, success, failure, conflict, and dependency states

### Primary surfaces

`/account`, `/account/profile`, `/account/preferences`, `/account/privacy`, `/account/linked-identities`, `/account/security`, `/account/sessions`, `/account/data`, `/passport`, `/passport/history`, `/passport/memories`, `/passport/artifacts`, `/passport/saved`, `/profile/[handle]`

### Meaningful limitations

- Available on main through protected PR #9; deployment and owner acceptance remain separate
- Not deployed; live-user validation and owner acceptance are not established
- Live provider connections and external malware scanning remain externally unvalidated
- Export, deactivation, and account deletion remain truthfully unavailable where no accepted service exists
- Owner Re-Review Round 3 remains PENDING_OWNER_DECISION

### Evidence

- commit: `761adb7a693feabacc4e7d54d28d443ceda8a273`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_3_Validation_Record.md`
- test: `tests/e2e/homeport-phase3.spec.ts`

---

## FT-B004 - Community Harbor Discovery Library

**Status:** MAINLINE
**Program or subsystem:** Project Homeport Phase 4

A content-first Community Harbor now presents deterministic public shelves, governed districts, typed safe cards, URL-backed discovery, public detail families, and canonical save/follow state.

### Important subfeatures

- Content-first Community Harbor
- Curated and deterministic public shelves
- Governed district taxonomy
- Public-safe typed cards
- Search, sort, compact filters, and advanced filters
- Creator Profiles and public collections
- Chronicle, artifact, template, map, audio, Guide, and Voyage Log discovery according to supported contracts
- Canonical save and follow state
- Complete default, empty, no-result, unavailable, quarantined, and removed states
- Desktop and mobile Community parity

### Primary surfaces

`/community`, `/community/featured`, `/community/chronicles`, `/community/artifacts`, `/community/templates`, `/community/maps`, `/community/audio`, `/community/creators`, `/community/collections`, `/community/guides`, `/community/voyage-logs`

### Meaningful limitations

- Available on main through protected PR #9; deployment and owner acceptance remain separate
- Not deployed; live-user validation and owner acceptance are not established
- Unsupported provider or installation actions remain truthfully unavailable
- Owner Re-Review Round 3 remains PENDING_OWNER_DECISION

### Evidence

- commit: `06394221844c36921d95b1a199d72f18c88645ad`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_4_Validation_Record.md`
- test: `tests/e2e/homeport-phase4.spec.ts`

---

## FT-B005 - Governed Route Reachability Graph

**Status:** MAINLINE
**Program or subsystem:** Project Homeport Phase 5

A source-derived, permission-aware product graph now gives every ordinary route a visible natural entry while governing dynamic sources, tokenized handoffs, compatibility routes, parent and return behavior, and desktop/mobile parity.

### Important subfeatures

- Source-parity census for every app page and service route
- Exclusive classification for ordinary, contextual, tokenized, compatibility, development, and diagnostic routes
- Permission-aware gateway-rooted shortest paths
- Visible entry and direct-entry proof for every ordinary route
- Dynamic source, invalid-ID, private-denial, parent, and return contracts
- State-safe tokenized handoffs excluded from ordinary navigation
- Explicit redirect and canonical context-adapter dispositions
- Desktop/mobile destination and edge parity
- Touch, keyboard, effective 200 percent zoom, compact, and immersive exit proof
- Automated source-drift, cycle, dead-end, and ordinary-orphan enforcement

### Primary surfaces

`/`, `/tales`, `/community`, `/account`, `/passport`, `/player/library`, `/captain/library`, `/studio/library`, `/play/[taleSlug]/session/[sessionId]`, `/join/[token]`, `/tale/[campaignSlug]`

### Meaningful limitations

- Available on main through protected PR #9; deployment and owner acceptance remain separate
- Not deployed; live-user validation and owner acceptance are not established
- Evidence is local, synthetic, and uses a copied SQLite database
- Compatibility retirement remains owner-reviewed and traffic-dependent
- Owner Re-Review Round 3 remains PENDING_OWNER_DECISION

### Evidence

- commit: `b9f1552b78857c36a45f25eb5fdfb7a7e09f102a`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_5_Validation_Record.md`
- path: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_5_Route_Reachability_Graph.json`

---

## FT-B006 - Complete Product Surfaces and States

**Status:** MAINLINE
**Program or subsystem:** Project Homeport Phase 6

Every current human-facing screen is now source-inventoried with governed visual maturity, page-state, responsive, accessibility, motion, media-fallback, mutation-feedback, and source-bound visual-evidence contracts.

### Important subfeatures

- Source-parity acceptance registry for 92 current human-facing screens
- Normalized component-family governance across product areas
- Typed loading, populated, empty, no-result, recovery, dependency, permission, session, mutation, conflict, removed, media, and token states
- Critical-screen desktop, mobile, tablet, narrow-mobile, and effective-200-percent completion
- Keyboard, touch, focus, dialog, landmark, live-region, and automated accessibility contracts
- Reduced-motion and no-false-success motion authority
- Named media and scan-state fallbacks without raw object-key disclosure
- Visible mutation pending, success, failure, conflict, and authoritative-result feedback
- Checksum, source, fixture, viewport, and review-bound visual evidence
- Idempotent Phase 6 inventory, evidence, and Sounding Line policy publication

### Primary surfaces

`/`, `/sign-in`, `/player/library`, `/captain/library`, `/studio/library`, `/account`, `/account/profile`, `/passport`, `/community`, `/player/playthroughs/[playthroughId]`, `/captain/sessions/[sessionId]`, `/studio/tales/[taleId]`

### Meaningful limitations

- Available on main through protected PR #9; deployment and owner acceptance remain separate
- Evidence is local, synthetic, and uses a copied SQLite database
- Live storage, malware scanning, moderation providers, production MySQL, and deployment remain externally unvalidated
- Codex visual review is not owner acceptance or physical assistive-technology validation
- Owner Re-Review Round 3 remains PENDING_OWNER_DECISION

### Evidence

- commit: `e02ee0dae0469a2ba573beaf409c0b34e8668d09`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_6_Validation_Record.md`
- path: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_6_Screen_Acceptance_Registry.json`
- test: `tests/e2e/homeport-phase6.spec.ts`

---

## FT-B007 - Integrated Whole-Product Voyage and Owner Walkthrough

**Status:** MAINLINE
**Program or subsystem:** Project Homeport Phase 7

Project Homeport now includes the integrated Whole Voyage plus Owner Correction Rounds 1-3 and focused Patch A: governed Profile imagery and crop editing, identity propagation, atomic pending registration, six-digit registration verification, ordinary unverified sign-in, Resend production delivery with deterministic synthetic testing, one canonical Player, Captain, and Creator session separated from resource authority, generation-owned route crossfades, visible account-menu motion, and Dark defaults.

### Important subfeatures

- Immutable integrated synthetic seed with isolated automated and owner-walkthrough clones
- External task-owned credential and token handoff with no committed secrets
- A-through-O visible-control whole-product journey registry
- Cross-workspace canonical account and session continuity
- Profile, Passport, Community save, Player, Captain, and Creator integrated reconciliation
- Password recovery, session expiry, permission, multi-tab invalidation, and dependency recovery
- Desktop, mobile, keyboard focus, and reduced-motion journey proof
- Checksum, source, fixture, viewport, route, and visual-review-bound evidence
- Owned final production walkthrough runtime with safe prepare, status, reset, and stop controls
- Independent owner decision boundary that remains pending until personal review
- Public-safe Chronicle preview separated from the explicit Start Chronicle mutation boundary
- Chronicle-scoped participation aliases with signed-in display-name defaults and anonymous guest continuity
- One claimed account with Player, Captain, and Creator capability setup plus a server-owned active-Chronicle lock
- Claiming, primary email verification and change, recovery, and human-readable account state
- Secure Discord, Steam, and Microsoft/Xbox provider adapters with truthful unavailable configuration states
- Versioned export plus reauthenticated deactivation, reactivation, deletion, cancellation, and due processing
- Personal Harbor hierarchy with one Display Name authority, public Profile destination, Data and Account, and Sign Out
- Four visible effective preferences with legacy values preserved for ten removed inert controls
- Delayed loading, interruption-safe route and menu transitions, visible home ambience, first-paint stability, and reduced-motion completion
- Compact and expanded URL-backed Community search plus coherent responsive review creation and editing
- Correction Round 1 journeys A through U and original Phase 7 A through O rerun against the same exact source
- Correction Round 2 journeys A through W with retained Round 1 A-U and original Phase 7 A-O regressions
- Structurally stable role-card hover, animated account menu, balanced lantern swing, visible star and fog ambience, and reduced-motion completion
- Global Dark, Light, and System themes with pre-hydration selection and cross-product token coherence
- Sera fixture truth with Player, Captain, and Creator capability cards plus one public Profile identity
- Authoritative Community save counts, rating summaries, in-place reviews, completion eligibility, and Passport review-later entry
- Browseable Experience Images package with 227 checksummed desktop, mobile, theme, and major-state captures across 88 human-facing routes
- Task-owned synthetic email outbox with explicit non-claim of live delivery
- Interactive avatar and banner selection, preview, crop, replacement, removal, and normalized derivative lifecycle
- Profile avatar and banner propagation across Personal Harbor, account controls, and safe public identity projections
- Six-digit email-code registration with hashed expiry, attempts, resend replacement, and atomic account activation
- Provider-neutral transactional email with Resend production, task-owned synthetic, and dormant Postmark compatibility adapters
- Live-validated disposable Resend registration verification with provider acceptance, owner-controlled inbox receipt, code consumption, and active verified account state
- One ordinary AccountSession for Player, Captain, and Creator entry separated from Voyage, Chronicle, asset, invitation, helper, and collaboration authorization
- Active-Chronicle transition safety with authoritative true-lock and false-lock behavior
- Direct page crossfades with stable shell, 500 ms loading integration, focus handoff, and reduced motion
- Perceptible production account-menu opening and closing motion
- Dark anonymous and new-account defaults with broad Light visual completion deferred
- Correction Round 3 journeys A-V with retained Round 2 A-W, Round 1 A-U, and original Phase 7 A-O regressions
- Focused Patch A atomic pending registration with explicit display-name and email conflict recovery
- Accessible password strength and confirmation status with server-authoritative policy
- Ordinary verified or unverified account sign-in without an email-code challenge and with non-blocking verification follow-up
- Generation-owned 280 ms route crossfades with a 500 ms loading threshold, stale-generation invalidation, and background-only-frame prevention
- Patch A journeys A-N with selected Round 3 critical and original Phase 7 account/session regressions

### Primary surfaces

`/`, `/register`, `/sign-in`, `/account`, `/account/roles`, `/account/personal-information`, `/account/linked-identities`, `/account/data`, `/account/email-change`, `/account/preferences`, `/account/security`, `/account/sessions`, `/passport`, `/passport/history`, `/passport/memories`, `/passport/artifacts`, `/passport/saved`, `/community`, `/community/[slug]`, `/chronicles/[taleSlug]`, `/verify-email`, `/player/library`, `/captain/library`, `/studio/library`

### Meaningful limitations

- Available on main through protected PR #9; deployment remains separate
- Owner Re-Review Round 3 remains PENDING_OWNER_DECISION; focused Patch A readiness is not owner acceptance
- Broad Light Mode visual completion remains deferred
- Resend webhook deployment remains deferred and is not inferred from provider submission or inbox proof
- Production MySQL execution, non-email external-provider configuration, and physical assistive-technology validation remain external
- Readiness for owner re-review is not owner acceptance or product acceptance

### Evidence

- commit: `e1829c3cffa87e561d15342da2e6e9b073fd7165`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Validation_Record.md`
- path: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Integrated_Journey_Registry.json`
- test: `tests/e2e/homeport-phase7.spec.ts`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_1_Validation_Record.md`
- test: `tests/e2e/homeport-phase7-owner-correction-round1.spec.ts`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_2_Validation_Record.md`
- test: `tests/e2e/homeport-phase7-owner-correction-round2.spec.ts`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_3_Validation_Record.md`
- test: `tests/e2e/homeport-phase7-owner-correction-round3.spec.ts`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_7_Correction_Round_3_Patch_A_Validation_Record.md`
- test: `tests/e2e/homeport-phase7-owner-correction-round3-patch-a.spec.ts`
- path: `Experience_Images/manifest.json`
- commit: `320c25c3e49be58b36be43254be75548b32655a6`

---

## FT-B008 - Google and GitHub Account Authentication

**Status:** MAINLINE
**Program or subsystem:** Voyagewright OAuth

Voyagewright adds first-class Google and GitHub sign-up, sign-in, and explicit account linking to the canonical Homeport account, verified-email, external-identity, session, and security-event lifecycle.

### Important subfeatures

- Server-side OAuth authorization-code exchange with one-time state and S256 PKCE
- Google OpenID Connect signature, issuer, audience, authorized-party, nonce, time, subject, and verified-email validation
- GitHub immutable numeric identity plus primary or fallback verified-email validation
- Canonical AccountSession creation and returning-provider identity reuse
- Explicit signed-in account linking with no automatic email-based merge
- Verified provider email activation without a duplicate email-verification challenge
- Password authentication compatibility and last-login-method unlink protection
- Provider token discard and public-safe linked-identity projection
- Trusted public-origin post-callback redirects with internal-host and Host-header rejection
- Desktop and mobile deterministic browser lifecycle validation
- Owner-accepted real Google and GitHub sign-in and sign-up through protected staging

### Primary surfaces

`/register`, `/sign-in`, `/account/linked-identities`

### Meaningful limitations

- Protected staging is accepted; production provider configuration and production deployment remain separately governed and are not claimed
- Repeatable automated provider lifecycle evidence uses a deterministic non-production adapter; real Google and GitHub staging success is separately classified as owner-observed acceptance
- Live callback execution requires an OAuth-capable runtime plus correctly registered provider credentials at the exact configured redirect URIs

### Evidence

- path: `src/wayfarer/oauth.ts`
- test: `src/wayfarer/oauth.exchange.test.ts`
- test: `src/app/api/auth/providers/[provider]/callback/route.test.ts`
- test: `src/homeport/public-app-origin.test.ts`
- test: `tests/oauth/voyagewright-oauth.spec.ts`
- completion-record: `Development_Docs/Validation/Voyagewright_Google_GitHub_OAuth_Validation_Record.md`
- commit: `b4fa3b4b3f50e3f22f82adace3b287b9cadace8a`
- commit: `7675a9e3c02cb1bad18812c65010e9310d9b977c`

---

## FT-B009 - Tideglass Chronicle Edition Intelligence

**Status:** MAINLINE
**Program or subsystem:** Project Tideglass Phases 1-2

The accepted server-side foundation compares exact immutable Chronicle editions, classifies and summarizes evidence deterministically, projects spoiler-safe audience views, and preserves append-only Creator context without changing published or live Voyage truth.

### Important subfeatures

- Exact edition and checksum binding
- Versioned semantic normalization
- Stable identity and graph comparison
- Deterministic Change Sets and receipts
- Stable change codes and explainable significance
- Evidence-linked compatibility deltas
- Deterministic concise and detailed summaries
- Public, Player-safe, and Creator-full projections
- Append-only Creator annotation revisions
- Digest-validated rebuildable comparison cache
- Authorized bounded comparison and annotation APIs
- Read-only cross-domain invariance

### Primary surfaces

`npm run tideglass:compare`, `src/tideglass`, `/api/chronicles/:chronicleId/comparison`

### Meaningful limitations

- The accepted Phase 2 extension remains server-side and does not create a polished comparison experience.
- Ordinary user comparison routes, played-history qualification, and polished What Changed interaction remain outside Phase 2.
- Unknown historical semantics remain explicitly unavailable until an accepted Drydock reader can normalize them.

### Evidence

- path: `src/tideglass/service.ts`
- path: `src/tideglass/intelligence.ts`
- path: `src/tideglass/annotations.ts`
- test: `tests/tideglass`
- completion-record: `Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_1_Completion_Receipt.md`
- completion-record: `Development_Docs/Projects/Project_Tideglass/Project_Tideglass_Phase_2_Completion_Receipt.md`

---

## FT-B010 - Governed Platform Administration and Consented Support Access

**Status:** MAINLINE
**Program or subsystem:** Project Admiralty

Canonical account roles, recent privileged assurance, scoped user consent, sanitized audit evidence, and a limited administration shell establish least-privileged platform operations without creating a second identity authority.

### Important subfeatures

- Server-side role and capability resolution
- Explicit dry-run-first administrator bootstrap
- Session-bound recent privileged assurance
- User-approved target, operator, scope, and time-bounded Support Access
- Sanitized canonical administrative audit evidence
- Living 92-entry capability-floor registry
- Non-revealing unauthorized admin route behavior
- Additive SQLite and MySQL migration parity
- Task-owned synthetic browser and owner-walkthrough runtimes

### Primary surfaces

`/admin`, `/account/support-access`

### Meaningful limitations

- The owner accepted the complete governed Phase 1 walkthrough on 2026-08-09
- Owner-accepted Phase 1 implementation is integrated on canonical main with verified remote parity
- Production MySQL execution, live-provider behavior, and physical assistive-technology validation remain external
- Phase 2 and all later operational command-center capabilities remain dormant
- Owner acceptance does not imply deployment or acceptance of later Admiralty phases

### Evidence

- commit: `49c2f59d6d75791edbdba84f22f5ec1595d2d129`
- path: `src/admiralty/authorization.ts`
- path: `src/admiralty/support-access.ts`
- path: `Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Capability_Registry.json`
- test: `tests/e2e/admiralty-phase1.spec.ts`
- completion-record: `Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Completion_Receipt.md`
- completion-record: `Development_Docs/Projects/Project_Admiralty/Project_Admiralty_Phase_1_Owner_Decision_Record.md`

---

# Completed Branch Features Not Yet Available on Main

# Deliberately Excluded Until Complete

- Harborlight Phase 4 is planned and is not cataloged as an implemented capability.
- Project Sounding Line's local governance and verification control plane is cataloged, and its focused hosted workflow has passed; remote workers, provider/MySQL proof, production signing, branch protection, and the P34 browser matrix remain separate non-pass work.
- Project Landfall is governed but not implemented.
- Vision Waypoint recognition is not implemented beyond its provider seam and simulator.
- Production multi-instance pub/sub, distributed rate limiting, production scanner/KMS/storage/alerting, and full deployment proof remain separate work.
- Real private Chronicle story material is intentionally absent from the public repository.

# Catalog maintenance policy

Update the owning machine-readable fragment only when completed work changes a major capability, important subfeature, availability, or meaningful limitation. Regenerate this file with `npm run features:sync`; never hand-edit it. Validate before closeout with `npm run features:validate`.

Generation source commit: `920d92a51a16d60a2dfe35278598e6d921be7e4c`
