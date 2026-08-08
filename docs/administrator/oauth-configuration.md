---
title: Google and GitHub OAuth configuration
audience: administrator
status: current
canonical_for: oauth-provider-configuration
last_reviewed: 2026-08-07
---

# Google and GitHub OAuth configuration

Voyagewright uses provider-owned OAuth applications for Google and GitHub. All
client credentials remain server-only. The callbacks enter the same Homeport
`UserAccount`, `AccountEmail`, `ExternalIdentity`, `AccountSession`, role, and
security-event system used by password authentication; there is no parallel
account store or provider-specific session cookie.

## Server variables

Set these in an ignored `.env.local` for development or in the deployment
secret store:

- `VOYAGEWRIGHT_GOOGLE_CLIENT_ID`
- `VOYAGEWRIGHT_GOOGLE_CLIENT_SECRET`
- `VOYAGEWRIGHT_GOOGLE_REDIRECT_URI`
- `VOYAGEWRIGHT_GITHUB_CLIENT_ID`
- `VOYAGEWRIGHT_GITHUB_CLIENT_SECRET`
- `VOYAGEWRIGHT_GITHUB_REDIRECT_URI`
- `HOMEPORT_PUBLIC_APP_ORIGIN`

Do not use `NEXT_PUBLIC_`, commit values, or paste values into logs, screenshots,
issues, documentation, or test evidence. `.env.example` documents names only.

## Exact staging callbacks

Register and configure these exact values when the OAuth-capable branch is
running at the protected staging origin:

- Google:
  `https://staging.absoluterelativesystems.com/api/auth/providers/google/callback`
- GitHub:
  `https://staging.absoluterelativesystems.com/api/auth/providers/github/callback`

The scheme, hostname, path, and trailing-slash choice must match exactly between
the provider application and the corresponding redirect variable.

Provider callback registration and the browser destination after Voyagewright
finishes the callback are separate settings. The provider redirect variables
above remain the exact callback URLs. `HOMEPORT_PUBLIC_APP_ORIGIN` is the trusted
server-side origin used for Voyagewright-owned success, cancellation, collision,
invalid-state, linking, and unavailable-provider redirects after the provider
returns. Set it to this exact value for staging:

`https://staging.absoluterelativesystems.com`

Voyagewright does not derive these browser redirects from `Host`,
`X-Forwarded-Host`, or the internal request URL. Production rejects bind,
loopback, private-network, and internal hostnames rather than exposing them in a
`Location` response. Local development may use an explicitly configured local
browser origin; `0.0.0.0` is a bind address and is never a browser origin.

For a true local live-provider test, create or select provider application
credentials whose registered callback exactly matches the local runtime, for
example `http://localhost:3218/api/auth/providers/google/callback` and
`http://localhost:3218/api/auth/providers/github/callback`, then set the matching
redirect variables for that runtime. Do not reuse a staging-only callback and
interpret the resulting return to a different runtime as local validation.

## Provider permissions

Google requests `openid email profile`, validates an RS256 ID token against
Google signing keys, and requires the configured audience, permitted issuer,
one-time nonce, valid token time, immutable subject, and verified email. GitHub
requests only `user:email`, exchanges with S256 PKCE, resolves the authenticated
`/user` numeric ID, and requires a verified email from `/user/emails`. Neither
provider requests repository access. Provider access tokens are discarded after
the identity has been verified.

## Account and collision behavior

A previously linked immutable provider identity returns to its existing
canonical account. A first-time provider identity with a verified unused email
creates one active account, verified primary email, Player role, linked external
identity, and ordinary account session. If the email already belongs to any
account, Voyagewright fails closed and instructs the person to sign in using the
existing method before explicitly linking. It never auto-links by email and
never creates a duplicate account after a uniqueness race.

`VOYAGEWRIGHT_OAUTH_TEST_MODE=1` enables a deterministic simulator only when
`NODE_ENV` is not `production`. It is for isolated automated validation and is
not evidence that Google or GitHub accepted an authorization.
