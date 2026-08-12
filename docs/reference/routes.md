---
title: Route reference
audience: reference
status: current
canonical_for: route-reference
last_reviewed: 2026-08-12
---

# Route reference

Primary route groups are `/player`, `/captain`, `/studio`, `/play`, `/profile`, `/tales`, and controlled API routes. Access depends on authentication, role, ownership, and invitation policy; route knowledge does not grant authorization. Compatibility route groups are transitional and are not a preferred integration surface.

Project Homeport Phase 3 adds ordinary mainline Personal Harbor routes under
`/account` and `/passport`. Account descendants cover Profile, personal
information, preferences, accessibility, notifications, privacy, linked
identities, Security, Sessions & Devices, and Data & Account. Passport
descendants cover history and version-pinned detail, Memories, Artifact Cabinet
and artifact detail, and Saved from Community. `/profile/[handle]` is the
separate public projection.

Project Tideglass Phase 3 adds the ordinary comparison route
`/chronicles/[taleSlug]/compare`, reached from a visible Chronicle-detail
**See what changed** action. An owned past-Voyage action resolves through
`/passport/history/[recordId]/compare` and redirects only after server-side
history ownership and Chronicle identity checks. Creator Studio published
versions use `/api/studio/tales/[taleId]/versions/compare` for a
`CREATOR_FULL` semantic projection. These routes accept bounded selection or
return context only; URL knowledge never grants a foreign history record,
edition, or elevated audience.

Phase 4 makes `/community` the content-first Harbor Home. Ordinary districts
are `/community/featured`, `/chronicles`, `/artifacts`, `/templates`, `/maps`,
`/audio`, `/creators`, `/collections`, `/guides`, and `/voyage-logs`. Public
details use `/community/[slug]`, `/creators/[handle]`,
`/collections/[slug]`, `/guides/[slug]`, and `/voyage-logs/[slug]`.
Shipwright's Workshop is a governed Guide-category view, not a second content
store. Moderation and owner/consent routes remain capability or workflow
surfaces, not ordinary public districts.

Project Homeport Phase 5 classifies all 92 page routes as ordinary static,
contextual dynamic, tokenized, compatibility, or development-only surfaces.
The branch publishes parent/return metadata, genuine dynamic source controls,
safe token states, compatibility targets, and equivalent desktop/mobile entry
edges. Ordinary navigation never exposes token values or treats a private
detail ID as discoverable. This graph is on main; it is not deployment or owner
acceptance.

Phase 6 re-censused the current source at 92 page routes and 200 API/route
handlers, with no omitted page source. It adds screen/state/responsive evidence
without changing route ownership or creating a second navigation authority.
The result is exact-source validation retained on main, not deployment proof.

Project Admiralty Phase 1 adds `/admin` as a privileged route and
`/account/support-access` as the ordinary account-owner consent surface. Phase
2 expands the named branch to `/admin/people`, `/admin/chronicles`,
`/admin/voyages`, `/admin/community`, `/admin/operations`, `/admin/providers`,
`/admin/configuration`, `/admin/releases`, `/admin/audit`, and
`/admin/investigate`, with contextual People, Chronicle, Voyage, and Community
detail routes. Authorized roles receive an account-menu entry and filtered
Admiralty navigation; ordinary accounts receive neither. Every route still
returns a non-revealing not-found result before privileged projection when its
server-side capability check fails. Phase 2 is owner accepted and integrated on
main through PR #28; it is not deployed.

Mainline Google and GitHub OAuth adds public provider discovery and start routes
plus the exact callbacks
`/api/auth/providers/google/callback` and
`/api/auth/providers/github/callback`. The matching provider segment also owns
an authorization start. A simulator route exists only in explicit
non-production test mode and returns 404 otherwise. Signed-in linking begins
through the existing CSRF-protected `/api/passport/providers/begin` mutation.

For product intent see [features](../product/features.md); for implementation ownership see [architecture](../developer/architecture.md).

## Phase 7 correction Round 1 status

The owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; the source is on main but not deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 includes governed Profile imagery, six-digit verification, Resend plus task-owned synthetic email, canonical workspace entry separated from resource authority, route crossfades, account-menu motion, and Dark defaults. Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`; the source is on main but not deployed.
