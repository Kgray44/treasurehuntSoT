---
title: Features and subfeatures
audience: product
status: current
canonical_for: product-features
last_reviewed: 2026-08-12
---

# Features and subfeatures

## Identity and Chronicle Passport

**Audience:** Players, Captains, Creators. **Availability:** available on main.
Account flows, role gateways, profile handles, preferences, privacy controls,
Chronicle Passport, private history, and personal artifact custody provide an
owned identity surface. [Guide](../user/chronicle-passport.md).

Project Homeport Phase 1 is available on main. It adds one canonical current-user contract, one
ordinary sign-in surface, explicit capability decisions, session invalidation
across tabs, and bounded observe-and-rotate compatibility for historical
Player and staff sessions.

Project Homeport Phase 3 is also available on main. It separates the
public Profile from the private Chronicle Passport, adds server-enforced
Profile/privacy projections, typed preferences, linked identities, private
history and Memories, artifact provenance, saved Community items, and account
security/session management. [Profile guide](../user/profile.md), [Passport
guide](../user/chronicle-passport.md), and [account security
guide](../user/account-security.md). Mainline availability is not deployment or
owner acceptance.

Google and GitHub sign-up, sign-in, and explicit account linking are complete
on main and accepted through protected staging. Both providers use the canonical
Homeport account/session lifecycle, verified-email rules, immutable provider
identifiers, collision-safe deliberate linking, and token-discard behavior.
Deterministic browser validation covers the repeatable lifecycle and security
contracts; the owner separately completed real Google and GitHub sign-in/sign-up
through staging. Application-owned post-callback redirects use the configured
public browser origin and reject internal production origins without trusting
proxy host headers. Production provider configuration and deployment remain
separately governed. [Linked
identities](../user/linked-identities.md).

## Private Living Journey Archive

**Audience:** Players and account owners. **Availability:** branch-complete,
not on main. Project Wakebook Phase 1 turns Chronicle Passport History into
`Your Voyages`: an owner-private visual shelf grouped by truthful archive date,
with accurate displayed-year summaries, bounded search and filters, stable
opaque pagination, exact played-edition identity, historical crew context, and
calm unavailable/partial-history states. Voyage Detail keeps shared artifact
moments separate from personal Artifact Cabinet provenance and preserves the
existing private Reflection, Memory, Keepsake, consent, and eligible review
workflows. Invitation-only history is visible but never counted as a played
Voyage. [Chronicle Passport guide](../user/chronicle-passport.md). Owner
walkthrough, mainline integration, deployment, public sharing, Tideglass
semantics, and later Timeline/People/Statistics views remain separate.

## Global shell and wayfinding

**Audience:** Players, Captains, Creators, and public visitors.
**Availability:** available on main. Phase 2 adds one route-classified shell,
visible Home/Explore/Community
navigation, structured account orientation, capability-projected workspace
switching, equivalent mobile destinations, and explicit compact/immersive
exits. Its acceptance evidence is local and synthetic; it is not deployment or
owner acceptance. Personal Harbor reconstruction is complete in Phase 3,
Community content reconstruction is complete in Phase 4, and the governed
route-reachability graph is complete in Phase 5 on main.

## Governed route reachability graph

**Audience:** Players, Captains, Creators, and public visitors.
**Availability:** available on main. Phase 5 publishes an authoritative page census and permission-aware
graph with visible ordinary entries, real dynamic source controls, deliberate
tokenized and compatibility dispositions, stable parents/returns, dead-end
recovery, desktop/mobile parity, and an automated orphan gate. Exact-source
browser evidence begins at Home and reaches all ordinary destinations through
visible controls. The evidence is local and synthetic; deployment, live-user
behavior, owner acceptance, and Phase 7 whole-product proof are not claimed.

## Complete product surfaces and states

**Audience:** Players, Captains, Creators, public visitors, and account owners.
**Availability:** available on main. Phase 6 publishes a source-parity registry for every current
human-facing screen, completes all critical/high visual surfaces, normalizes
shared dialogs, state panels and media fallbacks, and governs loading, empty,
no-results, recovery, dependency, permission, session, mutation, conflict,
removed, media, and token states. Critical screens have desktop, mobile,
tablet, narrow-mobile, effective-200-percent, focus, keyboard/touch,
accessibility, and reduced-motion evidence. The evidence is local and synthetic;
Phase 7 integrated journeys, deployment, owner acceptance, and product
acceptance are not claimed.

## Platform administration and consented support

**Audience:** Administrators, support operators, operations observers, audit
operators, security operators, and account owners. **Availability:** Phase 1 is
owner accepted and integrated on canonical main. Phase 2 is also owner accepted
and integrated on canonical main after exact-source authority and protected
integration in PR #28.

Phase 1 provides server-resolved roles/capabilities, explicit administrator
bootstrap, short-lived session-bound privileged assurance, canonical sanitized
audit evidence, a living capability registry, and user-approved scoped Support
Access. Affected account owners can review, deny, approve, and revoke requests
through [Support Access](../user/support-access.md).

Phase 2 expands the authorized shell into a read-only
[Admiralty Command Center](../administrator/admiralty-command-center.md) with
bounded People, Chronicle, Voyage, Community, operations, provider,
configuration, release, audit, and correlation-led investigation projections.
It adds no schema and no broad mutation. Deployment, live-provider validation,
owner acceptance, canonical-main integration, and later phases remain separate.

