---
title: Crossdeck Phase 1 implementation record
audience: product-engineering
status: ready-for-owner-walkthrough
canonical_for: crossdeck-phase1-implementation
last_reviewed: 2026-10-10
---

# Phase 1 — Lay the Gangway

The Phase 1 implementation binds several browser surfaces to one canonical Wayfarer person and the existing One Voyage membership. It implements participation, pairing, roles, capability projection and presence. It does not implement synchronization, content transfer, AR rendering or Air Handoff.

## Product paths

- Personal Harbor → Sessions & Devices → Connect your Voyage devices.
- The live Chronicle Journal → Devices.
- `/account/devices?voyage=<id>` selects the current Voyage.
- `/devices/pair#code=<opaque-code>` receives the QR deep link. The credential remains in the fragment, never the server URL, and is removed after successful confirmation.
- A receiver without a valid sign-in gets the ordinary Wayfarer sign-in path with a token-free return destination and a bounded tab-local pending credential. Pairing never creates a login, account, Player, membership or progression event.

A Player names the browser surface, chooses their Voyage, and selects **Use this device**. **Connect another device** produces a QR and human-enterable code for the requested companion role. The receiving device signs in as that same person and confirms **Join this Voyage**. Both devices show the connected surface and its role. Removing a surface leaves the Voyage unchanged.

Roles are presentation intentions. Chronicle Lens and other spatial/rendering behavior remains with the receiving project and later phases; the UI explicitly explains that boundary rather than presenting a simulated lens as finished.

## Requirement implementation

| Phase 1 obligation                                   | Implementation and proof                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain foundation and separate surface participation | `src/crossdeck/contracts.ts`; unique surface UUID plus independent surface-session ID                                                                            |
| Canonical AccountSession binding                     | Foreign key to Wayfarer AccountSession; all operations recheck current session/account/membership authority                                                      |
| One person and one Voyage                            | Foreign key to existing membership; same-account challenge claim; no identity or progression writes                                                              |
| QR and manual code                                   | Opaque 48-bit random code, 12 hexadecimal characters, QR fragment deep link, keyboard form confirmation                                                          |
| One-time challenges                                  | SHA-256 domain-separated storage; two-minute maximum validity; atomic conditional consumption in the same transaction as receiver creation                       |
| Challenge scope                                      | Source participation binds exact person, Voyage, requesting sign-in and requested role; optional submitted Voyage mismatch fails closed                          |
| Active surface registry                              | Durable database records shared across application workers; account-restricted no-store enumeration                                                              |
| Role assignment                                      | Complete initial role vocabulary; Captain auxiliary requires current Captain authority; Creator preview is explicitly unavailable pending its authoring policy   |
| Sextant capability seam                              | Privacy-safe capability-state projection accepts Sextant discovery results; missing providers stay unknown; browser only contributes layout/reduced-motion hints |
| Lifecycle and presence                               | Active/background/locked/sleeping/degraded/disconnected vocabulary; 15-second heartbeat; 45-second stale cutoff; page-hide disconnect and reconnect refresh      |
| Surface and sign-in revocation                       | Explicit removal invalidates participation and challenges; live parent session/account/member checks immediately invalidate access and exclude revoked surfaces  |
| Simple devices UI                                    | Harbor and Journal entry points; small live indicator; responsive device cards, matching pairing confirmation, accessible forms and role controls                |
| Shared Device Lab D0/D1                              | Two existing Crossdeck scenario declarations receive executable owner packs using the shared runner and source-bound receipts                                    |

## Security and identity rules

Crossdeck never reads network adjacency as trust and never performs device fingerprinting. Surface role names do not grant account permissions. Every mutation passes through ordinary Wayfarer CSRF validation. Unknown, expired, used, wrong-person and wrong-Voyage codes return a bounded rejection; code plaintext is never stored in the database. Pairing requests are account-rate-limited through the existing platform limiter. The 48-bit code remains infeasible to exhaust during its two-minute window even across workers; rate limiting is additional defense, not the sole entropy defense.

New source challenges require fresh active presence. Receiver creation rechecks source authority and consumes the challenge atomically, so concurrent claims cannot both succeed. A failed transaction rolls back consumption. Surface participation expires no later than its receiving AccountSession or 24 hours. The underlying membership and Voyage expiration are also checked at use time. Revocation denies server operations immediately; a visible browser updates on its next heartbeat, normally within 15 seconds. Background browsers may be throttled and are never described as guaranteed immediate consumers.

Only same-person devices are enumerated. Summaries omit AccountSession IDs, authentication tokens, CSRF secrets of other sessions, hashes, account details, device fingerprints and Chronicle content. The current request receives only its own CSRF token. A capability report is a presentation hint, never permission or evidence of physical hardware qualification. No sensor or camera is activated by pairing.

Expired and revoked participation records are removed after a seven-day grace period on a later authenticated owner operation. Challenges are bounded to one per source, replaced on regeneration and cascade with participation deletion. This is opportunistic retention, not a claim of a background purge scheduler.

