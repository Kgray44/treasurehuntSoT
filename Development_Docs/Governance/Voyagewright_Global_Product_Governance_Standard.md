---
title: Voyagewright Global Product Governance Standard
audience: product-engineering
status: current
canonical_for: voyagewright-global-product-governance
last_reviewed: 2026-08-01
source_sha256: 3EF85AAEB0F155725FC2C96CC54C5B0A1EC79A47A2A7B56B56ECF3883C520165
---

# VOYAGEWRIGHT

# GLOBAL PRODUCT GOVERNANCE STANDARD

Permanent Rules for Coherent Identity, Navigation, Discoverability, Visual Quality, Integration, and Human-Validated Completion

Version 1.0 | Governing Baseline | July 31, 2026

> **Governing Principle**
>
> Voyagewright is one coherent product for one person. A capability does not exist merely because code, tables, APIs, routes, or tests exist. It exists when a person can discover it, understand it, use it, leave it, return to it, and recover from failure through the intended interface.

<div style="page-break-after: always;"></div>

# Document Control

Purpose. This standard establishes permanent product-quality and integration rules for every future Voyagewright project, phase, prompt, design record, implementation, review, merge, release, and maintenance task.

Authority. This standard governs all product-facing work unless a later approved revision explicitly supersedes a requirement. Project-specific governing documents may add stricter requirements but may not weaken these rules silently.

Scope. The standard covers unified account behavior, session continuity, global navigation, route reachability, profile and account information architecture, Community Harbor, visual quality, page-state completeness, responsive behavior, accessibility, user journeys, completion language, Codex obligations, evidence, owner acceptance, and change control.

| Field                      | Governing value                                                       |
| -------------------------- | --------------------------------------------------------------------- |
| Document ID                | VW-PG-001                                                             |
| Document title             | Voyagewright Global Product Governance Standard                       |
| Version                    | 1.0                                                                   |
| Date                       | July 31, 2026                                                         |
| Status                     | Mandatory governing baseline                                          |
| Primary platform           | Voyagewright / Chronicles platform                                    |
| Product identity authority | Project Wayfarer and Universal Language, constrained by this standard |
| Community authority        | Project Harborlight, constrained by this standard                     |
| Navigation authority       | True North / platform shell, constrained by this standard             |
| Verification authority     | Project Sounding Line                                                 |
| Motion authority           | Project Lanternwake                                                   |
| Owner acceptance authority | The product owner after a running-product walkthrough                 |

## Normative Language

The words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, and MAY are normative. MUST-level rules are completion gates. A SHOULD-level rule requires a written explanation when not followed. Silence, convenience, existing code, a passing test, or a completion receipt is not an approved exception.

## Precedence

1. This Global Product Governance Standard governs product coherence, discoverability, visual quality, and human acceptance.
2. Accepted project governing documents govern their specialized domains when they do not conflict with this standard.
3. The current fetched repository governs implementation names, paths, and present technical facts.
4. Current design records govern approved implementation decisions.
5. Individual prompts govern only the task scope and may not weaken a higher authority.
6. Completion messages, stale reports, old branches, and chat recollections have no power to override current product reality.

## Revision History

| Version | Date       | Status             | Summary                                                                                                                                                                                                                                           |
| ------- | ---------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-07-31 | Governing baseline | Established permanent product-reality, unified-account, navigation, route-reachability, visual-quality, journey-validation, and owner-acceptance rules after the July 31 product walkthrough exposed major integration and presentation failures. |

<div style="page-break-after: always;"></div>

# Contents

- 1. Executive Summary
- 2. Authority, Scope, and Product Constitution
- 3. July 31 Product Reality Findings
- 4. Canonical Product Ownership and Integration Boundaries
- 5. One Account, One Session, Many Capabilities
- 6. Account Creation, Sign-In, Recovery, and Sign-Out
- 7. Global Shell and Navigation
- 8. No Orphaned User-Facing Routes
- 9. Global Account Menu
- 10. Account and Profile Hub
- 11. Chronicle Passport, History, Artifacts, and Saved Content
- 12. Community Harbor Product Experience
- 13. Community Discovery, Districts, Cards, and Filters
- 14. Visual Design and Component Quality
- 15. Responsive, Mobile, Accessibility, and Motion
- 16. Complete Page-State Contracts
- 17. End-to-End Journey Acceptance
- 18. Representative Data and Demonstration State
- 19. Product Maturity and Completion Language
- 20. Owner Walkthrough and Product Acceptance
- 21. Sounding Line Verification Integration
- 22. Mandatory Codex and Prompt Governance
- 23. Repository Control Artifacts
- 24. Change Control, Exceptions, and Debt
- 25. Immediate Nonconformity Register
- 26. Adoption and Enforcement
- Appendix A. Route Inventory Schema
- Appendix B. Screen Acceptance Record
- Appendix C. Journey Acceptance Matrix
- Appendix D. Product-Facing Completion Report
- Appendix E. Codex Preflight and Closure Checklists
- Appendix F. Glossary
- References
- Final Governing Rule

<div style="page-break-after: always;"></div>

# 1. Executive Summary

Voyagewright has accumulated substantial architecture, security, migration, animation, identity, Community, history, artifact, and verification work. The July 31, 2026 walkthrough demonstrated that a large quantity of implementation can coexist with a deeply incomplete product experience. The account system was fragmented across several sign-in surfaces, session state was inconsistent between workspaces, registration was not discoverable, sign-out provided no dependable visible transition, Community Harbor was hidden behind a manually typed route, major Community pages rendered as raw lists and browser-default controls, and the Chronicle Passport resembled one long engineering form instead of a designed personal hub.

This standard exists because those failures were not isolated cosmetic defects. They were failures of governance. Earlier work allowed infrastructure completion, API reachability, schema validity, privacy tests, accessibility scans, or isolated browser checks to stand in for product completeness. The system therefore proved that many pieces existed without proving that a person could naturally use the resulting whole.

The permanent correction is not to distrust engineering evidence. It is to place that evidence in the correct hierarchy. Code, tests, and architecture remain necessary. They become insufficient when a task affects human-facing behavior. Product-facing completion now requires coherent information architecture, visible navigation, one account and session model, complete page states, responsive and accessible presentation, representative content, real browser journeys begun from natural entry points, and an owner walkthrough of the running product.

> **Central Rule**
>
> Product reality outranks implementation theater. A route that returns 200 but cannot be found is not a finished feature. A profile backed by thirty tables but presented as a raw form is not a finished profile. A Community system with 1,000 tests but no designed library is not a finished Community Harbor.

This standard is intentionally permanent. Project Homeport, the immediate recovery program, will use it to repair the present failures. Every project after Homeport must obey it so the repository does not again become a technically sophisticated collection of invisible or unusable features.

![Figure 1. Product governance authority chain. Product acceptance requires implementation truth, Sounding Line evidence, and owner acceptance to agree.](figure_01_authority_chain.png)

## 1.1 Required Outcomes

- One canonical account and session experience across Player, Captain, Creator, Community, profile, and administrative capabilities.
- One global shell and navigation model for every ordinary non-immersive human-facing page, including the gateway.
- No ordinary human-facing route reachable only by manually editing or typing a URL.
- A designed account menu and profile hub rather than a collection of unrelated links and forms.
- A Community Harbor that behaves like a rich content library before any search is entered.
- Consistent, polished, responsive, accessible components and page states across all workspaces.
- Browser-driven journey acceptance that starts from the application entry point and uses visible controls.
- Completion wording that distinguishes code, integration, visual completion, journey validation, and owner acceptance.
- Mandatory repository artifacts that allow Codex, humans, Sounding Line, and reviewers to detect regressions automatically.

# 2. Authority, Scope, and Product Constitution

## 2.1 Product Constitution

The following statements are constitutional constraints. They are not phase suggestions and do not expire when an implementation becomes inconvenient.

