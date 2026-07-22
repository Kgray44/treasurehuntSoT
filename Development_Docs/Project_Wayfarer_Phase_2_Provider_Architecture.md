# Project Wayfarer Phase 2 Provider Architecture

Wayfarer owns profile-connected identity providers. It does not own Chronicle
runtime state (One Voyage), private-package security (Sealed Hold), Community
publication (Harborlight), or animation policy (Lanternwake).

## Deployable adapters

- Discord OAuth requires `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and
  `DISCORD_REDIRECT_URI`, and requests only `identify`.
- Steam OpenID 2.0 requires `STEAM_OPENID_RETURN_URI` and
  `STEAM_OPENID_REALM`. The callback validates its return target and state,
  posts the signed assertion back to Steam with `check_authentication`, and
  records the immutable Steam ID. Steam returns no retained access token.
- Microsoft account OAuth/OIDC requires `MICROSOFT_CLIENT_ID`,
  `MICROSOFT_CLIENT_SECRET`, and `MICROSOFT_REDIRECT_URI`. It uses PKCE and
  nonce, exchanges the authorization code, verifies the `RS256` ID token
  against Microsoft's consumer JWKS, and checks issuer, audience, expiry, and
  nonce before retaining the returned access token.

Every link creates expiring hashed state/nonce and PKCE verifier records. The
callback is bound to the signed-in Wayfarer account, rejects cross-account
collisions, encrypts retained provider tokens with
`WAYFARER_PROVIDER_TOKEN_KEY`, and consumes the attempt. Visibility and login
permission are independent. Unlink clears encrypted token material and blocks
removal of the final viable login/recovery method.

## Governed taxonomy

Xbox Network is a distinct partner-gated capability and is not represented as
a Microsoft-account alias. Epic, EA, PlayStation Network, Nintendo Account,
and Ubisoft Connect remain partner-gated. Twitch, Google, Apple, and Battle.net
are planned only; custom OIDC remains disabled pending issuer-by-issuer review.
The three deterministic simulators are non-production test evidence only and
never claim external authorization.
