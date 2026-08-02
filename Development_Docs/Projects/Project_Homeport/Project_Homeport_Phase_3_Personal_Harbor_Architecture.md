---
title: Project Homeport Phase 3 Personal Harbor Architecture
audience: product-engineering
status: current
canonical_for: project-homeport-phase-3-personal-harbor-architecture
last_reviewed: 2026-08-02
---

# Project Homeport Phase 3 · Build the Personal Harbor

## Status and source boundary

This record freezes the Phase 3 architecture before product implementation. It is Project Homeport Phase 3, not Project Wayfarer Phase 3. Wayfarer remains the specialist owner of personal truth; Homeport owns its coherent product presentation.

| Field | Frozen value |
| --- | --- |
| Worktree | `C:\Users\kkids\Documents\Codex_TreasureHunt-homeport` |
| Branch | `codex/project-homeport-product-reality-recovery` |
| Phase 3 starting SHA | `9ba021c7a7efd50083cb7f0d2ef3c2d19e979843` |
| Remote branch SHA at start | `9ba021c7a7efd50083cb7f0d2ef3c2d19e979843` |
| Fetched `origin/main` and merge base | `8d142227d712d27e363b15903dba9b0c99a04bc8` |
| Starting divergence | Homeport 8 ahead, 0 behind `origin/main`; 0 ahead, 0 behind its remote branch |
| Canonical database SHA-256 | `DF33983556CF2C6FF01DF6084AE6619EC5DF5C99B11241FA88B4A88F8E144EEB` |
| Schema decision | No schema or migration change |

No newer accepted mainline contract requires reconciliation. Phase 1 `AccountSession`/`wayfarer_account` and typed current-user states remain authoritative. Phase 2 `ProductShell`, eight shell modes, the one navigation registry, active-route matching, and desktop/mobile functional parity remain authoritative.

## Current-source census and disposition

| Capability | Current authority | Phase 3 disposition |
| --- | --- | --- |
| Account, profile, email, credentials, sessions | `src/wayfarer/accounts.ts`, `src/wayfarer/http.ts`, Prisma account/profile models | Reuse; add explicit Homeport owner projections and designed routes. |
| Public Profile, handles, preferences, privacy | `src/wayfarer/profile.ts`, `/api/passport/profile`, `/preferences`, `/privacy`, `/profile/[handle]` | Reuse and harden allowlisted DTOs; preserve handle-history redirects. |
| Profile media | `src/wayfarer/profile-media.ts`, `/api/passport/media`, `/api/profile-media/[id]` | Reuse bounded normalization/private storage. Do not invent Sealed Hold scanner proof or a second store. Expose truthful processing/fallback states and removal. |
| Linked identities | `src/wayfarer/providers.ts`, `/api/passport/providers/*` | Reuse configured provider flows and lockout protection; project only safe owner fields. Remove simulator and implementation inventory from ordinary UI. |
| Chronicle history, Memories, Keepsakes | `src/wayfarer/chronicle-history.ts`, `/api/passport/history/*` | Reuse owner-only, version-pinned projections and consent. Add product routes and owner annotation UI only. Never write One Voyage truth. |
| Artifacts, cases, assemblies, achievements | `src/wayfarer/artifacts.ts`, `/api/passport/artifacts/*`, `/achievements/*` | Reuse receipt-derived owner projections. Add product routes/detail presentation; never infer ownership from shared inventory. |
| Saved Community content | `CommunitySave`, `src/community/social.ts`, Harborlight public projection services | Add a read-only Homeport composition that joins owner save rows to Harborlight-safe public DTOs and omits private, blocked, quarantined, archived, removed, or unavailable subjects. Unsave remains Harborlight-owned. |
| Shell and account menu | `src/navigation/*`, `src/components/shell/ProductShell.tsx` | Cut temporary anchors to canonical Phase 3 routes in the single registry. Preserve one shell and equivalent desktop/mobile IDs. |
| Sounding Line | `testing/*`, `scripts/sounding-line/*` | Register Phase 3 contracts and every changed test through the generated case registry. Raw runners remain diagnostic only. |

High-conflict files are `src/navigation/registry.ts`, `src/navigation/route-classification.ts`, `src/components/shell/ProductShell.tsx`, `src/components/wayfarer/ChroniclePassport.tsx`, `src/wayfarer/profile.ts`, `src/wayfarer/providers.ts`, account/session routes, `playwright.config.ts`, Sounding Line policy records, and Homeport inventories. Prisma schemas are inspected but remain unchanged.

## Frozen route and product-area architecture

### Personal Harbor owner family

`/account` is the private Profile Overview and Personal Harbor home. The canonical owner sections are:

- `/account/profile`
- `/account/personal-information`
- `/account/preferences`
- `/account/accessibility`
- `/account/notifications`
- `/account/privacy`
- `/account/linked-identities`
- `/account/security`
- `/account/sessions`
- `/account/data`

