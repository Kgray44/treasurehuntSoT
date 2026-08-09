---
title: Changelog
audience: product-engineering
status: current
canonical_for: repository-changelog
last_reviewed: 2026-08-09
---

# Changelog

## Unreleased

### Changed

- Added Project Helm Phase 1 participating-Captain operation. Voyage creation
  now defaults to Captain-only and offers an explicit Captain + Player mode
  backed by exactly one ordinary same-account Player membership. Captain
  authority and membership remain independently authorized and audited; Player
  projection, history, artifacts, removal, and perspective switching follow the
  existing Player contracts. No schema migration or second session system was
  introduced. The acceptance boundary is governed isolated local evidence and
  mainline source integration, not deployment or live-Voyage proof.

- Recorded the owner's `ACCEPTED` decision for the complete Project Admiralty
  Phase 1 walkthrough and reconciled its named branch with current main:
  canonical role/capability authorization, explicit
  administrator bootstrap, session-bound privileged assurance, a limited
  non-navigable `/admin` shell, user-consented scoped Support Access, sanitized
  canonical audit evidence, dual-provider additive migrations, a 92-entry
  capability floor, and an isolated owner runtime. Canonical integration and
  parity are pending; this is not deployed or production-MySQL validated, and
  Phase 2 was not started.

- Anchored every Voyagewright-owned OAuth success and failure redirect to the
  exact configured `HOMEPORT_PUBLIC_APP_ORIGIN` rather than the internal request
  URL. Google and GitHub success, cancellation, invalid/expired state, email and
  identity collisions, account linking, linking failure, and provider-unavailable
  paths now reject bind, loopback, private-network, internal-host, and
  Host-header injection leaks while preserving the exact provider callback URIs.
  After protected publication, the owner completed real Google and GitHub
  sign-in/sign-up through staging, returned successfully to Voyagewright, and
  observed no internal-origin redirect. Voyagewright Google and GitHub OAuth is
  accepted complete on protected staging; production deployment remains separate.

- Integrated Google and GitHub application OAuth on main through protected PR
  #10. It uses the canonical Homeport account/session system for first and
  returning sign-in,
  verified provider email, explicit linking, collision-safe no-auto-merge,
  last-login-method unlink protection, one-time state/nonce/PKCE, provider token
  discard, and desktop/mobile isolated browser coverage. Deterministic automated
  lifecycle/security acceptance passed, and owner-observed real Google and
  GitHub staging acceptance now passes separately. Protected PR #12 integrated
  trusted public-origin browser redirects, while exact provider callbacks remain
  unchanged. Production callbacks still require a separately governed
  OAuth-capable runtime and correctly registered provider applications.

- Integrated Project Homeport Phases 1-7 and Correction Round 3 Patch A into
  main through protected PR #9 while preserving source history and the final
  owner-walkthrough runtime. Mainline source convergence is not deployment,
  physical-phone proof, owner acceptance, or product acceptance.

- Restored Project Homeport interaction through the protected staging origin
  with exact development-host governance, bounded current-user bootstrap,
  operable authentication inputs during bootstrap, a server-only public account
  link origin, sanitized opt-in diagnostics, and an owned synthetic staging
  runtime. Direct/reverse-proxy automation and staging desktop journeys pass;
  physical-phone and owner acceptance remain pending.

- Stabilized Project Homeport Correction Round 3 account access and route
  transitions on the named branch: pending registration is atomic, ordinary
  unverified sign-in no longer requires a code, one canonical AccountSession
  provides Player/Captain/Creator workspace entry while Voyage and Chronicle
  authorization remains resource-scoped, and generation-owned 280 ms crossfades
  prevent stale loading and old-page resurrection. Resend is now the selected
  real transactional-email provider; the synthetic outbox and dormant Postmark
  compatibility adapter remain. Disposable live acceptance proved provider
  submission, owner-controlled inbox receipt, code consumption, and
  `ACTIVE`/`VERIFIED` account state. This is not deployment or owner acceptance.

- Completed Project Homeport Phase 7 to the owner-walkthrough-ready boundary on the named branch: one immutable synthetic fixture and isolated clones now prove A-through-O account, workspace, Personal Harbor, Community, recovery, failure, mobile, and final-rehearsal journeys. Owner Decision remains pending; this is not on main or deployed.
- Completed Project Homeport Phase 6 on the named branch: all 92 current human-facing screens are source-inventoried, every critical/high surface is visually complete, and shared page-state, dialog/focus, responsive, accessibility, motion, mutation, and media-fallback contracts are enforced. This is not on main, deployed, or owner accepted; Phase 7 remains separate.
- Completed Project Homeport Phase 5 on the named branch: a source-derived permission-aware route graph now gives every ordinary destination a visible gateway-rooted path, governs dynamic, tokenized, and compatibility routes, eliminates unexplained dead ends, and reconciles desktop/mobile entries. This is not on main, deployed, or owner accepted; Phases 6-7 remain separate.
- Completed Project Homeport Phase 4 on the named branch: a content-first Community Harbor with governed public districts, typed safe cards, deterministic shelves, search/filter URL state, Creator/collection/Guide/Voyage Log details, deliberate lifecycle states, and save/follow reconciliation. This is not on main, deployed, or owner accepted; Phases 5-7 remain separate.
- Completed Project Homeport Phase 3 on the named branch: a coherent Personal Harbor with separate public Profile and private Chronicle Passport, typed preferences and privacy controls, linked identities, private history and Memories, artifact custody, saved Community items, and separate Security and Sessions surfaces. This is not on main or deployed; Phase 4 remains separate.
- Completed Project Homeport Phase 2 on the existing named branch: one governed global shell, typed route modes, visible Home/Explore/Community wayfinding, structured account orientation, capability-projected workspace switching, exact desktop/mobile functional parity, and explicit compact/immersive exits. This change is not on main, deployed, or owner accepted; Phases 3-5 remain separate.
- Completed Project Homeport Phase 1 on its named branch: one ordinary account sign-in, one server current-user authority, explicit workspace capability decisions, multi-tab session invalidation, and bounded legacy-session rotation. This change is not yet on main.
- Reorganized documentation into audience-specific guides and an indexed engineering-record archive.
- Reconciled current-main documentation, Ledgerlight records, and the generated Feature Catalog after the Phase 3-4, Wayfarer, Sealed Hold, Harborlight, and True North convergence.