| Constitutional rule          | Mandatory meaning                                                                                                                                                                                              |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One Product                  | Voyagewright MUST feel like one platform. Player, Captain, Creator, Community, Profile, Chronicle discovery, and account management are related workspaces, not detached applications sharing a color palette. |
| One Person                   | One real person MUST have one canonical account and one canonical profile. Player, Captain, Creator, Moderator, and Administrator are capabilities of that person.                                             |
| One Session Truth            | A signed-in state MUST be projected consistently across every workspace. Signing in through one legitimate entry MUST make the person signed in everywhere their account applies.                              |
| One Navigation Truth         | Global navigation, workspace navigation, account navigation, and contextual navigation MUST be generated from one governed route and capability model.                                                         |
| No Hidden Ordinary Features  | Every ordinary user-facing route MUST be discoverable and reachable through the interface. A direct URL MAY support bookmarking or sharing but MUST NOT be the only route to ordinary functionality.           |
| Visual Quality Is Functional | Raw browser controls, unstructured forms, plain lists, broken hierarchy, inconsistent spacing, and blank pages are functional defects on a product-facing surface.                                             |
| Complete States              | Every page and control MUST define loading, ready, empty, error, unauthorized, offline, pending, success, and recovery behavior where applicable.                                                              |
| Journey Over Route           | A feature MUST be validated through the journey that makes it useful, not only by loading its isolated route.                                                                                                  |
| Evidence Over Optimism       | A completion claim MUST match reproducible evidence and current running behavior.                                                                                                                              |
| Owner Acceptance             | Major product-facing work reaches PRODUCT ACCEPTED only after the owner inspects the running experience and accepts it.                                                                                        |

## 2.2 Applicability

This standard applies whenever a change can alter what a person sees, understands, reaches, enters, exits, or believes. It applies to new pages, route changes, account and session behavior, role or capability changes, navigation, profile settings, Community features, content cards, empty states, errors, loading, responsive layouts, accessibility, motion, public projections, and any backend change that alters these behaviors.

Purely internal work MAY have narrower visual obligations. However, an internal task that creates a future human-facing route, placeholder component, hidden control, compatibility surface, or new session type is product-facing for governance purposes. Naming a route “internal for now” does not exempt a visible defect when that route is later exposed without redesign.

## 2.3 Prohibited Governance Shortcuts

- Calling a feature complete because the database schema exists.
- Calling a feature complete because API routes return successful status codes.
- Calling a feature complete because TypeScript, lint, build, or migration checks pass.
- Calling a feature complete because Axe reports no serious or critical violations.
- Calling a feature complete because a browser test reached the route using page.goto().
- Calling a feature complete because a placeholder route renders text instead of throwing.
- Deferring navigation, empty states, error states, or visual integration to an undefined later polish phase.
- Creating separate login pages for workspaces when one canonical account already exists.
- Leaving a user-facing route out of navigation because its URL is documented.
- Using an owner-unreviewed completion receipt as proof that the product experience is acceptable.

# 3. July 31 Product Reality Findings

The July 31 walkthrough is a formal governance incident. It revealed defects that must become permanent regression targets. The purpose of recording them is not to preserve a bad implementation as a museum exhibit. It is to prevent future tasks from repeating the same category of failure while reporting success.

## 3.1 Observed Failures

| ID     | Observed failure                                                                                                                                   | Why it is severe                                                                                        |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| PR-001 | The gateway omitted the persistent account control and global shell.                                                                               | The first page concealed account state and broke global consistency at the primary entry point.         |
| PR-002 | Separate Player, Captain, Creator, and generic sign-in routes remained visible as distinct experiences.                                            | The platform presented capabilities as different identities despite governing one-account requirements. |
| PR-003 | The generic sign-in screen did not visibly offer account creation, recovery, or a coherent account lifecycle.                                      | A person could not understand how to join, recover access, or progress after authentication.            |
| PR-004 | Signing in through a Player path did not reliably authenticate the account shell and Passport.                                                     | Multiple session authorities produced contradictory identity state.                                     |
| PR-005 | The account dropdown provided a summary, two links, workspace links, and Sign out rather than a complete account menu.                             | The most important personal control surface was treated as a small utility menu.                        |
| PR-006 | Sign out appeared to do nothing.                                                                                                                   | Session mutation lacked dependable context refresh, redirect, confirmation, and visible state change.   |
| PR-007 | Chronicle Passport displayed “Sign in again to continue” after another sign-in flow.                                                               | The platform contradicted the person’s observed authentication state.                                   |
| PR-008 | Security was elevated as one of only two top-level account destinations.                                                                           | Information architecture was organized around implementation surfaces rather than human needs.          |
| PR-009 | Chronicle Passport rendered a long sequence of plain forms and anchor links.                                                                       | Substantial profile capability existed without a designed profile experience.                           |
| PR-010 | Community Harbor was absent from normal navigation and required typing /community.                                                                 | A major platform capability was effectively undiscoverable.                                             |
| PR-011 | Community Harbor rendered a heading, ordinary list, search form, fieldsets, and empty search output.                                               | The public discovery product had not received a product design layer.                                   |
| PR-012 | Community district pages such as Artifacts were nearly empty raw pages.                                                                            | Content architecture and detail discovery were not implemented as a coherent library.                   |
| PR-013 | Community defaulted to search and filters rather than visible content.                                                                             | The library required a query before it felt populated or useful.                                        |
| PR-014 | Visual styling differed radically from established Player, Captain, Studio, and Chronicle surfaces.                                                | The platform felt like detached applications rather than one product.                                   |
| PR-015 | Automated completion evidence emphasized migrations, tests, privacy, and reachability but did not prove owner-intended visual and journey quality. | The acceptance system rewarded implementation depth while missing product reality.                      |

## 3.2 Root Causes

The failures share five root causes. First, account identity was consolidated in data architecture but not fully converged in user-facing flows and session projection. Second, navigation was treated as route registration rather than product information architecture. Third, major projects allowed skeletal pages to count as implemented surfaces. Fourth, tests proved isolated contracts while rarely beginning at the real gateway and navigating like a person. Fifth, completion language collapsed several maturity stages into one emotionally satisfying but technically misleading word: complete.

Project Homeport must repair the current implementation. This standard prevents the same roots from being reintroduced by later prompts.

# 4. Canonical Product Ownership and Integration Boundaries

A coherent product still needs specialized owners. Coherence does not mean one giant subsystem controls everything. It means each project owns one domain and integrates through governed contracts instead of creating a parallel experience.

| Domain                                                                         | Primary authority                | Required product boundary                                                                                                |
| ------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Canonical account, profile, preferences, privacy, history, artifacts           | Project Wayfarer                 | MUST provide one person-level identity and one profile experience. MUST NOT create workspace-specific credentials.       |
| Community discovery, publication, social interaction, collections, Voyage Logs | Project Harborlight              | MUST feel native to Voyagewright and use canonical identity, navigation, design, privacy, and motion.                    |
| Global shell, route classification, workspace navigation                       | True North / platform navigation | MUST expose all ordinary destinations and capabilities without duplicating account or Community logic.                   |
| Progression and runtime truth                                                  | Project One Voyage               | MUST remain authoritative for Chronicle and Voyage state. MUST NOT own account UI or global navigation.                  |
| Private assets and protected content                                           | Project Sealed Hold              | MUST expose narrow safe ports. MUST NOT create a second profile, Community, or navigation experience.                    |
| Presentation truth and animation ownership                                     | Project Lanternwake              | MUST own substantial scenes and reduced-motion policy. MUST NOT substitute presentation success for product correctness. |
| Verification and release evidence                                              | Project Sounding Line            | MUST enforce journeys, route reachability, visual evidence, accessibility, and truthful status.                          |
| Authoring verification                                                         | Project Drydock                  | MUST validate Chronicles. MUST NOT become a general product acceptance substitute.                                       |
| Terminology and product voice                                                  | Universal Language               | MUST keep names and messages coherent across all workspaces.                                                             |

> **Integration Rule**
>
> No project may create a second account system, second global shell, second profile hub, second Community identity, second route registry, or second product design language merely because integration is inconvenient.

## 4.1 Required Contract Review

Every product-facing prompt MUST identify which authorities it touches and which contracts it consumes. When a prompt changes a shared surface, it MUST inspect current owners before implementation. A Community prompt touching account menus must coordinate with Wayfarer and navigation. A Wayfarer prompt touching Community saves must use Harborlight contracts. A True North prompt changing route visibility must preserve Wayfarer capabilities and Harborlight reachability. This review belongs in the task design record and Sounding Line plan.

# 5. One Account, One Session, Many Capabilities

![Figure 2. Canonical identity model. A single account and session context project capability-based access into every workspace.](figure_02_unified_account.png)

## 5.1 Canonical Identity Rule

A real person MUST authenticate through one canonical account system. Player, Captain, Creator, Moderator, and Administrator are capability assignments. Workspaces may present different home pages and tools, but they MUST resolve the same account ID, session, profile, display name, preferences, privacy rules, and sign-out state.

Legacy identities MAY remain during controlled migration. They MUST become compatibility records or aliases, not competing user-facing account authorities. New writes MUST use the canonical account and session architecture.

## 5.2 Required Session Properties

