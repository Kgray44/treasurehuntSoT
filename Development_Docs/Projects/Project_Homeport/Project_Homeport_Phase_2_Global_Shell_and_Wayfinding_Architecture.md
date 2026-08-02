---
title: Project Homeport Phase 2 Global Shell and Wayfinding Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-2-global-shell-and-wayfinding-architecture
last_reviewed: 2026-08-01
---

# Project Homeport Phase 2 global shell and wayfinding architecture

## Freeze boundary

This record freezes Phase 2 before broad implementation on
`codex/project-homeport-product-reality-recovery`. The starting branch SHA is
`dca3480f5369bfa7d5b8fd52e2cca155185fae33`; the reconciled `origin/main` and
merge base are `8d142227d712d27e363b15903dba9b0c99a04bc8`. The branch is five commits ahead
and zero behind main. No newer mainline commits require reconciliation.

Phase 0 closed at `bda5217a67d8ce2b56a02163371c137d9ed07275` and remains historical current-state
evidence. Phase 1 implementation is anchored at
`43c0fdc701de1425e651acb06924051fbd3a4a34`; its canonical account/session,
current-user, capability, return, invalidation, and sign-out contracts are
invariants. Phase 2 changes presentation and reachability only. It creates no
identity authority, authorization decision, schema, migration, or persisted
navigation state.

The canonical development database SHA-256 before Phase 2 edits is
`DF33983556CF2C6FF01DF6084AE6619EC5DF5C99B11241FA88B4A88F8E144EEB`.

## Authority and ownership

The Voyagewright Global Product Governance Standard and Project Homeport
governing document control. Accepted specialist ownership remains intact:

- True North owns the platform shell and route-to-navigation semantics that
  Homeport converges and completes.
- Wayfarer owns account identity, Profile, Chronicle Passport, preferences,
  privacy, security, and public projection.
- One Voyage owns Chronicle, Voyage, Player/Captain/Creator runtime routes,
  invitations, progression, and durable state.
- Harborlight owns Community content, districts, moderation, and Community
  state. Phase 2 exposes its existing root without redesigning it.
- Lanternwake owns route, gateway, PageFlip, and immersive presentation
  lifecycle. Phase 2 uses its motion primitives and does not add local GSAP
  navigation timelines.
- Universal Language supplies canonical visible labels.
- Sounding Line owns governed selection, isolated execution, evidence, and
  decision status. Focused raw test output remains diagnostic.

`ProductShell` is the one ordinary product-frame owner. `HarborLanding` remains
the gateway presentation owner inside that frame. Route pages remain owners of
their content, mutations, authorization, and object-specific controls.

## Fresh source census

The pre-edit census found:

- `src/components/shell/ProductShell.tsx` currently removes the entire shell on
  `/`, combines workspace links and account access, and has only one disclosure
  pattern for desktop/mobile.
- `src/navigation/types.ts`, `registry.ts`, `route-classification.ts`,
  `route-matching.ts`, and `navigation-projection.ts` are the existing True North
  base. They use six lower-case modes, workspace-local arrays, and a projection
  that returns one workspace list rather than four coordinated layers.
- `src/components/landing/HarborLanding.tsx` owns the accepted cinematic gateway,
  role continuations, and `/api/gateway/status`; it has Explore and invitation
  controls but no governed account/global frame or Community entry.
- `src/animation/platform/RouteMotionBoundary.tsx` already owns route transition
  motion and destination-heading focus.
- `src/components/auth/CurrentUserProvider.tsx` and
  `src/homeport/current-user.ts` expose Phase 1 loading, anonymous,
  authenticated, ended-session, restricted, and unavailable states. The shell
  must consume this provider exactly once.
- `/profile/[handle]`, `/passport`, and `/account/security` are stable current
  destinations. Chronicle Passport owns current Profile, Linked identities,
  Preferences, Privacy, Security, History, and Artifact sections; Phase 2 will
  add stable section IDs rather than empty account routes.
- `/community` and its route family exist. Global reachability is missing; six
  district routes remain later Harborlight/reachability debt.
