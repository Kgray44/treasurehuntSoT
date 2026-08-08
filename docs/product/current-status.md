---
title: Current status
audience: product
status: current
canonical_for: product-current-status
last_reviewed: 2026-08-07
---

# Current status

**Available on main:** Project Homeport Phases 1-7 and Correction Round 3 Patch
A, Phase 3-4 convergence, Wayfarer Phases 3 and 4,
Sealed Hold Phases 3 and 4, Harborlight Phase 3, True North, Ledgerlight, the
Feature Catalog, and the completed Lanternwake system join identity, role-aware
Player/Captain/Creator flows, Studio editing and publishing, invitations,
libraries, journals, profile and Passport surfaces, protected content, and
animation presentation. Homeport reached main through protected PR #9; this is
source integration, not deployment or owner acceptance.

**Available on main, not deployed:** Google and GitHub application OAuth adds
sign-up, sign-in, returning identity reuse, explicit account linking,
verified provider-email handling, duplicate-account prevention, token discard,
and provider-aware unlink protection through the canonical Homeport account and
session architecture. Desktop and mobile product integration evidence is local
and synthetic. The owner reports both real providers working in a development
browser; redacted task-database inspection independently confirmed Google
identity/account/session persistence, while GitHub callback persistence remains
owner-observed. Protected PR #10 integrated the source; no production
configuration or deployment changed. OAuth application redirects now use the
explicit trusted public origin rather than the internal request origin across
success, cancellation, invalid/expired state, collisions, linking, and provider
failure. Production rejects bind, loopback, private-network, and internal
origins. Live staging acceptance of the corrected mainline runtime remains a
separate deployment check.

Phase 7 adds one immutable integrated synthetic fixture, isolated journey and
walkthrough clones, A-through-O visible-control production-browser proof, 16
reviewed checksum-bound milestone frames, explicit recovery/permission/session/
multi-tab/mobile behavior, and a safe final owner-walkthrough runtime package.
It is ready for owner walkthrough. Owner Decision remains
`PENDING_OWNER_DECISION`.

**Development-only or compatibility-only:** development showcases, legacy routes, and package-exchange integrations are not a promise of a generally hosted service.

**Focused and integration validated:** repository evidence covers the merged
systems' focused and integration scopes. **External validation pending:** live
third-party storage, scanning, provider, production MySQL, and deployment
behavior require appropriately configured environments; local adapters and
tests do not establish live-provider proof.

**Browser matrix exception:** `P34-BME-20260729` is an explicit risk acceptance
for the Phase 3-4 browser matrix. It is not a full matrix pass and does not
change the external-validation boundary.

**Planned or not validated:** Project Homeport owner acceptance and corrected
staging-hosted Google and GitHub OAuth acceptance remain pending, as do Harborlight Phase 4,
Project Drydock, Project Landfall, and Project Watchglass. Project Sounding
Line is the repository validation authority used for Homeport decisions; that
use does not claim a new user-facing Sounding Line product. Historic records
are evidence, not a release promise.

## Phase 7 correction Round 1 status

The owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; the source is on main but not deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 adds governed Profile imagery/cropping and identity
propagation, six-digit verification, a Resend production adapter with task-owned
synthetic isolation, ordinary Player/Captain/Creator entry separated from
resource authority, direct route crossfades, visible account-menu motion, and
Dark defaults. Owner Re-Review Round 3 remains `PENDING_OWNER_DECISION`; the
source is on main but not deployed.

## Phase 7 correction Round 3 Patch A status

Patch A is locally validated on the retained branch and restores the account
and navigation paths needed for continued owner review. New registration is
atomic, duplicate display-name and email outcomes are explicit, ordinary
sign-in does not require a six-digit email code, unverified status is
non-blocking, and generation-owned route transitions prevent delayed loading or
old-page return after readiness. The same canonical account session now carries
ordinary Player, Captain, and Creator entry while Voyage and Chronicle ownership
remain resource-specific. Resend replaces Postmark as the selected real email
provider. Its disposable registration-verification path passed live provider
submission, owner-controlled inbox receipt, application code consumption, and
`ACTIVE`/`VERIFIED` database state. This source is on main, but it is not
deployed or owner accepted.

The protected staging hostname now passes anonymous and synthetic-authenticated
desktop interaction after an exact development-origin correction: hydration,
account bootstrap, menus, route transitions, Sign In/Register/Forgot Password
inputs, Chronicle Passport, Personal Harbor, and workspace navigation were
observed. A physical-phone run is still mandatory, so staging desktop evidence
does not establish owner acceptance or deployment.
