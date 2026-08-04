---
title: Project Homeport Phase 6 Product Surface Completion Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-6-product-surface-completion-architecture
last_reviewed: 2026-08-04
---

# Project Homeport Phase 6 product surface completion architecture

## Decision and boundary

Phase 6 completes the visual and behavioral presentation of every current
product surface on `codex/project-homeport-product-reality-recovery`. The
frozen source boundary is the clean preparation commit
`54a8470e2274fcbd37f18487c09b0d198f09265d`. The branch is 59 commits ahead of
and zero commits behind its merge base with `origin/main`,
`8d142227d712d27e363b15903dba9b0c99a04bc8`.

The current App Router census contains 85 page sources, 174 route-handler
sources, six layouts, one route-owned error boundary, one route-owned loading
boundary, and no route-owned not-found boundary. The 85-page count, rather than
the historical screen total, is the Phase 6 page-source authority. Shared shell
states and seven cross-product state contracts are separately governed and are
not counted as additional page routes.

Phase 6 owns integration, visual completion, reusable presentation structure,
complete page-state contracts, responsive behavior, accessibility, focus,
mutation feedback, media fallback, and source-bound visual acceptance. It does
not replace specialist business authority, create a second session or
navigation system, rewrite accepted cinematic surfaces, invent provider
availability, or start Phase 7 integrated product proof.

## Authority and ownership

| Concern                              | Authority                         | Phase 6 responsibility                                                           |
| ------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------- |
| Identity, session, Profile, Passport | Wayfarer and Homeport Phase 1/3   | Preserve canonical typed states and present them completely.                     |
| Shell and route semantics            | True North and Homeport Phase 2/5 | Preserve one classifier, registry, shell, and safe return graph.                 |
| Runtime and Chronicle truth          | One Voyage                        | Render authoritative projections without adding writers.                         |
| Community data and policy            | Harborlight                       | Use allowlisted public projections and preserve fail-closed states.              |
| Private and protected media          | Sealed Hold                       | Present only governed derivatives and safe typed media states.                   |
| Motion and immersive presentation    | Lanternwake                       | Reuse its director, modes, lifecycle, and static fallbacks.                      |
| Product language                     | Voyagewright Universal Language   | Keep canonical visible terms while preserving technical compatibility names.     |
| Test selection and release decisions | Sounding Line                     | Add Phase 6 contracts; accept only authoritative subsystem/mainline decisions.   |
| Cross-product screen acceptance      | Homeport Phase 6                  | Own the registries, matrices, evidence, human review, and HP-NC-018 disposition. |

Structural reuse must not erase domain meaning. Shared cards, panels, status
regions, or form primitives retain their product-area copy, metadata,
permissions, and actions.

## Source-driven census

`scripts/homeport/phase6-screen-census.mjs` will discover every current
`src/app/**/page.tsx`, `loading.tsx`, `error.tsx`, and `not-found.tsx` source.
The Phase 5 route census and node registry supply stable route IDs,
classification, shell mode, logical parent, capability, and reachability.
Phase 6 adds shared-shell, dialog, drawer, disclosure, state-panel, major-card,
table/list/grid, immersive, compatibility, and development-surface inspection.

The generated census is deterministic. A newly added or removed page or
boundary makes the validator fail until the screen acceptance registry and
applicable matrices are regenerated. A page source may map to one primary
screen record; token variants can use state records under that screen rather
than duplicate page ownership. The development animation route remains
explicitly `DEVELOPMENT_ONLY` and cannot count toward ordinary completion.

## Criticality

The allowed values are `CRITICAL`, `HIGH`, `STANDARD`, `CONTEXTUAL`,
`DEVELOPMENT_ONLY`, and `NOT_APPLICABLE`.

- `CRITICAL` covers the gateway, account lifecycle, primary workspace
  landings, Personal Harbor and Passport landings, Community Harbor, primary
  detail flows, security/session management, active Chronicle, permission and
  recovery states, and owner-walkthrough paths.
- `HIGH` covers important secondary ordinary screens and high-consequence
  workspace tools.
