---
title: Project Homeport Phase 3 Test Plan
audience: product-engineering
status: current
canonical_for: project-homeport-phase-3-test-plan
last_reviewed: 2026-08-02
---

# Project Homeport Phase 3 test plan

## Decision boundary

Sounding Line owns test selection and final decisions. Direct Vitest and Playwright runs are diagnostic. Final subsystem and mainline decisions must come from planned, isolated Sounding Line runs bound to the Phase 3 source SHA, fixture checksum, database copy, profile-media root, protected-media root, port, and browser state. The canonical `prisma/dev.db` is read-only proof material and must retain its starting SHA-256 `DF33983556CF2C6FF01DF6084AE6619EC5DF5C99B11241FA88B4A88F8E144EEB`.

## Contract set

The implementation registers all 39 governed contracts:

`homeport.personal-harbor.ia`, `homeport.personal-harbor.section-registry`, `homeport.personal-harbor.mobile-parity`, `homeport.personal-harbor.deep-links`, `homeport.personal-harbor.unsaved-changes`, `homeport.personal-harbor.mutation-feedback`, `homeport.personal-harbor.stale-conflict`, `homeport.profile.overview`, `homeport.profile.public-projection`, `homeport.profile.owner-edit`, `homeport.profile.media-state`, `homeport.profile.no-private-leak`, `homeport.preferences.typed`, `homeport.accessibility.preference-consumption`, `homeport.notifications.feedback`, `homeport.privacy.server-enforced`, `homeport.linked-identities.safe`, `homeport.linked-identities.no-lockout`, `homeport.passport.product-surface`, `homeport.passport.no-test-controls`, `homeport.passport.session-regression`, `homeport.history.owner-only`, `homeport.history.version-pinned`, `homeport.history.empty-state`, `homeport.memories.owner-authorized`, `homeport.keepsake.consent`, `homeport.artifacts.owner-only`, `homeport.artifacts.provenance`, `homeport.artifacts.empty-state`, `homeport.saved-content.owner-only`, `homeport.saved-content.cross-surface`, `homeport.security.sensitive-reauth`, `homeport.sessions.list-safe`, `homeport.sessions.revoke`, `homeport.sessions.signout-all`, `homeport.account-data.truthful-availability`, `homeport.personal-harbor.phase1-regression`, `homeport.personal-harbor.phase2-regression`, and `homeport.personal-harbor.artifact-idempotency`.

## Layers

- Unit/service: strict schemas; explicit owner/public DTO allowlists; section registry determinism; safe linked identities and sessions; stale revisions; saved-content eligibility; history/artifact ownership and provenance; inventory updater idempotency.
- API: typed current-user states; CSRF; owner isolation; safe not-found boundaries; 409 stale conflicts; session revocation; provider lockout; no private or credential-field leakage.
- Component: semantic landmarks; grouped forms; pending/success/failure feedback; confirmation focus; unsaved Stay/Discard; preview parity; reduced-motion final states; unavailable versus empty.
- Browser A–AE: natural gateway/account entry, every deep link, desktop/mobile parity, profile/public preview, preferences/accessibility/privacy, linked identities, Passport home/history/detail/memories/artifacts/detail/saved, security/sessions/data, session expiry, stale conflict, keyboard, 200% zoom, 390×844, reduced motion, and Phase 1/2 regression journeys.

## Synthetic fixture

The updater creates only reserved synthetic Homeport accounts and deterministic records. It exercises at least 30 meaningful states: complete/incomplete profile, safe public/private projections, linked/unlinked/lockout identities, current/other/expired sessions, ready/empty/dependency-unavailable sections, history/detail/version mismatch, memory/no-memory/consent-required, owned/unresolved artifact provenance, eligible/ineligible saves, clean/dirty/saving/saved/error/stale form states, reduced motion, zoom/mobile, expired/revoked/restricted current-user states, and unsupported data operations. It contains no real prose, photo, location, email credential, provider token, or private path.

## Evidence and acceptance

The dedicated Phase 3 browser family must produce at least the 29 named PNGs from the directive. Every manifest row records source SHA, branch, run ID, fixture version/checksum, browser, viewport/zoom, evidence ID, and PNG SHA-256. Human inspection checks hierarchy, clipping, contrast-independent state, focus, overflow, truthful empty/unavailable/error states, and private-data absence. Architecture, implementation, inventory idempotency, source checks, docs, features, privacy scans, build, database immutability, process cleanup, and remote parity must all pass before Phase 3 can be reported complete.