- One authoritative account session cookie or equivalent credential for normal web use.
- One server-side session validation path shared by all ordinary workspaces.
- One client-facing account context contract with authenticated state, profile summary, capabilities, and session freshness.
- Cross-tab and cross-route refresh after sign-in, sign-out, role changes, profile changes, and session revocation.
- Explicit session expiry, invalidation, and recovery behavior.
- No implicit authentication inferred from route family or stale client state.
- No workspace-specific session that can contradict canonical account state.
- Compatibility sessions must either exchange into the canonical session or remain visibly isolated as legacy migration paths that ordinary users do not encounter.

## 5.3 Capability Projection

The shell MUST derive visible workspaces and actions from canonical capabilities. A person with Player and Creator access signs in once and may move between Player and Creator workspaces. A person without Captain access may see a clear request or locked explanation where appropriate, but MUST NOT be sent to a separate Captain identity system.

Authorization remains server-side. Hiding a menu item is not authorization. Showing a locked item is not a grant. The same capability contract MUST drive navigation, route guards, API authorization, workspace switching, and account-menu presentation.

## 5.4 Session Continuity Acceptance

The following sequence is a mandatory regression journey: create or use one account, sign in once, open Player, Profile, Community, Captain when authorized, and Creator when authorized, then return to the gateway. Every page MUST display the same person and correct capabilities. No page may request another ordinary sign-in. Sign out from any non-immersive surface MUST invalidate the session everywhere and produce an immediate visible anonymous state.

# 6. Account Creation, Sign-In, Recovery, and Sign-Out

## 6.1 Canonical Public Routes

The platform SHOULD expose one primary route for each account lifecycle action. Recommended canonical routes are /register, /sign-in, /forgot-password, /reset-password, /verify-email, /account/security, and /profile or /passport according to the approved information architecture.

Routes such as /player/sign-in, /captain/sign-in, and /studio/sign-in MAY remain only as compatibility aliases. They MUST redirect to the canonical sign-in flow with a validated return destination, for example /sign-in?returnTo=/studio/library. They MUST NOT render different credentials, language, session semantics, or visual systems.

## 6.2 Sign-In Page Requirements

- Clear product branding and explanation of the account relationship to all workspaces.
- Email or approved legacy alias input and password input.
- Visible Create Account action.
- Visible Forgot Password action.
- Optional guest or invitation continuation only when the current flow supports it truthfully.
- Provider sign-in only when configured and genuinely available.
- Pending, success, invalid-credential, locked, unverified, offline, rate-limited, and server-error states.
- Preservation and validation of a safe return destination.
- No raw developer wording, generic “request completed” messages, or ambiguous success without navigation.
- Keyboard, autofill, password-manager, mobile, zoom, and screen-reader support.
- Visual design consistent with the gateway and platform shell.

## 6.3 Registration Requirements

- Visible from every anonymous account menu and sign-in page.
- Clear fields, password guidance, validation, terms acknowledgement where applicable, and privacy explanation.
- Creation of one account, one profile, and baseline Player capability.
- Email verification behavior that does not strand the user on an unexplained page.
- Post-registration destination chosen from safe return intent or a designed onboarding flow.
- No separate registration by workspace.
- No use of private email as the default public display identity.
- Idempotent handling of repeated submission and existing-account conflicts.

## 6.4 Recovery and Verification

Password reset and email verification flows MUST have complete tokenized deep-link support, but ordinary entry into recovery MUST remain visible from sign-in and account security. Tokenized routes are allowed deep-link-only exceptions because their purpose depends on a secure token. They still require clear context, expiration behavior, retry, support guidance, and a safe route back to sign-in.

## 6.5 Sign-Out Contract

Sign out is a complete user journey, not a server-side cookie deletion. It MUST revoke the current canonical session, clear compatibility sessions as governed, invalidate cached account context, close the account menu, redirect or refresh to a deliberate anonymous destination, update every open client surface, and announce success accessibly. A failure MUST be visible and recoverable. A button that silently posts while the interface continues showing the user is a defect.

# 7. Global Shell and Navigation

![Figure 3. Layered navigation model. Global, workspace, and contextual navigation work together without hiding destinations or overwhelming active Chronicle experiences.](figure_03_navigation_architecture.png)

## 7.1 Persistent Shell Coverage

Every ordinary non-immersive human-facing page MUST render the approved global shell. This includes the gateway, public discovery, Community Harbor, account and profile pages, Player and Captain libraries, Creator Studio, Chronicle discovery, help, and other ordinary surfaces. Immersive Chronicle play MAY use a compact shell, but account recovery, safe exit, and essential session state must remain reachable according to the immersive design.

Authentication routes MAY use a simplified shell, but they MUST provide a clear return to Voyagewright and preserve the canonical design language. Token callbacks and internal service pages are not ordinary surfaces.

## 7.2 Global Shell Responsibilities

- Product mark and home behavior.
- Visible access to Explore Chronicles.
- Visible access to Community Harbor.
- Workspace switching or a workspace menu when authenticated.
- Account control on the gateway and all ordinary pages.
- Responsive mobile menu with functional parity.
- Current route and workspace context.
- Focus management, Escape behavior, outside-click behavior, and accessible naming.
- No duplicate or competing headers created by individual pages.
- No route family that bypasses the shell merely because its first implementation was a prototype.

## 7.3 Workspace Navigation

Each workspace MAY emphasize its own tasks, but it MUST not isolate the person from the broader product. Player navigation should prioritize My Voyages and relevant personal surfaces. Captain navigation should prioritize live and planned Voyages. Creator navigation should prioritize Chronicle authoring, assets, verification, publishing, and Exchange. Community and account access must remain logically available without competing with active critical controls.

## 7.4 Contextual Navigation

Lists, cards, tabs, breadcrumbs, section menus, and back controls connect global destinations to detail pages. A dynamic detail page MUST identify its parent and provide a deliberate return path. Browser Back support is necessary but not sufficient. Users should not need to remember where they came from to escape a page.

# 8. No Orphaned User-Facing Routes

![Figure 7. Route reachability contract. Every ordinary page documents how it is discovered, entered, left, and recovered.](figure_07_route_reachability.png)

## 8.1 Non-Negotiable Navigation Invariant

> **No Hidden URL Rule**
>
> No human-facing Voyagewright page may exist as an orphaned or hidden URL. Every ordinary static or dynamic destination must be reachable through at least one visible, logical, permission-aware path inside the product.

Direct URL entry MAY support bookmarks, shared content, invitations, password reset, email verification, and other deliberate deep links. It MUST never be required to discover or use ordinary functionality such as Community Harbor, Profile, Artifact Cabinet, Creator Exchange, settings, or workspace libraries.

## 8.2 Route Classification

| Classification      | Definition                                                                              | Navigation requirement                                                                        |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| NAVIGABLE_PAGE      | Ordinary human-facing page.                                                             | Requires visible desktop and mobile entry paths, logical parent, and return path.             |
| CONTEXTUAL_DETAIL   | Dynamic detail reached from a list, card, result, history, collection, or relationship. | Requires at least one governed source list or contextual link.                                |
| TOKENIZED_DEEP_LINK | Reset, verification, invitation, or similarly token-bound route.                        | May be deep-link-first; requires explanation, expiration handling, recovery, and onward path. |
| INTERNAL_SERVICE    | API, callback, webhook, health, static asset, or machine surface.                       | No ordinary navigation required; must not masquerade as a user page.                          |
| DEVELOPMENT_ONLY    | Debug, showcase, fixture, or development route.                                         | Must be excluded or protected in production and documented.                                   |
| COMPATIBILITY_ALIAS | Legacy URL redirecting into a canonical flow.                                           | Must preserve safe intent and never render a competing experience.                            |

## 8.3 Required Route Metadata

- Route ID and pattern.
- Classification.
- Workspace and logical parent.
- Desktop entry path and visible control.
- Mobile entry path and visible control.
- Authentication and capability requirements.
- Anonymous, unauthorized, and locked behavior.
- Return or back path.
- Empty-state onward action.
- Dynamic source list or relationship for contextual details.
- Deep-link behavior and safe return destination.
- Owner and protected product contract.
- Associated journey tests and screenshot evidence.

## 8.4 Automated Orphan-Route Gate

The repository MUST compare the actual page-route inventory with the governed route registry. Sounding Line MUST fail product-facing validation when an ordinary page lacks metadata, no visible link reaches it, mobile parity is missing, a link points to a nonexistent route, a detail page has no source list, or a route redirects to an unrelated legacy sign-in.

For ordinary navigation acceptance, browser tests MUST begin from a natural entry such as the gateway, account menu, workspace home, Community home, or parent list. Direct page.goto calls MAY be used to test deep links, authorization, or route isolation, but cannot be the only proof of discoverability.

