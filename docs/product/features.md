---
title: Features and subfeatures
audience: product
status: current
canonical_for: product-features
last_reviewed: 2026-09-04
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

Brightwork Stage 8 Wave 3 reinforces that distinction without adding a new
identity or workspace: Personal Harbor is the account control center and
Chronicle Passport is the first-class private history destination with one
product-level navigation authority.

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

**Audience:** Players and account owners. **Availability:** available on main.
Project Wakebook Phase 1 turns Chronicle Passport History into
`Your Voyages`: an owner-private visual shelf grouped by truthful archive date,
with accurate displayed-year summaries, bounded search and filters, stable
opaque pagination, exact played-edition identity, historical crew context, and
calm unavailable/partial-history states. Voyage Detail keeps shared artifact
moments separate from personal Artifact Cabinet provenance and preserves the
existing private Reflection, Memory, Keepsake, consent, and eligible review
workflows. Invitation-only history is visible but never counted as a played
Voyage. [Chronicle Passport guide](../user/chronicle-passport.md). The owner
accepted the qualified Phase 1 walkthrough on 2026-08-12 and protected mainline
integration completed in PR #41. Deployment and public sharing remain separate.

Phases 2 through 6 are also available on main: owner-private Voyage Detail
remembrance, source-bound Timeline/People/Statistics, an explicitly read-only
replay handoff, a truthful seasonal Voyage Atlas, and a printable Voyage Book.
They remain private historical presentation, never public sharing, account-data
export, or Voyage mutation.

Brightwork Stage 8 Wave 3 aligns those retained Passport surfaces with the
archival teal, brass, and parchment family; gives Timeline, People, Statistics,
and Atlas clearer human-facing composition; and retains provenance behind
technical disclosure. It does not add public sharing, social ranking, inferred
geography, new history ownership, or a new archive data source.

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

Support Pilot S1 adds a case console for a user-approved, short-lived,
case-bound diagnostic session. It reads only the exact approved scopes, stores
sanitized source references and deterministic evidence receipts, and presents a
finding, diagnosis, and information-only proposal. It cannot carry out a repair
or mutate account, Voyage, Community, session, job, projection, or configuration
state.

Support Pilot S2 adds a separately consented registered-repair layer. Only a
current case, current grant, fresh assurance, approved scope, hard risk ceiling,
budget, current-state preview, and owner command together can permit a repair.
The initial registry is limited to profile-preference reconciliation, one stale
session revocation, and one inconsistent removed-membership reconciliation.
Unregistered commands, raw SQL, private-content access, jobs, projection
rebuilds, and high-risk actions remain unavailable.

Support Pilot S3 completes the case lifecycle for the opening assured operator:
it closes only a quiescent case, revokes pending or active case-derived access,
and keeps a durable audit receipt. It adds no repair, raw-data, broad-mutation,
or independent support authority.

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
event summaries, and a safe published progress map without gaining
Player-private device, network, identity, draft, or hidden-story data. Project
Helm Phase 3 adds the live contextual Captain command console: it previews
current-state consequences, confirms meaningful orders, uses the canonical
command path, protects stale commands with the Voyage revision, and reconciles
same-key retries without a duplicate order. Participation may end without
removing Captain authority. Mainline source integration is not deployment,
live-Voyage proof, or owner acceptance.
[Guide](../user/captain-guide.md).

Amendment A2 adds a separate, scoped Captain handoff lifecycle: an active
Captain + Player can transfer authority to another joined Player; relinquishing
authority puts the shared Voyage into Succession Hold without cancellation; an
eligible Player can take Captaincy first-committed-wins, leave, or create an
independent same-edition solo continuation. The continuation keeps durable
parent/child lineage and excludes all other Player-private state. Its current
synthetic evidence is not protected-main integration, deployment, live-Voyage
proof, or owner acceptance. Amendments A1-A3 and Helm Phases 4-5 are also
available on main: crew lifecycle and succession remain authoritative; preflight
and recovery stay provider-neutral; and the final readiness handoff is
responsive with polite command feedback.

## Creator Studio and publishing

**Audience:** Creators. **Availability:** available on main. Studio supports Chronicle settings, story blocks, locations, assets, artifact authoring, version views, and immutable publishing. [Guide](../user/creator-guide.md).

Project Shipwright Phase 2 makes current Story Block authoring contract-aware:
the Inspector groups content, behavior, completion, presentation,
accessibility, and advanced diagnostics; it offers Guided, Detailed, and
Engineering disclosure over the same Chronicle data. Creators select readable
targets and typed variables, build canonical visual conditions, see effective
Drydock defaults and local issues, and retain existing autosave, history,
preview, and publication behavior. Drydock remains the sole contract and
validation authority; deployment and live-provider execution are separate.

Project Shipwright Phases 4-5 complete the Creator-side verification and release
journey. Version
history now stages save/freeze, source-bound Drydock readiness, exact
Creator-readable changes, asset/access and compatibility review, release notes,
and explicit immutable confirmation. Studio invokes only canonical One Voyage
publication and withholds success until the immutable Version receipt is
returned; a rejected request leaves the draft available for repair. Next actions
include preview, Voyage creation, version comparison, and an eligible governed
Harborlight handoff. The Creator can also follow Sea Trial coverage and traces
back to authored Passages. Controls remain responsive, keyboard-operable, and
free of manual identifiers or raw JSON for normal release work. Protected-main
integration does not establish deployment, owner acceptance, or live-provider
behavior.

Project Tideglass Phases 1-4 provide exact immutable-edition intelligence with
stable semantic change codes, explainable compatibility, spoiler-safe
projections, deterministic summaries, and append-only Creator annotations.
Chronicle and Passport **What changed?** journeys retain the exact
owner-recorded context; Creator Studio uses the same canonical semantic truth.
Phase 4 adds bounded Drydock historical reading, a Captain-safe edition
preflight, and same-Chronicle Harborlight release handoff. Unsupported or unsafe
historical semantics are named unavailable rather than silently upcast.
Repository proof is focused and synthetic; deployment and production MySQL
execution are not claimed.

Project Drydock Phases 3-4 are available on main. They
adds Creator-only, source-bound deterministic Sea Trials with revisioned
Scenarios, virtual time, registered synthetic faults, Suites, redacted traces,
coverage ledgers, and a shared One Voyage transition planner. Phase 4 adds
source-bound launch readiness, compatibility, required Suite evidence, and
immutable-publishing evidence. Drydock never mutates live Voyages or providers;
deployment and owner acceptance remain separate.

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
