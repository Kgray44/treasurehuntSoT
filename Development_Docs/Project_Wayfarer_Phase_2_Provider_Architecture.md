# Project Wayfarer Phase 2 Provider Architecture

The registry exposes a deployable Discord OAuth adapter and a `DISCORD_SIMULATOR` test adapter. Discord requires `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `DISCORD_REDIRECT_URI`; it requests only `identify`. The simulator is available only outside production and is not production proof.

Every link creates expiring hashed state/nonce and PKCE verifier records. The callback verifies all three under the current account, maps the immutable provider subject, rejects cross-account collisions, encrypts access tokens with `WAYFARER_PROVIDER_TOKEN_KEY`, and consumes the attempt. Visibility and login permission are independent. Unlink clears encrypted token material and blocks removal of the final viable login/recovery method.