# 9. Global Account Menu

## 9.1 Purpose

The account control is the persistent personal doorway into Voyagewright. It MUST communicate current identity, provide account and profile access, support workspace movement, and make sign-in or sign-out obvious. It is not a placeholder summary with two links.

## 9.2 Anonymous Account Menu

- Welcome statement explaining that one account reaches all authorized Voyagewright workspaces.
- Create Account as a primary action.
- Sign In as a primary or equivalent action.
- Continue as Guest only where supported and clearly scoped.
- Optional explanation of profile, history, saved content, and cross-device continuity.
- No workspace-specific login options presented as separate accounts.
- No “Choose a workspace” link used as a substitute for account creation or sign-in.

## 9.3 Authenticated Account Menu

The exact grouping may evolve, but the account menu MUST expose the following concepts directly or through clearly named grouped destinations:

- Profile summary with avatar, display name, handle, and View My Profile.
- Account Settings or Personal Information.
- Preferences and Accessibility.
- Privacy and Safety.
- Notifications.
- Linked Accounts or Identities.
- Chronicle History / Chronicle Passport.
- Artifact Cabinet.
- Saved Community Content or Collections.
- Security and Sessions.
- Workspace switching for authorized Player, Captain, Creator, and administrative capabilities.
- Sign Out with a dependable visible transition.

The menu MUST not become an unbounded list. Related destinations SHOULD be grouped under Profile, Account, Your Chronicles, and Workspaces. The governing requirement is completeness and clarity, not cramming every route into one rectangle.

## 9.4 Menu Interaction Quality

- Opens and closes with keyboard, pointer, touch, Escape, and backdrop interaction.
- Focus enters the menu predictably and returns to the trigger when dismissed.
- Current identity and session state refresh after account mutations.
- No stale profile name after profile update.
- No stale authenticated state after sign-out.
- No clipped menu on small screens or high zoom.
- No off-screen items without an accessible scrolling strategy.
- No important action available only through hover.

# 10. Account and Profile Hub

![Figure 5. Account and Profile Hub. A designed personal center with a strong profile header and organized section navigation.](figure_05_profile_hub.png)

## 10.1 Product Distinction

The Profile is the person-facing identity page. The Account is the private security and personal-data identity. Chronicle Passport is the private history and personal Chronicle record. They MAY live in one integrated hub, but the interface MUST explain their relationship and organize them around human tasks rather than database models.

## 10.2 Required Profile Header

- Large avatar with governed fallback.
- Optional banner or thematic background.
- Display name and public handle.
- Biography or personal introduction.
- Capability indicators presented carefully, not as security claims.
- Profile visibility or preview control.
- Edit Profile action for the owner.
- Public Profile preview when applicable.
- Clear distinction between public and private information.

## 10.3 Required Section Architecture

| Section                      | Required content                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                     | Profile presentation, account summary, recent personal activity, useful shortcuts, and status without exposing private security data. |
| Personal Information         | Display name, handle, biography, email management, locale, and other governed private details.                                        |
| Appearance and Accessibility | Theme, text scale, motion, contrast, captions, transcripts, audio description, autoplay, and bandwidth preferences.                   |
| Notifications                | Product, invitation, Chronicle, Community, moderation, and security notification controls.                                            |
| Privacy and Safety           | Profile visibility, discovery, invitations, blocking, data-sharing boundaries, content warnings, and safety controls.                 |
| Linked Accounts              | Approved external identities, visibility, sign-in permission, connection state, and safe unlinking.                                   |
| Chronicle History            | Invitation and Voyage history, version-pinned records, Memories, reflections, Keepsakes, and filters.                                 |
| Artifact Cabinet             | Personal artifact records, collections, assemblies, favorites, and displays.                                                          |
| Saved Content                | Community saves, favorites, collections, installed items, and followed creators where governed.                                       |
| Security and Sessions        | Password, email verification, active devices, session revocation, recovery methods, and security events.                              |
| Data and Account             | Export, deletion, retention, consent, and support flows when implemented.                                                             |

## 10.4 Layout Requirements

Desktop SHOULD use a persistent left-side section navigator or equally clear two-column structure. Mobile MUST use a compact section selector, drawer, or segmented navigation that preserves all destinations. Long vertical pages MAY exist for a coherent subsection but MUST NOT collapse the entire account domain into one endless form.

Each section MUST own its loading, ready, empty, error, pending, saved, conflict, unauthorized, and offline behavior. Save controls MUST communicate which section changed. Validation MUST be near the affected field. Destructive actions require deliberate confirmation and recovery guidance.

# 11. Chronicle Passport, History, Artifacts, and Saved Content

## 11.1 Chronicle Passport

Chronicle Passport is a first-class private personal experience, not a generic settings page. It MUST open from the account menu, Player workspace, and profile hub without an additional ordinary sign-in. It MUST present version-pinned Voyage Records, invitation history, completion outcomes, reflections, Memories, Keepsakes, crew history, and governed privacy using designed cards, timelines, filters, and detail views.

## 11.2 Authentication Behavior

When a person is not authenticated, protected personal routes MUST present the canonical sign-in experience with a safe return destination. When the canonical account is authenticated but a required profile migration or capability is missing, the page MUST explain and repair that condition. It MUST NOT misleadingly say “Sign in again” merely because another legacy session was expected.

## 11.3 Artifact Cabinet and Saved Content

Artifact Cabinet and saved Community content MUST be reachable from both the profile hub and appropriate workspace navigation. Empty states should explain what appears there and offer a natural route to find or earn content. Detail pages must return to the cabinet, collection, or source Chronicle. Public displays must use sanitized projections and must not expose private notes or provenance.

## 11.4 Human-Centered Presentation

- Use meaningful cards, covers, timelines, badges, metadata, and contextual actions.
- Prioritize names, images, dates, outcomes, and personal meaning over internal IDs and enum values.
- Translate enum-like values into approved product language.
- Use progressive disclosure for advanced privacy, provider, and security details.
- Provide readable histories when media or animation fails.
- Allow keyboard and screen-reader navigation through lists and details.
- Preserve exact historical truth while using current design and accessibility standards.

# 12. Community Harbor Product Experience

![Figure 4. Community Harbor information architecture. Content is visible immediately, while search and filters refine the library.](figure_04_community_ia.png)

## 12.1 Product Mission

Community Harbor is the shared-creation, discovery, organization, interaction, and celebration layer of Voyagewright. It MUST feel like a beautiful native library and harbor, not a generic social feed and not a detached data-management page.

The default experience MUST contain useful visible content without requiring a search. Search exists to refine discovery. It must not be the ritual required to make an empty page acknowledge that content exists.

## 12.2 Required Entry Points

- Primary global navigation on public and authenticated ordinary surfaces.
- Gateway or home entry.
- Explore area connection.
- Player library or profile connection.
- Creator Studio connection for Exchange and published work.
- Captain access outside critical live control mode.
- Account menu access to saved content and Community profile.
- Contextual links from Chronicles, artifacts, creators, history, and collections.

## 12.3 Community Home Composition

- Featured Chronicle or editorial hero area.
- Featured collections or themed shelves.
- Popular or trending Chronicles with governed evidence.
- Recently published or recently updated work.
- Artifacts, maps, audio, templates, and reusable components.
- Creator highlights.
- Guides and Shipwright’s Workshop material.
- Voyage Logs and Keepsakes where public consent permits.
- Personalized or deterministic recommendations where supported.
- Clear routes to browse every district and see all items.

## 12.4 Content Before Search

An empty query MUST produce a curated or sorted browse result. If the development database contains no public records, local development MUST provide a governed demonstration dataset or a deliberately designed empty-state preview. A blank production environment may explain how content will appear, but it must still use complete page design and appropriate calls to action.

## 12.5 Community Identity

Community identity extends the canonical Wayfarer profile. It MUST NOT create another login, email, credential, display-name authority, or avatar authority. Harborlight may own Community-specific creator status, follows, saves, reviews, collections, badges, and public activity. Shared profile fields must come from governed Wayfarer projections.

# 13. Community Discovery, Districts, Cards, and Filters

## 13.1 Districts

At minimum, Community Harbor must support clear first-class navigation for Chronicles, Artifacts, Templates, Maps, Audio, Creators, Collections, Guides, and Voyage Logs. Additional districts MAY be added when their content type is real. Each district MUST have a designed browse state, not merely a heading and “no entries yet.”

## 13.2 Card Contract

Community cards are the primary bridge from browse surfaces to dynamic details. Every supported content type must define a card schema. Cards SHOULD include the following where applicable:

