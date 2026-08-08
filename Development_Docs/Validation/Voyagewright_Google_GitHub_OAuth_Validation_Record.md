---
title: Voyagewright Google and GitHub OAuth Validation and Completion Record
audience: engineering
status: current
---

# Voyagewright Google and GitHub OAuth Validation and Completion Record

| Field                     | Value                                                               |
| ------------------------- | ------------------------------------------------------------------- |
| Program                   | Voyagewright OAuth                                                  |
| Record type               | Implementation, validation, and completion receipt                  |
| Closure date              | 2026-08-08                                                          |
| Final capability status   | **COMPLETE / ACCEPTED / MAINLINE**                                  |
| Original integration      | PR #10 / `b4fa3b4b3f50e3f22f82adace3b287b9cadace8a`                 |
| Public-origin correction  | PR #12 / `7675a9e3c02cb1bad18812c65010e9310d9b977c`                 |
| Accepted mainline/runtime | `f7bb10064f831a06e350a298ca8b380274d5f931`                          |
| Environment               | Protected staging with a task-owned isolated OAuth database         |
| Staging origin            | `https://staging.absoluterelativesystems.com`                       |
| Owner live acceptance     | Google PASS; GitHub PASS                                            |
| Acceptance classification | Owner-observed real-provider success                                |
| Automated acceptance      | PASS                                                                |
| Sounding Line             | PASS for implementation/public-origin publication                   |
| Secret policy             | No credentials, tokens, codes, email addresses, or account IDs kept |
| Production deployment     | Outside this staging capability closure                             |

## Final acceptance decision

Voyagewright Google and GitHub OAuth is complete, mainline, and accepted on the
protected staging experience. The implementation, canonical account and session
integration, deterministic protocol and security coverage, trusted public-origin
correction, protected-main publication, and owner-observed real-provider
acceptance have all passed. No OAuth implementation or staging-acceptance blocker
remains.

The owner explicitly reports successful real Google and real GitHub sign-in and
sign-up through the protected staging experience on 2026-08-08. Both providers
returned through the exact staging callbacks, completed authentication in
Voyagewright, and returned to a working application destination without exposing
`0.0.0.0`, `localhost`, `127.0.0.1`, or another internal origin.

This is `OWNER_OBSERVED_LIVE_PROVIDER_ACCEPTANCE = PASS`. It is not classified as
Codex-automated live-provider acceptance. Codex did not enter owner credentials,
observe or record secret provider interactions, retain authorization responses,
or independently reconstruct the owner's live evidence.

## Capability acceptance matrix

| Capability                                   | Result | Authority                                                                |
| -------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| Google implemented and configured            | PASS   | Mainline source, exact staging callback, and runtime configuration       |
| Google automated validation                  | PASS   | Focused protocol/security tests and deterministic lifecycle browser lane |
| Google real staging sign-in/sign-up          | PASS   | Owner-observed real-provider acceptance                                  |
| GitHub implemented and configured            | PASS   | Mainline source, exact staging callback, and runtime configuration       |
| GitHub automated validation                  | PASS   | Focused protocol/security tests and deterministic lifecycle browser lane |
| GitHub real staging sign-in/sign-up          | PASS   | Owner-observed real-provider acceptance                                  |
| Canonical account integration                | PASS   | Automated repository validation                                          |
| Canonical `AccountSession` integration       | PASS   | Automated repository validation                                          |
| First-time provider account creation         | PASS   | Automated validation and owner-observed staging sign-up                  |
| Returning provider sign-in                   | PASS   | Automated validation and owner-observed staging sign-in                  |
| Explicit account linking and linking failure | PASS   | Automated repository validation                                          |
| Email and identity collision safety          | PASS   | Automated repository validation                                          |
| No automatic email-based account merging     | PASS   | Automated repository validation                                          |
| Last-login-method unlink protection          | PASS   | Automated repository validation                                          |
| One-time state and CSRF binding              | PASS   | Automated protocol/security validation                                   |
| S256 PKCE                                    | PASS   | Automated protocol/security validation                                   |
| Google OIDC nonce and token validation       | PASS   | Automated protocol/security validation                                   |
| Safe return handling                         | PASS   | Automated route and lifecycle validation                                 |
| Trusted public-origin redirect handling      | PASS   | Automated regression tests and staging boundary acceptance               |
| Internal-origin leak                         | NONE   | Regression protected; none owner-observed in either real provider flow   |
| Provider-token discard                       | PASS   | Automated persistence validation                                         |
| Email/password regression compatibility      | PASS   | Automated repository and browser validation                              |
| Protected staging                            | PASS   | Automated boundary checks plus owner-observed real-provider acceptance   |