- `STANDARD` covers lower-risk ordinary supporting screens.
- `CONTEXTUAL` covers narrow dynamic details, tokenized entry, compatibility,
  and recovery adapters whose meaning depends on a parent or token state.
- `DEVELOPMENT_ONLY` covers named diagnostics excluded from ordinary
  navigation and production completion counts.
- `NOT_APPLICABLE` is reserved for a registry record that is intentionally not
  a user screen; it cannot hide a current page source.

Critical screens require desktop, mobile, keyboard, automated accessibility,
applicable high-risk state, and human-review evidence. High screens require
desktop and mobile evidence, responsive/state proof, accessibility checks, and
human review. Standard screens require one primary capture, desktop/mobile
layout assertions, state contracts, and representative review. Contextual
screens require direct-entry context, parent/return, relevant failure state,
responsive semantics, and representative evidence.

## Visual maturity

Final values are `VISUALLY_COMPLETE`,
`COMPLETE_WITH_TRUTHFUL_EXTERNAL_LIMITATION`, `DEVELOPMENT_ONLY`,
`NOT_APPLICABLE`, and `BLOCKED_WITH_GOVERNED_REASON`. Historical values
`COMPLETE`, `PARTIAL`, `SKELETAL`, `PLACEHOLDER`, `BROKEN`, `UNREACHABLE`, and
`INTERNAL_ONLY` remain readable so prior observations are not rewritten.

At closure no critical or high ordinary screen may retain an incomplete final
value. `COMPLETE_WITH_TRUTHFUL_EXTERNAL_LIMITATION` is allowed only when the UI
is itself complete and the external dependency is visibly, safely, and
accurately unavailable. An internal implementation gap is never converted to
an external limitation.

## Complete state vocabulary

The required state vocabulary is `INITIAL_LOADING`, `STREAMING_LOADING`,
`READY_POPULATED`, `READY_EMPTY`, `NO_RESULTS`, `AUTH_REQUIRED`,
`SESSION_EXPIRED`, `SESSION_REVOKED_OR_INVALID`, `ACCOUNT_RESTRICTED`,
`PERMISSION_RESTRICTED`, `DEPENDENCY_UNAVAILABLE`, `OFFLINE_OR_DEGRADED`,
`RECOVERABLE_ERROR`, `PARTIAL_MEDIA_FAILURE`, `MUTATION_PENDING`,
`MUTATION_SUCCESS`, `MUTATION_FAILURE`, `STALE_CONFLICT`, `RATE_LIMITED`,
`ARCHIVED_OR_REMOVED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_CONSUMED`,
`TOKEN_REVOKED`, and `NOT_APPLICABLE`.

Each applicable screen/state pair records its trigger, data authority, visual
composition, message, actions, recovery, parent, focus target, live-region
behavior, privacy rule, mobile and reduced-motion treatment, tests, evidence,
and final status. Loading, empty, no-results, authentication, permission,
session, restriction, unavailable, and error states remain semantically and
visually distinct.

## Screen acceptance registry

`Project_Homeport_Phase_6_Screen_Acceptance_Registry.json` is the Phase 6
screen acceptance authority. Each record carries stable screen and route IDs,
source files, product and specialist/integration ownership, shell and parent
context, criticality, goal and heading, actions, projection, component
families, applicable states, viewports, keyboard/touch/focus/motion/media/
overflow contracts, recovery actions, evidence, review and accessibility
status, exact source SHA, fixture version, maturity, limitations, and test
contract IDs.

The validator rejects duplicate IDs or source mapping, invalid routes or
owners, missing ordinary pages, private DTOs on public screens, stale source
bindings, incomplete critical evidence, missing parent/shell context, or a
development surface counted as ordinary.

## Component-family ownership

`Project_Homeport_Phase_6_Component_Family_Registry.json` governs global
headers and footers; account controls and menus; workspace, section, district,
breadcrumb, and exit navigation; profile heroes; settings and form structures;
error summaries and mutation status; content shelves; Chronicle, Community,
Voyage, history, artifact, Creator, and collection cards; filters and search;
badges and metadata; tabs and disclosures; loading, empty, no-result,
unavailable, permission, archived, and token panels; dialogs, confirmations,
status regions, pagination, and media fallbacks.