## Integrated whole-product voyage and owner walkthrough

**Audience:** Product owner, Players, Captains, Creators, and account owners.
**Availability:** available on main and ready for the separate owner walkthrough
decision. Phase 7 supplies one immutable synthetic
fixture, isolated A-through-O journey clones, account continuity across all
workspaces, Profile/Passport/Community reconciliation, explicit recovery and
failure states, mobile/keyboard/reduced-motion proof, reviewed exact-source
evidence, and an owned final walkthrough runtime. Owner Decision is
`PENDING_OWNER_DECISION`; readiness is not deployment or owner acceptance.

## Player experience

**Audience:** Players. **Availability:** available on main. Invitations, a Player Library, waiting and access states, a Chronicle Journal, story progression, replay/history surfaces, Ship's Log, side-quest and finale presentation are implemented through the player routes. [Guide](../user/player-guide.md).

## Captain and Voyage operations

**Audience:** Captains. **Availability:** available on main. Captain Library,
Voyage creation, invitation management, session views, Player preview, and
live-control foundations are available. Project Helm Phases 1 and 2 add an
explicit Captain-only or Captain + Player choice, one ordinary same-account
Player membership where chosen, independent Captain authority, and a
privacy-safe read-only operations view. Captains can see prioritized Voyage
status, safe crew presence and synchronization health, current warnings, safe
event summaries, and read-only progress without gaining Player-private device,
network, identity, draft, or progression-command data. Participation may end
without removing Captain authority. Mainline source integration is not
deployment, live-Voyage proof, or owner acceptance.
[Guide](../user/captain-guide.md).

## Creator Studio and publishing

**Audience:** Creators. **Availability:** available on main. Studio supports Chronicle settings, story blocks, locations, assets, artifact authoring, version views, and immutable publishing. [Guide](../user/creator-guide.md).

Project Tideglass Phase 1 provides the accepted exact immutable edition
comparison foundation. The accepted Phase 2 extension adds server-side
intelligence with stable change codes, explainable significance and
compatibility, spoiler-safe audience projections, deterministic summaries,
append-only Creator annotations, and bounded safe APIs. Phase 2 is on main.
The Phase 3 ordinary comparison page, navigation entry, owned played-history
handoff, and Studio semantic comparison are currently an unmerged worktree
under local qualification, not an available-on-main feature. Repository
validation is local and synthetic, and no deployment or production MySQL
execution is claimed.

Project Drydock Phase 3 is active implementation on its dedicated branch. It
adds Creator-only, source-bound deterministic Sea Trials with revisioned
Scenarios, virtual time, registered synthetic faults, Suites, redacted traces,
coverage ledgers, and a shared One Voyage transition planner. It never mutates
live Voyages or providers. This branch work is not available on main, deployed,
or accepted; its candidate qualification remains governed separately.

## Community and artifacts

**Audience:** Creators and Captains. **Availability:** available on main for
the Phase 3 community foundations: package, artifact, licensing, lineage,
discovery, social, keepsake, and voyage-log controls. Externally hosted
exchange proof is not claimed. [Guide](../user/community-harbor.md).

Project Homeport Phase 4 adds the mainline Community Discovery
Library: content-first public shelves, a governed district taxonomy, typed
public-safe cards, search/sort/compact and advanced filters, Creator Profiles,
collections, Guides, Voyage Logs, details, and save/follow state with complete
default, empty, no-result, unavailable, quarantine, removed, desktop, and
mobile contracts. It is not deployed or owner accepted. External providers
remain truthfully unavailable where unsupported.

## Private content, animation, and resilience

**Audience:** administrators and developers. **Availability:** protected
workflows are available on main, including Phase 3 operations/recovery and
Phase 4 protected-media grants, consent, derivatives, and withdrawal. External
provider validation is environment-dependent. Private packages,
storage/scanning boundaries, recovery operations, presentation assets,
accessibility checks, and test tooling are documented in [private
content](../administrator/private-content.md), [animation](../developer/animation/README.md), and [testing](../developer/testing.md).

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; the source is on main but not deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 includes governed Profile imagery, six-digit verification,
Resend plus task-owned synthetic delivery, canonical workspace entry separated
from resource authority, route crossfades, account-menu motion, and Dark
defaults. Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`; the source is
on main but not deployed.

## Phase 7 correction Round 3 Patch A

**Audience:** Account owners and the product owner. **Availability:** available
on main, not deployed. Patch A adds atomic
pending registration, explicit duplicate display-name and email recovery,
accessible password strength and confirmation status, ordinary unverified
account sign-in without a code challenge, and generation-owned 280 ms route
crossfades with a 500 ms delayed-loading threshold. It also carries the same
canonical account through Captain and Creator while preserving private resource
ownership. Resend is the selected real provider, and disposable live acceptance
proved registration delivery, inbox receipt, code consumption, and account
activation. Round 3 owner acceptance is not claimed.

## Staging origin interaction reliability

**Audience:** Product owner and developers. **Availability:** corrected on the
Project Homeport branch and desktop-validated through the protected staging
hostname; not available on `main`. Exact development-origin governance restores
hydration, account bootstrap, menus, navigation, and native authentication
inputs through staging and LAN hosts without wildcard trust. Anonymous and
synthetic-authenticated staging desktop journeys pass. Physical-phone
acceptance and the broader Round 3 owner decision remain pending.