- Governed cover artwork, poster, or intentional fallback illustration.
- Content type and category.
- Title and safe summary.
- Creator display name and handle.
- Difficulty, duration, player count, representation, language, accessibility, or compatibility metadata.
- Rating, installation, completion, save, or update indicators only when supported by authoritative evidence.
- Price or free state only when the platform actually supports it.
- Save, favorite, install, open, preview, or share actions as permitted.
- Clear hover, focus, press, loading, unavailable, and reduced-motion behavior.
- No private storage keys, internal IDs, hidden spoiler text, or raw moderation state.

## 13.3 Search and Filter Hierarchy

The primary search row SHOULD remain compact. Recommended visible controls are search, content type, sort, and one or two high-value quick filters such as difficulty or representation. Advanced filters belong in an expandable panel or drawer. The interface must not greet every visitor with large raw fieldsets containing every possible filter.

Filters MUST preserve URL and Back/Forward state. Active filters must be visible and removable. Clear All must be obvious. Result counts and empty states must explain what happened. Mobile filter controls must be usable without horizontal overflow or microscopic checkboxes.

## 13.4 District Empty States

An empty district MUST still look complete. It should explain what belongs there, whether the absence is global or caused by filters, and offer a useful onward action such as Browse All, clear filters, follow creators, create content, or learn about the content type. Empty states must not be plain developer prose floating in an otherwise vacant page.

## 13.5 Dynamic Details

Every listing, creator, collection, guide, artifact, and Voyage Log detail page MUST be reachable from a visible card, list, history record, relationship, or search result. The detail page MUST provide its parent context, related content, and a return path. A slug route that only works when manually typed is nonconforming even if its API and metadata are correct.

# 14. Visual Design and Component Quality

## 14.1 Visual Quality Is a Completion Gate

A product-facing surface is visually incomplete when it relies on browser-default form layout, ungrouped text, raw list bullets, inconsistent type scale, missing spacing hierarchy, mismatched shells, or empty expanses without purposeful composition. Accessibility does not require visual poverty. Visual design does not excuse inaccessible controls. Both are mandatory.

## 14.2 Design-System Requirements

- Approved typography hierarchy for display titles, page titles, section titles, labels, body, metadata, and helper text.
- Approved spacing tokens and page-width behavior.
- Approved colors, contrast, materials, borders, shadows, and surfaces.
- Buttons with primary, secondary, subtle, destructive, disabled, pending, and success states.
- Inputs, selects, checkboxes, radios, toggles, textareas, file inputs, and validation messages styled consistently.
- Cards, shelves, lists, tabs, sidebars, menus, dialogs, drawers, breadcrumbs, tooltips, and empty states.
- Loading skeletons and progress indicators that do not imply completion prematurely.
- Error and warning treatments that remain readable without color alone.
- Focus indicators, touch targets, hover states, selected states, and keyboard state.
- One product mark and coherent workspace variations rather than unrelated page brands.

## 14.3 Raw Control Prohibition

Ordinary product pages MUST NOT ship with raw browser-default controls arranged inline as the final interface. Native controls may remain semantically native underneath, but they require approved spacing, labels, states, responsive layout, and visual integration. Development tools and emergency administrative diagnostics may use utilitarian designs when explicitly classified, protected, and documented.

## 14.4 Information Hierarchy

Every page must make its purpose, primary action, secondary actions, current state, and next useful step obvious. Headings must describe the person’s task, not the backing subsystem. Labels should use Universal Language. Internal enum names, provider states, or implementation jargon may appear in advanced diagnostic sections but not as default person-facing copy.

## 14.5 Visual Regression Evidence

Major product-facing tasks MUST capture stable desktop and mobile evidence for affected screens. Sounding Line should compare governed screenshots or structured visual assertions while allowing intentional updates through review. A screenshot is not sufficient by itself, but it is required evidence for visual work. Text-only browser assertions cannot prove spacing, hierarchy, clipping, or design integration.

# 15. Responsive, Mobile, Accessibility, and Motion

## 15.1 Functional Parity

Desktop and mobile may use different layouts. They MUST provide the same ordinary destinations and capabilities. A feature visible in desktop navigation but inaccessible on mobile is an orphan route for mobile users. Tablet and high-zoom states must not collapse controls into unusable overflow.

## 15.2 Required Viewports and Zoom

- Representative desktop viewport.
- Representative narrow mobile viewport.
- Representative wide mobile or small tablet where applicable.
- At least 200% browser zoom for ordinary account, profile, Community, and navigation surfaces.
- Landscape or safe-area validation for immersive or map-heavy experiences where applicable.
- No hidden horizontal overflow for ordinary content and forms.

## 15.3 Accessibility

Every destination and journey must remain usable by keyboard and screen reader and must not rely on color, sound, vibration, drag-and-drop, hover, or motion as the sole signal. Semantic headings, landmarks, labels, descriptions, focus order, live regions, error associations, and accessible names are required. Axe or equivalent automation is valuable but does not replace keyboard and screen-reader-oriented journey review.

## 15.4 Motion

Project Lanternwake remains the authority for substantial scenes and resolved motion preferences. Ordinary interface motion should use approved platform patterns. Motion must communicate hierarchy or continuity, not conceal latency or compensate for weak layout. Reduced-motion behavior must preserve state meaning, focus, and navigation. A static or reduced experience must still look designed.

## 15.5 Touch and Input

- Controls use appropriate touch targets and spacing.
- Hover-only menus or information have focus and touch equivalents.
- Drag-and-drop has keyboard and direct-action alternatives.
- File inputs have designed labels and progress.
- Password managers and autofill work on account forms.
- Mobile keyboards, safe areas, and viewport resizing do not hide critical actions.

# 16. Complete Page-State Contracts

Every human-facing page must define its state model. “The route renders” is only one state. The required states depend on the page, but omission must be deliberate and documented.

| State                  | Required behavior                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| INITIAL / LOADING      | Purposeful skeleton or progress state; no false empty message; focus and announcements managed.          |
| READY WITH DATA        | Full designed content and actions.                                                                       |
| READY EMPTY            | Intentional explanation, visual composition, and onward action.                                          |
| SEARCH / FILTER EMPTY  | Active criteria visible; clear or adjust actions available.                                              |
| PENDING MUTATION       | Control disabled or guarded appropriately; authoritative result awaited; duplicate submission prevented. |
| SUCCESS                | Committed state visible; relevant context refreshed; accessible confirmation.                            |
| VALIDATION ERROR       | Specific field or action guidance; entered data preserved where safe.                                    |
| SERVER / NETWORK ERROR | Readable explanation, retry, preserved context, and support correlation when appropriate.                |
| UNAUTHORIZED           | Canonical sign-in or access explanation with safe return destination.                                    |
| FORBIDDEN / LOCKED     | Capability or policy explanation; no misleading sign-in loop.                                            |
| OFFLINE / DEGRADED     | Truthful limitations and safe available actions.                                                         |
| STALE / CONFLICT       | Refresh, compare, or retry guidance; no silent overwrite.                                                |
| NOT FOUND / REMOVED    | Meaningful explanation and route back to parent or discovery.                                            |

## 16.1 Control-State Contracts

Buttons, links, menus, forms, filters, uploads, saves, follows, installs, and destructive actions must also define idle, hover, focus, active, disabled, pending, success, error, and unavailable behavior. State changes must be driven by authoritative results when the operation changes data. Presentation may celebrate success after the committed state exists, not before.

# 17. End-to-End Journey Acceptance

Product behavior is accepted through journeys. A journey crosses routes, systems, state changes, and visual contexts. Testing each route independently can prove that every room exists while failing to prove that the doors connect.

## 17.1 Mandatory Core Journeys

| Journey ID       | Required flow                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| J-ACCOUNT-01     | Gateway -> Create Account -> verification or governed development equivalent -> signed-in gateway -> Profile Hub.                        |
| J-AUTH-01        | Gateway -> Sign In -> intended workspace -> account state persists across Profile and Community.                                         |
| J-RECOVERY-01    | Sign In -> Forgot Password -> tokenized reset state -> return to Sign In -> successful access.                                           |
| J-SIGNOUT-01     | Authenticated page -> account menu -> Sign Out -> anonymous shell -> protected route requests canonical sign-in.                         |
| J-WORKSPACE-01   | One account -> Player -> Captain when authorized -> Creator when authorized -> Community -> Profile without additional ordinary sign-in. |
| J-PROFILE-01     | Account menu -> View My Profile -> edit profile -> save -> shell and public preview reflect change.                                      |
| J-PREFERENCES-01 | Profile Hub -> preferences/accessibility -> change setting -> navigate -> setting persists and affects presentation.                     |
| J-COMMUNITY-01   | Gateway or global navigation -> Community Harbor -> browse visible content without search -> open detail -> return.                      |
| J-COMMUNITY-02   | Community -> search -> quick filter -> advanced filter -> clear -> browser Back/Forward restores states.                                 |
| J-HISTORY-01     | Player or Profile -> Chronicle Passport -> open Voyage Record -> view Memory/Keepsake -> return.                                         |
| J-ARTIFACT-01    | Profile or Player -> Artifact Cabinet -> open artifact -> collection/display context -> return.                                          |
| J-MOBILE-01      | Repeat account, Community, profile, and navigation essentials through the mobile menu and narrow layouts.                                |