Each family identifies its owner, source components, design tokens, semantic,
state, responsive, motion, reduced-motion, and accessibility contracts,
consumers, deprecated duplicates, tests, and evidence. A deprecated duplicate
may remain only outside ordinary use or behind a documented compatibility
boundary.

## Design-system completion

Phase 6 extends the current Voyagewright token and material system rather than
redesigning the brand. Typography, measure, spacing, gutters, widths, card
rhythm, borders, radii, elevation, focus, interaction states, semantic colors,
parchment surfaces, overlays, skeletons, media frames, and breakpoints are
normalized through shared tokens and families. Gateway, Personal Harbor,
Community Harbor, and Chronicle presentation retain distinct accepted visual
identity.

Ordinary surfaces may not expose raw JSON, enum values, IDs, provider subjects,
object keys, implementation checklists, default unstyled controls, inert
mutations, ungoverned tables, blank panels, or development diagnostics. The
automated raw-surface gate is a conservative supplement to DOM assertions and
human review.

## Responsive and overflow policy

The governed viewport families are large desktop `1600x1000`, standard desktop
`1440x900`, compact desktop `1280x720`, tablet landscape `1024x768`, tablet
portrait `768x1024`, modern mobile `390x844`, narrow mobile `320x568`, and
effective 200 percent zoom modeled with a `720x450` layout viewport rather than
CSS zoom.

Mobile can reorganize but cannot remove capability. Tests reject accidental
document-level horizontal overflow, clipped controls, off-viewport menus,
sticky overlap, unreadable sidebars or forms, hover-only actions, distorted
media, unbounded dialogs, or tiny touch targets. Tables and intentional
horizontal shelves require bounded scroll containers and visible semantics.
Body scroll locks and restores for drawers/dialogs; route changes and anchors
land outside sticky headers; PageFlip and immersive scroll remain under their
specialist owner.

## Accessibility and focus

Every critical and high screen records title, one `h1`, landmarks, named
navigation, heading order, control names/descriptions, error association, live
regions, focus order, entry focus, menu/dialog focus, focus restoration,
keyboard behavior, touch targets, current-state semantics, non-color and
non-motion meaning, media alternatives, zoom, automated scan, and evidence.
Representative critical surfaces require zero serious or critical automated
violations. Moderate/minor findings require an explicit disposition.

Task-oriented keyboard checks cover gateway entry, global and mobile
navigation, all primary workspaces, Personal Harbor editing, Community search
and save, dialogs, permission/token recovery, and compact/immersive exits.
Screen-reader-oriented proof covers role, name, description, heading, live
state, focus target, and current-state indicators. Phase 6 will not claim
physical screen-reader testing unless it is actually performed.

Route entry focuses destination context. Opening a drawer or dialog contains
focus and removes background controls from keyboard reach. Escape and close
restore the trigger where appropriate. Validation focuses a summary or first
invalid field. Success does not steal focus unnecessarily. Failure and stale
conflict keep recoverable input. Unmount and route changes cannot strand focus.

## Motion and reduced motion

Lanternwake remains the sole substantial motion authority. Phase 6 uses its
AnimationDirector, scene contracts, mode resolution, lifecycle cleanup, and
static fallbacks; ordinary families use bounded CSS/WAAPI transitions only
where no specialist runtime owns the property. No new component-local motion
director or competing reduced-motion preference is introduced.

Motion supports comprehension, remains interruptible, does not announce
mutation success early, pauses or settles when hidden, preserves focus, and
leaves a usable final state. Gateway cinematic arrival stays single-owned and
promptly exposes account/navigation controls. Immersive Journal and PageFlip
behavior is repaired only if evidence exposes a real defect.

Reduced motion removes nonessential travel and looping, uses stable semantic
poses, and preserves sequence/state meaning. It never consumes a one-shot
business acknowledgement.

## Loading, empty, error, permission, and offline strategies

