---
title: Voyagewright Google and GitHub OAuth Validation Record
audience: engineering
status: current
---

# Voyagewright Google and GitHub OAuth Validation Record

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Program        | Voyagewright OAuth                                    |
| Record type    | Implementation and validation                         |
| Date           | 2026-08-07                                            |
| Base           | `320c25c3e49be58b36be43254be75548b32655a6`            |
| Branch         | `codex/voyagewright-google-github-auth`               |
| Environment    | Task-owned SQLite and isolated development host       |
| Secret policy  | No credential values retained in evidence             |
| External state | Owner reports both live; Google persistence confirmed |

## Scope and architecture

Google and GitHub now enter the existing `UserAccount`, `PlayerProfile`,
`AccountEmail`, `AccountRoleAssignment`, `ExternalIdentity`, `AccountSession`,
and `SecurityEvent` architecture. There is no separate account table, session
cookie, or provider-token store. Sign-in attempts are one-time, ten-minute,
provider- and intent-bound records with hashed state and nonce plus an S256 PKCE
verifier. Linking is additionally bound to the authenticated account.

Google validates the authorization-code response through provider token
exchange and RS256/JWKS verification, accepted issuer, exact audience and
authorized party when required, expiry/issued time, nonce, immutable `sub`, and
verified email. GitHub exchanges with PKCE, resolves `/user` on every sign-in,
uses the immutable numeric user ID, and selects a primary verified or fallback
verified email from `/user/emails`. Provider access tokens are not persisted.

A first provider identity creates one active canonical account with a verified
email and Player role. A returning immutable identity creates a new ordinary
session for the same account. Matching email alone never links accounts: an
email collision fails closed and requires password or previously linked-provider
sign-in followed by explicit connection. Database uniqueness remains the final
race boundary.

## Validation

- Focused Vitest covers provider availability, exact callbacks, scopes,
  state/nonce/PKCE persistence, unsafe returns, Google signed-token verification
  and authorized-party rejection, GitHub immutable ID and verified email,
  provider lifecycle compatibility, and unlink security.
- Isolated Playwright covers Google and GitHub independently: first and
  returning sign-in, account and identity rows, verified email, session
  persistence across reload and tabs, logout, redirects, password registration
  and unverified sign-in, email collision without duplicate creation, explicit
  linking, linked-provider sign-in, cancellation, invalid state, keyboard,
  reduced motion, and mobile layout.
- SQLite migration deployment is executed against a newly created task-owned
  database before every browser run. Production-schema validation and repository
  gates remain part of final branch validation.

## Development provider observation

The owner reports that both real Google and real GitHub sign-in worked from a
separate development browser. That is owner-observed live-provider evidence;
Codex did not observe or record either provider consent screen and retained no
authorization response or personal provider value.

A subsequent redacted inspection of the task-owned SQLite database independently
confirmed the Google callback boundary. It contained one non-synthetic Google
identity connected to one active canonical account, one verified primary email,
and one active ordinary session. The identity was enabled for login and provider
verified, and it retained no provider access token. The same inspection found no
duplicate provider-subject row. It did not find a non-synthetic numeric GitHub
identity, so GitHub callback persistence remains owner-observed rather than
independently database-confirmed. Synthetic provider lifecycle coverage remains
the repeatable authority for first/returning identity behavior, collision
handling, linking, session persistence, cancellation, logout, and password
compatibility.

## External boundary

The supplied credentials are stored only in ignored `.env.local`. Their
configured callback values point to
`https://staging.absoluterelativesystems.com/api/auth/providers/google/callback`
and
`https://staging.absoluterelativesystems.com/api/auth/providers/github/callback`.
The retained staging runtime intentionally remains on accepted Homeport source
and does not contain this OAuth branch. It therefore cannot execute these
callback routes directly. The owner's development-browser result does not alter
that retained runtime or claim a staging deployment.

No production configuration or deployment was changed. A directly hosted
staging lifecycle still needs an OAuth-capable runtime at those exact staging
callbacks. This record does not infer or disclose provider-console values.
