# Full-System Product Polish implementation record

Status: implementation in progress  
Started: 2026-07-18  
Repository baseline: `main` at `481dc92`, synchronized with `origin/main` (`0` behind / `0` ahead)

## Governing boundaries

- Preserve the unified Tall Tale platform, immutable published versions, role/resource policy, Player-safe projections, audited Captain operations, and canonical journal runtime.
- The library helps a Player choose or continue an adventure; the physical journal remains the canonical place where a Tall Tale is played.
- The Phase B Vision Waypoint roadmap and governing specification are parallel future-program inputs. This polish pass must remain compatible with their shared-product and design-system rules, but it must not invent capture, vision, PWA, or desktop behavior.
- System copy stays broadly reusable. Authored Tall Tale copy may be specific to its selected story or event.
- Existing local changes and untracked governing documents are preserved without normalization or incidental edits.

## Product terminology map

| Term | Product meaning | Usage rule |
| --- | --- | --- |
| Tall Tale | A reusable, creator-authored interactive story | Primary noun for content in discovery, Studio, and invitations |
| Experience | Broad description of what participants create or join | Use in explanatory marketing copy; do not substitute it for stored Tall Tale entities |
| Voyage | A configured, version-pinned playthrough shared by a group | Use for Captain setup, invitations, lobby, history, and continuation |
| Session | The live technical/runtime state of a voyage | Use for operational status, reconnect behavior, and Captain controls |
| Player | A person experiencing the Tall Tale | Primary participant role in controls and permissions |
| Participant | Inclusive collective label when role detail is not important | Use in general explanations and accessibility copy |
| Captain | The host who configures and guides a voyage | Use consistently for host-only actions |
| Creator | A person who authors and publishes Tall Tales | Use consistently for Studio access and authoring actions |
| Crew | Optional thematic collective for Players | Flavor only; critical controls continue to use Player or participant |
| Chapter | A published structural division of a Tall Tale | Never substitute step or stage for the authored chapter entity |
| Story moment | A prompt, passage, decision, activity, or reveal inside a chapter | Human-readable umbrella term for block-level content |
| Invitation | A single-recipient credential and joining flow | Use for links, short codes, PINs, lifecycle, and acceptance |
| Waiting room | The pre-launch Player state after invitation acceptance | Use instead of lobby where the existing route and domain already use this term |
| Journal | The immersive, canonical in-session and completed-history surface | Cards may select a voyage, but must not replace journal play |

## Audit summary

### Architecture and data

- Next.js 16 App Router with React 19, strict TypeScript, Prisma, server-owned authorization/projections, ordered events, SSE reconciliation, GSAP/Motion/StPageFlip/Rive/Lottie presentation, Vitest, and Playwright.
- Public, Player, Captain, Creator, legacy campaign companion, and development showcase route families are additive and share the same repository, but their page chrome and navigation are currently local implementations.
- The unified platform and canonical journal are already release-gate validated. Polish work should reuse their services rather than create visual-only copies of data.
- Baseline quality gates pass: Prettier, ESLint, TypeScript, and 90 Vitest tests across 27 files.

### Product and visual findings

- Landing, platform, Studio, Tall Tale, legacy Player, Quartermaster, and animation surfaces use related materials but do not yet share one explicit product shell.
- Page metadata is global, so major routes expose the same title and private-one-tale description.
- `tokens.css` defines the original palette and a few primitives, while surface styles duplicate semantic colors, radii, timings, shadows, and layer numbers.
- Buttons, form fields, selected controls, alerts, loading states, and empty states are styled through several local patterns. Disabled contrast is poor on parchment surfaces.
- Captain and Studio cards remain narrow on large screens and leave substantial unused workspace.
- Studio briefly renders a false empty state while its library request is still pending.
- Player Library shows search/filter/view controls even when the account has no voyages.
- Tab and gallery/list selection is visual but not consistently exposed with `aria-pressed` or `aria-current`.
- Loading states are mostly single lines of text rather than stable skeletons; several failure states lack an in-place retry.
- The landing entrance controls can overlap role actions on a small mobile viewport while the scene is playing.
- Route titles, return paths, and workspace switching are inconsistent; authenticated users can reach a route but cannot always answer where they are or how to switch context.

### Content findings

- General interface copy is already predominantly reusable and non-romantic.
- Development fixture names and the product title appear in authored/demo data, correctly separated from system copy.
- Operational terms are sometimes exposed where action-oriented wording would be clearer (for example, immutable/version language in discovery introductions).
- Primary nouns are mostly stable, but controls alternate between catalog/library, start/begin, host/Captain implications, and technical session/voyage language without an explicit map.

## Implementation checklist

### Shared foundation

- [ ] Add a responsive shared product shell with skip navigation, active workspace state, mobile navigation, role switching, and restrained footer/help context.
- [ ] Add route-family metadata and replace the one-tale global description with reusable product language.
- [ ] Expand semantic design, motion, typography, control, state, and layer tokens without replacing the established palette.
- [ ] Add shared loading, error, empty, status, and action primitives.
- [ ] Standardize primary, secondary, subtle, and destructive action states, including readable disabled and loading behavior.

### Public and onboarding

- [ ] Explain what a Tall Tale is, how hosting/joining differs, supported experience categories, persistence, and privacy/control on the landing page.
- [ ] Add clear `Explore Tall Tales`, `Join with an invitation`, and role-specific calls to action.
- [ ] Prevent mobile presentation controls from covering meaningful content.

### Discovery and setup

- [ ] Add search/filter/clear behavior and richer consistent card semantics to public discovery using real catalog data.
- [ ] Make loading, no-results, empty-catalog, and error recovery states intentional.
- [ ] Improve the Captain creation wizard's progress semantics, selected states, validation messages, review summary, action labels, and success feedback.

### Player, invitations, and waiting room

- [ ] Prioritize active/invited content over filters; hide irrelevant tools for a truly empty library.
- [ ] Add accessible selected-state semantics and inline save/loading feedback for preferences.
- [ ] Clarify invitation validity, account requirement, joining, decline consequence, and busy/success states.
- [ ] Keep connection, Captain-waiting, reconnect, leave, and automatic journal-entry states distinguishable.

### Captain and Creator

- [ ] Use the shared shell while preserving capability checks and audited mutations.
- [ ] Improve responsive card density, destructive-action language, server status, loading, error recovery, and empty-state next actions.
- [ ] Remove Studio's false-empty flash and expose busy action labels.

### Canonical journal

- [ ] Preserve the physical journal as the dominant in-session surface.
- [ ] Confirm contextual tools, return-to-library/current-objective actions, reconnect messaging, text scaling, and reduced-motion behavior remain intact after shared changes.

### Accessibility, responsive behavior, and quality

- [ ] Add visible active navigation, skip target, keyboard-safe mobile menu, polite status regions, `aria-busy`, `aria-pressed`, and named destructive controls.
- [ ] Verify 390x844, 430x932, 844x390, 1440x900, 1920x1080, and 2560x1440 representative layouts without horizontal overflow.
- [ ] Run formatter, linter, strict types, unit tests, configured browser tests, asset validation, and production build.
- [ ] Manually review public, Player, Captain, Creator, invitation/waiting, and journal routes with console inspection.

## Deferred by governing scope

- Production/private story and media replacement while the repository is public.
- MySQL 8 live integration, shared pub/sub/rate limiting, object storage, background scheduled launch, and production deployment.
- Phase B native capture, Vision Waypoints, verification engine, PWA, desktop shell, packaging, and updater work.