### Validation

- Added focused Admiralty policy/service/component coverage, fresh and upgrade
  migration rehearsal, and exact-source production-browser journeys for
  unauthorized concealment, assurance expiry/renewal, support approval, denial,
  revocation, role/session invalidation, desktop/mobile/keyboard/reduced-motion/
  effective-200-percent behavior, and serious/critical accessibility scanning.
  The fixture and evidence are local, synthetic, task-owned, and not owner
  acceptance.

- Added a dual-host Chromium regression for hydration, account bootstrap,
  pointer interaction, keyboard focus/typing, navigation, settled overlays,
  loopback-request leakage, and proxy metadata. Added protected-staging
  anonymous and synthetic-authenticated desktop evidence without claiming
  physical-phone proof.

- Added the isolated Phase 7 A-O production-browser lane, 16 checksum/source/fixture-bound reviewed frames, failure/recovery and owner-runtime contracts, 48 registered Sounding Line contracts, and an idempotent control-plane publication. These establish local walkthrough readiness, not owner acceptance.
- Added an isolated Phase 6 production-browser matrix, 126 checksum/source/fixture-bound screenshots, explicit alternate-state and reduced-motion evidence, 55 registered Sounding Line contracts, and byte-idempotent screen/state/responsive/accessibility artifact publication. These establish local synthetic branch evidence only.
- Added isolated A-AD Phase 5 browser journeys, 87 route-level receipts, 29 visually accepted checksum-bound screenshots, idempotent graph publication, and registered orphan/cycle/parity/compatibility contracts. These establish local branch evidence only.
- Added isolated A-AR Phase 4 Community journeys, checksum-bound desktop/mobile/zoom/reduced-motion evidence, public-projection and lifecycle checks, idempotent inventory publication, and registered Sounding Line contracts. These establish local branch evidence only.
- Added isolated A-AE Phase 3 browser journeys, 29 human-reviewed checksum-bound screenshots, deterministic section/projection/mutation/parity contracts, and additive inventory closure. These establish local branch evidence only.
- Added isolated A-U Phase 2 browser journeys, 20 visually inspected checksum-bound screenshots, deterministic shell/navigation/parity/exit contracts, and additive inventory closure. These establish local branch evidence only.
- Added isolated A-Q Homeport browser journeys, checksum-bound after-state evidence, compatibility cutover records, and Sounding Line release contracts. These establish local branch evidence, not deployment or live-user proof.
- Recorded the explicit `P34-BME-20260729` browser-matrix risk acceptance as an exception; it is not represented as a full matrix pass.

## Current mainline

### Added

- Role-aware Player, Captain, and Creator experiences; Chronicle libraries, journals, invitations, published versions, and profile surfaces.
- Protected private-content package workflows and Community Harbor foundations.

### Security

- Private-content validation and access-control safeguards are documented separately from the public reporting policy.

Historical implementation detail and validation evidence live in [Development_Docs/](Development_Docs/README.md).

## Phase 7 correction Round 1 status

The owner returned walkthrough Round 1 for correction. The corrected capability has completed local automated validation and is awaiting owner re-review; it is not yet included in a published release. Live email delivery and Discord, Steam, and Microsoft/Xbox connections still depend on separately configured services. Automated accessibility coverage does not replace testing with physical assistive technology.

## Phase 7 correction Round 2 status

Correction Round 2 is locally exact-source validated and ready for owner re-review. Dark, Light, and System themes; truthful account/Profile/workspace state; authoritative Community saves and completion-verified reviews; expanded previews; delayed loading; motion; synthetic email boundaries; and Experience Images are included. Round 2 remains `PENDING_OWNER_DECISION`; this branch is not merged or deployed, and live providers remain external.

## Phase 7 correction Round 3 status

Correction Round 3 includes governed Profile imagery/cropping and identity
propagation, six-digit verification, Resend plus task-owned synthetic delivery,
ordinary workspace entry separated from resource authority, direct route
crossfades, visible account-menu motion, and Dark defaults. Owner Re-Review Round
3 remains `PENDING_OWNER_DECISION`; the branch is not merged or deployed.

## Phase 7 correction Round 3 Patch A status

Focused Patch A is locally exact-product-source validated and ready for owner
review. Patch A A-N passed 14/14, selected retained Round 3 critical journeys
passed 10/10, and original Phase 7 account/session journeys passed 9/9. The
branch is not merged or deployed. Resend supersedes Postmark as the selected real
provider, and its disposable registration-verification path passed live provider
submission, inbox receipt, code consumption, and account activation. Round 3
remains `PENDING_OWNER_DECISION`.
