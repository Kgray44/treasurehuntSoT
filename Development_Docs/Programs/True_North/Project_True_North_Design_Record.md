# Project True North design record

## Baseline and decision

- Branch: `codex/project-true-north-navigation-shell`
- Base: `origin/main` at `6bd8209d2d7f0edc73da9566fd06e825ae51a602`
- Date: 2026-07-25
- Scope: canonical navigation, shell identity, account access, route semantics, and responsive menus.

True North has four levels. The universal application bar identifies Voyagewright, the resolved workspace, connection state, and the profile menu. Workspace navigation contains stable major destinations. Context navigation belongs to an object (a Chronicle, Passport, Community Harbor, or active Player experience). Page actions remain in page headers/toolbars and are never registry items.

## Shell and route policy

| Mode               | Routes                                                                  | Rule                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `gateway`          | `/`                                                                     | Role gateway retains its cinematic presentation.                                                                          |
| `authentication`   | sign-in, register, password, verification and invitation routes         | Product identity and safe return only; no role claim.                                                                     |
| `standard`         | ordinary public, Player, Captain, Creator, Community and account routes | Persistent application bar, stable workspace navigation, profile access.                                                  |
| `compact`          | Quartermaster/live Captain console                                      | Captain identity, return to Voyages and profile access; page controls remain local.                                       |
| `immersive-player` | active Player session and Journal routes                                | Reduced Player shell only: Chronicle identity, My Voyages, Passport/profile and exit. No Captain or Creator destinations. |

The route classifier is the sole route-to-workspace authority. Canonical matching is exact before prefix/pattern matching. `/captain` canonically resolves to `/captain/library`; legacy `/quartermaster` resolves to Captain compact context. Account routes never fall through to public. Community routes are a registered extension that remains hidden while absent from the current base.

## Workspace definitions

| Workspace             | Stable navigation                                          | Account/profile behavior                                |
| --------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Public                | Explore Chronicles, Player, Captain, Studio                | Sign in / choose a role.                                |
| Player                | My Voyages, Explore Chronicles, Passport                   | Profile menu, Security, sign out.                       |
| Captain               | Voyages, Crew invitations, Explore Chronicles              | Profile menu, Security, role switching when authorized. |
| Creator               | Chronicle Library, Exchange; Create Chronicle is an action | Profile menu, Security, role switching when authorized. |
| Account               | Passport, Security                                         | Same profile menu; no public-navigation flash.          |
| Community (extension) | Harbor, districts supplied by extension                    | Public-safe account projection.                         |

Capability projection is boolean-only: `canUsePlayer`, `canUseCaptain`, `canUseCreator`, and `isAdministrator`. The shell API never returns email, provider identity, account/session identifiers, role internals, CSRF values, or tokens. The display name and initials are bounded presentation data.

## Interaction and accessibility contract

Desktop and mobile project the same registry item definitions and labels. On narrow viewports, the workspace menu opens as a modal-like disclosure: focus enters its first item; Escape, backdrop, and route changes close it; focus returns to its trigger on explicit dismissal. The profile menu follows the same behavior. Both menus use named navigation/menu controls, visible focus tokens, `aria-current`, and no hidden interactive controls in the accessibility tree.

The shell remains mounted during profile-context loading. It reserves the profile trigger geometry and shows a neutral `Account` label rather than a fabricated identity. Reduced motion removes shell/menu transition delay. Errors preserve the shell and offer the ordinary page's existing retry/parent behavior.

## Context and page-header contract

The global shell supplies only levels 1 and 2. Existing Player Companion, editor section, Passport section, and Captain detail controls remain level 3 under their current owners. `Create Chronicle`, publish, validate, preview, save, invitations, and console controls remain level 4 page actions. Breadcrumbs are rendered by pages where object identity is available; a shell must not invent an object label from a URL segment.

## Terminology

| Concept           | Canonical label     | Compatibility                                                   |
| ----------------- | ------------------- | --------------------------------------------------------------- |
| Product           | Voyagewright        | Existing product term retained.                                 |
| Player library    | My Voyages          | Replaces inconsistent Player Library menu wording.              |
| Captain workspace | Captain Console     | `Voyages` is the workspace destination.                         |
| Creator workspace | Voyagewright Studio | Short label `Studio`.                                           |
| Creator library   | Chronicle Library   | Existing canonical language term retained.                      |
| Account           | Chronicle Passport  | Route `/passport`; Security remains a separate account section. |

## Active-branch extension points

Lanternwake retains `PlayerExperience`, `CompanionNavigation`, mobile Player navigation, SceneHost, PageFlip, and animation targets. True North only classifies their enclosing routes and supplies compact shell chrome. Harborlight registers Community destinations via the navigation extension API when its routes converge. Sealed Hold registers private operations only behind authorized Creator/Administrator capability projections; this base exposes no invented operations page. Wayfarer registers Passport history, artifact cabinet, and achievements context destinations when those routes converge.

## Test strategy

Unit tests cover registry uniqueness/order, canonical aliases, classification, capability filtering, and active matching. Component tests cover persistent profile access, account classification, compact Player exclusion of Captain/Creator, and mobile focus dismissal. Browser acceptance uses a task-owned runtime and synthetic accounts only; its required flows and viewport matrix are recorded in the test plan.
