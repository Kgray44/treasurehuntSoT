---
title: Project Homeport Phase 5 Route Reachability Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-5-route-reachability-architecture
last_reviewed: 2026-08-03
---

# Project Homeport Phase 5: Close Route and Information-Architecture Gaps

## Status and frozen source boundary

This document freezes the Phase 5 route-reachability architecture before broad
route edits. It is Project Homeport Phase 5, not Project True North. True North
continues to own route classification mechanics, shell modes, matching,
navigation projection, responsive menus, contextual navigation, and
compatibility aliases. Homeport owns the proof that every intended destination
is discoverable, permission-safe, understandable in context, and escapable
through those mechanics.

| Field                                | Frozen value                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Worktree                             | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport`                         |
| Branch                               | `codex/project-homeport-product-reality-recovery`                              |
| Phase 5 starting SHA                 | `54372224fc9bf4b4fb42797ca58a5a224ffdb92a`                                     |
| Remote branch SHA at start           | `54372224fc9bf4b4fb42797ca58a5a224ffdb92a`                                     |
| Fetched `origin/main` and merge base | `8d142227d712d27e363b15903dba9b0c99a04bc8`                                     |
| Starting divergence                  | Homeport 43 ahead, 0 behind `origin/main`; 0 ahead, 0 behind its remote branch |
| Canonical database SHA-256           | `DF33983556CF2C6FF01DF6084AE6619EC5DF5C99B11241FA88B4A88F8E144EEB`             |
| Schema decision                      | No schema or migration change                                                  |

The starting tree contains 85 `page.tsx` sources and 174 `route.ts` sources.
All 85 page sources already have an inventory record. Seven service sources
are absent from the Phase 4 inventory and must be added by the idempotent Phase
5 updater: account data, account overview, account personal information,
canonical auth context, Passport Memories, Passport overview, and Passport
saved APIs. The existing inventory's 32 direct-URL/orphan flags are not treated
as current truth: some identify genuine gaps and others predate accepted Phase
3/4 dynamic registries. The Phase 5 census derives the answer from current
source plus governed registries.

This freeze establishes architecture only. It does not establish
implementation, test success, evidence freshness, nonconformity closure,
Sounding Line release authority, merge, deployment, owner acceptance, Phase 6,
Phase 7, or product acceptance.

## Authority and invariants

- Wayfarer remains authoritative for account, Profile, Chronicle Passport,
  history, artifacts, settings, identity, privacy, and tokenized account flows.
- One Voyage remains authoritative for Player, Captain, Creator, invitation,
  Voyage, playthrough, Journal, and canonical/compatibility runtime behavior.
- Harborlight remains authoritative for Community source collections, public
  projection, lifecycle, privacy, moderation, and social state.
- Sealed Hold remains authoritative for private-media authorization and opaque
  delivery. A graph edge never exposes an object key or private identifier.
- Lanternwake remains authoritative for route-motion lifecycle, immersive
  presentation, focus timing, and reduced-motion behavior.
- Universal Language remains authoritative for visible product terms.
- Sounding Line remains the sole release-decision authority.
- Phase 1 current-user state, Phase 2 shell/navigation, Phase 3 Personal Harbor,
  and Phase 4 Community Harbor are regression boundaries, not replacement
  targets.
- Authorization stays in routes and services. A visible edge is discoverability
  evidence, never an authorization grant.

## Route discovery mechanism

`scripts/homeport/phase5-route-census.mjs` will walk `src/app` and derive route
patterns from filesystem semantics rather than a fixed total. It will:

1. discover pages, route handlers, layouts, `not-found`, and error boundaries;
2. ignore route groups in URL construction while retaining their source path;
3. preserve dynamic, catch-all, and optional catch-all parameter metadata;
4. normalize every URL pattern to bracket syntax;
5. compare source files with the route inventory, screen catalog, shell-mode
   registry, node registry, and edge targets;
6. report added, omitted, phantom, duplicated, and reclassified sources; and
7. keep API/service routes in source parity while excluding them from human
   graph reachability.

The source census is deterministic and sorted by normalized route pattern,
then source path. Counts are derived output and may change only with regenerated
artifacts.

## Classification precedence

Every discovered route receives exactly one classification. The decision order
is deliberately narrow:

1. `STATIC_ASSET` for a discovered asset boundary, if any.
2. `API_OR_SERVICE` for `route.ts` and non-page service handlers.
3. `DEPRECATED` when an explicit ledger disposition removes or retires a route.
4. `DEVELOPMENT_ONLY` for environment-restricted development pages.
5. `INTERNAL_DIAGNOSTIC` for explicitly owner-authorized operational pages.
6. `TOKENIZED_DEEP_LINK` when entry requires a secret, bounded code, or signed
   handoff and the route is excluded from ordinary navigation.
7. `AUTH_COMPATIBILITY_ALIAS` for a historical authentication entry that
   delegates to canonical identity.
8. `REDIRECT_ALIAS` for a historical bookmark that terminates at a canonical
   route without competing UI.
9. `CONTEXTUAL_DYNAMIC` for a detail/workflow page whose parameter or context
   is obtained from an eligible visible source surface.
10. `USER_NAVIGABLE` for an ordinary static destination.

Safe fallback classification is prohibited. A newly discovered page without an
explicit registry record fails as ambiguous. An ordinary page may not be made
internal merely to clear the orphan gate.

## Route node schema

`Project_Homeport_Phase_5_Route_Node_Registry.json` records every page source.
Each node contains:

- `routeId`, `pathPattern`, `sourceFile`, `classification`, `productArea`,
  `specialistOwner`, and `integrationOwner`;
- `shellMode`, `logicalParentRouteId`, `canonicalRouteId`, and
  `activeNavigationOwner`;
- `authentication`, `requiredCapabilities`, `anonymousAvailability`,
  `desktopAvailability`, and `mobileAvailability`;
- `compactOrImmersive`, `dynamicParameters`, `dynamicSourceRequired`,
  `tokenized`, `compatibility`, and `deprecated`;
- `ordinaryCompletionStatus`, `applicableStates`, `emptyStateAction`,
  `errorRecoveryAction`, `permissionRecoveryAction`, and `returnFallback`;
- `sourceCollectionIds`, `entryEdgeIds`, `exitEdgeIds`, `evidenceIds`, and
  `testContractIds`; and
- `currentDisposition` and `notes`.

The validator rejects duplicate IDs or sources, unknown classification/shell/
capability values, missing or cyclic parents, invalid canonical targets,
missing collections or edges, omitted/phantom sources, dynamic routes without
parameters, tokenized routes marked ordinary, and deprecated routes without an
exact disposition.

## Route edge schema

`Project_Homeport_Phase_5_Route_Edge_Registry.json` records only verifiable
product transitions. Edge types are `GLOBAL_NAV`, `WORKSPACE_NAV`,
`ACCOUNT_NAV`, `SECTION_NAV`, `DISTRICT_NAV`, `CARD_DETAIL`, `LIST_DETAIL`,
`COLLECTION_ITEM`, `RELATED_CONTENT`, `CREATOR_LINK`, `BREADCRUMB`,
`PARENT_RETURN`, `CONTEXTUAL_EXIT`, `EMPTY_STATE_ACTION`, `ERROR_RECOVERY`,
`PERMISSION_RECOVERY`, `NOTIFICATION_LINK`, `INVITATION_HANDOFF`,
`TOKEN_HANDOFF`, `AUTH_RETURN`, `COMPATIBILITY_REDIRECT`,
`DEPRECATION_REDIRECT`, `SUCCESS_ONWARD`, and `MANUAL_CONTEXT_LINK`.

Each edge contains `edgeId`, `edgeType`, `sourceRouteId`, `targetRouteId`,
`visibleControlId`, `accessibleLabel`, `presentation`, `desktop`, `mobile`,
`pointer`, `keyboard`, `touch`, `authenticationState`,
`requiredCapabilities`, `sourceDataFamily`, `dynamicParameterSource`,
`queryContract`, `fragmentContract`, `allowedWhen`, `forbiddenWhen`,
`safeReturn`, `stableFallback`, `browserJourneyIds`, `evidenceIds`, and
`currentStatus`.

An edge must name a current source control or registry-driven control. Dynamic
edges name the allowlisted data family that supplies parameters. Private IDs
are never committed; fixture aliases and route patterns are used instead.

## Product roots and capability profiles

The primary ordinary route root is `/`. Reachability is evaluated independently
for these graph profiles:

- `ANONYMOUS_GATEWAY`;
- `AUTHENTICATED_PLAYER_GATEWAY`;
- `AUTHENTICATED_CAPTAIN_GATEWAY`;
- `AUTHENTICATED_CREATOR_GATEWAY`;
- `AUTHENTICATED_FULL_CAPABILITY_GATEWAY`;
- `AUTHENTICATED_MODERATOR_GATEWAY`; and
- `RESTRICTED_ACCOUNT_GATEWAY`.

Tokenized reset, verification, invitation, claim, and merge flows use bounded
nonordinary roots. They cannot satisfy an ordinary route's entry requirement.
Administrator is evaluated only where a current intended surface exists.

## Reachability algorithm

For every graph profile the validator starts at the gateway, projects allowed
desktop and mobile edges, and performs deterministic breadth-first traversal.
It records the shortest eligible path and an alternate path where applicable.
Traversal checks the source and target, authentication state, capabilities,
dynamic source contract, query/fragment contract, and platform availability.

The validator separately checks:

1. every ordinary route is reachable by at least one eligible root;
2. every contextual route has an eligible visible source collection/control;
3. ineligible profiles cannot traverse a protected edge as authorized;
4. every route has a capability-compatible parent and stable exit/onward edge;
5. desktop and mobile destination/edge membership are equivalent;
6. dynamic parameters originate from an allowlisted service projection;
7. redirect and parent graphs terminate and contain no cycles or self-loops;
8. tokenized routes are absent from ordinary navigation;
9. compatibility routes cannot compete with canonical product UI; and
10. direct-entry evidence references a previously proven natural path.

Allowed terminal results are `REACHABLE`, `REACHABLE_CONTEXTUAL`,
`REACHABLE_PERMISSION_GATED`, `INTENTIONALLY_TOKENIZED`,
`INTENTIONALLY_COMPATIBILITY_ONLY`, `INTENTIONALLY_DEVELOPMENT_ONLY`, and
`DEPRECATED_WITH_DISPOSITION`. `UNREACHABLE_DEFECT` and `AMBIGUOUS_DEFECT`
block closure.

## Static and dynamic reachability

A `USER_NAVIGABLE` node requires a visible entry, eligible root, logical parent,
desktop and mobile paths, authorization behavior, state contract, and a return
or onward edge. Browser Back cannot be its only exit.

A `CONTEXTUAL_DYNAMIC` node requires parameter metadata, a stable source route,
source component/control, allowlisted query/service, authorization predicate,
public/private classification, empty-source behavior, invalid/private/removed
behavior, stable parent, return fallback, and synthetic fixture alias. Public
Community cards, Personal Harbor records, Player/Captain libraries, and Studio
Chronicle editors are governed sources; an API URL, fixture ID, or direct
`page.goto()` alone is not.

## Tokenized and invitation handling

The token matrix covers reset, verification, invitation token/short code,
guest claim, account merge, and any current signed human delivery route. It
records source, lifetime, valid/malformed/expired/consumed/revoked behavior,
authenticated/anonymous behavior, non-retention, safe return, browser proof,
and ordinary-navigation exclusion. No committed artifact, screenshot, receipt,
query example, or log may contain a raw token.

## Compatibility and redirect policy

Every compatibility route receives exactly one ledger disposition:
`TRANSPARENT_REDIRECT`, `CANONICAL_CONTEXT_ADAPTER`, `DEPRECATION_NOTICE`,
`OWNER_ONLY_DIAGNOSTIC`, `REMOVED_NOT_FOUND`, or `OBSERVATION_REQUIRED`.
Historical sign-in routes remain bounded adapters to canonical account
identity; Player/Captain/Studio/Quartermaster/Tale aliases cannot present a
second ordinary product.

Redirect validation rejects self/cyclic/missing/deprecated targets, unsafe
external destinations, token leakage, unsafe query loss, auth-return loops, and
undocumented multi-hop chains. One-hop canonical redirects are preferred.

## Parent, return, empty, error, and permission architecture

Every nonroot ordinary/contextual node has one logical parent in the same or a
documented adjacent product area. Parent and redirect graphs are acyclic. A
parent must be available to the same eligible profile and cannot be removed or
development-only.

Every ordinary page exposes a stable parent, workspace home, broader product
area, or deliberate next step; most details expose both parent and broader
area. Empty states provide a meaningful onward action. Errors preserve current
area, explain the bounded failure, and provide retry or parent. Permission
denial preserves authenticated identity and offers an available workspace or
parent; canonical sign-in is used only when identity is genuinely absent or
ended. Full visual state completion remains Phase 6.

## Desktop/mobile, compact, immersive, and accessibility policy

Equivalent state must expose the same functional route and edge membership on
desktop and mobile. Presentation may differ. Entries must support keyboard and
touch and cannot depend on hover, mouse-only menus, invisible overlays, tiny
unlabelled icons, or drag.

Phase 2 compact and immersive contracts are preserved. Every such page retains
a visible canonical exit, compatible graph parent, direct-entry context,
canonical account state, mobile exit, and nonmutating exit behavior. Phase 5
does not redesign immersive experiences or create a second motion lifecycle.
Lanternwake's route boundary remains responsible for destination focus after
route settlement and reduced-motion timing.

## Browser natural-path proof and evidence

Machine graph proof establishes structural completeness. The Phase 5 browser
harness consumes the governed edge registry and locates controls by role and
accessible name. It starts at `/`, clicks only nondestructive navigation,
records route/edge identity, validates active context and stable return, and
uses direct navigation only after the natural path is proven.

Each route receipt is source-SHA-bound and records route ID, branch, synthetic
fixture alias, browser, viewport, account/capability profile, natural root,
traversed edge IDs, final/parent/return patterns, platform, input applicability,
result, bounded failure, timestamp, and evidence checksum. It excludes tokens,
private IDs/content, object keys, and credentials.

## Drift detection and idempotent migration

`apply-phase5-inventory-updates.mjs` updates the existing route, navigation,
screen, journey, evidence, and nonconformity records additively. Historical
Phase 0 through Phase 4 source SHAs, statuses, ordering, evidence, and closure
claims are preserved. Running the updater twice must produce byte-identical
output.

The route census fails on missing/phantom pages or services, source/screen/node
classification disagreement, shell or parent disagreement, missing targets,
silent removal, and route-count changes without regenerated artifacts. It
derives counts and never treats today's total as eternal truth.

No persistence migration is justified. Route and navigation contracts are
source/document artifacts; product repairs are bounded link, parent, recovery,
and compatibility changes. Rollback reverts the Phase 5 commits as a coherent
set. It never rolls back by deleting historical evidence, migrations, user
records, or prior-phase work.

## Sounding Line enforcement and closure boundary

The Phase 5 contracts are registered with stable test IDs, owners, tiers, risks,
source paths, fixtures, resource ownership, budgets, retry policy, and release
relevance. The orphan validator emits separate schema, source parity, graph,
ordinary, dynamic, tokenized, compatibility, dead-end, parity, and remaining
product-nonconformity outcomes. Later Phase 6/7 findings remain explicit and do
not become false Phase 5 failures or false product acceptance.

Only Sounding Line finalizer `RELEASE_GO` decisions for the exact committed
source may support branch-complete Phase 5 closure. Focused direct runners are
diagnostic. Phase 5 completion cannot claim merge, deployment, owner acceptance,
Phase 6, Phase 7, or product acceptance.