Known structure uses stable skeleton geometry instead of a page-sized spinner.
Skeletons expose restrained loading semantics, never leak stale private data,
never flash anonymous identity, and settle into a typed unavailable/error
state. Reduced motion uses a static treatment.

Empty and no-result panels share structure but use screen-specific reasons and
onward actions. No-results preserves query/filter context and offers reset or
nearby content. Neither state substitutes for request failure or denial.

Recoverable error and dependency-unavailable panels preserve shell, parent,
safe orientation, and retry where meaningful; they expose no raw stack or
private detail. Offline classifications are `OFFLINE_SUPPORTED`,
`OFFLINE_READONLY_CACHE`, `OFFLINE_DEGRADED`,
`OFFLINE_NOT_SUPPORTED_WITH_EXPLANATION`, and `NOT_APPLICABLE`. Phase 6 does
not fabricate offline behavior where the runtime only exposes a network error.

Authentication required, expired/revoked session, account restriction,
permission restriction, sensitive reauthentication, moderation denial, and
owner-only denial remain typed. A valid authenticated identity stays visible;
sign-in appears only when appropriate; denials provide safe alternatives while
avoiding resource-existence leaks.

## Mutation feedback

Every visible mutation identifies its server authority, validation, dirty and
confirmation behavior, pending/duplicate control, optimistic policy,
authoritative result, success/failure/conflict/retry, context refresh, focus,
live announcement, mobile behavior, evidence, and status. Success waits for the
server. Failures keep safe input and never expose raw server errors. Conflicts
explain what changed and preserve local work where practical.

The matrix includes identity lifecycle, Profile and all Personal Harbor
settings, linked identities and sessions, Community save/follow, invitation
actions, archive/favorite behavior, and currently supported Player, Captain,
Studio, and Chronicle actions.

## Media and fallback

The governed media families are Profile avatar/banner, Chronicle cover,
Community card, Creator avatar/banner, artifact, map preview, audio/reveal, 3D
preview, protected private media, Journal media, and PageFlip assets. Each
records normal, missing, scan-pending/accepted/quarantined, processing failure,
dependency-unavailable, and removed states as applicable.

Fallbacks preserve layout, identity, meaning, alt text or transcript/caption
status, and mobile behavior. They never show browser broken-image chrome,
storage/object keys, private paths, unsafe pending content, or an unexplained
black frame. Public surfaces use only allowlisted Harborlight projections and
Sealed Hold-approved derivatives.

## Fixtures and data isolation

The deterministic fixture family is `homeport-phase6-v1`. It contains only
synthetic accounts, memberships, Chronicles, sessions, Profile/Passport data,
Community projections, mutation states, and token outcomes necessary for the
acceptance matrix. It is seeded idempotently into a copied task-owned SQLite
database under
`C:/Users/kkids/AppData/Local/Temp/homeport-phase6-019fcb64/database/phase6.db`.
Profile, protected-content, traces, screenshots, and build/runtime state use
separate children of the same task root.

The canonical development database is never opened for mutation. Its start
checksum for this run is
`54647911F63C6A55E5C6B6C95E5EC0A2977B4580A42DE073C8C503A3D8C7A412`;
closure must prove the same checksum and file timestamp. No real private
content, user identity, token, provider, or production system is used.

## Evidence tiers and source binding

Tier A critical screens require desktop, mobile, high-risk zoom, applicable
high-risk states, automated accessibility, keyboard, and human review. Tier B
high screens require desktop/mobile, state and responsive assertions, and
human review. Tier C standard screens require a current primary capture,
desktop/mobile automation, component/state proof, and representative review.
Tier D contextual/token screens require context, parent/return, representative
state, responsive/accessibility proof, and visual evidence.

Final captures use a task-owned production build/start runtime. Every active
record carries evidence ID, screen, route, product area, state, criticality,
fixture identity, account state, viewport, zoom, motion mode, exact committed
source SHA, browser/version, path, checksum, review classification, defects,
correction commit, and final status. Source changes invalidate affected active
captures; stale images cannot be rebound by metadata alone.