- `/quartermaster`, `/quartermaster/[workspace]`, and
  `/captain/sessions/[sessionId]` are compact/compatibility routes.
  `/player/playthroughs/[playthroughId]`, its `/journal` route, and
  `/play/[taleSlug]/session/[sessionId]` are immersive Player routes.
- `/captain`, `/studio`, `/player`, `/tale/[campaignSlug]`, and archive routes
  include canonical redirects or compatibility behavior that must retain stable
  active ownership without becoming new navigation items.
- `scripts/homeport/validate-phase0-inventories.mjs` and
  `apply-phase1-inventory-updates.mjs` provide the validation/update pattern to
  extend idempotently. Sounding Line registrations live in
  `scripts/sounding-line/test-registry.mjs`.

## Governed shell modes

Runtime names are normative upper-case values. Legacy lower-case names are
removed from the route authority rather than maintained as a competing public
vocabulary.

| Mode                 | Intended routes                                                                  | Required frame                                                                            |
| -------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GATEWAY_STANDARD`   | `/`                                                                              | cinematic gateway plus prompt global/account frame, workspace entry, no duplicate header  |
| `PUBLIC_STANDARD`    | `/tales`, public Community/Profile/detail routes, compatibility public discovery | global navigation, account control, contextual parent, appropriate footer                 |
| `WORKSPACE_STANDARD` | Player/Captain/Creator libraries and ordinary tools, Passport/account            | global, workspace, account, contextual layers and current workspace                       |
| `COMPACT`            | Quartermaster and focused Captain session controls                               | workspace identity, safe account access, canonical exit, no full desktop bar obstruction  |
| `IMMERSIVE`          | active/waiting/historical Player journal/session views                           | compact context, safe account access, Voyage-safe exit to Player, no progression mutation |
| `AUTHENTICATION`     | canonical sign-in, registration, forgot-password, role intent adapters           | brand, lifecycle links, safe return, no duplicate account control                         |
| `TOKENIZED`          | reset, verification, invitation and deliberate token handoffs                    | purpose, invalid/expired state, safe return, no token-preserving global menu              |
| `DEVELOPMENT`        | `/dev/*`                                                                         | explicit development identity, no ordinary navigation entry, safe home exit               |

Every page record receives exactly one mode in the Phase 2 mode registry. APIs
are excluded. Classification is ranked by explicit route pattern specificity;
ambiguous equal-rank matches fail validation. `COMPACT` and `IMMERSIVE` records
must have non-tokenized canonical exit targets. Authentication and tokenized
records must have bounded local safe returns. Development records cannot be
referenced by active ordinary navigation items.

## One navigation authority

One typed registry owns stable items across four layers:

1. `GLOBAL`: Home, Explore Chronicles, Community Harbor.
2. `WORKSPACE`: role/capability-owned destinations for Player, Captain, Creator,
   and intentionally exposed privileged workspaces.
3. `ACCOUNT`: identity, personal destinations, available workspace choices,
   and Sign Out metadata.
4. `CONTEXTUAL`: canonical parent, return, and exit controls attached to route
   families rather than inferred by the component.

Each item records stable ID, layer, canonical label and destination, owner,
authentication/capability policy, applicable modes, desktop/mobile placement,
active-match policy, parent, order, and status. Components may render a
projection; they may not own competing link arrays or permission logic.

The pure projection accepts pathname, governed mode, Phase 1 current-user
state/capabilities, workspace, presentation (`desktop` or `mobile`), and
contextual route metadata. It returns global, workspace, account, contextual,
active, and available-workspace sets. It reads no cookie, local storage, route
inventory, or database; it does not infer capability from a pathname. Loading,
restricted, and unavailable states expose only safe public navigation and their
deliberate account status. Privileged items require server-projected capability.

Desktop and mobile use the same functional IDs. Placement and order may differ;
membership may differ only through a documented governed exception. The parity
validator compares ID sets for equivalent user/mode/route input.

## Active matching

The centralized policies are `EXACT`, `SECTION`, `DYNAMIC_FAMILY`, `ALIAS_OF`,
and `NEVER_ACTIVE`.

- `EXACT` owns only its canonical pathname.
- `SECTION` owns the canonical route and slash-delimited descendants, never a
  lexical prefix such as `/player-sign-in`.
- `DYNAMIC_FAMILY` uses an explicit route pattern.
- `ALIAS_OF` resolves to an existing canonical item ID.
- `NEVER_ACTIVE` covers actions, auth/tokenized controls, and development-only
  links.

Specific contextual ownership is resolved separately from the global active
item. Normally exactly one projected global link has `aria-current="page"`.
Community descendants retain Community global orientation; nested workspace
routes retain workspace orientation; auth adapters and tokenized routes do not
pretend to be authorized workspace content.

## Gateway integration

`ProductShell` remains mounted in `GATEWAY_STANDARD` and renders a restrained,
overlay-safe frame integrated with the existing harbor composition. It does not
place a generic opaque dashboard bar above the scene. Global/account controls
are promptly operable and do not wait for the decorative arrival sequence.

Anonymous gateway projection exposes Home orientation, Explore Chronicles,
Community Harbor, Create Account, Sign In, Player, Captain, Creator, and the
existing invitation entry. Authenticated projection replaces anonymous account
actions with profile summary, available workspaces, personal destinations, and
Sign Out. Loading reserves account-control geometry and is never presented as
anonymous. Unavailable context has an explicit alert and retry, with no stale
private data or false anonymous projection.

`HarborLanding` retains animation targets and role-continuation behavior. Phase
2 supplies the global/account frame and a visible Community path without
copying the role cards or creating a second account control.

## Account control and personal reachability

The account disclosure is navigation, not an ARIA application menu. It has
semantic groups and one focus lifecycle.

- Anonymous orientation: Account; Create Account; Sign In; optional current
  invitation entry.
- Authenticated identity: bounded avatar/fallback, display name, public handle,
  View My Profile.
- Personal: Chronicle Passport, Preferences, Privacy & Safety, Chronicle
  History, Artifact Cabinet, Security & Sessions.
- Workspaces: every granted Player/Captain/Creator workspace and only granted,
  intentionally surfaced privileged workspaces; current workspace is identified.
- Action: visually separated Sign Out.

View My Profile uses `/profile/{encoded public handle}` when present. The safe
no-handle fallback is `/passport#profile`, labeled as the owner's Profile; it
never constructs a null route or displays email. Phase 3 may replace this
fallback when it rebuilds Personal Harbor.

Current stable personal destinations are anchors inside Chronicle Passport,
except Security & Sessions, which uses `/account/security`. Phase 2 adds and
focuses stable IDs: `profile`, `preferences`, `privacy`, `history`, and
`artifacts`. These are honest routes into current sections, not empty pages and
not a Phase 3 redesign.

Only one account disclosure is mounted per shell. Opening it closes the
navigation drawer and vice versa. Focus enters the first useful control; Escape
and backdrop/outside dismissal restore the trigger; route change closes all
disclosures and restores body scroll. Mobile uses the same grouped controls in
the governed drawer. Sign Out retains Phase 1 server-side revocation and
invalidation.

## Workspace switching

Canonical homes remain `/player/library`, `/captain/library`, and
`/studio/library`. Moderator may resolve to `/community/moderation` only when
`canModerate`; no administrator dashboard is invented. Available workspaces
come solely from Phase 1 capability projection. Switching preserves the same
canonical account, requires no second sign-in, closes the disclosure, updates
the current workspace, and remains keyboard/touch/zoom operable.

Workspace navigation contains only workspace-owned destinations. Global Home,
Explore, and Community are not duplicated there. Player owns My Voyages;
Captain owns Voyages and Crew invitations; Creator owns Chronicle Library,
Exchange, and authorized private-content tools.

## Community and contextual navigation

Community Harbor is an active global destination on gateway, public, ordinary
workspace, account, and mobile projections. Phase 2 does not change Community
content or falsely close district debt. Community detail routes receive a
stable parent to `/community`; public Chronicle details return to `/tales`;
Profile/Passport returns to an approved account/workspace context; primary
workspace roots can return Home. A direct-linked page therefore has a canonical
parent even when browser history is empty.

Context controls are registry metadata rendered through reusable shell
primitives. Phase 5 retains exhaustive route-by-route reachability.

## Compact and immersive exits

Every compact/immersive record is captured in the contextual-exit matrix.

- Quartermaster and focused Captain sessions identify Captain context and exit
  to `/captain/library`.
- Player waiting/session/journal routes identify Player/Voyage context and exit
  to `/player/library`.
- The legacy `/play/.../session/...` entry renders the same canonical Player
  journal contract and uses the same exit.

The exit is a normal link, never `history.back()` alone. It does not invoke a
progression command, reset session state, or own PageFlip. It is visible without
covering primary story controls, survives mobile and reduced motion, and keeps
safe account access. `ProductShell` remains outside the journal presentation
owner, so route exit unmounts the experience only after deliberate navigation.

## Responsive, focus, and transition lifecycle

Desktop renders global navigation visibly when space permits and separates
workspace/account orientation. Mobile renders one structured drawer from the
same projection. Opening the drawer locks body scroll; Escape, backdrop,
outside dismissal, or route change close it and restore scroll/focus. Hidden
drawer controls are removed from the accessibility tree. Touch targets remain
at least the existing shell token size, content scrolls within the viewport,
and no horizontal overflow is accepted at 390x844 or 200% zoom.

The skip link precedes navigation. Disclosures place focus predictably and
restore it on dismissal. `RouteMotionBoundary` retains Lanternwake's route
transition and destination heading focus. Phase 2 adds no route delay and does
not refetch current-user context on navigation merely to update active state.

Reduced motion removes large drawer travel and delayed access while retaining
complete navigation, current-state, focus, and exit behavior.

## Security, privacy, and reliability

Navigation visibility is not authorization. Every destination retains its
server guard. Client route or storage tampering cannot add capability because
projection consumes only typed Phase 1 context. Public account display includes
only bounded display name, initials, and public handle; it excludes email,
provider/session identifiers, tokens, role rows, CSRF, private object keys, and
private Chronicle data. Tokenized path/search material is not copied into
global or account hrefs. Safe returns continue through the Phase 1 resolver.

The client keeps one CurrentUserProvider, one projection call, stable item IDs,
and bounded document listeners only while a disclosure is open. No per-item
query, duplicate BroadcastChannel, resize loop, hydration-time route inventory,
or serialized control artifact is introduced.

## Machine-readable and validation contract

The Phase 2 shell-mode registry and navigation-projection contract are manually
reviewable source artifacts validated against the current route inventory and
runtime registry. The Phase 2 updater applies implemented-state addenda
idempotently to the Phase 0/1 artifacts. The Homeport validator emits separate
`ARTIFACT_SCHEMA_VALID`, `PHASE_2_SHELL_CONFORMING`, and
`PRODUCT_NONCONFORMITIES_PRESENT` outcomes; later-phase debt does not turn a
structurally valid Phase 2 result into a false clean product claim.

Governed unit, component, and isolated browser tests register the Phase 2
contracts in Sounding Line. Screenshots are checksum-bound local synthetic
after-state evidence and require visual inspection. They do not establish
deployment or owner acceptance.

## Phase boundary and rollback

Phase 2 may close HP-NC-001, HP-NC-006, HP-NC-010, and HP-NC-016 only after all
required evidence and authoritative Sounding Line decisions pass. HP-NC-008,
HP-NC-014, and HP-NC-026 may advance only partially. Personal Harbor redesign
remains Phase 3, Community reconstruction Phase 4, exhaustive route reachability
Phase 5, and full screen-state/owner acceptance later governed work.

Rollback is source-only: revert the Phase 2 implementation and artifact commits
while retaining this decision record and historical evidence. No database
rollback exists because Phase 2 adds no schema or persisted data.

## Implementation conformance addendum

Implementation anchor `ce9fd8e70f0e906416cf41cd508ec5f2063570cc`
conforms to this freeze: 69 pages classify once across all eight modes, 32
registry items project through the four layers, 29 visible parity rows have
equivalent desktop/mobile destinations, and all seven compact/immersive records
have canonical exits. The final A-U browser run passed 21 journeys and the 20
required images were visually accepted. Inventory closure and Sounding Line
remain separate publication receipts; neither local browser proof nor this
addendum claims deployment or owner acceptance.
