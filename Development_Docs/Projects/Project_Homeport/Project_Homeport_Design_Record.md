---
title: Project Homeport Design Record
audience: product-engineering
status: current
canonical_for: project-homeport-design-record
last_reviewed: 2026-08-02
---

# Project Homeport design record

## Phase 0 freeze boundary

This record freezes evidence vocabulary and Phase 1 inputs. The Phase 1 amendment below freezes the identity and session convergence architecture before implementation; it does not authorize Phase 2 navigation work.

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

## Phase 1 architecture freeze amendment

**Decision date:** 2026-08-01. **Source boundary:** Phase 0 closure `bda5217a67d8ce2b56a02163371c137d9ed07275`, whose merge base with `origin/main` is the current `origin/main` SHA `8d142227d712d27e363b15903dba9b0c99a04bc8`. No newer mainline change requires reconciliation before Phase 1.

The architecture is frozen in [Project Homeport Phase 1 Identity and Session Architecture](Project_Homeport_Phase_1_Identity_and_Session_Architecture.md). The decisions close every Phase 0 open item as follows:

- `AccountSession` and the `wayfarer_account` cookie remain the only canonical product-account session authority. The existing fields already support hashed credentials, expiry, revocation, CSRF, and device/session management, so Phase 1 requires no schema or data migration.
- One server-owned current-user resolver classifies anonymous, authenticated, expired, revoked/invalid, account-restricted, and dependency-unavailable states. The client adds only a transient loading state and may never invent authentication or capability.
- Active `PlayerProfile` presence grants Player capability. Active global `AccountRoleAssignment` rows grant Captain, Creator, Moderator, and Administrator capabilities; Administrator implies staff capabilities but does not fabricate a Player profile.
- `forever_gm` and `chronicle_player` stop receiving ordinary new writes. They remain bounded read-and-rotate compatibility adapters. `chronicle_session`, `forever_player`, pending-invitation credentials, reset/verification tokens, and Tale Session state retain their narrower governed meanings.
- `/sign-in` is the canonical credential surface. Player, Captain, and Studio sign-in URLs become bounded context adapters; invitation-code entry remains available at the Player adapter. An already-authenticated user is evaluated for the requested capability and is never asked for a second password.
- Return destinations accept one bounded local-relative path only. Authentication is followed by fresh server-context resolution and destination authorization before navigation. Unsafe or unauthorized destinations fall back to the requested workspace home or `/`.
- Current-tab invalidation performs one direct authoritative refetch; same-browser tab invalidation uses a versioned `BroadcastChannel` message containing only event type and protocol version. Focus and visibility changes provide a throttled fallback. A request-generation guard rejects stale completions, while a current refresh failure produces an unavailable state and clears stale identity projection.
- Current-session and all-session sign-out revoke canonical `AccountSession` rows, clear canonical and compatibility identity cookies plus the client CSRF hint, publish invalidation, and preserve invitation credentials and Tale Session business state.

### Phase 1 source census

The fresh pre-edit census found the following governing implementation surface:

- session creation, authentication, revocation, guest claim/merge, reset, and account state: `src/wayfarer/accounts.ts`;
- canonical cookie and CSRF adapter: `src/wayfarer/http.ts`;
- Player and invitation compatibility: `src/platform/auth.ts`;
- staff compatibility and capability adapter: `src/lib/security.ts`;
- shell identity projection and client shell: `src/app/api/shell/context/route.ts`, `src/components/shell/ProductShell.tsx`, and `src/navigation/*`;
- account lifecycle UI and mutations: `src/components/wayfarer/AccountFlow.tsx` and `src/app/api/auth/*`;
- role-entry adapters and guards: `src/app/player/sign-in/page.tsx`, `src/app/captain/sign-in/page.tsx`, `src/app/studio/sign-in/page.tsx`, `src/app/player/library/page.tsx`, `src/app/captain/library/page.tsx`, `src/app/studio/library/page.tsx`, `src/components/platform/PlayerSignIn.tsx`, and `src/components/platform/StaffSignIn.tsx`;
- authorization-denial defect: `src/app/community/moderation/page.tsx` and `src/app/community/moderation/[id]/page.tsx`;
- Passport consumer: `src/app/passport/page.tsx` and `src/components/wayfarer/ChroniclePassport.tsx`;
- persistence contract: `prisma/schema.sqlite.prisma` and `prisma/schema.prisma`, which are provider-equivalent for the relevant account/session/profile/role models;
- governed verification registration and execution: `scripts/sounding-line/test-registry.mjs`, the Sounding Line planner/finalizer, and the Homeport validators.