## Data and deployment

Both Prisma schemas add `CrossdeckSurfaceSession` and `CrossdeckPairingChallenge`. SQLite migration `202610100001_crossdeck_phase1` and MySQL migration `0069_crossdeck_phase1` are additive. Capability JSON uses MySQL LONGTEXT rather than a short default VARCHAR. Apply the appropriate migration through the existing deployment process before enabling these routes on a deployed database. Missing tables fail with a bounded service-unavailable response rather than creating an in-memory alternate registry.

The SQLite migration rehearsal checks real SQL creation, long payload storage, challenge uniqueness, AccountSession cascade deletion and foreign-key integrity. Service tests use isolated SQLite databases and the actual generated Prisma client. MySQL DDL is generated from the MySQL datamodel and its LONGTEXT default is normalized to the [required MySQL 8.0.13+ expression syntax](https://dev.mysql.com/doc/refman/8.0/en/data-type-defaults.html); physical MySQL migration execution must be stated separately from SQLite evidence.

## Verification and limits

Focused service/API tests cover identity cardinality, replay, wrong account/Voyage, challenge expiry/replacement, competing claims, heartbeat attribution, role escalation, background/stale/reconnect, revocation, membership removal, account suspension, surface removal, strict input and capability projection, CSRF boundary, rate limiting and private errors.

D0 adapters execute the real service/database seam with synthetic people and clocks. D1 adapters execute production Next routes and React UI in separate desktop/mobile Chromium contexts, including signed-out QR return without credentials in sign-in URLs, keyboard pairing, responsive layout, accessibility, lifecycle loss, removal, sign-in revocation and Journal reachability. Both use the shared Device Lab runner with actual source fingerprints, protected-contract assertions and owned cleanup. D1 is browser emulation; it does not qualify physical iPhone/Android cameras, native app behavior, magnetic sensors, gestures or a field pairing experience.

Phase 2 remains the owner of synchronization, focus/custody and manual handoff. D4/D5 real-device and field gates remain explicit future obligations. No phase-level software receipt closes those physical gates or completes the six-phase Crossdeck program.

## Focused verification receipt

| Check                                           | Result                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------ |
| Real SQLite service/API tests                   | 18 passed, including both shared D0 scenarios                                        |
| Shared D1 desktop–phone and disconnect journeys | 2 passed in Chromium with a 390 × 844 receiving viewport                             |
| Signed-out QR return                            | Passed; sign-in destination contains no pairing credential                           |
| Keyboard and mobile accessibility               | Passed; no serious/critical Axe findings in the device panel; no horizontal overflow |
| Mobile visual review                            | Reviewed rendered product screenshot; corrected mobile card spacing                  |
| SQLite migration rehearsal                      | Passed storage, uniqueness, cascade and foreign-key checks                           |
| Changed-feature TypeScript and lint             | Passed focused checks; repository-wide qualification belongs to Sounding Line        |
| MySQL execution                                 | Not physically executed; additive DDL generated from the validated MySQL schema      |
| Physical D4/D5                                  | Not claimed; later-phase gates                                                       |

The shared runner emits source-bound D0/D1 JSON receipts under `artifacts/crossdeck-device-lab`. Browser screenshots are owned test artifacts; automatic traces and videos are disabled so pairing credentials are not captured. The ordinary Sounding Line PR result is the authoritative protected-main software receipt.

## Owner walkthrough

Product state is **READY FOR OWNER WALKTHROUGH**. The [Global Product Governance Standard](../../Governance/Voyagewright_Global_Product_Governance_Standard.md) requires a running-product owner walkthrough before `PRODUCT_ACCEPTED`; passing automation does not supply that acceptance.

1. Sign in on desktop and phone with the same existing Wayfarer account and an existing eligible Voyage.
2. On desktop, open Personal Harbor → Sessions & Devices → Connect your Voyage devices. Select the Voyage, name the screen, and use this device.
3. Choose the companion role, generate a code, and scan the QR or enter the code on the phone. Confirm joining and inspect matching confirmation on both screens.
4. Continue the Voyage on the phone, open the Journal's Devices entry, and verify the same two surfaces remain attached to the same person and Voyage.
5. Leave the phone page, inspect disconnected/stale presence, remove its surface, and confirm it cannot revive that removed participation. Revoke its ordinary sign-in from Sessions & Devices and confirm access is denied.

Pairing/continuity may be accepted for Phase 1 without claiming later synchronization, spatial rendering or gesture transfer. Owner acceptance must be recorded separately rather than inferred from this implementation record.

## Rollback and continuation

Remove the product entry points/routes with an ordinary reviewed revert if rollback is needed. Preserve the additive tables until retention and dependency review allows removal; there are no canonical identity/progression writes to reverse. Revoking ordinary sign-ins remains effective independently of Crossdeck code. Future synchronization must consume these surface-session IDs and live authority checks rather than creating a competing person, membership or progression engine.

Protected-main completion requires the ordinary Sounding Line check and a landed-tree smoke check. The completion receipt records that result after it is actually known.