The Phase 6 publication commit may update documents and metadata after capture
without invalidating product-source evidence only when the evidence metadata
separately records the exact tested implementation tree and a path-impact
check proves no screen-affecting source changed. Any `src`, relevant public
asset, style, fixture, or browser-contract change requires recapture.

## Human visual review

Codex inspects actual rendered captures individually and in contact sheets.
Each evidence family receives `ACCEPTED`, `REJECTED_PRODUCT_DEFECT`,
`REJECTED_EVIDENCE_DEFECT`, `BLOCKED_EXTERNAL`, or `NOT_APPLICABLE`. Review
checks overlap, clipping, overflow, hierarchy, alignment, raw controls,
inconsistent meaning, contrast, focus visibility, viewport containment, sticky
behavior, duplicate chrome, media failure, stale data, runtime overlays, state
truth, primary actions, and private-data exposure. A passing DOM assertion or
existing PNG is not visual acceptance.

## Validator and updater architecture

`scripts/homeport/validate-phase6-surfaces.mjs` performs schema, source parity,
state, responsive, accessibility, motion, media, mutation, raw-surface,
evidence checksum/source/fixture, review, maturity, and nonconformity checks.
It emits independent named outcomes and treats retained Phase 7 findings as a
non-zero product finding count without failing Phase 6 when their ownership is
explicit.

`scripts/homeport/apply-phase6-inventory-updates.mjs` applies additive Phase 6
fields and records to the Phase 0-5 control plane. It preserves historical
ordering and SHAs, deduplicates by stable ID, closes only HP-NC-018 as branch
validated when evidence permits, and leaves Phase 7 findings open. Running it
twice must produce byte-identical tracked output.

Sounding Line gains explicit Phase 6 screen/state/responsive/accessibility/
evidence contracts and routes subsystem and mainline execution through its
existing policy, isolated resources, receipts, cleanup proof, and release
decision authority. Raw Vitest, Playwright, or build output is diagnostic only.

## Production evidence and limitations

The product-runtime lane uses the repository's Next.js production build and a
task-owned port, copied database, storage roots, Playwright output, and browser
profile. Node is `24.18.0`, npm is `11.9.0`, Next.js is `16.2.10`, React is
`19.2.4`, Prisma is `6.19.3`, Playwright is `1.56.1`, and the inspected host
provides 2560x1600 and 2560x1440 display contexts. Exact Chromium version is
recorded at capture time.

Automated local evidence proves the tested branch and synthetic fixtures only.
It does not prove deployment, owner acceptance, physical screen-reader use,
live external providers, production signing, remote workers, or Phase 7
integrated product acceptance.

## Schema and migration decision

No Prisma schema or migration change is justified. Visual maturity, screen
acceptance, fixture, review, and evidence metadata are repository governance
artifacts rather than product data. Existing typed APIs and projections are
used; DTOs are not broadened for presentation convenience.

## Rollback and publication

Each Phase 6 commit is additive and independently revertible. Rollback reverts
the product-surface implementation and its generated Phase 6 records while
preserving all Phase 0-5 history and specialist data. No database rollback is
required because there is no migration. Evidence generated for reverted source
becomes historical and cannot remain active.

The implementation commit becomes the FT-B006 source anchor and the exact
visual-test source. Publication then adds final receipts without changing
screen-affecting product source. Only the retained Homeport branch is pushed;
there is no merge, deployment, owner acceptance, or Phase 7 start.

## Phase 7 handoff

Phase 7 receives the exact Phase 6 implementation SHA, registries, matrices,
source-bound evidence manifest, human review, Sounding Line receipts, database
immutability proof, environment record, remaining external limitations, and
the still-open Phase 7 nonconformities. Phase 6 does not close HP-NC-015,
HP-NC-019, or HP-NC-020 and does not interpret branch-local completion as
integrated product proof.

## Architecture acceptance state

This document freezes the Phase 6 architecture only. It establishes no product
implementation, screenshot acceptance, test result, nonconformity closure,
feature-catalog completion, merge, deployment, owner acceptance, or Phase 7
authorization.
