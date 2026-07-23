# Project Wayfarer Phase 2 Test Plan

Focused tests cover handle normalization/reservation, V1 preference validation and resolver precedence, token encryption/configuration truthfulness, provider state/nonce/PKCE/collision/unlink services, explicit public DTO privacy, owner authorization/CSRF, restricted media, migration foreign keys, and Harborlight canonical identity projection. Browser checks cover Passport editing, redirects, private provider visibility, keyboard controls, mobile reflow, and reduced motion.

The full repository gate additionally runs Prisma format/validate/generate, formatting, lint, TypeScript, language validation, Vitest, asset checks, and production build. A provider simulator test is simulated evidence, not an external provider approval.

Continuation evidence uses the worktree-local Vitest module entrypoint. A
shared development-worktree wrapper resolves a different matcher dependency
tree and is not a canonical Phase 2 runner. The browser gate uses a fresh
SQLite database and isolated profile-media root; it must not reuse a developer
or shared validation database.

## Final browser acceptance (2026-07-22)

The authoritative browser runner is repository Playwright Chromium, never the
embedded browser. It runs against a Playwright-owned loopback production server
with a newly migrated SQLite database, isolated profile-media root, clean
browser context, loopback proxy bypass, and explicit test-only provider
simulator opt-in. The focused `wayfarer-phase2` project passed 2/2 tests: the
real profile/media/redirect/preferences/privacy/provider/unlink journey and
the required desktop/mobile/landscape viewport sweep. It uses a deterministic
32x32 Sharp PNG and does not mock media validation. Keyboard-accessible unlink
requires confirmation and describes the login/recovery consequence.

Live OAuth, partner provisioning, and live MySQL are external staging or
deployment proofs, not browser-suite prerequisites.