## 17.2 Journey Test Rules

- Begin at the natural product entry point or parent surface.
- Use visible controls and accessible names rather than hidden selectors where practical.
- Prove navigation, not only destination content.
- Use representative persisted synthetic data.
- Assert identity and session continuity across routes.
- Exercise empty, error, unauthorized, and recovery variants for critical journeys.
- Capture desktop and mobile visual evidence for major changed surfaces.
- Confirm cleanup, stable database state, and no unintended privacy exposure.
- Keep direct URL tests as supplemental deep-link and route-isolation evidence.

# 18. Representative Data and Demonstration State

## 18.1 Why Representative Data Is Required

A content platform cannot be visually or behaviorally evaluated using only empty databases. Empty states are necessary, but they cannot prove card composition, list density, metadata hierarchy, pagination, filters, responsive wrapping, artwork fallbacks, profile identity, or Community shelves. Local development and product walkthroughs require a governed demonstration state.

## 18.2 Demonstration Dataset Requirements

- Clearly synthetic and safe.
- Generated or seeded through maintained repository tooling.
- Contains multiple accounts and capabilities.
- Contains representative profiles, Chronicles, Voyages, artifacts, Community listings, creators, collections, guides, and Voyage Logs as current features permit.
- Includes varied titles, summaries, artwork ratios, long and short labels, accessibility metadata, empty categories, and edge cases.
- Includes no real private Chronicle content, credentials, personal photos, or sensitive locations.
- Idempotent and resettable without modifying production data.
- Updated when major product surfaces gain new required content types.
- Available to browser acceptance and owner walkthroughs through a documented safe launcher.

## 18.3 Empty-State Validation

Representative data does not remove the obligation to test empty states. Both populated and empty states are governed. A feature is incomplete if it only looks acceptable with carefully chosen data, and equally incomplete if it was only ever viewed empty.

# 19. Product Maturity and Completion Language

![Figure 6. Product maturity model. Each stage requires the earlier stages but does not collapse into them.](figure_06_completion_funnel.png)

## 19.1 Approved Statuses

| Status                      | Meaning                                                                                                  | Allowed claim                                                   |
| --------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| IMPLEMENTED                 | Required source behavior exists.                                                                         | Do not call the product feature complete.                       |
| CONTRACT_VALIDATED          | Focused unit/service/schema contracts passed.                                                            | Behavior is technically supported.                              |
| INTEGRATED                  | Shared identity, navigation, data, and cross-project contracts work.                                     | Integration complete, visual and journey acceptance may remain. |
| VISUALLY_COMPLETE           | Affected pages meet design-system, responsive, page-state, and visual evidence requirements.             | Ready for journey validation.                                   |
| JOURNEY_VALIDATED           | Required browser journeys pass from natural entry points on required viewports.                          | Ready for owner walkthrough.                                    |
| READY_FOR_OWNER_WALKTHROUGH | All locally required implementation and evidence exist; application is running with representative data. | Do not call PRODUCT ACCEPTED.                                   |
| PRODUCT_ACCEPTED            | Owner inspected the running product and accepted the experience.                                         | May be called complete for the governed product scope.          |
| RELEASE_VALIDATED           | Sounding Line release gate passed for the exact source.                                                  | May be released subject to external gates and owner decision.   |
| EXTERNAL_VALIDATION_PENDING | Local work complete; named live provider or environment proof remains.                                   | Must name the missing external evidence.                        |
| NONCONFORMING               | Known violation of this standard exists.                                                                 | Cannot claim product completion.                                |

## 19.2 Forbidden Completion Language

Codex, developers, reports, and project receipts MUST NOT use “complete,” “fully complete,” “finished,” “production ready,” or equivalent language for a product-facing scope unless the evidence supports the exact approved status. A task with passing tests but no owner walkthrough should say READY FOR OWNER WALKTHROUGH. A route skeleton should say IMPLEMENTED or INCOMPLETE, not Community complete.

## 19.3 Partial Scope

A narrowly scoped internal component may be complete without an owner walkthrough when it has no user-facing impact. The completion report must state that boundary. A backend service may be CONTRACT_VALIDATED while the feature remains NONCONFORMING at the product level. This distinction is honest engineering, not pessimism.

# 20. Owner Walkthrough and Product Acceptance

## 20.1 Purpose

The owner walkthrough exists because automated evidence cannot determine whether the product matches the intended experience, whether hierarchy feels right, whether navigation is natural, or whether a page is technically usable but emotionally dreadful. Owner acceptance is not a substitute for tests. It is the final product-reality gate after tests.

## 20.2 Required Walkthrough Package

- Exact source commit and branch.
- Normal application startup command.
- Representative demonstration data and credentials that are safe to share with the owner.
- List of affected routes and journeys.
- Desktop and mobile pages opened in a logical order.
- Known limitations and external gates stated before inspection.
- No hidden URL required for any ordinary destination.
- No task process stopped before the walkthrough when the owner needs the running application.
- A concise acceptance checklist the owner can mark accepted, rejected, or revise.

## 20.3 Owner Outcomes

| Outcome                           | Meaning                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| ACCEPTED                          | The experience matches the governed scope. Defects discovered later are ordinary regressions. |
| ACCEPTED WITH RECORDED MINOR DEBT | The experience is acceptable; named non-blocking debt has owner-approved scope and due date.  |
| REVISION REQUIRED                 | The product does not yet satisfy the intended experience. Implementation remains open.        |
| REJECTED / NONCONFORMING          | A foundational mismatch requires recovery or redesign before acceptance.                      |

## 20.4 No Automatic Acceptance

Codex MUST stop at READY FOR OWNER WALKTHROUGH for major product-facing projects unless the owner explicitly accepts the result. A completion receipt cannot self-promote to PRODUCT ACCEPTED. The repository may record technical closure while product acceptance remains pending, but the distinction must remain visible.

# 21. Sounding Line Verification Integration

## 21.1 Required Product Contract Families

Sounding Line must treat the following as first-class product contracts, not ad hoc browser tests:

- global-shell.coverage
- account.canonical-session
- account.registration-discoverability
- account.sign-in-continuity
- account.sign-out-transition
- profile.hub-information-architecture
- profile.protected-route-return
- community.global-reachability
- community.content-before-search
- community.card-and-detail-navigation
- route.no-orphans
- navigation.mobile-parity
- page.complete-state-contract
- visual.design-system-conformance
- journey.owner-walkthrough-readiness

## 21.2 Test Tier Requirements

| Change class              | Minimum evidence                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Account/session change    | Unit/contract, service/API, cross-workspace browser journey, sign-out journey, security negative tests.                   |
| Navigation/route change   | Route inventory validation, component tests, desktop/mobile navigation journey, orphan-route scan.                        |
| Profile/account UI change | Component accessibility, visual evidence, responsive journey, save/error/session continuity.                              |
| Community page change     | Projection/privacy tests, populated and empty component states, browse/search/filter journey, desktop/mobile screenshots. |
| Design-system change      | Component regression, representative cross-workspace screenshots, accessibility, zoom, reduced motion when applicable.    |
| New user-facing route     | Route metadata, visible entry path, parent/return path, mobile parity, page-state matrix, browser reachability.           |

## 21.3 Visual Evidence

Sounding Line evidence should include governed screenshots, traces, page-state results, route-navigation receipts, and journey outcomes. Visual diffs must be reviewable and source-bound. A screenshot update requires explanation when it changes an accepted baseline. Pixel identity is not always required; intentional hierarchy and layout are.

## 21.4 Failure Classification

A route returning 200 while lacking navigation is a PRODUCT_DEFECT. A raw unstyled form on a governed page is a PRODUCT_DEFECT, not merely design debt. A session context that fails to refresh after sign-out is a PRODUCT_DEFECT. A browser test that directly navigates around the missing entry path is a TEST_DEFECT if it is presented as reachability evidence.

