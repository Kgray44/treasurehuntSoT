# Security

## Companion release boundary

Serialization is allowlist-based. Locked chapters omit narrative/objective/clues; unreleased hints and annotations are absent; rumored map locations omit coordinates/internal regions; unknown artifacts omit names/descriptions; hidden quests are absent and rumors expose only safe teasers; hidden finale details are never modeled in public content. SSE payloads pass through the same explicit allowlist and never stream raw stored payloads. Player routes require a campaign-bound, unexpired access identity and expose no mutation endpoint.

The repository is public as of 2026-07-16. Real story, surprise, romantic, location, photographic, token, and finale content is prohibited until visibility is verified private.

Player access uses a bcrypt-verified campaign code and strict HTTP-only cookie. GM login uses bcrypt, database sessions, secure/strict cookies, a per-session CSRF token, generic failures, and a five-failure/15-minute fingerprint limit. Zod validates mutation input. Admin actions are audited. Logs redact passwords, access codes, cookies, and authorization headers. Player snapshots omit all chapter content until the chapter is released; tests and manual DOM/network inspection verify the gate contains no clue text.

Production must set a random 32+ byte session secret, unique GM password and player code, HTTPS, reverse-proxy rate controls, database least privilege, and private repository visibility before real surprise content is committed.

Animation is downstream of authorization. Access and GM scenes start their network operation immediately but cannot cross the director's `await-server` checkpoint until the response succeeds; skip only completes safe presentation and never authorizes, confirms, or fetches a protected snapshot. Failed operations run a failure/reversal branch. The showcase never calls player/GM APIs and returns 404 in production. Animation contracts reject remote URLs, Rive CDN fallback is disabled, and all Lottie/Rive files and static fallbacks are same-origin.

The repository was still treated as public during the automated-demo milestone. Only generic development clues, locations, messages, and credentials are committed; validation performs a deliberate diff/secret review before publication. LAN development is an explicit opt-in because binding to `0.0.0.0` exposes the disposable demo surface to peers allowed by the host firewall.

Phase 3 admin commands require GM session, CSRF, schema validation, expected sequence, and idempotency key. The player cookie cannot call admin APIs. Preview uses the sanitized public projection and performs no writes. Narrative content renders as React text, not HTML. Development capability exposure is server-gated by `NODE_ENV`; finale/reset commands are not implemented. Correlation/audit metadata excludes secrets.

The Phase 3 Quartermaster bridge additionally requires the server-side `CAPTAIN` capability on command, compatibility action, status, and page entry. Its bounded discriminated payload and full canonical idempotency fingerprint prevent one key from authorizing a different intent. Expected sequence is reserved by compare-and-set inside each business transaction. A prepared hint is reported as committed staging, not as process publication, and unexpected server failures return generic client text.

Player presentation history is allowlist-projected and bounded. Chapter-release prose is reconstructed only through the currently authorized `PublicChapter`; unreadable or missing chapters cause that history event to be omitted. SSE performs periodic access revalidation and sends a terminal access-revoked signal. Both Player surfaces stop reconnecting for the revoked identity; the compatibility companion additionally clears protected workspace and in-memory replay history before showing the access state. Replay cannot call mutations or create a viewed acknowledgment.

## Unified Tall Tale Platform boundary

Gateway role choice is presentation only. Player APIs require a live `PlayerIdentitySession` plus resource membership; Captain and Creator APIs require the existing server-side staff session plus the matching capability and, where applicable, Captain assignment or Creator ownership. New cookie-authenticated mutations use per-session CSRF. Runtime actions made through durable Player identity require Player CSRF; the legacy opaque session-cookie flow remains isolated for compatibility. SSE and asset routes enforce resource authorization independently and recheck Player membership during long-lived streams.

Invitation links and codes are high-entropy or human-friendly credentials whose clear values are returned only at creation/replacement. The database stores SHA-256 token/code hashes, bcrypt PIN hashes, safe prefixes, redemption/expiry state, and lifecycle events. Pending invitation and Player identity cookies are HttpOnly, SameSite, Secure in production, time-bounded, and rotated or cleared after acceptance/logout. Code lookup, login, and interactive routes are rate-limited. Revoked, replaced, declined, and expired links fail before Player-safe invitation content renders.

Player projections are allowlists derived from membership, the pinned published version, ordered events, and reveal state. They remove accepted answers, future branches, Captain instructions, Creator notes, private variables, unapproved assets, raw storage keys, and raw event payloads. Completed archives use the exact version experienced, not the current draft or release. Platform audit records use correlation IDs and reject metadata keys associated with credentials, tokens, PINs, answers, snapshots, payloads, and private notes.