### Explicit non-goals

Phase 1 does not redesign the gateway or global navigation, expose new Community districts, redesign Passport information architecture, alter Tale Session authorization or persisted progress, remove legacy database tables, begin Phase 2, merge to `main`, or issue product/release acceptance.

## Phase 2 architecture freeze amendment

**Decision date:** 2026-08-01. **Source boundary:** Phase 1 final branch SHA
`dca3480f5369bfa7d5b8fd52e2cca155185fae33`; reconciled `origin/main` and merge
base `8d142227d712d27e363b15903dba9b0c99a04bc8`. The canonical development
database SHA-256 before edits is
`DF33983556CF2C6FF01DF6084AE6619EC5DF5C99B11241FA88B4A88F8E144EEB`.

The architecture is frozen in [Project Homeport Phase 2 Global Shell and
Wayfinding Architecture](Project_Homeport_Phase_2_Global_Shell_and_Wayfinding_Architecture.md).
It establishes eight exclusive shell modes, one typed four-layer navigation
authority, a shared desktop/mobile projection, centralized active matching,
gateway account/global framing, structured personal and workspace orientation,
Community global reachability, and explicit compact/immersive exits.

Phase 1 current-user and authorization remain authoritative. Phase 2 introduces
no schema, migration, identity writer, client capability inference, independent
animation lifecycle, Community content redesign, or empty account routes. The
existing Chronicle Passport receives stable section anchors as a bounded
reachability adapter; Phase 3 retains Personal Harbor reconstruction.

Expected direct closure remains limited to HP-NC-001, HP-NC-006, HP-NC-010,
and HP-NC-016 after governed evidence. HP-NC-008, HP-NC-014, and HP-NC-026 can
advance only partially; their later-phase owners remain unchanged.

## Phase 2 implementation amendment

**Implementation anchor:** `ce9fd8e70f0e906416cf41cd508ec5f2063570cc`.
The frozen architecture was implemented without schema or migration changes.
All 69 page routes receive exactly one typed shell mode; APIs are excluded.
One 32-record registry owns global, workspace, account, and contextual layers,
and one projection supplies equivalent desktop/mobile functional IDs.

The implementation resolved three acceptance-discovered product issues at the
shell owner: desktop outside-click dismissal, route-transition overlay closure,
and Creator navigation overflow at 1280 pixels. The responsive drawer now
begins before the full Creator destination set can collide. Stable Passport
section anchors are a bounded Phase 2 reachability adapter and do not revise
Phase 3 ownership.

The A-U isolated Chromium project passed 21 journeys and produced 20 visually
accepted checksum-bound synthetic images. Representative compact and immersive
exits returned to their owning workspaces; the immersive exit left persisted
Tale Session fields and event count unchanged. These are local branch facts,
not deployment, owner acceptance, or product acceptance.

After governed closure, HP-NC-001, HP-NC-006, HP-NC-010, and HP-NC-016 are
eligible for direct closure. HP-NC-008, HP-NC-014, and HP-NC-026 remain
explicit partial advances with their Phase 3/4/later-state owners preserved.

## Phase 3 architecture freeze amendment

**Decision date:** 2026-08-02. **Source boundary:** completed Phase 2 preparation
SHA `9ba021c7a7efd50083cb7f0d2ef3c2d19e979843`; reconciled `origin/main` and
merge base `8d142227d712d27e363b15903dba9b0c99a04bc8`. The canonical development
database starts at SHA-256
`DF33983556CF2C6FF01DF6084AE6619EC5DF5C99B11241FA88B4A88F8E144EEB`.

The architecture is frozen in [Project Homeport Phase 3 Personal Harbor
Architecture](Project_Homeport_Phase_3_Personal_Harbor_Architecture.md), its
18-section registry, four explicit behavior/projection matrices, and test plan.
Homeport owns coherent presentation; Wayfarer remains the authority for account,
Profile, Passport, history, identity, preferences, privacy, session, and artifact
truth; Harborlight remains the authority for save records and eligible public
projections. Phase 1 typed current-user state and Phase 2 shell/navigation remain
unchanged.

The phase introduces no schema, migration, duplicate identity writer, private
media store, reauthentication grant, export/deactivation/deletion service, or
provider simulator. Sensitive actions use accepted server authorities and
explicit confirmation; unsupported operations are labelled truthfully rather
than represented by decorative controls. `/passport` becomes a record-led
product surface while accepted descendants remain, and the Phase 2 hash anchors
become explicit route compatibility adapters.

No implementation, test result, evidence, nonconformity closure, merge,
deployment, Phase 4 work, or release acceptance is established by this freeze.
