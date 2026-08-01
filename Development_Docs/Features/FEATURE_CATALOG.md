# Forever Treasure Feature Catalog

This generated catalog records completed, meaningful platform capabilities. It is not a changelog, task ledger, roadmap, or list of implementation trivia. Machine-readable fragments under `Development_Docs/Features/` are the source of truth.

## Audited repository and commit

Repository: `Kgray44/treasurehuntSoT`
Audited source commit: `8d142227d712d27e363b15903dba9b0c99a04bc8`

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

`/join`, `/player`

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

Captains create, launch, operate, recover, and reconcile live Voyages through authoritative commands.

### Important subfeatures

- Voyage creation wizard
- Crew readiness
- Command idempotency
- Pause and resume
- Operational audit trail

### Primary surfaces

`/captain`, `/captain/voyages/[id]`

### Evidence

- path: `src/server/admin-command.ts`
- path: `src/domain/admin.ts`

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

A stable registry defines reusable story blocks, validation, metadata, and safe unknown-type behavior.

### Important subfeatures

- Narrative and direction blocks
- Media and reveal blocks
- Interaction blocks
- Logic and completion blocks
- Safe diagnostic fallback

### Primary surfaces

`/studio/chronicles/[id]`

### Evidence

- path: `src/chronicle/block-registry.ts`
- path: `src/chronicle/types.ts`

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

`/player/voyages/[id]`

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

`/player/voyages/[id]/chart`

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

`/player/voyages/[id]/treasure`

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

`/player/voyages/[id]/ledger`

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

`/player/voyages/[id]/log`

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

`/player/voyages/[id]/finale`

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

`/api/player/events`, `/player`

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

`/api/verification`, `/captain`

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

`/tales`, `/studio/community`

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

# Completed Branch Features Not Yet Available on Main

## FT-B001 - Unified Identity and Session Authority

**Status:** BRANCH COMPLETE NOT MERGED
**Program or subsystem:** Project Homeport Phase 1

One server-resolved account session now drives current-user state, workspace capability, lifecycle invalidation, and bounded legacy-session rotation across product surfaces.

### Important subfeatures

- Canonical AccountSession current-user projection
- One ordinary account sign-in lifecycle
- Explicit workspace capability decisions
- Cross-tab and focus session invalidation
- Safe intended-return authorization
- Bounded legacy Player and staff session rotation

### Primary surfaces

`/sign-in`, `/register`, `/api/auth/context`, `/player/sign-in`, `/captain/sign-in`, `/studio/sign-in`, `/passport`

### Meaningful limitations

- Not available on main until separately reviewed and integrated
- Legacy global-session readers remain observe-and-rotate compatibility paths
- Deployment, live-user validation, and owner acceptance are not established
- Gateway navigation, account-menu reconstruction, and Passport visual reconstruction remain later phases

### Evidence

- commit: `43c0fdc701de1425e651acb06924051fbd3a4a34`
- completion-record: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_1_Validation_Record.md`
- path: `Development_Docs/Projects/Project_Homeport/Project_Homeport_Phase_1_Compatibility_Cutover_Ledger.csv`

---

# Deliberately Excluded Until Complete

- Harborlight Phase 4 is planned and is not cataloged as an implemented capability.
- Project Sounding Line's local governance and verification control plane is cataloged, and its focused hosted workflow has passed; remote workers, provider/MySQL proof, production signing, branch protection, and the P34 browser matrix remain separate non-pass work.
- Project Landfall is governed but not implemented.
- Vision Waypoint recognition is not implemented beyond its provider seam and simulator.
- Production multi-instance pub/sub, distributed rate limiting, production scanner/KMS/storage/alerting, and full deployment proof remain separate work.
- Real private Chronicle story material is intentionally absent from the public repository.

# Catalog maintenance policy

Update the owning machine-readable fragment only when completed work changes a major capability, important subfeature, availability, or meaningful limitation. Regenerate this file with `npm run features:sync`; never hand-edit it. Validate before closeout with `npm run features:validate`.

Generation source commit: `8d142227d712d27e363b15903dba9b0c99a04bc8`