# 22. Mandatory Codex and Prompt Governance

![Figure 8. Mandatory product-facing prompt lifecycle. Each task begins with current-reality and journey analysis and ends at the proper acceptance gate.](figure_08_prompt_lifecycle.png)

## 22.1 Required Preflight

Before editing product-facing behavior, Codex MUST:

1. Read this standard and the current governing documents for each affected project.
2. Fetch or inspect the current repository state and repository-specific instructions.
3. Identify affected routes, account/session contracts, navigation paths, page states, capabilities, and journeys.
4. Inspect the running product or current screenshots when the task concerns existing visual behavior.
5. Identify current nonconformities instead of assuming earlier completion reports are accurate.
6. Define the intended product state, not merely the source files to change.
7. Create or update a design record when the task is broad, cross-project, or information-architecture significant.

## 22.2 Implementation Obligations

- Preserve canonical ownership boundaries.
- Use one account and session authority.
- Update global, workspace, contextual, and mobile navigation as required.
- Implement every applicable page state.
- Use approved design-system components or extend the system intentionally.
- Add representative demonstration data when visual evaluation requires it.
- Update route inventory, screen catalog, Feature Catalog entry points, and journey registry.
- Add or update Sounding Line contracts and tests in the same task.
- Do not leave ordinary routes discoverable only by direct URL.
- Do not represent future functionality with polished-looking but inert controls.
- Do not create a placeholder and label it complete because a later project will style it.

## 22.3 Continuity Rule

Codex must continue through ordinary setup, focused fixes, navigation integration, visual states, tests, and documentation. A schema checkpoint, successful API, or first rendering is not a stopping point when substantial locally attainable product work remains. When one validation lane is blocked, continue disjoint work. Genuine external blockers must be reported precisely without converting unfinished local work into an external excuse.

## 22.4 Closure Obligations

1. Run focused and required Sounding Line validation.
2. Start the application using the governed launcher.
3. Use representative data.
4. Navigate from the gateway through every changed ordinary destination using visible controls.
5. Exercise account/session continuity and sign-out when relevant.
6. Capture required desktop and mobile visual evidence.
7. Confirm the route inventory has no new orphans.
8. Confirm the working tree and evidence state.
9. Report the truthful maturity status.
10. Leave the application running and open the walkthrough surfaces when owner inspection is required.
11. Stop at READY FOR OWNER WALKTHROUGH until the owner accepts major product-facing work.

## 22.5 Forbidden Codex Behaviors

- Using direct URLs to demonstrate ordinary reachability without proving the navigation path.
- Writing a completion receipt before inspecting the running product.
- Treating raw HTML structure as a finished user interface.
- Adding a second login or session because the canonical flow is inconvenient.
- Deleting or hiding routes instead of integrating them.
- Weakening tests, changing expected screenshots, or marking controls optional solely to obtain green evidence.
- Calling visual design “out of scope” when the task creates or exposes a user-facing page.
- Claiming that user acceptance occurred because browser automation passed.

# 23. Repository Control Artifacts

This standard must be executable through repository artifacts. Documents alone are insufficient because future sessions will otherwise rediscover the rules after shipping another hidden page.

| Artifact                                                                        | Required purpose                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Development_Docs/Governance/Voyagewright_Global_Product_Governance_Standard.md  | Canonical machine-readable governing source.                                                |
| Development_Docs/Governance/Voyagewright_Global_Product_Governance_Standard.pdf | Human review and archival copy.                                                             |
| product/routes.json                                                             | Authoritative user-facing route inventory and navigation metadata.                          |
| product/journeys.json                                                           | Governed end-to-end journey registry.                                                       |
| product/screens.json                                                            | Screen catalog, states, owners, design maturity, and evidence.                              |
| product/navigation.json                                                         | Global, workspace, account, and contextual navigation declarations or generated projection. |
| product/nonconformities.json                                                    | Open product-governance violations and planned remediation.                                 |
| product/acceptance/\*.json                                                      | Source-bound owner walkthrough and acceptance records.                                      |
| testing/contracts/product-\*.json                                               | Sounding Line product contract registrations.                                               |
| Development_Docs/Feature_Catalog\*                                              | Feature entry points, maturity, and user-facing evidence links.                             |

## 23.1 Route Inventory Generation

The repository SHOULD derive actual Next.js page routes and compare them with product/routes.json. Dynamic route patterns must be normalized. API routes, callbacks, and internal services must be classified separately. New page routes without a governed entry are policy failures.

## 23.2 Screen Catalog

Each major screen should record purpose, route, owner, design-system family, required states, responsive layouts, navigation parent, screenshot evidence, and current maturity. This catalog makes it impossible for a route skeleton to hide inside a large feature count.

## 23.3 Feature Catalog Integration

The Feature Catalog must list the primary user entry point and current product maturity for each feature. A backend-only capability may be listed as infrastructure. A user-facing feature cannot be presented as complete when its entry point is hidden, its UI is skeletal, or its owner walkthrough is pending.

# 24. Change Control, Exceptions, and Debt

## 24.1 Governance Changes

A change that weakens one-account behavior, route reachability, global shell coverage, owner acceptance, page-state completeness, or visual completion requires an approved governance amendment. An implementation prompt cannot create a temporary exception merely by stating that it is urgent.

## 24.2 Temporary Exceptions

A temporary exception must include a unique ID, exact rule, reason, affected routes and journeys, risk, compensating controls, owner approval, expiration date, and removal plan. Exceptions cannot authorize security or privacy violations. An expired exception becomes a blocking nonconformity.

## 24.3 Product Debt

Product debt must be visible and classified. “Polish later” is not a debt record. A valid record names the missing state or quality, affected users, current workaround, severity, owner, target milestone, and acceptance impact. Major visual incompleteness, hidden navigation, or session fragmentation blocks PRODUCT ACCEPTED and cannot be downgraded to minor debt without explicit owner approval.

## 24.4 Regression Handling

When accepted behavior regresses, the correction task must add a focused reproducer, update relevant journey evidence, and determine why existing policy or tests failed to detect the regression. The response must repair both the product and the missing governance enforcement where practical.

# 25. Immediate Nonconformity Register

The following nonconformities were open at the creation of this standard. Project Homeport will own the detailed recovery specification and implementation. These entries remain open until source-bound evidence and owner acceptance close them.

| ID     | Severity | Nonconformity                                                                              | Required closure evidence                                                                       |
| ------ | -------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| NC-001 | Critical | Multiple visible sign-in experiences and session authorities.                              | One canonical flow, compatibility redirects, cross-workspace session journey, owner acceptance. |
| NC-002 | Critical | Gateway lacks global account and navigation shell.                                         | Shell rendered on gateway with anonymous/authenticated states on desktop and mobile.            |
| NC-003 | Critical | Community Harbor hidden from ordinary navigation.                                          | Visible global and workspace entry paths plus route inventory proof.                            |
| NC-004 | Critical | Sign out lacks dependable visible transition.                                              | Session revocation, context refresh, redirect, cross-tab behavior, accessible confirmation.     |
| NC-005 | High     | Account menu lacks comprehensive account and profile navigation.                           | Approved grouped menu with all governed destinations and responsive interaction proof.          |
| NC-006 | High     | Registration and recovery are not clearly discoverable from sign-in and account surfaces.  | Canonical account lifecycle journey evidence.                                                   |
| NC-007 | High     | Chronicle Passport requests another sign-in after legacy Player authentication.            | Canonical session convergence and protected return behavior.                                    |
| NC-008 | High     | Chronicle Passport is an unstructured long form rather than a profile/history hub.         | Profile header, section navigation, designed screens, mobile parity, owner acceptance.          |
| NC-009 | High     | Community Harbor home lacks content-first library composition.                             | Featured and browse sections populated by representative persisted synthetic data.              |
| NC-010 | High     | Community search and filters dominate the page as raw controls.                            | Compact search, quick filters, advanced panel, designed result and empty states.                |
| NC-011 | High     | Community district pages are raw or empty route skeletons.                                 | Designed district browse pages, cards, detail entry, empty states, responsive evidence.         |
| NC-012 | High     | Global navigation omits Community and other ordinary destinations in several workspaces.   | Route registry and visible navigation parity across desktop/mobile.                             |
| NC-013 | High     | Major product pages lack dedicated cohesive visual styling.                                | Design-system implementation and visual regression evidence.                                    |
| NC-014 | High     | Completion evidence did not require owner-intended visual and journey acceptance.          | Sounding Line contract updates and owner walkthrough gate.                                      |
| NC-015 | Moderate | Representative local data is insufficient for meaningful Community and profile inspection. | Governed demonstration dataset and reset workflow.                                              |