One shared Personal Harbor layout supplies profile context, grouped persistent desktop navigation, the equivalent mobile section navigator, active state, mutation announcements, dirty-state protection, and a return to Overview. `ProductShell` remains the sole global shell; the Personal Harbor layout never adds another global account menu.

### Public Profile relationship

`/profile/[handle]` remains the public projection route. `/account/profile` is an owner editor and preview controller; it does not render a privileged approximation of the public page. Preview and the real public route consume the same allowlisted public Profile projection. Email, account/profile IDs, provider subjects/tokens/scopes, private history, hidden artifacts, private collections, sessions, moderation data, and internal status are absent.

### Chronicle Passport relationship

`/passport` remains a distinctive private Chronicle product home, not an account-settings form. Descendants are `/passport/history`, `/passport/history/[recordId]`, `/passport/memories`, `/passport/artifacts`, `/passport/artifacts/[artifactId]`, and `/passport/saved`. Passport uses accepted Wayfarer projections and links back to Profile Overview. It does not duplicate Personal Harbor forms or expose provider simulators, adapter inventories, raw enums, database forms, or manual reconciliation controls.

### Compatibility cutover

The old `/passport#profile`, `#preferences`, `#privacy`, `#history`, and `#artifacts` targets map client-side to the canonical routes and retain an immediate visible fallback link. The new destinations are respectively `/account/profile`, `/account/preferences`, `/account/privacy`, `/passport/history`, and `/passport/artifacts`. No form remains at the legacy anchor. Existing account claim and merge URLs keep their tokenized shell treatment.

## Section taxonomy and navigation

The canonical section registry is `Project_Homeport_Phase_3_Section_Registry.json`. Logical groups are Profile, Experience, Privacy and connections, Chronicle Passport, and Account. Desktop uses a sticky left navigator below the ProductShell header. Mobile uses an in-page disclosure/sheet control with the exact same section IDs and destinations; it does not require a global account-menu round trip. Both presentations use the single registry and mark the current route with `aria-current="page"`.

The Phase 2 account menu changes only through `src/navigation/registry.ts`: View My Profile → `/account`; Preferences → `/account/preferences`; Privacy & Safety → `/account/privacy`; Chronicle History → `/passport/history`; Artifact Cabinet → `/passport/artifacts`; Security & Sessions → `/account/security`. Chronicle Passport remains `/passport`.

## Owner and public DTO boundaries

All Phase 3 routes return explicit DTOs. Raw Prisma objects are not HTTP responses.

| DTO | Contents | Explicit exclusions |
| --- | --- | --- |
| `PersonalHarborOverviewDto` | display name, handle/no-handle state, biography presence/text, safe media URLs, account verification label, capability labels, real supported summary states/counts | IDs, email-as-identity, role rows, session metadata, private provider data |
| `OwnerProfileDto` | editable display name, handle, biography, default visibility, media display facts, revision | account/profile IDs, raw preference JSON, credentials, audit, moderation |
| `PublicProfileDto` | allowlisted handle, display name, biography when permitted, media URLs, public linked labels, public artifact projection | every private account or owner-only field |
| `PersonalInformationDto` | primary display email, verification label, created date, account/claim availability labels | password/credential data, raw account status, IDs, role/audit data |
| `PreferenceDto` | typed V1 preferences plus revision and truthful delivery/consumer notes | raw JSON, unsupported settings |
| `LinkedIdentityDto` | provider label, connection state, safe display label, linked/verified dates, visibility, sign-in eligibility | subject, token, scopes, callback/config/debug values |
| `SessionDto` | opaque action key, safe device label, created/last-active/expiry times, current marker | token/hash, IP, raw user agent, account ID |
| `SavedContentDto` | subject kind, title, safe summary/label, governed detail URL, creator label when public | raw save row, private subject, storage/scanner/moderation fields |

Foreign-account access to owner endpoints fails without existence disclosure. Restricted and missing profiles receive typed unavailable/denied states rather than guessed data.

## Mutation and concurrency behavior

Every editable surface implements the states in `Project_Homeport_Phase_3_Mutation_State_Matrix.csv`: initial loading, ready/clean, ready/dirty, validation error, pending, success, failure, stale conflict, reset pending, and dependency unavailable as applicable. Success accepts the server DTO, clears dirty state, announces the result, refreshes current-user context when identity changes, and never relies on stale optimistic data.

Profile and typed-preference mutations use their persisted `updatedAt` value as a revision token. A mismatch returns a conflict response and preserves local edits for explicit Reload latest or Retry. Privacy rules use a server-derived revision from the current rule set. Routes reject unknown mutation keys and mass assignment.

Internal Personal Harbor navigation consults a shared dirty registry. A dirty navigation attempt opens a focused confirmation with Stay and Discard and continue. Forms may add Save and continue only where the owning mutation can complete deterministically. `beforeunload` is a last-resort browser guard while dirty, never the only protection. Successful save/reset removes the warning.

## Sensitive-action policy

