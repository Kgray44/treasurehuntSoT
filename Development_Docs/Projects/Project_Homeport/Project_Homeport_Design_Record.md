---
title: Project Homeport Design Record
audience: product-engineering
status: current
canonical_for: project-homeport-design-record
last_reviewed: 2026-08-01
---

# Project Homeport design record

## Phase 0 freeze boundary

This record freezes evidence vocabulary and Phase 1 inputs only. It does not freeze or implement the final identity architecture.

| Frozen input                  | Phase 0 decision                                                                                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical global governance   | `Development_Docs/Governance/Voyagewright_Global_Product_Governance_Standard.md`                                                                                                   |
| Canonical Homeport governance | `Development_Docs/Projects/Project_Homeport/Project_Homeport_Governing_Document.md` with adjacent supplied PDF                                                                     |
| Canonical audit root          | `Development_Docs/Projects/Project_Homeport/`                                                                                                                                      |
| Artifact schema               | JSON/CSV field sets enforced by `scripts/homeport/validate-phase0-inventories.mjs`; schema version `1.0.0`                                                                         |
| Route vocabulary              | USER_NAVIGABLE, CONTEXTUAL_DYNAMIC, TOKENIZED_DEEP_LINK, AUTH_COMPATIBILITY_ALIAS, REDIRECT_ALIAS, INTERNAL_DIAGNOSTIC, DEVELOPMENT_ONLY, API_OR_SERVICE, STATIC_ASSET, DEPRECATED |
| Session vocabulary            | CANONICAL, LEGACY_COMPATIBILITY, GUEST_OR_INVITATION, TOKENIZED_RECOVERY, CLIENT_HINT_ONLY                                                                                         |
| Screen maturity vocabulary    | COMPLETE, PARTIAL, SKELETAL, PLACEHOLDER, BROKEN, UNREACHABLE, INTERNAL_ONLY, NOT_APPLICABLE                                                                                       |
| Required state vocabulary     | loading, empty, no-results, recoverable-error, dependency-unavailable, session-expired, permission-restricted                                                                      |
| Journey result vocabulary     | PASSED, PASSED_WITH_NONCONFORMITY, BLOCKED_BY_PRODUCT_DEFECT, BLOCKED_BY_FIXTURE, BLOCKED_BY_ENVIRONMENT, UNREACHABLE, NOT_IMPLEMENTED, NOT_APPLICABLE                             |
| Nonconformity severity        | CRITICAL, HIGH, MODERATE, LOW                                                                                                                                                      |
| Evidence identity             | source SHA + branch + run ID + fixture version/checksum + browser + viewport/zoom + evidence ID + PNG SHA-256                                                                      |

## Specialist ownership boundaries

Wayfarer owns account, session, Profile, Passport, and history projections. True North/platform shell work owns global navigation and gateway/shell reachability. One Voyage owns Player/Captain/Creator and invitation compatibility. Harborlight owns Community routes, public projection, district behavior, moderation, and community operations. Sealed Hold owns private delivery boundaries. Lanternwake owns presentation behavior, not authoritative state. Sounding Line owns governed test selection and evidence execution. Project Homeport owns convergence, cross-project acceptance, and the nonconformity ledger; it does not silently absorb specialist authorities.

## Phase 1 open decisions

- Exact cookie transition and whether `wayfarer_account` keeps its public name while its implementation converges.
- Whether legacy Player and staff readers remain adapters, and for how long.
- The canonical current-user payload and invalidation mechanism across server and client shells.
- Registration/sign-in intended-return semantics and explicit expiry/permission states.
- Capability derivation when account role rows and Player/profile membership disagree.
- Whether global sign-out revokes every compatibility authority atomically or through bounded adapters.
- How Passport receives stable account context without page-local simulation controls.

## Shared and high-conflict files

Probable high-conflict surfaces include `src/components/shell/ProductShell.tsx`, `src/navigation/registry.ts`, account/session API routes, Player/Captain/Studio sign-in routes, route guards, current-user projections, Passport/Profile components, Prisma session models, and migration ledgers. Phase 1 must re-census these files immediately before edits and coordinate specialist owners.

## Migration necessity assessment

**FACT:** Phase 0 changed no schema and found one canonical AccountSession plus two visible compatibility session families and token/client hints.

**RECOMMENDATION:** Phase 1 should begin without a schema change: converge reads, writes, capability projection, return behavior, and revocation around the existing canonical account session first. Additive schema work is justified only if implementation evidence shows current AccountSession fields cannot represent required revocation, device/session management, or compatibility provenance. Any migration must remain additive until legacy-reader retirement criteria pass.

## Compatibility adapters requiring observation

Observe `forever_gm`, legacy Player identity/session readers, `chronicle_session`, `forever_player`, invitation/claim state, reset/verification URL tokens, CSRF storage, and non-authoritative device/role/presentation hints. Compatibility routes `/player/sign-in`, `/captain/sign-in`, `/studio/sign-in`, `/quartermaster`, and `/tale/:campaignSlug` require explicit target disposition rather than silent deletion.

## Exact Phase 1 blockers

No repository, source, isolation, or evidence blocker prevents Phase 1 from beginning. The 28 product nonconformities are governed inputs, not Phase 0 stop conditions. Phase 1 must not claim completion until critical HP-NC-004, 017, 023, and 027 and their dependents have acceptance evidence.

## Recommended Phase 1 target

**RECOMMENDATION FOR PHASE 1:** Treat AccountSession/`wayfarer_account` as the probable canonical account authority. Preserve role-specific visible URLs only as contextual entry adapters into one account lifecycle. Derive current-user and capability projections from one server-owned account context, invalidate that context after sign-in/registration/role changes/sign-out, and give expiry and authorization separate deliberate states. Keep staff and Player compatibility readers observable behind adapters until owner tests prove retirement. Ensure Passport consumes the same account context. Avoid data migration initially; reconcile projections before storage.

Safest implementation order:

1. Freeze canonical current-user, capability, return, expiry, permission, and revocation contracts.
2. Add focused tests around existing AccountSession behavior without changing storage.
3. Converge sign-in and registration writes plus client-context invalidation.
4. Converge route guards and capability projection.
5. Converge global sign-out and multi-tab recovery.
6. Route role-specific sign-in pages through compatibility adapters.
7. Repair Passport context and then hand off shell/navigation work to Phase 2.
8. Decide legacy-reader retirement and only then assess additive migration.