# 26. Adoption and Enforcement

## 26.1 Immediate Adoption

1. Commit the Markdown and PDF versions of this standard under Development_Docs/Governance.
2. Update AGENTS.md and Codex guidance to require reading it for every product-facing task.
3. Create product/routes.json, product/journeys.json, product/screens.json, and product/nonconformities.json.
4. Register initial Sounding Line product contracts.
5. Create Project Homeport from the immediate nonconformity register.
6. Block new major feature work from claiming PRODUCT ACCEPTED while critical Homeport nonconformities remain, unless the owner explicitly approves parallel work.

## 26.2 Transitional Enforcement

Existing routes and pages will not satisfy every artifact immediately. The transition must inventory first, classify honestly, and add coverage in risk order. Critical account, shell, navigation, sign-out, Profile, and Community failures receive priority. The transition cannot be used to grandfather hidden or broken ordinary routes indefinitely.

## 26.3 Final Enforcement State

In the target state, a new page cannot merge without route classification and navigation metadata; a new product feature cannot close without screen and journey evidence; a new account flow cannot create competing session authority; Sounding Line cannot issue product-ready evidence while required visual or journey contracts are missing; and Codex cannot claim product completion before owner acceptance.

# Appendix A. Route Inventory Schema

The exact schema may evolve, but it must preserve these semantics. The example intentionally distinguishes discoverability from authorization.

```text
{
  "id": "community-artifacts",
  "pattern": "/community/artifacts",
  "classification": "NAVIGABLE_PAGE",
  "workspace": "community",
  "logicalParent": "community-home",
  "owner": "harborlight",
  "authentication": "optional",
  "capabilities": [],
  "desktopEntry": {
    "from": "/community",
    "control": "Artifacts district card"
  },
  "mobileEntry": {
    "from": "/community",
    "control": "Community district menu > Artifacts"
  },
  "returnPath": "/community",
  "emptyStateAction": "/community?type=ARTIFACT",
  "journeys": ["J-COMMUNITY-01"],
  "screens": ["community-artifacts-desktop", "community-artifacts-mobile"]
}
```

# Appendix B. Screen Acceptance Record

| Field                  | Required value                                      |
| ---------------------- | --------------------------------------------------- |
| Screen ID              | Stable identifier.                                  |
| Route                  | Static or normalized dynamic pattern.               |
| Owner                  | Project and component owner.                        |
| Purpose                | Human task supported.                               |
| Primary action         | Main useful action.                                 |
| Navigation parent      | Where the person comes from.                        |
| Required states        | Loading, ready, empty, error, auth, offline, etc.   |
| Desktop evidence       | Source-bound screenshot or visual assertion.        |
| Mobile evidence        | Source-bound screenshot or visual assertion.        |
| Zoom evidence          | Required when applicable.                           |
| Accessibility evidence | Keyboard, semantic, automated, and manual coverage. |
| Representative data    | Fixture or seed identity.                           |
| Maturity               | Implemented through Product Accepted.               |
| Known limitations      | Truthful open issues and external gates.            |

# Appendix C. Journey Acceptance Matrix

| Dimension     | Required considerations                                                                 |
| ------------- | --------------------------------------------------------------------------------------- |
| Identity      | Anonymous, authenticated, profile, capability, stale session, revoked session.          |
| Navigation    | Gateway, global shell, workspace, contextual, back, mobile.                             |
| Data          | Populated, empty, long labels, missing media, fallbacks.                                |
| Mutation      | Pending, success, validation error, conflict, retry, idempotency.                       |
| Failure       | Network, server, unauthorized, forbidden, not found, offline.                           |
| Responsive    | Desktop, mobile, zoom, touch, safe area where relevant.                                 |
| Accessibility | Keyboard, focus, headings, names, live regions, reduced motion, non-color meaning.      |
| Privacy       | Public projection, owner projection, foreign-account denial, no hidden private payload. |
| Evidence      | Trace, screenshot, route receipt, database or API assertion, cleanup.                   |

# Appendix D. Product-Facing Completion Report

```text
PRODUCT-FACING COMPLETION REPORT

Scope:
Source commit:
Governing documents read:
Affected workspaces:
Affected routes:
Affected account/session contracts:
Affected journeys:

Implementation maturity:
- IMPLEMENTED:
- CONTRACT_VALIDATED:
- INTEGRATED:
- VISUALLY_COMPLETE:
- JOURNEY_VALIDATED:
- READY_FOR_OWNER_WALKTHROUGH:
- PRODUCT_ACCEPTED: pending owner decision

Navigation evidence:
Route inventory changes:
Orphan-route result:
Desktop path:
Mobile path:

Page-state evidence:
Representative data:
Visual captures:
Accessibility:
Responsive/zoom:

Known limitations and external gates:
Application startup command:
Walkthrough URLs reached through visible navigation:
Stop command:

```

# Appendix E. Codex Preflight and Closure Checklists

## E.1 Preflight

- Read VW-PG-001 and affected project governance.
- Inspect current repository and running product.
- List affected routes, screens, page states, identities, capabilities, and journeys.
- Check for current nonconformities and overlapping work.
- Define natural entry and return paths.
- Define desktop, mobile, accessibility, visual, and representative-data requirements.
- Define truthful target maturity and owner walkthrough boundary.

## E.2 Closure

- All source and contract work complete.
- All applicable page states implemented.
- Route inventory and navigation updated.
- No ordinary route requires manual URL entry.
- Representative and empty data states validated.
- Desktop and mobile visual evidence captured.
- Keyboard, focus, accessibility, and reduced motion validated.
- Cross-workspace account/session behavior validated.
- Application launched and journeys navigated from natural entries.
- Truthful maturity reported.
- Owner walkthrough prepared and application left running when requested.

# Appendix F. Glossary

| Term                       | Meaning                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| Account                    | Private security and authentication identity for one real person.                                 |
| Profile                    | Person-facing identity, preferences, history, and public presentation.                            |
| Capability                 | Authorization allowing an account to use a role or workspace.                                     |
| Workspace                  | A task-focused area such as Player, Captain, Creator, Community, or Account.                      |
| Global shell               | Persistent product identity, global navigation, account control, and workspace context.           |
| Ordinary user-facing route | A destination a person should discover and use through the product.                               |
| Orphan route               | An ordinary page with no visible in-product navigation path.                                      |
| Contextual detail          | Dynamic page reached from a card, list, relationship, history, or search result.                  |
| Page-state contract        | Required loading, data, empty, failure, permission, and recovery behavior.                        |
| Representative data        | Safe synthetic persisted content sufficient to evaluate real layouts and journeys.                |
| Journey validation         | Browser proof that a person can complete a useful flow through visible controls.                  |
| Owner walkthrough          | Human inspection of the running product after required evidence passes.                           |
| Product Accepted           | Owner-approved product state after implementation, integration, visual, and journey gates.        |
| Nonconformity              | Known violation of a governing requirement.                                                       |
| Compatibility alias        | Legacy route that redirects into one canonical experience without maintaining competing behavior. |

# References

1. Project Wayfarer: Player Identity, Chronicle Passport, and Personal History - Governing Architecture and Product Requirements, Version 1.0, July 21, 2026.
2. Project Harborlight: Community Harbor Governing Charter and Product Architecture Specification, Version 1.0, July 21, 2026.
3. Project Sounding Line Part I: Software Verification Architecture, Version 1.0, July 28, 2026.
4. Project Sounding Line Part II: Execution Infrastructure and Parallel Runtime, Version 1.0, July 28, 2026.
5. Project Sounding Line Part III: Repository Policy, Codex Governance, and Release Assurance, Version 1.0, July 28, 2026.
6. Project Lanternwake accepted architecture and completion records.
7. Universal Language and True North navigation records.
8. Current Kgray44/treasurehuntSoT repository at the time of implementation, including ProductShell, route classification, navigation registry, AccountFlow, ChroniclePassport, Community pages, CommunityDiscoveryBrowser, and sign-out action.
9. July 31, 2026 product reality walkthrough and failure audit.
10. WCAG 2.2 and accepted repository accessibility practices.
11. OWASP guidance for authentication, sessions, authorization, secure redirects, privacy, and logging.

# Final Governing Rule

> **Final Governing Rule**
>
> Voyagewright is complete only when its architecture, interface, navigation, account state, page states, journeys, evidence, and owner experience describe the same coherent product. No amount of hidden functionality, passing tests, impressive tables, or optimistic completion prose may substitute for that agreement.