## Scope and architecture

Google and GitHub enter the existing `UserAccount`, `PlayerProfile`,
`AccountEmail`, `AccountRoleAssignment`, `ExternalIdentity`, `AccountSession`,
and `SecurityEvent` architecture. There is no separate account table, session
cookie, or provider-token store. Sign-in attempts are one-time, ten-minute,
provider- and intent-bound records with hashed state and nonce plus an S256 PKCE
verifier. Linking is additionally bound to the authenticated account.

Google validates the authorization-code response through provider token exchange
and RS256/JWKS verification, accepted issuer, exact audience and authorized party
when required, expiry/issued time, nonce, immutable `sub`, and verified email.
GitHub exchanges with PKCE, resolves `/user` on every sign-in, uses the immutable
numeric user ID, and selects a primary verified or fallback verified email from
`/user/emails`. Provider access tokens are not persisted.

A first provider identity creates one active canonical account with a verified
email and Player role. A returning immutable identity creates a new ordinary
session for the same account. Matching email alone never links accounts: an
email collision fails closed and requires password or previously linked-provider
sign-in followed by explicit connection. Database uniqueness remains the final
race boundary.

## Automated and Codex-verified evidence

- Focused Vitest covers provider availability, exact callbacks, scopes,
  state/nonce/PKCE persistence, unsafe returns, Google signed-token verification
  and authorized-party rejection, GitHub immutable ID and verified email,
  provider lifecycle compatibility, public-origin selection, hostile internal
  request origins, Host-header injection resistance, and unlink security.
- Isolated Playwright covers Google and GitHub independently: first and returning
  sign-in, account and identity rows, verified email, session persistence across
  reload and tabs, logout, redirects, password registration and unverified
  sign-in, email collision without duplicate creation, explicit linking,
  linked-provider sign-in, cancellation, invalid state, keyboard, reduced
  motion, and mobile layout.
- Staging boundary checks covered provider authorization starts, exact callback
  registration, cancellation and failure returns, configured public-origin
  behavior, and absence of internal origins from browser-visible `Location`
  values. These checks did not require or claim owner credentials.
- Sounding Line selected and passed the implementation/publication gates, and
  the protected-main checks passed before the public-origin correction merged.

The repeatable lifecycle browser lane intentionally uses the non-production
deterministic provider adapter. It establishes application behavior and security
contracts but is not relabeled as real-provider authorization.

## Owner-observed live-provider evidence

The owner personally completed both real provider flows through
`https://staging.absoluterelativesystems.com` after the public-origin correction
was merged and the exact accepted mainline runtime was started:

- Google OAuth sign-in/sign-up: **PASS**
- GitHub OAuth sign-in/sign-up: **PASS**
- successful return through each staging callback: **PASS**
- successful Voyagewright authentication and final application return: **PASS**
- internal-origin redirect observed: **NO**

The live owner acceptance did not use the synthetic test adapter. No screenshot,
authorization code, token, credential, personal email, provider subject, or
account identifier is manufactured or retained by this record.

## Exact callbacks and trusted public origin

The registered provider callbacks remain separate from Voyagewright's
post-callback browser destination and were not changed by the public-origin fix:

- Google:
  `https://staging.absoluterelativesystems.com/api/auth/providers/google/callback`
- GitHub:
  `https://staging.absoluterelativesystems.com/api/auth/providers/github/callback`

Every Voyagewright-owned success, cancellation, collision, invalid/expired-state,
linking, linking-failure, and provider-unavailable destination uses the trusted
server-side `HOMEPORT_PUBLIC_APP_ORIGIN`. The staging value is
`https://staging.absoluterelativesystems.com`. Neither `Host` nor forwarded-host
headers select the browser destination. Production configuration fails closed
for bind, loopback, private-network, single-label container, and reserved
internal hostnames. Safe relative return paths remain governed by the existing
`safeReturnTo` contract.

Focused regression coverage sends both Google and GitHub callback routes an
internal request URL at `http://0.0.0.0:3000` plus hostile proxy-host headers
while configuring the staging public origin. It proves that sign-in success
(including provider-specific `signedInWith`), cancellation, invalid or expired
state, account linking, linking failure, provider unavailability, email
collision, identity collision, and other callback failures emit only the public
origin. Separate provider tests assert the exact callback and token-exchange
`redirect_uri` values.

## Closure boundary

This record closes Voyagewright Google and GitHub OAuth implementation,
mainline integration, protected-staging operation, automated validation, and
owner acceptance. Production provider configuration and production deployment
remain separately governed operational work and are not implied by staging
acceptance.

**FINAL CAPABILITY STATUS: COMPLETE.**