The current accepted backend has no transient password-reauthentication grant. Phase 3 therefore does not invent one. Ordinary viewing never asks for another password. Email change, password change-in-session, export, deactivation, and deletion are classified honestly as unsupported or routed through the accepted reset/recovery lifecycle where applicable.

Session revocation and Sign Out Everywhere require a valid canonical `AccountSession`, CSRF, an explicit confirmation, and authoritative response. Reauth is `NOT_CURRENTLY_SUPPORTED` rather than simulated. Current-session revocation is presented as sign-out, not an ordinary row action. Provider unlink uses existing last-login protection and confirmation; it is denied if accepted recovery/sign-in viability would be lost. The full policy is in `Project_Homeport_Phase_3_Sensitive_Action_Matrix.csv`.

## Media behavior

Profile images retain the accepted Wayfarer Phase 2 media boundary: bounded PNG/JPEG/WebP input, decoded dimension/pixel limits, rotation/normalization to PNG, generated hash-addressed key, restricted profile-media root, owner update, and permission-aware no-store delivery. The UI distinguishes selection, upload pending, safe local processing, accepted, replacement, removal, failure, dependency unavailable, and fallback. It never exposes a key or claims a ClamAV/Sealed Hold scan. Protected Memory, Keepsake, artifact, and display-case media remain Sealed Hold-owned through opaque ports; Phase 3 adds no storage provider.

## History, artifacts, and saved content

One Voyage remains the immutable runtime/history fact owner. Wayfarer projections remain rebuildable, owner-only, version-pinned, and annotation-preserving. History viewing never mutates progression; only reflection, Memory, private Keepsake, consent, artifact personalization, display-case presentation, and achievement showcase operations use their accepted services.

Artifact ownership requires `ArtifactGrantReceipt`; shared inventory is at most witnessed/unresolved. Public artifact data continues through `publicArtifactProjection` only.

Saved-content reads begin from the authenticated account's `CommunitySave` rows and return only currently eligible Harborlight projections. Direct save-row data is never returned. Unknown, private, crew-only, unlisted, blocked, quarantined, archived, removed, or missing subjects are omitted without revealing why. Unsave calls the existing Harborlight mutation with CSRF and removes the card only after the authoritative response.

## Security, sessions, and account-data availability

`AccountSession` remains the only ordinary session authority. The Sessions page displays safe device/time fields, separates current from other sessions, confirms revocation, announces pending/success/failure, and broadcasts current-user invalidation after any current/all-session action. Tale Session/Voyage business records are untouched.

The Data & Account section classifies each operation as `AVAILABLE`, `PROVIDER_DEPENDENT`, `NOT_CURRENTLY_SUPPORTED`, or `REQUIRES_REAUTHENTICATION`. Privacy documentation and sign-out/session controls are available. Account export, deactivation, and deletion are not currently supported because no accepted export, retention, tombstone, or destructive account service exists. No decorative mutation control is rendered.

## Accessibility, visual system, and motion

Semantic landmarks, heading order, labelled controls, live mutation regions, keyboard operation, visible focus, dialog focus containment/restoration, 200% zoom, 390×844 layout, color-independent state, and no horizontal overflow are acceptance contracts. Mobile and desktop section IDs are identical. Error and unavailable states are distinguishable from empty states.

The visual system extends the Phase 2 deep-teal, parchment, brass, and warm-ink shell with a calm Personal Harbor card/rail system. Profile Overview is identity-led; Passport is record-led and more journal-like. Forms are grouped into comprehensible panels rather than raw walls. Motion uses Lanternwake/platform primitives only: bounded route/hero/card emphasis in full/gentle modes and immediate semantic final states in reduced mode. Motion never delays access or carries exclusive meaning.

## Test contracts and evidence

The applicable Sounding Line contracts are the 39 `homeport.*` Phase 3 contract IDs in the governing directive. They map to unit/service, API, component, and the dedicated Phase 3 browser family. The browser fixture uses reserved synthetic accounts, copied SQLite, task-owned profile/protected-media roots, task-owned port and browser state, deterministic IDs/checksums, and no real Chronicle prose, photos, locations, or credentials. Raw Vitest/Playwright runs are diagnostic; Sounding Line subsystem and mainline finalizer decisions are authoritative.

Evidence requires the named 29-image minimum, checksum/source binding, screen/journey cross-references, and human visual inspection. Empty, dependency-unavailable, stale-conflict, mobile, zoom, keyboard, and reduced-motion states are first-class evidence, not inferred from a happy path.

## Rollback and forward fix

No schema or migration rollback exists because Phase 3 changes no persistence shape. Product rollback is a source revert of the Phase 3 implementation commits while preserving Phase 0–2 history, Wayfarer/Harborlight records, and canonical database state. Compatibility anchors remain until a later governed removal. A defect in a new owner composition or route is forward-fixed behind existing service boundaries; it never triggers deletion/reprojection of personal history or artifact truth. No merge, deployment, Phase 4 work, or provider activation is authorized by this record.
